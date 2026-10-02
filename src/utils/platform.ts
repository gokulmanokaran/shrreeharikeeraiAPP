import { Capacitor } from "@capacitor/core";

/**
 * Native custom URL scheme registered in AndroidManifest.xml & Capacitor
 */
export const NATIVE_OAUTH_REDIRECT_URI = "com.shreeharikeerai.app://auth-callback";
export const NATIVE_OAUTH_LOGIN_CALLBACK_URI = "com.shreeharikeerai.app://login-callback";

/**
 * Returns true if the app is currently running inside:
 * 1. Capacitor native shell (Android/iOS)
 * 2. Android WebView wrapper (detected by User-Agent tag 'ShreeHariApp', 'wv', or window.AndroidAppBridge)
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // 1. Capacitor native platform detection
  try {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
  } catch {
    /* ignore */
  }

  // 2. Global Capacitor object
  if ((window as any).Capacitor?.isNativePlatform?.()) {
    return true;
  }

  // 3. Android JavaScript Bridge injected by MainActivity.kt
  if ((window as any).AndroidAppBridge !== undefined) {
    return true;
  }

  // 4. Custom User-Agent tag added in MainActivity.kt
  const ua = navigator.userAgent || "";
  if (ua.includes("ShreeHariApp")) {
    return true;
  }

  // 5. Standard Android WebView detection (Android + wv token)
  if (ua.includes("Android") && /\bwv\b/.test(ua)) {
    return true;
  }

  // 6. Explicit window flag or query param override (useful for testing)
  if ((window as any).__IS_NATIVE_APP__ === true) {
    return true;
  }

  return false;
}

/**
 * Returns the proper OAuth redirect URL:
 * - Native Android / Capacitor app: "com.shreeharikeerai.app://auth-callback"
 * - Normal Web Browser (Desktop / Mobile Chrome / Safari): "https://<domain>/auth/callback"
 */
export function getOAuthRedirectUrl(): string {
  if (isNativeApp()) {
    return NATIVE_OAUTH_REDIRECT_URI;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth/callback`;
  }

  // Production web fallback
  const siteUrl =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
    "https://www.shreeharikeerai.in";
  return `${siteUrl.replace(/\/+$/, "")}/auth/callback`;
}
