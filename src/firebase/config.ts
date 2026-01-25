
// This file is for the main Firebase app configuration.
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";

// Unified configuration for all data services (Firestore, Storage).
const dataFirebaseConfig = {
  apiKey: "AIzaSyCr_ww4wutG61c1C8DaOIBGBmkjc3V2EWw",
  authDomain: "porters-detailing.firebaseapp.com",
  projectId: "porters-detailing",
  storageBucket: "porters-detailing.firebasestorage.app",
  messagingSenderId: "1032751350390",
  appId: "1:1032751350390:web:5d09011d1fddba3a239557",
  measurementId: "G-605E9LV6YK"
};

// Initialize a named app for all data services to avoid conflict with the default auth app.
const dataAppName = 'dataApp';
const dataApp: FirebaseApp = getApps().find(app => app.name === dataAppName) || initializeApp(dataFirebaseConfig, dataAppName);


// All data services now point to the single 'porters-detailing' project.
export const firestore = getFirestore(dataApp);
export const galleryFirestore = getFirestore(dataApp);
export const storage = getStorage(dataApp);
