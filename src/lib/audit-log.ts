/**
 * Audit Log Utilities
 * Phase 1: Comprehensive audit logging
 */

import { collection, addDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';

export type AuditAction = 
  | 'attempt_publish' 
  | 'blocked' 
  | 'posted' 
  | 'failed'
  | 'kill_switch_blocked'
  | 'duplicate_blocked'
  | 'not_approved'
  | 'approved'
  | 'rejected'
  | 'scheduled'
  | 'status_changed';

export interface AuditLogEntry {
  timestamp_utc: string;
  actor: string; // user_id, 'system', 'cron', 'webhook', etc.
  platform: string;
  content_id?: string;
  action: AuditAction;
  reason: string; // why allowed/blocked
  request_id?: string;
  trace_id?: string;
  platform_response?: {
    status?: number;
    code?: string;
    post_id?: string;
    error?: string;
  };
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Log an audit entry
 * Phase 1: Comprehensive audit logging
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  try {
    const auditRef = collection(galleryFirestore, 'audit_logs');
    await addDoc(auditRef, {
      ...entry,
      timestamp_utc: entry.timestamp_utc || new Date().toISOString(),
      logged_at: new Date().toISOString(), // Firestore server timestamp equivalent
    });
  } catch (error) {
    // Don't throw - audit logging should never break the main flow
    console.error('[AUDIT_LOG] Failed to log entry:', error, entry);
  }
}

/**
 * Log a publish attempt (allowed or blocked)
 */
export async function logPublishAttempt(params: {
  actor: string;
  platform: string;
  content_id?: string;
  action: 'attempt_publish' | 'blocked' | 'posted' | 'failed';
  reason: string;
  request_id?: string;
  platform_response?: {
    status?: number;
    code?: string;
    post_id?: string;
    error?: string;
  };
}): Promise<void> {
  await logAuditEntry({
    timestamp_utc: new Date().toISOString(),
    actor: params.actor,
    platform: params.platform,
    content_id: params.content_id,
    action: params.action,
    reason: params.reason,
    request_id: params.request_id,
    platform_response: params.platform_response,
  });
}

/**
 * Quick helper to log blocked publish attempts
 */
export async function logBlockedPublish(params: {
  actor: string;
  platform: string;
  content_id?: string;
  reason: string;
  request_id?: string;
}): Promise<void> {
  await logAuditEntry({
    timestamp_utc: new Date().toISOString(),
    actor: params.actor,
    platform: params.platform,
    content_id: params.content_id,
    action: 'kill_switch_blocked',
    reason: params.reason,
    request_id: params.request_id,
  });
}
