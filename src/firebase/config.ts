
// This file is for the main Firebase app configuration.
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

// Unified configuration for all data services (Firestore, Storage).
const dataFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCr_ww4wutG61c1C8DaOIBGBmkjc3V2EWw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "porters-detailing.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "porters-detailing",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "porters-detailing.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1032751350390",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1032751350390:web:5d09011d1fddba3a239557",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-605E9LV6YK"
};

// Initialize a named app for all data services to avoid conflict with the default auth app.
const dataAppName = 'dataApp';
const dataApp: FirebaseApp = getApps().find(app => app.name === dataAppName) || initializeApp(dataFirebaseConfig, dataAppName);


// All data services now point to the single 'porters-detailing' project.
export const firestore = getFirestore(dataApp);
export const galleryFirestore = getFirestore(dataApp);
export const storage = getStorage(dataApp);
