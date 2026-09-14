import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";
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
 */
export async function signInWithGoogle(
  redirectTo?: string
): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  const targetRedirect =
    redirectTo ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined);

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: targetRedirect,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      return { error: error.message };
    }
    return {};
  } catch (err: any) {
    return { error: err?.message || "Failed to initiate Google sign in." };
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
      // Trigger a fresh OTP email resend in the background
      try {
        await supabase.auth.resend({ type: "signup", email });
      } catch {
        /* rate limit is handled gracefully in the UI */
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
 * Supabase sends a 6-digit OTP to the user's email for verification.
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

  // 1. Server-side pre-check for existing account (secure, credentials not exposed)
  try {
    const checkUrl =
      typeof window !== "undefined"
        ? "/api/auth/check-email"
        : "http://localhost:5173/api/auth/check-email";

    const checkRes = await fetch(checkUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      if (checkData.exists && checkData.isVerified) {
        return {
          error: "An account already exists with this email address. Please log in instead.",
          emailAlreadyExists: true,
        };
      }
    }
  } catch {
    /* If /api/auth/check-email is unreachable, proceed to Supabase signUp verification */
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    if (
      /already/i.test(error.message) ||
      /user.*already/i.test(error.message) ||
      (error as any).status === 422
    ) {
      return {
        error: "An account already exists with this email address. Please log in instead.",
        emailAlreadyExists: true,
      };
    }
    if (/rate limit/i.test(error.message)) {
      return { error: "Too many requests. Please wait a few minutes before trying again." };
    }
    return { error: error.message };
  }

  // 2. Supabase duplicate account detection (when Prevent User Enumeration is enabled)
  // When an email is already registered, Supabase returns identities: []
  if (data.user && (data.user.identities?.length ?? 1) === 0) {
    return {
      error: "An account already exists with this email address. Please log in instead.",
      emailAlreadyExists: true,
    };
  }

  // 3. Genuinely new user created — email confirmation required (session is null)
  if (data.user && !data.session) {
    return {
      needsEmailVerification: true,
      unconfirmedEmail: email,
      user: data.user,
    };
  }

  // 4. Email confirmations disabled on this project — user is signed in immediately
  if (data.user && data.session) {
    await upsertProfile({
      id: data.user.id,
      fullName,
      email,
    });
    return { user: data.user };
  }

  return {
    needsEmailVerification: true,
    unconfirmedEmail: email,
  };
}

export interface VerifyEmailOtpResult {
  success: boolean;
  error?: string;
  user?: User;
  profile?: CustomerProfile;
}

/**
 * Verify Supabase email OTP code.
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

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Authentication service is unavailable." };

  const cleanEmail = email.trim().toLowerCase();

  let { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: trimmedToken,
    type: "signup",
  });

  if (error && (/invalid/i.test(error.message) || /expired/i.test(error.message))) {
    // Attempt fallback with type: "email"
    const retry = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: trimmedToken,
      type: "email",
    });
    if (!retry.error && retry.data?.user) {
      data = retry.data;
      error = null;
    }
  }

  if (error) {
    if (
      /expired/i.test(error.message) ||
      /invalid/i.test(error.message) ||
      /token/i.test(error.message) ||
      (error as any).code === "otp_expired"
    ) {
      return {
        success: false,
        error: "Incorrect or expired verification code. Please check your email or click Resend Code.",
      };
    }
    return { success: false, error: error.message };
  }

  if (data?.user) {
    const fullName = String(data.user.user_metadata?.full_name || "");
    const profile: CustomerProfile = {
      id: data.user.id,
      fullName,
      email: cleanEmail,
    };
    await upsertProfile(profile);
    return { success: true, user: data.user, profile };
  }

  return { success: true };
}

/**
 * Resend Supabase email OTP with rate-limiting handling.
 */
export async function resendEmailOtp(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const emailErr = validateRequiredEmail(email);
  if (emailErr) return { success: false, error: emailErr };

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Authentication service is unavailable." };

  const cleanEmail = email.trim().toLowerCase();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: cleanEmail,
  });

  if (error) {
    const isRateLimit =
      (error as any).code === "over_email_send_rate_limit" ||
      /security/i.test(error.message) ||
      /rate limit/i.test(error.message);
    if (isRateLimit) {
      return {
        success: false,
        error: "Please wait at least 60 seconds before requesting another code.",
      };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
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

  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  const redirectTo = getResetPasswordRedirectUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  if (error) return { error: error.message };
  return { success: true };
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


