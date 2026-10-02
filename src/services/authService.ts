import type { User } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { getSupabaseClient } from "../lib/supabase";
import { getOAuthRedirectUrl, isNativeApp } from "../utils/platform";
import {
  validateConfirmPassword,
  validateName,
  validatePassword,
  validateRequiredEmail,
} from "../utils/validation";

export interface CustomerProfile {
  id: string;
  fullName: string;
  email: string;
  mobile?: string;
}

function mapProfile(row: {
  id: string;
  full_name?: string;
  email?: string;
  mobile?: string;
} | null): CustomerProfile | null {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name || "",
    email: row.email || "",
    mobile: row.mobile || "",
  };
}

export async function fetchProfile(
  userId: string,
  fallback?: {
    email?: string;
    fullName?: string;
    mobile?: string;
  }
): Promise<CustomerProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return fallback
      ? {
          id: userId,
          fullName: fallback.fullName || "",
          email: fallback.email || "",
          mobile: fallback.mobile || "",
        }
      : null;
  }

  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, mobile")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      if (!data.full_name && fallback?.fullName) {
        try {
          await supabase
            .from("profiles")
            .update({ full_name: fallback.fullName })
            .eq("id", userId);
          data.full_name = fallback.fullName;
        } catch {
          /* ignore */
        }
      }
      return mapProfile(data);
    }

    // If profile row doesn't exist yet in Supabase (e.g. fresh Google OAuth sign-in)
    if (fallback && (fallback.email || fallback.fullName)) {
      const newProfile: CustomerProfile = {
        id: userId,
        fullName: fallback.fullName || "",
        email: fallback.email || "",
        mobile: fallback.mobile || "",
      };
      await upsertProfile(newProfile);
      return newProfile;
    }
  } catch {
    /* fallback to metadata */
  }

  return {
    id: userId,
    fullName: fallback?.fullName || "",
    email: fallback?.email || "",
    mobile: fallback?.mobile || "",
  };
}

/**
 * Sign in using Supabase Google OAuth.
 * Automatically selects the appropriate redirect target:
 * - Native Android / Capacitor: "com.shreeharikeerai.app://auth-callback"
 * - Normal Web Browser: "https://<domain>/auth/callback"
 */
export async function signInWithGoogle(
  redirectTo?: string
): Promise<{ error?: string; url?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  const targetRedirect = redirectTo || getOAuthRedirectUrl();
  const isNative =
    isNativeApp() || targetRedirect.startsWith("com.shreeharikeerai.app://");

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: targetRedirect,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
        skipBrowserRedirect: isNative,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (isNative && data?.url) {
      // 1. If running in Capacitor native app, open using Capacitor Browser plugin
      if (Capacitor.isNativePlatform()) {
        try {
          await Browser.open({ url: data.url, windowName: "_system" });
          return { url: data.url };
        } catch (bErr) {
          console.warn("[signInWithGoogle] Capacitor Browser.open failed, falling back:", bErr);
        }
      }

      // 2. If running in Android WebView with AndroidAppBridge interface
      if ((window as any).AndroidAppBridge?.openOAuth) {
        try {
          (window as any).AndroidAppBridge.openOAuth(data.url);
          return { url: data.url };
        } catch (bridgeErr) {
          console.warn("[signInWithGoogle] AndroidAppBridge.openOAuth failed:", bridgeErr);
        }
      }

      // 3. Fallback: assign window.location (intercepted by WebViewClient in Android)
      if (typeof window !== "undefined") {
        window.location.assign(data.url);
      }
      return { url: data.url };
    }

    return {};
  } catch (err: any) {
    return { error: err?.message || "Failed to initiate Google sign in." };
  }
}

export interface ProcessOAuthResult {
  success: boolean;
  error?: string;
  user?: User;
  profile?: CustomerProfile;
}

/**
 * Parses and processes an OAuth callback URL (custom scheme or https).
 * Handles both PKCE code exchange and implicit hash tokens.
 */
export async function handleAuthCallbackUrl(urlStr: string): Promise<ProcessOAuthResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Authentication service is unavailable." };

  try {
    const safeUrlStr = urlStr.replace(/^[a-zA-Z0-9._-]+:\/\//, "http://dummy.app/");
    const parsed = new URL(safeUrlStr);
    const searchParams = parsed.searchParams;

    const hashStr = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const hashParams = new URLSearchParams(hashStr);

    // 1. Check for errors
    const errorDesc =
      searchParams.get("error_description") ||
      hashParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error");

    if (errorDesc) {
      return {
        success: false,
        error: decodeURIComponent(errorDesc.replace(/\+/g, " ")),
      };
    }

    // 2. PKCE code exchange
    const code = searchParams.get("code");
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn("[handleAuthCallbackUrl] PKCE exchange warning:", error.message);
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          const user = sessionData.session.user;
          const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || "");
          const profile = await fetchProfile(user.id, { email: user.email, fullName });
          return { success: true, user, profile: profile || undefined };
        }
        return { success: false, error: error.message };
      }

      if (data?.session?.user) {
        const user = data.session.user;
        const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || "");
        const profile = await fetchProfile(user.id, { email: user.email, fullName });
        return { success: true, user, profile: profile || undefined };
      }
    }

    // 3. Implicit token in hash
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data?.session?.user) {
        const user = data.session.user;
        const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || "");
        const profile = await fetchProfile(user.id, { email: user.email, fullName });
        return { success: true, user, profile: profile || undefined };
      }
    }

    // 4. Existing session fallback
    const { data: existingSession } = await supabase.auth.getSession();
    if (existingSession?.session?.user) {
      const user = existingSession.session.user;
      const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || "");
      const profile = await fetchProfile(user.id, { email: user.email, fullName });
      return { success: true, user, profile: profile || undefined };
    }

    return { success: false, error: "No authentication tokens found in callback." };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to process authentication callback." };
  }
}

export async function upsertProfile(profile: CustomerProfile): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Could not save profile." };

  try {
    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        full_name: profile.fullName,
        email: profile.email,
        mobile: profile.mobile || "",
      },
      { onConflict: "id" }
    );
    if (error) {
      // Only silently ignore schema-cache / missing table errors (e.g. during initial setup)
      if (/could not find|does not exist|schema cache/i.test(error.message)) {
        console.warn("[upsertProfile] Schema/table not ready:", error.message);
        return {};
      }
      // Unique constraint on mobile
      if (/unique|duplicate|already exists/i.test(error.message) && /mobile/i.test(error.message)) {
        return { error: "This mobile number is already registered with another account." };
      }
      console.error("[upsertProfile] DB error:", error.message);
      return { error: error.message };
    }
  } catch (e: any) {
    console.error("[upsertProfile] Exception:", e?.message || e);
    return { error: e?.message || "Failed to save profile." };
  }
  return {};
}

export interface AuthActionResult {
  error?: string;
  warning?: string;
  needsEmailVerification?: boolean;
  unconfirmedEmail?: string;
  emailAlreadyExists?: boolean;
  user?: User;
}

/**
 * Sign in existing user with email and password.
 * If user email has not yet been confirmed in Supabase, returns needsEmailVerification = true
 */
export async function loginCustomer(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const emailErr = validateRequiredEmail(input.email);
  if (emailErr) return { error: emailErr };
  const passErr = validatePassword(input.password);
  if (passErr) return { error: passErr };

  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  const email = input.email.trim().toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) {
    // Check if email confirmation is pending
    if (
      (error as any).code === "email_not_confirmed" ||
      /confirm/i.test(error.message) ||
      /not confirmed/i.test(error.message)
    ) {
      // Trigger a fresh OTP email resend via custom endpoint (Resend API)
      try {
        const apiUrl = typeof window !== "undefined" ? "/api/auth/send-otp" : "http://localhost:5173/api/auth/send-otp";
        await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, resend: true }),
        });
      } catch {
        /* rate limit / network errors handled gracefully in the UI */
      }
      return {
        needsEmailVerification: true,
        unconfirmedEmail: email,
      };
    }

    if (/invalid/i.test(error.message) || /credentials/i.test(error.message)) {
      return { error: "Invalid email or password. Please check your credentials." };
    }

    return { error: error.message };
  }

  if (data?.user) {
    return { user: data.user };
  }

  return {};
}

/**
 * Register a new user with Full Name, Email, Password, and Confirm Password.
 * Uses custom /api/auth/send-otp endpoint (Resend) instead of Supabase SMTP.
 */
export async function registerCustomer(input: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<AuthActionResult> {
  const nameErr = validateName(input.fullName);
  if (nameErr) return { error: nameErr };
  const emailErr = validateRequiredEmail(input.email);
  if (emailErr) return { error: emailErr };
  const passErr = validatePassword(input.password);
  if (passErr) return { error: passErr };
  const confirmErr = validateConfirmPassword(input.password, input.confirmPassword);
  if (confirmErr) return { error: confirmErr };

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  try {
    const apiUrl =
      typeof window !== "undefined"
        ? "/api/auth/send-otp"
        : "http://localhost:5173/api/auth/send-otp";

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: input.password, fullName }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.emailAlreadyExists) {
        return {
          error: data.error || "An account already exists with this email address. Please log in instead.",
          emailAlreadyExists: true,
        };
      }
      return { error: data.error || "Could not create account. Please try again." };
    }

    return {
      needsEmailVerification: true,
      unconfirmedEmail: email,
    };
  } catch (e: any) {
    return { error: e?.message || "Network error. Please check your connection and try again." };
  }
}

export interface VerifyEmailOtpResult {
  success: boolean;
  error?: string;
  user?: User;
  profile?: CustomerProfile;
}

/**
 * Verify email OTP via custom /api/auth/verify-otp endpoint.
 * After verification, auto-logs in using magic link token.
 */
export async function verifyEmailOtp(
  email: string,
  token: string
): Promise<VerifyEmailOtpResult> {
  const emailErr = validateRequiredEmail(email);
  if (emailErr) return { success: false, error: emailErr };

  const trimmedToken = token.trim();
  if (!trimmedToken || trimmedToken.length < 6) {
    return { success: false, error: "Please enter the complete verification code." };
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const apiUrl =
      typeof window !== "undefined"
        ? "/api/auth/verify-otp"
        : "http://localhost:5173/api/auth/verify-otp";

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, otp: trimmedToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.error || "Incorrect or expired verification code.";
      return { success: false, error: msg };
    }

    // Auto-login via magic link token if backend provided one
    const supabase = getSupabaseClient();
    if (supabase && data.tokenHash) {
      try {
        const { data: sessionData } = await supabase.auth.verifyOtp({
          token_hash: data.tokenHash,
          type: "email",
        });
        if (sessionData?.user) {
          const fullName = String(sessionData.user.user_metadata?.full_name || "");
          const profile: CustomerProfile = {
            id: sessionData.user.id,
            fullName,
            email: cleanEmail,
          };
          await upsertProfile(profile);
          return { success: true, user: sessionData.user, profile };
        }
      } catch {
        /* fallback: verification succeeded, user can login manually */
      }
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error. Please try again." };
  }
}

/**
 * Resend email OTP via custom /api/auth/send-otp endpoint (Resend API).
 */
export async function resendEmailOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const emailErr = validateRequiredEmail(email);
  if (emailErr) return { success: false, error: emailErr };

  const cleanEmail = email.trim().toLowerCase();

  try {
    const apiUrl =
      typeof window !== "undefined"
        ? "/api/auth/send-otp"
        : "http://localhost:5173/api/auth/send-otp";

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, resend: true }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data.error || "Could not resend verification code. Please try again." };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || "Network error. Please try again." };
  }
}

export function getResetPasswordRedirectUrl(): string {
  // If running in browser on a production domain (not localhost or 127.0.0.1)
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return `${window.location.origin}/reset-password`;
  }
  // Production fallback URL (ensures email link points to live app and never fails with "Site can't be reached")
  const productionBase =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL) ||
    "https://shrreeharikeerai-app.vercel.app";
  return `${productionBase.replace(/\/+$/, "")}/reset-password`;
}

export async function requestPasswordReset(email: string): Promise<{
  error?: string;
  notFound?: boolean;
  success?: boolean;
}> {
  const emailErr = validateRequiredEmail(email);
  if (emailErr) return { error: emailErr };

  const cleanEmail = email.trim().toLowerCase();

  // 1. Check if an account exists for this email address securely on the backend
  try {
    const checkUrl =
      typeof window !== "undefined"
        ? "/api/auth/check-email"
        : "http://localhost:5173/api/auth/check-email";

    const checkRes = await fetch(checkUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        checkOnly: true,
        action: "forgot-password",
      }),
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (!checkData.exists) {
        return {
          error: "No account found with this email address. Please create an account first.",
          notFound: true,
        };
      }
    }
  } catch (err) {
    console.warn("[requestPasswordReset] Pre-check error:", err);
  }

  const redirectTo = getResetPasswordRedirectUrl();

  try {
    const forgotUrl =
      typeof window !== "undefined"
        ? "/api/auth/forgot-password"
        : "http://localhost:5173/api/auth/forgot-password";

    const res = await fetch(forgotUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        redirectTo,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.notFound) {
        return {
          error: data.error || "No account found with this email address. Please create an account first.",
          notFound: true,
        };
      }
      return { error: data.error || "Could not send password reset email. Please try again." };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Network error. Please try again." };
  }
}

export async function updateCustomerPassword(
  password: string,
  confirmPassword: string
): Promise<{ error?: string }> {
  const passErr = validatePassword(password);
  if (passErr) return { error: passErr };
  const confirmErr = validateConfirmPassword(password, confirmPassword);
  if (confirmErr) return { error: confirmErr };
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return {};
}

export async function updateCustomerProfile(input: {
  fullName: string;
  email: string;
  mobile?: string;
}): Promise<{ error?: string }> {
  const nameErr = validateName(input.fullName);
  if (nameErr) return { error: nameErr };
  const emailErr = validateRequiredEmail(input.email);
  if (emailErr) return { error: emailErr };

  const fullName = input.fullName.trim();
  const email = input.email.trim().toLowerCase();
  const mobile = input.mobile ? input.mobile.replace(/\D/g, "") : "";

  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  const { data: sessionData } = await supabase.auth.getUser();
  const user = sessionData?.user;
  if (!user) {
    return { error: "Please log in again to update your profile." };
  }

  // 1. Update auth user metadata (full_name stored in user_metadata)
  const authPayload: { email?: string; data: { full_name: string; mobile?: string } } = {
    data: { full_name: fullName, mobile },
  };
  if (email && email !== (user.email || "").toLowerCase()) {
    authPayload.email = email;
  }
  try {
    const { error: authErr } = await supabase.auth.updateUser(authPayload);
    if (authErr) {
      console.warn("[updateCustomerProfile] auth.updateUser error:", authErr.message);
      // Non-fatal: still try to update the profiles table
    }
  } catch (e) {
    console.warn("[updateCustomerProfile] auth.updateUser exception:", e);
  }

  // 2. Upsert profiles table row
  const profileResult = await upsertProfile({
    id: user.id,
    fullName,
    email,
    mobile,
  });

  if (profileResult.error) {
    console.error("[updateCustomerProfile] upsertProfile error:", profileResult.error);
    return profileResult;
  }

  console.info("[updateCustomerProfile] Profile updated successfully for", user.id);
  return {};
}

export async function logoutCustomer(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {}
  }

  // Thoroughly clear all customer-specific data from localStorage and sessionStorage
  // so the next customer on the same browser/device cannot see prior user data
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem("shreehari_orders");
      localStorage.removeItem("shreehari_latest_order");
      localStorage.removeItem("shreehari_guest_details");
      localStorage.removeItem("shreehari_pending_order");
      localStorage.removeItem("shreehari_submitted_order_ids");
      sessionStorage.removeItem("shreehari_pending_order");
    }
  } catch (err) {
    console.warn("[authService] Failed to clear client storage on logout:", err);
  }
}


