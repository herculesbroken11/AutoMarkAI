/**
 * Audit Log Utilities
 * Phase 1: Comprehensive audit logging
 */

import { adminFirestore, isAdminSDKAvailable } from '@/firebase/admin';

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

/** Strip undefined values so Firestore accepts the document (recursive) */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // Skip undefined values
    }
    
    // Recursively strip undefined from nested objects
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      const cleaned = stripUndefined(value as Record<string, unknown>);
      // Only add if the cleaned object has at least one property
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned;
      }
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Log an audit entry
 * Phase 1: Comprehensive audit logging
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  try {
    if (!isAdminSDKAvailable() || !adminFirestore) {
      console.warn('[AUDIT_LOG] Admin SDK not available, skipping log entry');
      return;
    }

    const data = stripUndefined({
      ...entry,
      timestamp_utc: entry.timestamp_utc || new Date().toISOString(),
      logged_at: new Date().toISOString(),
    });
    await adminFirestore.collection('audit_logs').add(data);
  } catch (error) {
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
  // Clean platform_response to remove undefined values
  const cleanedPlatformResponse = params.platform_response 
    ? stripUndefined(params.platform_response as Record<string, unknown>)
    : undefined;
  
  await logAuditEntry({
    timestamp_utc: new Date().toISOString(),
    actor: params.actor,
    platform: params.platform,
    content_id: params.content_id,
    action: params.action,
    reason: params.reason,
    request_id: params.request_id,
    platform_response: Object.keys(cleanedPlatformResponse || {}).length > 0 ? cleanedPlatformResponse : undefined,
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
