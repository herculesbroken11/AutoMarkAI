/**
 * Post Status Management
 * Phase 1: Backend-Enforced Approval
 */

export type PostStatus = 
  | 'DRAFT'
  | 'NEEDS_APPROVAL' 
  | 'APPROVED'
  | 'SCHEDULED'
  | 'POSTED'
  | 'FAILED'
  | 'REJECTED';

// Legacy statuses for backward compatibility
export type LegacyStatus = 'pending' | 'scheduled' | 'posted' | 'rejected' | 'failed';

/**
 * Map legacy status to new standardized status
 */
export function mapLegacyStatus(legacy: LegacyStatus | PostStatus): PostStatus {
  const mapping: Record<string, PostStatus> = {
    'pending': 'NEEDS_APPROVAL',
    'scheduled': 'SCHEDULED',
    'posted': 'POSTED',
    'rejected': 'REJECTED',
    'failed': 'FAILED',
    'DRAFT': 'DRAFT',
    'NEEDS_APPROVAL': 'NEEDS_APPROVAL',
    'APPROVED': 'APPROVED',
    'SCHEDULED': 'SCHEDULED',
    'POSTED': 'POSTED',
    'FAILED': 'FAILED',
    'REJECTED': 'REJECTED',
  };
  
  return mapping[legacy] || 'DRAFT';
}

/**
 * Check if status allows publishing
 */
export function canPublish(status: PostStatus | LegacyStatus): boolean {
  const normalized = mapLegacyStatus(status);
  return normalized === 'SCHEDULED' || normalized === 'APPROVED';
}

/**
 * Check if status transition is valid
 */
export function isValidTransition(
  from: PostStatus | LegacyStatus,
  to: PostStatus
): boolean {
  const fromNormalized = mapLegacyStatus(from);
  
  const validTransitions: Record<PostStatus, PostStatus[]> = {
    'DRAFT': ['NEEDS_APPROVAL'],
    'NEEDS_APPROVAL': ['APPROVED', 'REJECTED', 'DRAFT'],
    'APPROVED': ['SCHEDULED', 'NEEDS_APPROVAL', 'REJECTED'],
    'SCHEDULED': ['POSTED', 'FAILED', 'NEEDS_APPROVAL'],
    'POSTED': [], // Final state
    'FAILED': ['SCHEDULED', 'NEEDS_APPROVAL'],
    'REJECTED': ['NEEDS_APPROVAL', 'DRAFT'],
  };
  
  return validTransitions[fromNormalized]?.includes(to) || false;
}

export const NOT_APPROVED_ERROR = 'NOT_APPROVED';
export const INVALID_STATE_TRANSITION_ERROR = 'INVALID_STATE_TRANSITION';
