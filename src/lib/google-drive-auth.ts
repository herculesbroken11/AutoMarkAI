/**
 * Shared Google Drive OAuth helpers for API routes and server actions.
 * Uses Firebase Admin SDK when available (server/cron), else client SDK.
 */

import { doc, getDoc } from 'firebase/firestore';
import { galleryFirestore } from '@/firebase/config';
import { adminFirestore, isAdminSDKAvailable } from '@/firebase/admin';

export const GOOGLE_DRIVE_AUTH_ERROR_CODE = {
  INVALID_GRANT: 'invalid_grant',
  MISSING_CREDENTIALS: 'missing_credentials',
  NOT_CONFIGURED: 'not_configured',
} as const;

export class GoogleDriveAuthError extends Error {
  constructor(
    message: string,
    public readonly code: keyof typeof GOOGLE_DRIVE_AUTH_ERROR_CODE,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'GoogleDriveAuthError';
  }
}

export interface GoogleDriveCreds {
  clientId?: string;
  client_id?: string;
  clientSecret?: string;
  client_secret?: string;
  refreshToken?: string;
  refresh_token?: string;
}

/**
 * Load Google Drive OAuth credentials from Firestore (settings/googleDrive).
 */
export async function getGoogleApiCredentials(): Promise<GoogleDriveCreds & Record<string, unknown>> {
  if (isAdminSDKAvailable() && adminFirestore) {
    const settingsRef = adminFirestore.collection('settings').doc('googleDrive');
    const docSnap = await settingsRef.get();
    if (!docSnap.exists) {
      throw new GoogleDriveAuthError(
        'Google Drive API credentials are not configured in settings.',
        'NOT_CONFIGURED'
      );
    }
    return docSnap.data() as GoogleDriveCreds & Record<string, unknown>;
  }

  const settingsRef = doc(galleryFirestore, 'settings', 'googleDrive');
  const docSnap = await getDoc(settingsRef);
  if (!docSnap.exists()) {
    throw new GoogleDriveAuthError(
      'Google Drive API credentials are not configured in settings.',
      'NOT_CONFIGURED'
    );
  }
  return docSnap.data() as GoogleDriveCreds & Record<string, unknown>;
}

/**
 * Exchange stored refresh token for a new access token.
 * Throws GoogleDriveAuthError with code INVALID_GRANT when refresh token is expired/revoked.
 */
export async function getRefreshedAccessToken(creds: GoogleDriveCreds): Promise<string> {
  const clientId = creds.clientId ?? creds.client_id;
  const clientSecret = creds.clientSecret ?? creds.client_secret;
  const refreshToken = creds.refreshToken ?? creds.refresh_token;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new GoogleDriveAuthError(
      'Google Drive settings missing clientId, clientSecret, or refreshToken. Check Firestore settings/googleDrive.',
      'MISSING_CREDENTIALS'
    );
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = (data.error as string) || '';
    const description = data.error_description || data.error || 'Failed to refresh access token.';

    if (errorCode === 'invalid_grant') {
      console.warn('[DRIVE] Token refresh invalid_grant (expired/revoked). Re-authenticate in Settings.', data);
      throw new GoogleDriveAuthError(
        'Google Drive access has expired or was revoked. Please re-authenticate in Settings.',
        'INVALID_GRANT',
        data
      );
    }

    console.error('[DRIVE] Token refresh failed:', data);
    throw new GoogleDriveAuthError(description, 'INVALID_GRANT', data);
  }

  return data.access_token;
}

/**
 * Helper for API routes: get credentials and a valid access token in one call.
 * Throws GoogleDriveAuthError on missing config or invalid_grant.
 */
export async function getDriveAccessToken(): Promise<string> {
  const creds = await getGoogleApiCredentials();
  return getRefreshedAccessToken(creds);
}
