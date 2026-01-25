
// This file provides an authentication context for the entire application.
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { User, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, GoogleAuthProvider, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, provider } from "@/lib/firebase"; // Use the UNIFIED provider from lib
import { Loader } from "lucide-react";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem("google-drive-token");
    if (storedToken) {
      setAccessToken(storedToken);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
        // If there's a user but no token, we might need a silent refresh logic here
        // For simplicity, we assume token is set on login or from localStorage
      } else {
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem("google-drive-token");
      }
      setLoading(false);
    });

    // One-time script to create the admin user if they don't exist.
    const createAdminUser = async () => {
        try {
            // Try to sign in first to see if user exists.
            // This is a simple way to check, but not perfect.
            // A more robust way would be to use a server-side function.
            await signInWithEmailAndPassword(auth, "porters@admin.com", "12345678");
            console.log("Admin user already exists.");
        } catch (error: any) {
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
                console.log("Admin user not found, creating new one...");
                try {
                    await createUserWithEmailAndPassword(auth, "porters@admin.com", "12345678");
                    console.log("Admin user created successfully.");
                } catch (createError) {
                    console.error("Error creating admin user:", createError);
                }
            } else {
              console.error("Error checking for admin user:", error);
            }
        } finally {
            // Always sign out after the check to not leave the app in a logged-in state.
            if(auth.currentUser) {
                await signOut(auth);
            }
        }
    }
    if (process.env.NODE_ENV === 'development') {
        createAdminUser();
    }


    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
      setLoading(true);
      try {
          const userCredential = await signInWithEmailAndPassword(auth, email, pass);
          setUser(userCredential.user);
          // For now, we don't have a specific access token from email/pass login like we did with Google
          // We can handle Drive auth separately if needed.
          setAccessToken(null);
          localStorage.removeItem("google-drive-token");
          router.push("/dashboard");
      } catch (error) {
          console.error("Email/Password login failed:", error);
          setLoading(false);
          throw error; // re-throw to be caught by the UI
      }
  }


  const login = async () => {
    setLoading(true);
    try {
      // Use the unified auth and provider from lib/firebase
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      const token = credential?.accessToken;

      if (token) {
        setAccessToken(token);
        localStorage.setItem("google-drive-token", token);
      }
      setUser(result.user);
      router.push("/dashboard");
    } catch (error) {
      console.error("Authentication failed:", error);
      // You might want to show a toast message to the user here
      setLoading(false);
    }
  };

  const logout = () => {
    signOut(auth).then(() => {
      setUser(null);
      setAccessToken(null);
      localStorage.removeItem("google-drive-token");
      router.push("/");
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="animate-spin text-primary">
            <Loader size={48} />
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
