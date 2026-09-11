import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServerClient } from "./_supabase";

/**
 * POST /api/phone-login
 * Body: {
 *   phone: string,           // 10-digit Indian number, already verified by Firebase on client
 *   mode?: "login" | "signup",// defaults to "login"
 *   fullName?: string,       // optional, used for signup
 *   email?: string           // optional, used for signup
 * }
 *
 * Firebase verified phone on the client → this endpoint links/creates the Supabase user
 * and returns { tokenHash } so client calls supabase.auth.verifyOtp() to establish
 * a real Supabase session — 100% Free Firebase Phone Auth, zero Twilio SMS required!
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const rawPhone: string = (body?.phone ?? "").replace(/\D/g, "");
  const mode: "login" | "signup" = body?.mode === "signup" ? "signup" : "login";
  const fullName: string = (body?.fullName ?? "").trim();
  const providedEmail: string = (body?.email ?? "").trim().toLowerCase();

  // Basic validation: 10-digit Indian number starting with 6-9
  if (!/^[6-9]\d{9}$/.test(rawPhone)) {
    return res.status(400).json({ error: "Invalid mobile number. Must be a 10-digit Indian number." });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return res.status(500).json({ error: "Server configuration error. Supabase client unavailable." });
  }

  try {
    // 1. Look up existing user across Supabase auth & profiles
    let existingUser: any = null;

    // Check profiles table (safely in case table does not exist)
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email, mobile")
        .eq("mobile", rawPhone)
        .maybeSingle();

      if (profile?.id) {
        const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
        if (authUser?.user) {
          existingUser = authUser.user;
        }
      }
    } catch {
      // profiles table might not exist in database yet
    }

    // Search through auth.users if not found in profiles
    if (!existingUser) {
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (!listErr && listData?.users) {
        existingUser = listData.users.find((u) => {
          const m = (u.user_metadata?.mobile || u.user_metadata?.phone || "").replace(/\D/g, "");
          const p = (u.phone || "").replace(/\D/g, "");
          return (
            m === rawPhone ||
            p === rawPhone ||
            p === `91${rawPhone}` ||
            u.email === `${rawPhone}@phone.shreeharikeerai.local`
          );
        });
      }
    }

    // ── LOGIN FLOW ───────────────────────────────────────────────────────────
    if (mode === "login") {
      if (!existingUser) {
        return res.status(404).json({
          error: "No account found with this mobile number. Please create an account first.",
        });
      }

      let userEmail = existingUser.email || "";
      if (!userEmail) {
        userEmail = `${rawPhone}@phone.shreeharikeerai.local`;
        try {
          await supabase.auth.admin.updateUserById(existingUser.id, { email: userEmail });
        } catch {
          /* ignore */
        }
      }

      // Generate magiclink token
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
        options: { shouldCreateUser: false },
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        console.error("[phone-login] generateLink error:", linkErr?.message);
        return res.status(500).json({ error: "Could not generate login token. Please try again." });
      }

      return res.status(200).json({
        tokenHash: linkData.properties.hashed_token,
        email: userEmail,
      });
    }

    // ── SIGNUP FLOW ──────────────────────────────────────────────────────────
    if (mode === "signup") {
      if (existingUser) {
        return res.status(409).json({
          error: "An account with this mobile number already exists. Please sign in.",
        });
      }

      // Choose email: use provided email if valid, or generate unique local email for phone account
      let userEmail =
        providedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providedEmail)
          ? providedEmail
          : `${rawPhone}@phone.shreeharikeerai.local`;

      // Check if this email is already registered to someone else
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emailTaken = listData?.users?.some((u) => u.email?.toLowerCase() === userEmail.toLowerCase());
      if (emailTaken) {
        if (providedEmail) {
          return res.status(409).json({
            error: "An account with this email already exists. Please use a different email or log in.",
          });
        }
        userEmail = `${rawPhone}-${Date.now().toString(36)}@phone.shreeharikeerai.local`;
      }

      // Create user in Supabase auth
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: userEmail,
        email_confirm: true,
        user_metadata: {
          full_name: fullName || "Valued Customer",
          name: fullName || "Valued Customer",
          mobile: rawPhone,
          phone_verified: true,
        },
      });

      if (createErr || !newUser?.user) {
        console.error("[phone-signup] createUser error:", createErr?.message);
        return res.status(500).json({
          error: createErr?.message || "Failed to create customer account. Please try again.",
        });
      }

      // Try upserting into profiles table if present
      try {
        await supabase.from("profiles").upsert(
          {
            id: newUser.user.id,
            full_name: fullName || "Valued Customer",
            email: userEmail,
            mobile: rawPhone,
          },
          { onConflict: "id" }
        );
      } catch {
        /* ignore */
      }

      // Generate magiclink token so client can immediately establish session
      const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
      });

      if (linkErr || !linkData?.properties?.hashed_token) {
        console.error("[phone-signup] generateLink error:", linkErr?.message);
        return res.status(500).json({ error: "Account created, but failed to log in automatically. Please log in." });
      }

      return res.status(200).json({
        tokenHash: linkData.properties.hashed_token,
        email: userEmail,
        isNew: true,
      });
    }

    return res.status(400).json({ error: "Invalid action mode." });
  } catch (err: any) {
    console.error("[phone-login] unexpected error:", err?.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}
