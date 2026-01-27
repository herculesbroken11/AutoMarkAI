/**
 * Posting Control Utilities
 * Phase 1: Global Kill Switch Implementation
 */

import { doc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

export const POSTING_PAUSED_ERROR = 'POSTING_PAUSED_SYSTEM_LOCK';

/**
 * Check if posting is paused globally
 * @returns Promise<boolean> - true if posting is paused, false if allowed
 */
export async function isPostingPaused(): Promise<boolean> {
  try {
    const settingsRef = doc(galleryFirestore, 'system_settings', 'posting');
    const docSnap = await getDoc(settingsRef);
    
    if (!docSnap.exists()) {
      // Default to false (posting allowed) if settings don't exist
      return false;
    }
    
    const data = docSnap.data();
    return data.posting_paused === true;
  } catch (error) {
    console.error('[POSTING_CONTROL] Error checking posting status:', error);
    // On error, default to paused for safety
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
    const settingsRef = doc(galleryFirestore, 'system_settings', 'posting');
    const docSnap = await getDoc(settingsRef);
    
    if (!docSnap.exists()) {
      return {
        posting_paused: false,
      };
    }
    
    const data = docSnap.data();
    return {
      posting_paused: data.posting_paused === true,
      paused_at: data.paused_at,
      paused_by: data.paused_by,
      paused_reason: data.paused_reason,
      last_updated: data.last_updated,
    };
  } catch (error) {
    console.error('[POSTING_CONTROL] Error getting posting settings:', error);
    return {
      posting_paused: true, // Default to paused on error for safety
    };
  }
}
