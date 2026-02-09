/**
 * Posting Caps and Throttling
 * Phase 1: Rate limits, cooldowns, and automatic pause on cap exceeded
 */

import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { adminFirestore, isAdminSDKAvailable } from '@/firebase/admin';
import { logBlockedPublish } from './audit-log';

export const RATE_CAP_EXCEEDED_ERROR = 'RATE_CAP_EXCEEDED';
export const COOLDOWN_ACTIVE_ERROR = 'COOLDOWN_ACTIVE';

interface PlatformCaps {
  maxPerHour: number;
  maxPerDay: number;
  cooldownMinutes: number;
}

interface RateCapSettings {
  platforms: {
    instagram?: PlatformCaps;
    facebook?: PlatformCaps;
    youtube?: PlatformCaps;
    tiktok?: PlatformCaps;
  };
  autoPauseOnCap: boolean;
  alertOnCap: boolean;
}

const DEFAULT_CAPS: PlatformCaps = {
  maxPerHour: 5,
  maxPerDay: 20,
  cooldownMinutes: 10,
};

/**
 * Get rate cap settings from Firestore
 */
export async function getRateCapSettings(): Promise<RateCapSettings> {
  try {
    // Use Admin SDK if available (for server-side calls like cron jobs)
    if (isAdminSDKAvailable() && adminFirestore) {
      const docSnap = await adminFirestore.collection('system_settings').doc('rate_caps').get();
      
      if (!docSnap.exists) {
        // Return default settings
        return {
          platforms: {
            instagram: DEFAULT_CAPS,
            facebook: DEFAULT_CAPS,
            youtube: DEFAULT_CAPS,
            tiktok: DEFAULT_CAPS,
          },
          autoPauseOnCap: true,
          alertOnCap: true,
        };
      }
      
      const data = docSnap.data();
      return {
        platforms: data?.platforms || {},
        autoPauseOnCap: data?.autoPauseOnCap !== false,
        alertOnCap: data?.alertOnCap !== false,
      };
    }
    
    // Fallback to Client SDK (for client-side calls)
    const settingsRef = doc(galleryFirestore, 'system_settings', 'rate_caps');
    const docSnap = await getDoc(settingsRef);
    
    if (!docSnap.exists()) {
      // Return default settings
      return {
        platforms: {
          instagram: DEFAULT_CAPS,
          facebook: DEFAULT_CAPS,
          youtube: DEFAULT_CAPS,
          tiktok: DEFAULT_CAPS,
        },
        autoPauseOnCap: true,
        alertOnCap: true,
      };
    }
    
    const data = docSnap.data();
    return {
      platforms: data.platforms || {},
      autoPauseOnCap: data.autoPauseOnCap !== false,
      alertOnCap: data.alertOnCap !== false,
    };
  } catch (error) {
    console.error('[RATE_CAPS] Error getting rate cap settings:', error);
    // Return defaults on error
    return {
      platforms: {
        instagram: DEFAULT_CAPS,
        facebook: DEFAULT_CAPS,
        youtube: DEFAULT_CAPS,
        tiktok: DEFAULT_CAPS,
      },
      autoPauseOnCap: true,
      alertOnCap: true,
    };
  }
}

/**
 * Check if platform posting is within rate caps
 */
export async function checkRateCaps(platform: string): Promise<{
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
}> {
  try {
    const settings = await getRateCapSettings();
    const platformCaps = settings.platforms[platform as keyof typeof settings.platforms];
    
    if (!platformCaps) {
      // No caps configured for this platform - allow
      return { allowed: true };
    }
    
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Use Admin SDK if available (for server-side calls like cron jobs)
    if (isAdminSDKAvailable() && adminFirestore) {
      // Note: timestamp_utc is stored as ISO string in audit_logs
      const oneHourAgoISO = oneHourAgo.toISOString();
      const oneDayAgoISO = oneDayAgo.toISOString();
      
      // Check posts in last hour
      const hourSnapshot = await adminFirestore
        .collection('audit_logs')
        .where('platform', '==', platform)
        .where('action', '==', 'posted')
        .where('timestamp_utc', '>=', oneHourAgoISO)
        .get();
      const postsLastHour = hourSnapshot.size;
      
      if (postsLastHour >= platformCaps.maxPerHour) {
        const nextAllowed = new Date(now.getTime() + 60 * 60 * 1000);
        return {
          allowed: false,
          reason: `Hourly cap exceeded: ${postsLastHour}/${platformCaps.maxPerHour} posts`,
          nextAllowedAt: nextAllowed,
        };
      }
      
      // Check posts in last day
      const daySnapshot = await adminFirestore
        .collection('audit_logs')
        .where('platform', '==', platform)
        .where('action', '==', 'posted')
        .where('timestamp_utc', '>=', oneDayAgoISO)
        .get();
      const postsLastDay = daySnapshot.size;
      
      if (postsLastDay >= platformCaps.maxPerDay) {
        const nextAllowed = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return {
          allowed: false,
          reason: `Daily cap exceeded: ${postsLastDay}/${platformCaps.maxPerDay} posts`,
          nextAllowedAt: nextAllowed,
        };
      }
      
      // Check cooldown (time since last post)
      const lastPostSnapshot = await adminFirestore
        .collection('audit_logs')
        .where('platform', '==', platform)
        .where('action', '==', 'posted')
        .orderBy('timestamp_utc', 'desc')
        .limit(1)
        .get();
      
      if (!lastPostSnapshot.empty) {
        const lastPost = lastPostSnapshot.docs[0].data();
        const lastPostTime = new Date(lastPost.timestamp_utc);
        const minutesSinceLastPost = (now.getTime() - lastPostTime.getTime()) / (60 * 1000);
        
        if (minutesSinceLastPost < platformCaps.cooldownMinutes) {
          const nextAllowed = new Date(lastPostTime.getTime() + platformCaps.cooldownMinutes * 60 * 1000);
          return {
            allowed: false,
            reason: `Cooldown active: ${Math.ceil(platformCaps.cooldownMinutes - minutesSinceLastPost)} minutes remaining`,
            nextAllowedAt: nextAllowed,
          };
        }
      }
    } else {
      // Fallback to Client SDK (for client-side calls)
      // Check posts in last hour
      const hourQuery = query(
        collection(galleryFirestore, 'audit_logs'),
        where('platform', '==', platform),
        where('action', '==', 'posted'),
        where('timestamp_utc', '>=', Timestamp.fromDate(oneHourAgo))
      );
      const hourSnapshot = await getDocs(hourQuery);
      const postsLastHour = hourSnapshot.size;
      
      if (postsLastHour >= platformCaps.maxPerHour) {
        const nextAllowed = new Date(now.getTime() + 60 * 60 * 1000);
        return {
          allowed: false,
          reason: `Hourly cap exceeded: ${postsLastHour}/${platformCaps.maxPerHour} posts`,
          nextAllowedAt: nextAllowed,
        };
      }
      
      // Check posts in last day
      const dayQuery = query(
        collection(galleryFirestore, 'audit_logs'),
        where('platform', '==', platform),
        where('action', '==', 'posted'),
        where('timestamp_utc', '>=', Timestamp.fromDate(oneDayAgo))
      );
      const daySnapshot = await getDocs(dayQuery);
      const postsLastDay = daySnapshot.size;
      
      if (postsLastDay >= platformCaps.maxPerDay) {
        const nextAllowed = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return {
          allowed: false,
          reason: `Daily cap exceeded: ${postsLastDay}/${platformCaps.maxPerDay} posts`,
          nextAllowedAt: nextAllowed,
        };
      }
      
      // Check cooldown (time since last post)
      const lastPostQuery = query(
        collection(galleryFirestore, 'audit_logs'),
        where('platform', '==', platform),
        where('action', '==', 'posted'),
        where('timestamp_utc', '<=', Timestamp.fromDate(now))
      );
      const lastPostSnapshot = await getDocs(lastPostQuery);
      
      if (!lastPostSnapshot.empty) {
        const lastPost = lastPostSnapshot.docs
          .map(doc => doc.data())
          .sort((a, b) => {
            const aTime = a.timestamp_utc?.toDate?.() || new Date(0);
            const bTime = b.timestamp_utc?.toDate?.() || new Date(0);
            return bTime.getTime() - aTime.getTime();
          })[0];
        
        const lastPostTime = lastPost.timestamp_utc?.toDate?.() || new Date(0);
        const minutesSinceLastPost = (now.getTime() - lastPostTime.getTime()) / (60 * 1000);
        
        if (minutesSinceLastPost < platformCaps.cooldownMinutes) {
          const nextAllowed = new Date(lastPostTime.getTime() + platformCaps.cooldownMinutes * 60 * 1000);
          return {
            allowed: false,
            reason: `Cooldown active: ${Math.ceil(platformCaps.cooldownMinutes - minutesSinceLastPost)} minutes remaining`,
            nextAllowedAt: nextAllowed,
          };
        }
      }
    }
    
    return { allowed: true };
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string; details?: string };
    const message = err?.message ?? String(error);
    const details = err?.details ?? '';
    const isIndexError =
      err?.code === 9 ||
      /index|FAILED_PRECONDITION|requires an index/i.test(message) ||
      /index|requires an index/i.test(details);

    if (isIndexError) {
      console.warn('[RATE_CAPS] Missing Firestore index for rate cap queries. Failing open. Create index:', details || message);
    } else {
      console.error('[RATE_CAPS] Error checking rate caps:', error);
    }
    // Fail open: allow posting when rate cap check fails (missing index or any error)
    return { allowed: true };
  }
}

/**
 * Auto-pause platform if cap exceeded
 */
export async function autoPausePlatformIfNeeded(platform: string, reason: string): Promise<void> {
  try {
    const settings = await getRateCapSettings();
    
    if (!settings.autoPauseOnCap) {
      return; // Auto-pause disabled
    }
    
    // Update platform settings to disable it
    const platformSettingsRef = doc(galleryFirestore, 'system_settings', 'platforms');
    const platformSettingsSnap = await getDoc(platformSettingsRef);
    
    const currentSettings = platformSettingsSnap.exists() ? platformSettingsSnap.data() : {};
    const platforms = currentSettings.platforms || {};
    
    platforms[platform] = {
      ...platforms[platform],
      enabled: false,
      autoPausedAt: new Date().toISOString(),
      autoPausedReason: reason,
    };
    
    await setDoc(platformSettingsRef, {
      platforms,
      last_updated: new Date().toISOString(),
    }, { merge: true });
    
    console.warn(`[RATE_CAPS] Auto-paused platform ${platform} due to: ${reason}`);
    
    // Log the auto-pause
    await logBlockedPublish({
      actor: 'system:rate-caps',
      platform,
      reason: `AUTO_PAUSED: ${reason}`,
    });
  } catch (error) {
    console.error('[RATE_CAPS] Error auto-pausing platform:', error);
  }
}
