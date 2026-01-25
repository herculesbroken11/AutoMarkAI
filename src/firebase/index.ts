// This is the main barrel file for all Firebase-related functionality.
'use client';

import { getAuth, onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider, type User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { app } from './config';
import { FirebaseClientProvider, useFirebase, useUser } from './client-provider';

// Initialize Firebase services
const auth = getAuth(app);
const firestore = getFirestore(app);

// --- AUTHENTICATION ---

const provider = new GoogleAuthProvider();

/**
 * Initiates Google Sign-In process.
 */
async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        // This gives you a Google Access Token. You can use it to access the Google API.
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        // The signed-in user info.
        const user = result.user;
        return { user, token };
    } catch (error: any) {
        // Handle Errors here.
        const errorCode = error.code;
        const errorMessage = error.message;
        // The email of the user's account used.
        const email = error.customData?.email;
        // The AuthCredential type that was used.
        const credential = GoogleAuthProvider.credentialFromError(error);
        
        console.error("Error during Google sign-in:", {
            errorCode,
            errorMessage,
            email,
            credential,
        });

        throw error;
    }
}

/**
 * Signs out the current user.
 */
async function signOutWithGoogle() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out:", error);
        throw error;
    }
}

export {
    // Firebase App
    app,
    auth,
    firestore,

    // Auth exports
    signInWithGoogle,
    signOutWithGoogle,
    onAuthStateChanged,
    type User,

    // Provider and hooks
    FirebaseClientProvider,
    useUser,
    useFirebase,
};
