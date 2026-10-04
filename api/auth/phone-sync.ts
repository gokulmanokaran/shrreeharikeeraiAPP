/**
 * /api/auth/phone-sync
 * ─────────────────────
 * Vercel serverless function that bridges Firebase Phone Auth with Supabase.
 *
 * Request body (POST):
 *   {
 *     firebase_uid:  string,   // Firebase UID from verified credential
 *     phone_number:  string,   // E.164 e.g. "+919876543210"
 *     full_name?:    string    // Optional display name
 *   }
 *
 * Response (200):
 *   {
 *     supabase_user_id: string,
 *     access_token:     string,
 *     refresh_token:    string
 *   }
 *
 * Strategy:
 *   1. Look up `profiles` table for existing row by mobile (phone_number)
 *      or by firebase_uid (stored in profiles.firebase_uid if present)
 *   2. If found → reuse that Supabase user id
 *   3. If not found → create a new Supabase Auth user with
 *      email = <firebase_uid>@phone.shreehari.app (synthetic, never emailed)
 *      and upsert a profiles row with mobile = phone_number
 *   4. Generate a Supabase magic-link / admin sign-in to get access + refresh tokens
 *   5. Return tokens to client so AuthContext is hydrated
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://wmzevbfhziroffoyxkxf.supabase.co";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdminClient() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not set.");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Converts a phone number to a deterministic synthetic email used only as Supabase auth identifier. */
function phoneToSyntheticEmail(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `phone_${digits}@shreehari-phone.internal`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return res
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
      .setHeader("Access-Control-Allow-Headers", "Content-Type")
      .status(204)
      .end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { firebase_uid, phone_number, full_name = "" } = req.body || {};

  // ── Validation ────────────────────────────────────────────────────────────
  if (!firebase_uid || typeof firebase_uid !== "string") {
    return res.status(400).json({ error: "firebase_uid is required." });
  }
  if (!phone_number || typeof phone_number !== "string") {
    return res.status(400).json({ error: "phone_number is required." });
  }
  if (!/^\+\d{7,15}$/.test(phone_number)) {
    return res.status(400).json({ error: "phone_number must be in E.164 format." });
  }

  try {
    const supabase = getAdminClient();
    const syntheticEmail = phoneToSyntheticEmail(phone_number);

    // ── Step 1: Check if a profile already exists for this phone number ──────
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, full_name, mobile")
      .eq("mobile", phone_number.replace(/\D/g, "").slice(-10)) // last 10 digits stored without country code
      .maybeSingle();

    let supabaseUserId: string | null = existingProfile?.id ?? null;

    // ── Step 2: If no profile row, check Supabase Auth by synthetic email ───
    if (!supabaseUserId) {
      const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existingAuthUser = userList?.users?.find(
        (u) => u.email === syntheticEmail
      );
      if (existingAuthUser) {
        supabaseUserId = existingAuthUser.id;
      }
    }

    // ── Step 3: Create Supabase Auth user if still not found ─────────────────
    if (!supabaseUserId) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true, // bypass email confirmation
        user_metadata: {
          full_name: full_name || "",
          mobile: phone_number,
          firebase_uid,
          auth_provider: "firebase_phone",
        },
        password: crypto.randomUUID(), // random password — user never uses it
      });

      if (createErr || !newUser?.user) {
        console.error("[phone-sync] createUser error:", createErr?.message);
        return res.status(500).json({
          error: createErr?.message || "Failed to create user account.",
        });
      }

      supabaseUserId = newUser.user.id;
    }

    // ── Step 4: Upsert `profiles` row ────────────────────────────────────────
    const mobileShort = phone_number.replace(/\D/g, "").slice(-10);
    await supabase
      .from("profiles")
      .upsert(
        {
          id: supabaseUserId,
          email: syntheticEmail,
          mobile: mobileShort,
          full_name: full_name || existingProfile?.full_name || "",
        },
        { onConflict: "id" }
      );

    // ── Step 5: Generate a session (sign in via admin generateLink trick) ─────
    // We use generateLink + verifyOtp to get a real access/refresh token pair.
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: syntheticEmail,
      options: { redirectTo: undefined },
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("[phone-sync] generateLink error:", linkErr?.message);
      return res.status(500).json({
        error: "Failed to generate authentication session. Please try again.",
      });
    }

    // Verify the magic link token to exchange it for access + refresh tokens
    const { data: sessionData, error: verifyErr } = await supabase.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    });

    if (verifyErr || !sessionData?.session) {
      console.error("[phone-sync] verifyOtp error:", verifyErr?.message);
      return res.status(500).json({
        error: "Failed to create session. Please try again.",
      });
    }

    const { access_token, refresh_token } = sessionData.session;

    console.log(`[phone-sync] ✓ Phone user synced: ${phone_number} → supabase_id=${supabaseUserId}`);

    return res.status(200).json({
      supabase_user_id: supabaseUserId,
      access_token,
      refresh_token,
    });
  } catch (err: any) {
    console.error("[phone-sync] Unexpected error:", err?.message || err);
    return res.status(500).json({
      error: err?.message || "An unexpected error occurred. Please try again.",
    });
  }
}
