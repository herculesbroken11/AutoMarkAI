/**
 * Posting Control Utilities
 * Phase 1: Global Kill Switch + Per-Platform Toggles Implementation
 */

import { doc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { adminFirestore, isAdminSDKAvailable } from '@/firebase/admin';

export const POSTING_PAUSED_ERROR = 'POSTING_PAUSED_SYSTEM_LOCK';
export const PLATFORM_DISABLED_ERROR = 'PLATFORM_DISABLED';

async function getPostingDoc(): Promise<{ exists: boolean; data?: Record<string, unknown> }> {
  if (isAdminSDKAvailable() && adminFirestore) {
    const docSnap = await adminFirestore.collection('system_settings').doc('posting').get();
    return { exists: docSnap.exists, data: docSnap.data() as Record<string, unknown> | undefined };
  }
  const settingsRef = doc(galleryFirestore, 'system_settings', 'posting');
  const docSnap = await getDoc(settingsRef);
  return { exists: docSnap.exists(), data: docSnap.data() as Record<string, unknown> | undefined };
}

/**
 * Check if posting is paused globally
 * @returns Promise<boolean> - true if posting is paused, false if allowed
 */
export async function isPostingPaused(): Promise<boolean> {
  try {
    const { exists, data } = await getPostingDoc();
    if (!exists || !data) return false;
    return data.posting_paused === true;
  } catch (error) {
    console.error('[POSTING_CONTROL] Error checking posting status:', error);
    return true;
  }
}

/**
 * Get posting control settings
 * @returns Promise with posting_paused status and metadata
 */
export async function getPostingSettings(): Promise<{
  posting_paused: boolean;
  paused_at?: string;
  paused_by?: string;
  paused_reason?: string;
  last_updated?: string;
}> {
  try {
    const { exists, data } = await getPostingDoc();
    if (!exists || !data) return { posting_paused: false };
    return {
      posting_paused: data.posting_paused === true,
      paused_at: data.paused_at as string | undefined,
      paused_by: data.paused_by as string | undefined,
      paused_reason: data.paused_reason as string | undefined,
      last_updated: data.last_updated as string | undefined,
    };
  } catch (error) {
    console.error('[POSTING_CONTROL] Error getting posting settings:', error);
    return { posting_paused: true };
  }
}

async function getPlatformsDoc(): Promise<{ exists: boolean; data?: Record<string, unknown> }> {
  if (isAdminSDKAvailable() && adminFirestore) {
    const docSnap = await adminFirestore.collection('system_settings').doc('platforms').get();
    return { exists: docSnap.exists, data: docSnap.data() as Record<string, unknown> | undefined };
  }
  const ref = doc(galleryFirestore, 'system_settings', 'platforms');
  const docSnap = await getDoc(ref);
  return { exists: docSnap.exists(), data: docSnap.data() as Record<string, unknown> | undefined };
}

/**
 * Check if a specific platform is enabled
 * @param platform - Platform name (instagram, facebook, youtube, tiktok)
 * @returns Promise<boolean> - true if platform is enabled, false if disabled
 */
export async function isPlatformEnabled(platform: string): Promise<boolean> {
  try {
    if (await isPostingPaused()) return false;

    const { exists, data } = await getPlatformsDoc();
    if (!exists || !data) return true;

    const platforms = (data.platforms || {}) as Record<string, { enabled?: boolean }>;
    const platformConfig = platforms[platform.toLowerCase()];
    if (!platformConfig) return true;

    return platformConfig.enabled !== false;
  } catch (error) {
    console.error('[POSTING_CONTROL] Error checking platform status:', error);
    return false;
  }
}

/**
 * Get all platform settings
 */
export async function getPlatformSettings(): Promise<{
  [platform: string]: {
    enabled: boolean;
    autoPausedAt?: string;
    autoPausedReason?: string;
    pausedAt?: string;
    pausedBy?: string;
    pausedReason?: string;
  };
}> {
  try {
    const { exists, data } = await getPlatformsDoc();
    if (!exists || !data) return {};
    return (data.platforms || {}) as ReturnType<typeof getPlatformSettings> extends Promise<infer R> ? R : never;
  } catch (error) {
    console.error('[POSTING_CONTROL] Error getting platform settings:', error);
    return {};
  }
}
