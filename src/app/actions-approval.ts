/**
 * Approval Actions
 * Phase 1: Backend-Enforced Approval
 * 
 * Server actions for approving/rejecting posts with backend validation
 */

'use server';

import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { isValidTransition, mapLegacyStatus, INVALID_STATE_TRANSITION_ERROR, PostStatus } from '@/lib/post-status';
import { logAuditEntry } from '@/lib/audit-log';
import { revalidatePath } from 'next/cache';

/**
 * Approve a single post (move to SCHEDULED)
 * Backend-validated: ensures status transition is valid
 */
export async function approvePostAction(
  postId: string,
  actor: string = 'system'
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const postRef = doc(galleryFirestore, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      return { success: false, error: 'Post not found' };
    }
    
    const postData = postSnap.data();
    const currentStatus = mapLegacyStatus(postData.status || 'DRAFT');
    
    // Validate transition
    if (!isValidTransition(currentStatus, 'SCHEDULED')) {
      const error = `${INVALID_STATE_TRANSITION_ERROR}: Cannot transition from ${currentStatus} to SCHEDULED`;
      
      // Log invalid transition attempt
      await logAuditEntry({
        timestamp_utc: new Date().toISOString(),
        actor,
        platform: postData.platform || 'unknown',
        content_id: postId,
        action: 'blocked',
        reason: error,
      });
      
      return { success: false, error };
    }
    
    // Update status (backend-only mutation)
    await updateDoc(postRef, {
      status: 'SCHEDULED',
      approvedAt: new Date().toISOString(),
      approvedBy: actor,
    });
    
    // Log approval
    await logAuditEntry({
      timestamp_utc: new Date().toISOString(),
      actor,
      platform: postData.platform || 'unknown',
      content_id: postId,
      action: 'attempt_publish',
      reason: 'Post approved and moved to SCHEDULED',
    });
    
    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Post approved and scheduled' };
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
    const batch = writeBatch(galleryFirestore);
    let approved = 0;
    let failed = 0;
    const errors: string[] = [];
    
    // Validate all posts first
    for (const postId of postIds) {
      const postRef = doc(galleryFirestore, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        failed++;
        errors.push(`Post ${postId} not found`);
        continue;
      }
      
      const postData = postSnap.data();
      const currentStatus = mapLegacyStatus(postData.status || 'DRAFT');
      
      if (!isValidTransition(currentStatus, 'SCHEDULED')) {
        failed++;
        errors.push(`Post ${postId}: Invalid transition from ${currentStatus} to SCHEDULED`);
        continue;
      }
      
      // Add to batch
      batch.update(postRef, {
        status: 'SCHEDULED',
        approvedAt: new Date().toISOString(),
        approvedBy: actor,
      });
      approved++;
    }
    
    if (approved > 0) {
      await batch.commit();
      
      // Log batch approval
      for (const postId of postIds) {
        const postRef = doc(galleryFirestore, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const postData = postSnap.data();
          await logAuditEntry({
            timestamp_utc: new Date().toISOString(),
            actor,
            platform: postData.platform || 'unknown',
            content_id: postId,
            action: 'attempt_publish',
            reason: 'Post approved and moved to SCHEDULED (batch)',
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
    const postRef = doc(galleryFirestore, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      return { success: false, error: 'Post not found' };
    }
    
    const postData = postSnap.data();
    const currentStatus = mapLegacyStatus(postData.status || 'DRAFT');
    
    // Validate transition
    if (!isValidTransition(currentStatus, 'REJECTED')) {
      const error = `${INVALID_STATE_TRANSITION_ERROR}: Cannot transition from ${currentStatus} to REJECTED`;
      
      await logAuditEntry({
        timestamp_utc: new Date().toISOString(),
        actor,
        platform: postData.platform || 'unknown',
        content_id: postId,
        action: 'blocked',
        reason: error,
      });
      
      return { success: false, error };
    }
    
    // Update status
    await updateDoc(postRef, {
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
 * Return post to NEEDS_APPROVAL (from REJECTED or SCHEDULED)
 * Backend-validated: ensures status transition is valid
 */
export async function returnToPendingAction(
  postId: string,
  actor: string = 'system'
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const postRef = doc(galleryFirestore, 'posts', postId);
    const postSnap = await getDoc(postRef);
    
    if (!postSnap.exists()) {
      return { success: false, error: 'Post not found' };
    }
    
    const postData = postSnap.data();
    const currentStatus = mapLegacyStatus(postData.status || 'DRAFT');
    
    // Validate transition
    if (!isValidTransition(currentStatus, 'NEEDS_APPROVAL')) {
      const error = `${INVALID_STATE_TRANSITION_ERROR}: Cannot transition from ${currentStatus} to NEEDS_APPROVAL`;
      
      await logAuditEntry({
        timestamp_utc: new Date().toISOString(),
        actor,
        platform: postData.platform || 'unknown',
        content_id: postId,
        action: 'blocked',
        reason: error,
      });
      
      return { success: false, error };
    }
    
    // Update status (use legacy 'pending' for backward compatibility)
    await updateDoc(postRef, {
      status: 'pending', // Legacy status, maps to NEEDS_APPROVAL
    });
    
    revalidatePath('/dashboard/schedule');
    return { success: true, message: 'Post returned to pending approval' };
  } catch (error: any) {
    console.error('[APPROVAL_ACTION] Error returning post to pending:', error);
    return { success: false, error: error.message || 'Failed to return post to pending' };
  }
}
