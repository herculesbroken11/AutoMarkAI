/**
 * Approval Actions
 * Phase 1: Backend-Enforced Approval
 * 
 * Server actions for approving/rejecting posts with backend validation
 */

'use server';

import { adminFirestore, isAdminSDKAvailable } from '@/firebase/admin';
import { isValidTransition, mapLegacyStatus, INVALID_STATE_TRANSITION_ERROR, PostStatus } from '@/lib/post-status';
import { logAuditEntry } from '@/lib/audit-log';
import { revalidatePath } from 'next/cache';

// Helper to ensure Admin SDK is available
function ensureAdminSDK() {
  if (!isAdminSDKAvailable() || !adminFirestore) {
    throw new Error(
      "Firebase Admin SDK is not configured. " +
      "Please set up credentials: GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_ADMIN_SERVICE_ACCOUNT"
    );
  }
  return adminFirestore;
}

/**
 * Approve a single post (move to APPROVED)
 * Backend-validated: ensures status transition is valid.
 * Phase 1 flow: NEEDS_APPROVAL → APPROVED; scheduling with a time later moves to SCHEDULED.
 */
export async function approvePostAction(
  postId: string,
  actor: string = 'system'
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const db = ensureAdminSDK();
    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    
    if (!postSnap.exists) {
      return { success: false, error: 'Post not found' };
    }
    
    const postData = postSnap.data();
    const currentStatus = mapLegacyStatus(postData?.status || 'DRAFT');
    
    // Validate transition: NEEDS_APPROVAL → APPROVED (not SCHEDULED)
    if (!isValidTransition(currentStatus, 'APPROVED')) {
      const error = `${INVALID_STATE_TRANSITION_ERROR}: Cannot transition from ${currentStatus} to APPROVED`;
      
      await logAuditEntry({
        timestamp_utc: new Date().toISOString(),
        actor,
        platform: postData?.platform || 'unknown',
        content_id: postId,
        action: 'blocked',
        reason: error,
      });
      
      return { success: false, error };
    }
    
    await postRef.update({
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedBy: actor,
    });
    
    await logAuditEntry({
      timestamp_utc: new Date().toISOString(),
      actor,
      platform: postData?.platform || 'unknown',
      content_id: postId,
      action: 'attempt_publish',
      reason: 'Post approved',
    });
    
    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Post approved' };
  } catch (error: any) {
    console.error('[APPROVAL_ACTION] Error approving post:', error);
    return { success: false, error: error.message || 'Failed to approve post' };
  }
}

/**
 * Approve multiple posts (batch)
 * Backend-validated: ensures all transitions are valid
 */
export async function approvePostsBatchAction(
  postIds: string[],
  actor: string = 'system'
): Promise<{ success: boolean; error?: string; message?: string; approved: number; failed: number }> {
  try {
    const db = ensureAdminSDK();
    const batch = db.batch();
    let approved = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Validate all posts first; transition NEEDS_APPROVAL → APPROVED
    for (const postId of postIds) {
      const postRef = db.collection('posts').doc(postId);
      const postSnap = await postRef.get();
      
      if (!postSnap.exists) {
        failed++;
        errors.push(`Post ${postId} not found`);
        continue;
      }
      
      const postData = postSnap.data();
      const currentStatus = mapLegacyStatus(postData?.status || 'DRAFT');
      
      if (!isValidTransition(currentStatus, 'APPROVED')) {
        failed++;
        errors.push(`Post ${postId}: Invalid transition from ${currentStatus} to APPROVED`);
        continue;
      }
      
      batch.update(postRef, {
        status: 'APPROVED',
        approvedAt: new Date().toISOString(),
        approvedBy: actor,
      });
      approved++;
    }
    
    if (approved > 0) {
      await batch.commit();
      
      for (const postId of postIds) {
        const postRef = db.collection('posts').doc(postId);
        const postSnap = await postRef.get();
        if (postSnap.exists) {
          const postData = postSnap.data();
          await logAuditEntry({
            timestamp_utc: new Date().toISOString(),
            actor,
            platform: postData.platform || 'unknown',
            content_id: postId,
            action: 'attempt_publish',
            reason: 'Post approved (batch)',
          });
        }
      }
    }
    
    revalidatePath('/dashboard/schedule');
    
    return {
      success: approved > 0,
      error: failed > 0 ? errors.join('; ') : undefined,
      message: `Approved ${approved} post(s)${failed > 0 ? `, ${failed} failed` : ''}`,
      approved,
      failed,
    };
  } catch (error: any) {
    console.error('[APPROVAL_ACTION] Error batch approving posts:', error);
    return { success: false, error: error.message || 'Failed to approve posts', approved: 0, failed: postIds.length };
  }
}

/**
 * Reject a post (move to REJECTED)
 * Backend-validated: ensures status transition is valid
 */
export async function rejectPostAction(
  postId: string,
  actor: string = 'system',
  reason?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const db = ensureAdminSDK();
    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    
    if (!postSnap.exists) {
      return { success: false, error: 'Post not found' };
    }
    
    const postData = postSnap.data();
    const currentStatus = mapLegacyStatus(postData?.status || 'DRAFT');
    
    // Validate transition
    if (!isValidTransition(currentStatus, 'REJECTED')) {
      const error = `${INVALID_STATE_TRANSITION_ERROR}: Cannot transition from ${currentStatus} to REJECTED`;
      
      await logAuditEntry({
        timestamp_utc: new Date().toISOString(),
        actor,
        platform: postData?.platform || 'unknown',
        content_id: postId,
        action: 'blocked',
        reason: error,
      });
      
      return { success: false, error };
    }
    
    // Update status
    await postRef.update({
      status: 'REJECTED',
      rejectedAt: new Date().toISOString(),
      rejectedBy: actor,
      rejectionReason: reason,
    });
    
    // Log rejection
    await logAuditEntry({
      timestamp_utc: new Date().toISOString(),
      actor,
      platform: postData.platform || 'unknown',
      content_id: postId,
      action: 'blocked',
      reason: reason || 'Post rejected by admin',
    });
    
    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Post rejected' };
  } catch (error: any) {
    console.error('[APPROVAL_ACTION] Error rejecting post:', error);
    return { success: false, error: error.message || 'Failed to reject post' };
  }
}

/**
 * Schedule a post (set scheduledAt in UTC and move to SCHEDULED)
 * Backend-validated: ensures status transition is valid
 * @param scheduledAtUTC - ISO string in UTC
 */
export async function schedulePostAction(
  postId: string,
  scheduledAtUTC: string,
  actor: string = 'system'
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const db = ensureAdminSDK();
    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    
    if (!postSnap.exists) {
      return { success: false, error: 'Post not found' };
    }
    
    const postData = postSnap.data();
    const currentStatus = mapLegacyStatus(postData?.status || 'DRAFT');
    
    // Validate transition: APPROVED → SCHEDULED (or SCHEDULED → SCHEDULED to update time)
    if (!isValidTransition(currentStatus, 'SCHEDULED')) {
      const error = `${INVALID_STATE_TRANSITION_ERROR}: Cannot transition from ${currentStatus} to SCHEDULED`;
      
      await logAuditEntry({
        timestamp_utc: new Date().toISOString(),
        actor,
        platform: postData?.platform || 'unknown',
        content_id: postId,
        action: 'blocked',
        reason: error,
      });
      
      return { success: false, error };
    }
    
    // Update status and scheduledAt (stored in UTC)
    await postRef.update({
      status: 'SCHEDULED',
      scheduledAt: scheduledAtUTC, // Already in UTC
      scheduledBy: actor,
    });
    
    await logAuditEntry({
      timestamp_utc: new Date().toISOString(),
      actor,
      platform: postData?.platform || 'unknown',
      content_id: postId,
      action: 'scheduled',
      reason: `Post scheduled for ${scheduledAtUTC} (UTC)`,
    });
    
    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Post scheduled successfully' };
  } catch (error: any) {
    console.error('[SCHEDULE_ACTION] Error scheduling post:', error);
    return { success: false, error: error.message || 'Failed to schedule post' };
  }
}

/**
 * Return post to NEEDS_APPROVAL (from REJECTED or SCHEDULED)
 * Backend-validated: ensures status transition is valid
 */
export async function returnToPendingAction(
  postId: string,
  actor: string = 'system'
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const db = ensureAdminSDK();
    const postRef = db.collection('posts').doc(postId);
    const postSnap = await postRef.get();
    
    if (!postSnap.exists) {
      return { success: false, error: 'Post not found' };
    }
    
    const postData = postSnap.data();
    const currentStatus = mapLegacyStatus(postData?.status || 'DRAFT');
    
    // Validate transition
    if (!isValidTransition(currentStatus, 'NEEDS_APPROVAL')) {
      const error = `${INVALID_STATE_TRANSITION_ERROR}: Cannot transition from ${currentStatus} to NEEDS_APPROVAL`;
      
      await logAuditEntry({
        timestamp_utc: new Date().toISOString(),
        actor,
        platform: postData?.platform || 'unknown',
        content_id: postId,
        action: 'blocked',
        reason: error,
      });
      
      return { success: false, error };
    }
    
    // Update status (use legacy 'pending' for backward compatibility)
    await postRef.update({
      status: 'pending', // Legacy status, maps to NEEDS_APPROVAL
    });
    
    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Post returned to pending approval' };
  } catch (error: any) {
    console.error('[APPROVAL_ACTION] Error returning post to pending:', error);
    return { success: false, error: error.message || 'Failed to return post to pending' };
  }
}
