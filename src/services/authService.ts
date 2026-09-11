import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";
import {
  validateConfirmPassword,
  validateName,
  validatePassword,
  validatePhone,
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
      ? `${window.location.origin}/login`
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
    if (error && !/could not find|does not exist|schema cache/i.test(error.message)) {
      return { error: error.message };
    }
  } catch {
    /* ignore if schema not yet created */
  }
  return {};
}

export interface AuthActionResult {
  error?: string;
  needsEmailVerification?: boolean;
  unconfirmedEmail?: string;
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
 * Supabase sends an email OTP / confirmation code.
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

  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

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
    if (/already/i.test(error.message) || /registered/i.test(error.message)) {
      return { error: "An account with this email already exists. Please log in." };
    }
    if (/rate limit/i.test(error.message)) {
      return { error: "Email rate limit reached. Please wait a few minutes before trying again." };
    }
    return { error: error.message };
  }

  // If email confirmation is required (data.session is null), switch to OTP verification
  if (data.user && !data.session) {
    return {
      needsEmailVerification: true,
      unconfirmedEmail: email,
      user: data.user,
    };
  }

  // If project has confirmations disabled and signed in immediately
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
  if (!trimmedToken || trimmedToken.length !== 6) {
    return { success: false, error: "Please enter the complete 6-digit verification code." };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Authentication service is unavailable." };

  const cleanEmail = email.trim().toLowerCase();

  const { data, error } = await supabase.auth.verifyOtp({
    email: cleanEmail,
    token: trimmedToken,
    type: "signup",
  });

  if (error) {
    if (/expired/i.test(error.message) || /invalid/i.test(error.message) || /token/i.test(error.message)) {
      return {
        success: false,
        error: "Incorrect or expired verification code. Please check your email or click Resend OTP.",
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
    if ((error as any).code === "over_email_send_rate_limit" || /security/i.test(error.message) || /rate limit/i.test(error.message)) {
      return {
        success: false,
        error: "Please wait a moment before requesting another verification code.",
      };
    }
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  const emailErr = validateRequiredEmail(email);
  if (emailErr) return { error: emailErr };
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) return { error: error.message };
  return {};
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

  if (input.mobile && input.mobile.trim() !== "") {
    const mobileErr = validatePhone(input.mobile);
    if (mobileErr) return { error: mobileErr };
  }

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

  const authPayload: { email?: string; data: { full_name: string; mobile?: string } } = {
    data: { full_name: fullName, mobile },
  };
  if (email && email !== (user.email || "").toLowerCase()) {
    authPayload.email = email;
  }
  try {
    await supabase.auth.updateUser(authPayload);
  } catch {}

  return await upsertProfile({
    id: user.id,
    fullName,
    email,
    mobile,
  });
}

export async function logoutCustomer(): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {}
  }
}
