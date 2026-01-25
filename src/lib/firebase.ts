// This file configures and initializes Firebase services.
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { galleryFirestore, storage, firestore as dataFirestore } from "@/firebase/config"; // Import from the unified config

// The primary app instance is now the 'dataApp' from config.ts
// We re-export its services to consolidate usage.
const app: FirebaseApp = getApps().find(app => app.name === 'dataApp') || initializeApp({}, 'dataApp'); // Should be initialized in config.ts

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

// Export the firestore and storage instances from the central data config
export const firestore = galleryFirestore;

export { app, storage };
