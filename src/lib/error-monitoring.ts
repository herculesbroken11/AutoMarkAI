/**
 * Error Monitoring and Automatic Fallback Triggers
 * Phase 1: Monitor error rates and auto-pause on threshold exceeded
 */

import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp, orderBy, limit } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { adminFirestore, isAdminSDKAvailable } from '@/firebase/admin';
import { logBlockedPublish } from './audit-log';

export interface ErrorMonitoringSettings {
  errorRateThreshold: number; // Errors per hour before auto-pause
  errorWindowMinutes: number; // Time window for error rate calculation
  autoPauseOnError: boolean;
  alertOnError: boolean;
  platforms: {
    [platform: string]: {
      errorCount: number;
      lastErrorAt?: string;
      autoPausedAt?: string;
      autoPausedReason?: string;
    };
  };
}

const DEFAULT_SETTINGS: ErrorMonitoringSettings = {
  errorRateThreshold: 5, // 5 errors per hour
  errorWindowMinutes: 60,
  autoPauseOnError: true,
  alertOnError: true,
  platforms: {},
};

/**
 * Get error monitoring settings
 */
export async function getErrorMonitoringSettings(): Promise<ErrorMonitoringSettings> {
  try {
    // Use Admin SDK if available (for server-side calls like cron jobs)
    if (isAdminSDKAvailable() && adminFirestore) {
      const docSnap = await adminFirestore.collection('system_settings').doc('error_monitoring').get();
      
      if (!docSnap.exists) {
        return DEFAULT_SETTINGS;
      }
      
      const data = docSnap.data();
      return {
        errorRateThreshold: data?.errorRateThreshold || DEFAULT_SETTINGS.errorRateThreshold,
        errorWindowMinutes: data?.errorWindowMinutes || DEFAULT_SETTINGS.errorWindowMinutes,
        autoPauseOnError: data?.autoPauseOnError !== false,
        alertOnError: data?.alertOnError !== false,
        platforms: data?.platforms || {},
      };
    }
    
    // Fallback to Client SDK (for client-side calls)
    const settingsRef = doc(galleryFirestore, 'system_settings', 'error_monitoring');
    const docSnap = await getDoc(settingsRef);
    
    if (!docSnap.exists()) {
      return DEFAULT_SETTINGS;
    }
    
    const data = docSnap.data();
    return {
      errorRateThreshold: data.errorRateThreshold || DEFAULT_SETTINGS.errorRateThreshold,
      errorWindowMinutes: data.errorWindowMinutes || DEFAULT_SETTINGS.errorWindowMinutes,
      autoPauseOnError: data.autoPauseOnError !== false,
      alertOnError: data.alertOnError !== false,
      platforms: data.platforms || {},
    };
  } catch (error) {
    console.error('[ERROR_MONITORING] Error getting settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Record a publish error
 */
export async function recordPublishError(platform: string, error: string, contentId?: string): Promise<void> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // Last hour
    const windowStartISO = windowStart.toISOString();
    
    let errorCount = 1; // Start with 1 for current error
    
    // Use Admin SDK if available (for server-side calls like cron jobs)
    if (isAdminSDKAvailable() && adminFirestore) {
      // Count errors in the window
      const errorSnapshot = await adminFirestore
        .collection('audit_logs')
        .where('platform', '==', platform)
        .where('action', '==', 'failed')
        .where('timestamp_utc', '>=', windowStartISO)
        .orderBy('timestamp_utc', 'desc')
        .get();
      
      errorCount = errorSnapshot.size + 1; // +1 for current error
    } else {
      // Fallback to Client SDK (for client-side calls)
      const errorQuery = query(
        collection(galleryFirestore, 'audit_logs'),
        where('platform', '==', platform),
        where('action', '==', 'failed'),
        where('timestamp_utc', '>=', Timestamp.fromDate(windowStart)),
        orderBy('timestamp_utc', 'desc')
      );
      
      const errorSnapshot = await getDocs(errorQuery);
      errorCount = errorSnapshot.size + 1; // +1 for current error
    }
    
    // Get settings
    const settings = await getErrorMonitoringSettings();
    
    // Check if threshold exceeded
    if (errorCount >= settings.errorRateThreshold && settings.autoPauseOnError) {
      await autoPauseOnErrorThreshold(platform, errorCount, settings.errorRateThreshold, error);
    }
    
    // Update platform error tracking
    if (isAdminSDKAvailable() && adminFirestore) {
      const monitoringRef = adminFirestore.collection('system_settings').doc('error_monitoring');
      const monitoringSnap = await monitoringRef.get();
      const currentData = monitoringSnap.exists ? monitoringSnap.data() : DEFAULT_SETTINGS;
      const platforms = currentData?.platforms || {};
      
      platforms[platform] = {
        ...platforms[platform],
        errorCount,
        lastErrorAt: now.toISOString(),
      };
      
      await monitoringRef.set({
        ...currentData,
        platforms,
        last_updated: now.toISOString(),
      }, { merge: true });
    } else {
      // Fallback to Client SDK
      const monitoringRef = doc(galleryFirestore, 'system_settings', 'error_monitoring');
      const monitoringSnap = await getDoc(monitoringRef);
      const currentData = monitoringSnap.exists() ? monitoringSnap.data() : DEFAULT_SETTINGS;
      const platforms = currentData.platforms || {};
      
      platforms[platform] = {
        ...platforms[platform],
        errorCount,
        lastErrorAt: now.toISOString(),
      };
      
      await setDoc(monitoringRef, {
        ...currentData,
        platforms,
        last_updated: now.toISOString(),
      }, { merge: true });
    }
    
    console.warn(`[ERROR_MONITORING] Platform ${platform} error count: ${errorCount}/${settings.errorRateThreshold}`);
  } catch (error) {
    console.error('[ERROR_MONITORING] Error recording publish error:', error);
  }
}

/**
 * Auto-pause platform when error threshold exceeded
 */
async function autoPauseOnErrorThreshold(
  platform: string,
  errorCount: number,
  threshold: number,
  lastError: string
): Promise<void> {
  try {
    const reason = `Error rate threshold exceeded: ${errorCount} errors (threshold: ${threshold}/hour). Last error: ${lastError}`;
    
    // Use Admin SDK if available (for server-side calls like cron jobs)
    if (isAdminSDKAvailable() && adminFirestore) {
      const platformSettingsRef = adminFirestore.collection('system_settings').doc('platforms');
      const platformSettingsSnap = await platformSettingsRef.get();
      
      const currentSettings = platformSettingsSnap.exists ? platformSettingsSnap.data() : {};
      const platforms = currentSettings?.platforms || {};
      
      platforms[platform] = {
        ...platforms[platform],
        enabled: false,
        autoPausedAt: new Date().toISOString(),
        autoPausedReason: reason,
      };
      
      await platformSettingsRef.set({
        platforms,
        last_updated: new Date().toISOString(),
      }, { merge: true });
    } else {
      // Fallback to Client SDK (for client-side calls)
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
    }
    
    console.error(`[ERROR_MONITORING] Auto-paused platform ${platform} due to error threshold`);
    
    // Log the auto-pause
    await logBlockedPublish({
      actor: 'system:error-monitoring',
      platform,
      reason: `AUTO_PAUSED: ${reason}`,
    });
  } catch (error) {
    console.error('[ERROR_MONITORING] Error auto-pausing platform:', error);
  }
}

/**
 * Check authentication failures for a platform
 */
export async function checkAuthFailures(platform: string): Promise<{
  shouldPause: boolean;
  failureCount: number;
  reason?: string;
}> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // Last hour
    const windowStartISO = windowStart.toISOString();
    
    let authFailureCount = 0;
    
    // Use Admin SDK if available (for server-side calls like cron jobs)
    if (isAdminSDKAvailable() && adminFirestore) {
      // Look for authentication errors (checking for "Token" in reason)
      // Note: Firestore doesn't support substring queries easily, so we'll query all failed actions
      // and filter in memory, or use a simpler approach
      const authErrorSnapshot = await adminFirestore
        .collection('audit_logs')
        .where('platform', '==', platform)
        .where('action', '==', 'failed')
        .where('timestamp_utc', '>=', windowStartISO)
        .get();
      
      // Filter for token/auth related errors
      authFailureCount = authErrorSnapshot.docs.filter(doc => {
        const data = doc.data();
        const reason = data.reason || '';
        return reason.toLowerCase().includes('token') || 
               reason.toLowerCase().includes('auth') ||
               reason.toLowerCase().includes('access token') ||
               reason.toLowerCase().includes('unauthorized');
      }).length;
    } else {
      // Fallback to Client SDK (for client-side calls)
      // Look for authentication errors
      const authErrorQuery = query(
        collection(galleryFirestore, 'audit_logs'),
        where('platform', '==', platform),
        where('action', '==', 'failed'),
        where('reason', '>=', 'Token'),
        where('reason', '<=', 'Token\uf8ff'),
        where('timestamp_utc', '>=', Timestamp.fromDate(windowStart))
      );
      
      const authErrorSnapshot = await getDocs(authErrorQuery);
      authFailureCount = authErrorSnapshot.size;
    }
    
    // If 3+ auth failures in an hour, pause the platform
    if (authFailureCount >= 3) {
      return {
        shouldPause: true,
        failureCount: authFailureCount,
        reason: `Repeated authentication failures: ${authFailureCount} failures in the last hour`,
      };
    }
    
    return {
      shouldPause: false,
      failureCount: authFailureCount,
    };
  } catch (error) {
    console.error('[ERROR_MONITORING] Error checking auth failures:', error);
    return {
      shouldPause: false,
      failureCount: 0,
    };
  }
}

/**
 * Reset error count for a platform (after manual intervention)
 */
export async function resetPlatformErrorCount(platform: string): Promise<void> {
  try {
    // Use Admin SDK if available (for server-side calls like cron jobs)
    if (isAdminSDKAvailable() && adminFirestore) {
      const monitoringRef = adminFirestore.collection('system_settings').doc('error_monitoring');
      const monitoringSnap = await monitoringRef.get();
      const currentData = monitoringSnap.exists ? monitoringSnap.data() : DEFAULT_SETTINGS;
      const platforms = currentData?.platforms || {};
      
      platforms[platform] = {
        ...platforms[platform],
        errorCount: 0,
        // Don't set lastErrorAt to undefined - just omit it
      };
      
      // Remove lastErrorAt if it exists
      if (platforms[platform].lastErrorAt) {
        delete platforms[platform].lastErrorAt;
      }
      
      await monitoringRef.set({
        ...currentData,
        platforms,
        last_updated: new Date().toISOString(),
      }, { merge: true });
    } else {
      // Fallback to Client SDK (for client-side calls)
      const monitoringRef = doc(galleryFirestore, 'system_settings', 'error_monitoring');
      const monitoringSnap = await getDoc(monitoringRef);
      const currentData = monitoringSnap.exists() ? monitoringSnap.data() : DEFAULT_SETTINGS;
      const platforms = currentData.platforms || {};
      
      platforms[platform] = {
        ...platforms[platform],
        errorCount: 0,
      };
      
      // Remove lastErrorAt if it exists
      if (platforms[platform].lastErrorAt) {
        delete platforms[platform].lastErrorAt;
      }
      
      await setDoc(monitoringRef, {
        ...currentData,
        platforms,
        last_updated: new Date().toISOString(),
      }, { merge: true });
    }
  } catch (error) {
    console.error('[ERROR_MONITORING] Error resetting error count:', error);
  }
}
