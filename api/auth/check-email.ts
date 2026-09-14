import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServerClient } from "../_supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email, checkOnly, action } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const serverClient = getSupabaseServerClient();

    if (!serverClient) {
      return res.status(200).json({ exists: false, isVerified: false });
    }

    // Fast indexed lookup on profiles table first
    const { data: profileMatch } = await serverClient
      .from("profiles")
      .select("id, email")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (profileMatch && (checkOnly || action === "forgot-password")) {
      return res.status(200).json({ exists: true, isVerified: true });
    }

    const { data, error } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      console.warn("[check-email] listUsers error:", error.message);
      return res.status(200).json({ exists: Boolean(profileMatch), isVerified: Boolean(profileMatch) });
    }

    const existingUser = (data?.users || []).find(
      (u: any) => u.email?.toLowerCase() === cleanEmail
    );

    if (!existingUser) {
      return res.status(200).json({ exists: false, isVerified: false });
    }

    const isVerified = Boolean(
      existingUser.email_confirmed_at ||
      existingUser.confirmed_at ||
      existingUser.user_metadata?.email_verified === true
    );

    // If checkOnly or action is forgot-password: NEVER delete anything!
    if (checkOnly || action === "forgot-password") {
      return res.status(200).json({ exists: isVerified, isVerified });
    }

    if (isVerified) {
      // User is verified and already has an active account for signup
      return res.status(200).json({ exists: true, isVerified: true });
    }

    // Stale unverified signup: the customer previously entered this email but never entered/verified the OTP.
    // Clean up the unverified record so a fresh, clean signup with a fresh 6-digit OTP can proceed.
    try {
      await serverClient.auth.admin.deleteUser(existingUser.id);
      console.log(`[check-email] Cleaned stale unverified user ${existingUser.id} (${cleanEmail})`);
    } catch (delErr: any) {
      console.warn("[check-email] Could not clean stale unverified user:", delErr.message);
    }

    return res.status(200).json({ exists: false, isVerified: false, wasCleaned: true });
  } catch (err: any) {
    console.error("[check-email] Exception:", err);
    return res.status(200).json({ exists: false, isVerified: false });
  }
}
