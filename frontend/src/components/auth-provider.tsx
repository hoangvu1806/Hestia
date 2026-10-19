"use client";

import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { firebaseAuth } from "@/lib/firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function isTauriApp(): boolean {
  return "__TAURI_INTERNALS__" in window || navigator.userAgent.includes("HestiaApp/");
}
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void setPersistence(firebaseAuth, browserLocalPersistence);
    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async signInWithGoogle() {
      await setPersistence(firebaseAuth, browserLocalPersistence);
      // Mobile browsers block the third-party storage that the redirect flow reads on return,
      // so every browser uses a popup. Only the Tauri webview, which cannot open popups,
      // uses the redirect flow.
      if (isTauriApp()) {
        await signInWithRedirect(firebaseAuth, googleProvider);
        return;
      }
      try {
        await signInWithPopup(firebaseAuth, googleProvider);
      } catch (error) {
        if ((error as { code?: string }).code !== "auth/popup-blocked") throw error;
        await signInWithRedirect(firebaseAuth, googleProvider);
      }
    },
    async signOut() {
      await firebaseSignOut(firebaseAuth);
    },
    async getIdToken() {
      if (!firebaseAuth.currentUser) throw new Error("authentication_required");
      return firebaseAuth.currentUser.getIdToken();
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
