import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Firebase config — set these VITE_ env vars in .env and Vercel dashboard
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

let _firebaseApp: FirebaseApp | null = null;
let _firebaseAuth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey) return null;

  if (_firebaseApp) return _firebaseApp;

  try {
    // Reuse existing app if already initialized (e.g. HMR in dev)
    _firebaseApp =
      getApps().find((a) => a.name === "[DEFAULT]") ??
      initializeApp(firebaseConfig);
    return _firebaseApp;
  } catch (err) {
    console.warn("[Firebase] Failed to initialize app:", err);
    return null;
  }
}

export function getFirebaseAuth(): Auth | null {
  if (_firebaseAuth) return _firebaseAuth;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    _firebaseAuth = getAuth(app);
    return _firebaseAuth;
  } catch (err) {
    console.warn("[Firebase] Failed to get Auth:", err);
    return null;
  }
}
