/**
 * Firebase Admin SDK Configuration
 * For server-side operations (API routes, server actions)
 * Bypasses Firestore security rules
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminFirestore: Firestore | null = null;

// Initialize Firebase Admin SDK
try {
  if (getApps().length === 0) {
    // Try to use service account from environment variable
    if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
        adminApp = initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'porters-detailing',
        });
      } catch (error) {
        console.error('Failed to parse FIREBASE_ADMIN_SERVICE_ACCOUNT:', error);
        // Fall back to Application Default Credentials
        adminApp = initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'porters-detailing',
        });
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use service account key file (path can be absolute or relative to cwd)
      const keyPath = resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
      const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'porters-detailing',
      });
    } else {
      // Try Application Default Credentials (works in production/Cloud Run)
      // For local dev without credentials, this will fail gracefully
      try {
        adminApp = initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'porters-detailing',
        });
      } catch (error: any) {
        console.warn('[FIREBASE_ADMIN] Could not initialize Admin SDK:', error.message);
        console.warn('[FIREBASE_ADMIN] For local development, you can:');
        console.warn('  1. Set GOOGLE_APPLICATION_CREDENTIALS to a service account key file path');
        console.warn('  2. Set FIREBASE_ADMIN_SERVICE_ACCOUNT to a JSON string of service account');
        console.warn('  3. Run: gcloud auth application-default login');
        // adminApp remains null - will use fallback
      }
    }
  } else {
    adminApp = getApps()[0];
  }

  if (adminApp) {
    adminFirestore = getFirestore(adminApp);
  }
} catch (error: any) {
  console.error('[FIREBASE_ADMIN] Initialization error:', error.message);
  // adminApp and adminFirestore remain null
}

// Export Firestore admin instance (bypasses security rules)
// Will be null if credentials are not available
export { adminFirestore };

// Helper to check if Admin SDK is available
export function isAdminSDKAvailable(): boolean {
  return adminFirestore !== null;
}
