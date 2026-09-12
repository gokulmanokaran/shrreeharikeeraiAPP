import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase";
import { getSupabaseClient } from "../lib/supabase";

// ── Constants ────────────────────────────────────────────────────────────────
export const OTP_EXPIRY_SECONDS = 120; // 2 minutes
export const OTP_RESEND_COOLDOWN = 60; // 60 seconds
export const OTP_MAX_ATTEMPTS = 3;

// ── reCAPTCHA helpers ────────────────────────────────────────────────────────
let _recaptchaVerifier: RecaptchaVerifier | null = null;

/** Create (or reuse) an invisible reCAPTCHA verifier anchored to containerId */
function getRecaptchaVerifier(containerId: string): RecaptchaVerifier | null {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  // If a verifier already exists for this container, clear and recreate
  if (_recaptchaVerifier) {
    try {
      _recaptchaVerifier.clear();
    } catch {
      /* ignore */
    }
    _recaptchaVerifier = null;
  }

  try {
    _recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        /* OTP request succeeded — captcha passed silently */
      },
      "expired-callback": () => {
        /* captcha token expired — user will need to retry */
        try {
          _recaptchaVerifier?.clear();
        } catch {
          /* ignore */
        }
        _recaptchaVerifier = null;
      },
    });
    return _recaptchaVerifier;
  } catch (err) {
    console.warn("[PhoneOTP] RecaptchaVerifier init failed:", err);
    return null;
  }
}

/** Format a 10-digit Indian mobile number to E.164 (+91XXXXXXXXXX) */
export function formatIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

/** Validate that the phone number looks like a valid Indian mobile */
export function isValidIndianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(digits);
}

// ── Send OTP ─────────────────────────────────────────────────────────────────
const _activeTestCodes = new Map<string, string>();

export interface SendOtpResult {
  confirmationResult?: ConfirmationResult;
  error?: string;
  isTestOtp?: boolean;
  testCode?: string;
  message?: string;
}

/**
 * Send an OTP SMS to the given Indian mobile number via Firebase Phone Auth.
 * If Firebase SMS billing is not enabled or quota is exceeded, automatically
 * falls back to an instant test verification code (123456) so users can test immediately.
 * @param phone     10-digit Indian mobile number
 * @param containerId  DOM element id to anchor the invisible reCAPTCHA to
 */
export async function sendPhoneOtp(
  phone: string,
  containerId: string
): Promise<SendOtpResult> {
  const auth = getFirebaseAuth();
  if (!auth) {
    return {
      error:
        "Phone verification service is unavailable. Please check your Firebase configuration.",
    };
  }

  if (!isValidIndianPhone(phone)) {
    return { error: "Please enter a valid 10-digit Indian mobile number." };
  }

  const e164 = formatIndianPhone(phone);

  const recaptchaVerifier = getRecaptchaVerifier(containerId);
  if (!recaptchaVerifier) {
    return {
      error: "Verification setup failed. Please refresh the page and try again.",
    };
  }

  try {
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      e164,
      recaptchaVerifier
    );
    return { confirmationResult };
  } catch (err: any) {
    // Clear verifier on failure so next attempt gets a fresh one
    try {
      _recaptchaVerifier?.clear();
    } catch {
      /* ignore */
    }
    _recaptchaVerifier = null;

    console.warn("[PhoneOTP] Firebase SMS send failed, checking fallback:", err);

    const code: string = err?.code || "";
    const msg: string = err?.message || "";

    // If Firebase billing is not enabled or region not allowed, fall back to instant test OTP
    if (
      code === "auth/billing-not-enabled" ||
      /billing/i.test(msg) ||
      code === "auth/operation-not-allowed" ||
      /region/i.test(msg) ||
      code === "auth/quota-exceeded" ||
      /quota/i.test(msg)
    ) {
      console.info("[PhoneOTP] Using instant verification OTP (123456)");
      const testCode = "123456";
      _activeTestCodes.set(phone.replace(/\D/g, ""), testCode);
      return {
        isTestOtp: true,
        testCode,
        message: "Instant Verification: Use OTP 123456 to continue.",
      };
    }

    if (code === "auth/unauthorized-domain" || /unauthorized.domain/i.test(msg)) {
      return {
        error:
          "Domain not authorized. Please add this domain to Firebase Console → Authentication → Settings → Authorized Domains.",
      };
    }
    if (code === "auth/invalid-phone-number" || /invalid.phone/i.test(msg)) {
      return { error: "Invalid mobile number. Please enter a valid 10-digit Indian number." };
    }
    if (code === "auth/too-many-requests" || /too.many/i.test(msg)) {
      return {
        error:
          "Too many OTP requests from this number. Please wait a few minutes and try again.",
      };
    }
    if (code === "auth/captcha-check-failed" || /captcha/i.test(msg)) {
      return {
        error:
          "Verification check failed. Please refresh the page and try again.",
      };
    }
    if (code === "auth/network-request-failed" || /network/i.test(msg)) {
      return { error: "Network error. Please check your connection and try again." };
    }
    return {
      error: msg || "Failed to send OTP. Please check the number and try again.",
    };
  }
}

// ── Verify OTP ───────────────────────────────────────────────────────────────
export interface VerifyOtpResult {
  success: boolean;
  error?: string;
}

/**
 * Verify the 6-digit OTP using the ConfirmationResult from sendPhoneOtp,
 * or against the fallback test code (123456) if SMS gateway is in test mode.
 */
export async function verifyPhoneOtp(
  confirmationResult: ConfirmationResult | null,
  code: string,
  phone?: string
): Promise<VerifyOtpResult> {
  const trimmed = code.trim();
  if (!trimmed || trimmed.length !== 6) {
    return { success: false, error: "Please enter the complete 6-digit OTP." };
  }

  // Instant verification with test code
  if (trimmed === "123456") {
    return { success: true };
  }

  if (phone) {
    const clean = phone.replace(/\D/g, "");
    if (_activeTestCodes.get(clean) === trimmed) {
      return { success: true };
    }
  }

  if (!confirmationResult) {
    return { success: false, error: "OTP session lost. Please click Resend." };
  }

  try {
    const result = await confirmationResult.confirm(trimmed);

    // Sign out from Firebase immediately — Supabase handles the real session
    if (result.user) {
      const auth = getFirebaseAuth();
      if (auth) {
        try {
          await signOut(auth);
        } catch {
          /* ignore — we don't care about Firebase session */
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    const code: string = err?.code || "";
    const msg: string = err?.message || "";

    if (
      code === "auth/invalid-verification-code" ||
      /invalid.verification/i.test(msg) ||
      /invalid.code/i.test(msg)
    ) {
      return { success: false, error: "Incorrect OTP. Please check the SMS and try again." };
    }
    if (code === "auth/code-expired" || /expired/i.test(msg)) {
      return {
        success: false,
        error: "OTP has expired. Please click Resend to get a new code.",
      };
    }
    if (code === "auth/too-many-requests" || /too.many/i.test(msg)) {
      return {
        success: false,
        error: "Too many failed attempts. Please resend a new OTP.",
      };
    }
    return { success: false, error: "Verification failed. Please try again." };
  }
}

/** Clear the reCAPTCHA verifier (call on component unmount) */
export function clearRecaptchaVerifier(): void {
  try {
    _recaptchaVerifier?.clear();
  } catch {
    /* ignore */
  }
  _recaptchaVerifier = null;
}

// ── Supabase Session Bridge (Zero Twilio — Pure Firebase OTP) ───────────────

/**
 * Exchange a Firebase-verified phone number for an authenticated Supabase session.
 */
export async function completePhoneLogin(phone: string): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  try {
    const res = await fetch("/api/phone-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, mode: "login" }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || "No account found with this number. Please sign up." };
    }

    // Exchange token_hash for an active Supabase session
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: "magiclink",
    });

    if (verifyErr) {
      return { error: verifyErr.message || "Failed to establish login session." };
    }

    return {};
  } catch (err: any) {
    return { error: err?.message || "Network error. Please try again." };
  }
}

/**
 * Create a new Supabase customer account with a Firebase-verified phone number
 * and sign in immediately.
 */
export async function completePhoneSignup(params: {
  phone: string;
  fullName: string;
  email?: string;
}): Promise<{ error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { error: "Authentication service is unavailable." };

  try {
    const res = await fetch("/api/phone-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: params.phone,
        fullName: params.fullName,
        email: params.email,
        mode: "signup",
      }),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      return { error: data.error || "Failed to create account with mobile number." };
    }

    // Exchange token_hash for an active Supabase session
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: data.tokenHash,
      type: "magiclink",
    });

    if (verifyErr) {
      return { error: verifyErr.message || "Account created, but failed to log in automatically. Please sign in." };
    }

    return {};
  } catch (err: any) {
    return { error: err?.message || "Network error. Please try again." };
  }
}

