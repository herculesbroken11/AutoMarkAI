/**
 * Duplicate Protection Utilities
 * Phase 1: Idempotency + Locking
 */

import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import crypto from 'crypto';

export const DUPLICATE_BLOCKED_ERROR = 'DUPLICATE_BLOCKED';

/**
 * Generate deterministic idempotency key
 * Format: sha256(content_id + platform + scheduled_at_utc + media_signature)
 */
export function generateIdempotencyKey(params: {
  content_id: string;
  platform: string;
  scheduled_at_utc?: string;
  media_signature?: string; // hash of media URL or file
}): string {
  const components = [
    params.content_id,
    params.platform,
    params.scheduled_at_utc || '',
    params.media_signature || '',
  ];
  
  const input = components.join('|');
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Check if a publish attempt already exists (duplicate check)
 */
export async function checkDuplicateAttempt(
  idempotencyKey: string
): Promise<{ isDuplicate: boolean; existingAttempt?: any }> {
  try {
    const attemptRef = doc(galleryFirestore, 'publish_attempts', idempotencyKey);
    const attemptSnap = await getDoc(attemptRef);
    
    if (attemptSnap.exists()) {
      return {
        isDuplicate: true,
        existingAttempt: attemptSnap.data(),
      };
    }
    
    return { isDuplicate: false };
  } catch (error) {
    console.error('[DUPLICATE_PROTECTION] Error checking duplicate:', error);
    // On error, assume not duplicate (fail open, but log)
    return { isDuplicate: false };
  }
}

/**
 * Record a publish attempt
 */
export async function recordPublishAttempt(params: {
  idempotencyKey: string;
  content_id: string;
  platform: string;
  status: 'attempting' | 'success' | 'failed';
  platform_post_id?: string;
  error?: string;
  actor: string;
}): Promise<void> {
  try {
    const attemptRef = doc(galleryFirestore, 'publish_attempts', params.idempotencyKey);
    
    await setDoc(attemptRef, {
      content_id: params.content_id,
      platform: params.platform,
      status: params.status,
      platform_post_id: params.platform_post_id,
      error: params.error,
      actor: params.actor,
      timestamp_utc: new Date().toISOString(),
      idempotency_key: params.idempotencyKey,
    }, { merge: true });
  } catch (error) {
    console.error('[DUPLICATE_PROTECTION] Error recording attempt:', error);
    // Don't throw - logging should not break main flow
  }
}

/**
 * Acquire a lock for publishing (prevents race conditions)
 * Lock expires after TTL (default 5 minutes)
 */
export async function acquirePublishLock(
  contentId: string,
  platform: string,
  ttlMinutes: number = 5
): Promise<{ acquired: boolean; lockId?: string }> {
  const lockId = `publish_${contentId}_${platform}`;
  const lockRef = doc(galleryFirestore, 'locks', lockId);
  
  try {
    return await runTransaction(galleryFirestore, async (transaction) => {
      const lockSnap = await transaction.get(lockRef);
      
      if (lockSnap.exists()) {
        const lockData = lockSnap.data();
        const lockTime = new Date(lockData.locked_at);
        const now = new Date();
        const lockAge = (now.getTime() - lockTime.getTime()) / 1000 / 60; // minutes
        
        // Check if lock expired
        if (lockAge < ttlMinutes) {
          // Lock still valid
          return { acquired: false };
        }
        // Lock expired, we can acquire it
      }
      
      // Acquire lock
      transaction.set(lockRef, {
        content_id: contentId,
        platform,
        locked_at: new Date().toISOString(),
        locked_by: 'system',
        ttl_minutes: ttlMinutes,
      });
      
      return { acquired: true, lockId };
    });
  } catch (error) {
    console.error('[DUPLICATE_PROTECTION] Error acquiring lock:', error);
    // On error, fail closed (don't allow publish)
    return { acquired: false };
  }
}

/**
 * Release a publish lock
 */
export async function releasePublishLock(lockId: string): Promise<void> {
  try {
    const lockRef = doc(galleryFirestore, 'locks', lockId);
    await setDoc(lockRef, {
      released_at: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error('[DUPLICATE_PROTECTION] Error releasing lock:', error);
  }
}

/**
 * Check if post already has platform_post_id (already posted)
 */
export async function checkAlreadyPosted(
  contentId: string
): Promise<{ alreadyPosted: boolean; platformPostId?: string }> {
  try {
    const postRef = doc(galleryFirestore, 'posts', contentId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      return { alreadyPosted: false };
    }
    
    const postData = postSnap.data();
    const platformPostId = postData.platformPostId || postData.platform_post_id;
    const status = postData.status;
    
    if (platformPostId || status === 'posted' || status === 'POSTED') {
      return {
        alreadyPosted: true,
        platformPostId,
      };
    }
    
    return { alreadyPosted: false };
  } catch (error) {
    console.error('[DUPLICATE_PROTECTION] Error checking if posted:', error);
    return { alreadyPosted: false };
  }
}
