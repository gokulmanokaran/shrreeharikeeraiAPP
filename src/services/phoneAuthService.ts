/**
 * phoneAuthService.ts
 * ────────────────────
 * Bridges Firebase Phone Authentication with Supabase.
 *
 * Flow (both localhost dev and production):
 *   1. Firebase OTP verified → Firebase UID + phone_number available
 *   2. POST /api/auth/phone-sync
 *      • localhost: handled by Vite dev middleware in vite.config.ts
 *      • production: handled by Vercel serverless function (api/auth/phone-sync.ts)
 *   3. Backend upserts Supabase `profiles` table (mobile = phone_number last 10 digits)
 *   4. Backend returns Supabase access_token + refresh_token
 *   5. Client calls supabase.auth.setSession(tokens) → AuthContext fires → user logged in
 */

export interface PhoneSyncInput {
  /** Firebase UID from verified credential (credential.user.uid) */
  firebaseUid: string;
  /** E.164 phone number e.g. "+919876543210" */
  phoneNumber: string;
  /** Optional display name */
  fullName?: string;
}

export interface PhoneSyncResult {
  success: boolean;
  error?: string;
  supabaseUserId?: string;
}

export async function syncFirebasePhoneUser(
  input: PhoneSyncInput
): Promise<PhoneSyncResult> {
  try {
    const res = await fetch("/api/auth/phone-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firebase_uid:  input.firebaseUid,
        phone_number:  input.phoneNumber,
        full_name:     input.fullName || "",
      }),
    });

    // Guard against non-JSON responses (e.g., 404 HTML pages)
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      console.error("[phoneAuthService] Non-JSON response:", res.status, text.slice(0, 300));
      return {
        success: false,
        error: `Server error (${res.status}). Please try again.`,
      };
    }

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error || "Failed to link phone number. Please try again.",
      };
    }

    // Hydrate Supabase client session from returned tokens
    if (data.access_token && data.refresh_token) {
      await hydrateSupabaseSession(data.access_token, data.refresh_token);
    }

    return { success: true, supabaseUserId: data.supabase_user_id };
  } catch (e: any) {
    console.error("[phoneAuthService] fetch error:", e?.message);
    return {
      success: false,
      error: e?.message || "Network error. Please check your connection.",
    };
  }
}

async function hydrateSupabaseSession(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  try {
    const { getSupabaseClient } = await import("../lib/supabase");
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    console.warn("[phoneAuthService] Failed to hydrate Supabase session:", err);
  }
}
