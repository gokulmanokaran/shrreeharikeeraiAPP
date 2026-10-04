/**
 * Firebase Web SDK — Phone Authentication (SMS OTP) + Analytics.
 *
 * Project: shreeharikeerai-d8d0c
 *
 * LOCALHOST / DEV:
 *   auth.settings.appVerificationDisabledForTesting = true
 *   → Works ONLY with phone numbers added in Firebase Console → Test numbers
 *   → No real SMS sent, no rate limits, no reCAPTCHA
 *
 * PRODUCTION:
 *   Invisible reCAPTCHA runs silently — users never see a captcha puzzle
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey:            "AIzaSyDOZvpHxhbbUx_8eXXOxtyJVFcHJExkFfg",
  authDomain:        "shreeharikeerai-d8d0c.firebaseapp.com",
  projectId:         "shreeharikeerai-d8d0c",
  storageBucket:     "shreeharikeerai-d8d0c.firebasestorage.app",
  messagingSenderId: "582496193761",
  appId:             "1:582496193761:web:861ffd0301b7464152fba0",
  measurementId:     "G-250LBJ4FTW",
};

let _app:       FirebaseApp | null = null;
let _auth:      Auth        | null = null;
let _analytics: Analytics   | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  const existing = getApps().find((a) => a.name === "[DEFAULT]");
  _app = existing ?? initializeApp(firebaseConfig);
  return _app;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;

  const auth = getAuth(getFirebaseApp());

  // On localhost: disable app verification so test phone numbers work instantly
  // (no SMS sent, no reCAPTCHA, no rate limits for test numbers)
  const isDev =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (isDev) {
    // Must be set BEFORE any signInWithPhoneNumber call
    (auth.settings as any).appVerificationDisabledForTesting = true;
    console.info(
      "%c[Firebase] 🧪 Test mode ON — use test phone numbers from Firebase Console.",
      "color:#00A651;font-weight:bold"
    );
  }

  _auth = auth;
  return _auth;
}

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (_analytics) return _analytics;
  try {
    if (!(await isSupported())) return null;
    _analytics = getAnalytics(getFirebaseApp());
    return _analytics;
  } catch {
    return null;
  }
}
