import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};

const missingConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingConfig.length) {
  throw new Error(`Missing Firebase web configuration: ${missingConfig.join(", ")}`);
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const firebaseAuth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let persistenceReady: Promise<void> | null = null;

function ensurePersistence() {
  persistenceReady ??= setPersistence(firebaseAuth, browserLocalPersistence);
  return persistenceReady;
}

export function observeAuth(callback: (user: User | null) => void) {
  void ensurePersistence();
  return onAuthStateChanged(firebaseAuth, callback);
}

export async function signInWithGoogle() {
  await ensurePersistence();
  return signInWithPopup(firebaseAuth, googleProvider);
}

export function signOutUser() {
  return signOut(firebaseAuth);
}

export type { User };
