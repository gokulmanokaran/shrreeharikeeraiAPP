import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServerClient } from "../_supabase.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, otp, userId } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.toString().trim();

  const serverClient = getSupabaseServerClient();
  if (!serverClient) return res.status(500).json({ error: "Server configuration error" });

  // Fast user lookup: check by userId first (~30ms), then fallback to listUsers if needed
  let user: any = null;
  if (userId) {
    const { data: userData } = await serverClient.auth.admin.getUserById(userId);
    if (userData?.user && userData.user.email?.toLowerCase() === cleanEmail) {
      user = userData.user;
    }
  }

  if (!user) {
    const { data: listData } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    user = (listData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
  }

  if (!user) {
    return res.status(404).json({ error: "No account found. Please sign up again." });
  }

  const storedOtp = user.user_metadata?.pending_otp;
  const otpExpiry = user.user_metadata?.otp_expiry;

  if (!storedOtp) {
    return res.status(400).json({ error: "No verification code found. Please request a new one." });
  }

  if (new Date() > new Date(otpExpiry)) {
    return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
  }

  if (storedOtp !== cleanOtp) {
    return res.status(400).json({ error: "Incorrect verification code. Please try again." });
  }

  // Confirm user email
  const { error: updateError } = await serverClient.auth.admin.updateUserById(user.id, {
    email_confirm: true,
    user_metadata: { ...user.user_metadata, pending_otp: null, otp_expiry: null },
  });

  if (updateError) {
    return res.status(500).json({ error: "Verification failed. Please try again." });
  }

  // Run profile upsert AND magiclink generation in parallel for maximum speed!
  const [, linkResult] = await Promise.all([
    serverClient.from("profiles").upsert(
      { id: user.id, full_name: user.user_metadata?.full_name || "", email: cleanEmail, mobile: "" },
      { onConflict: "id" }
    ).then((r: any) => r, () => null),
    serverClient.auth.admin.generateLink({
      type: "magiclink",
      email: cleanEmail,
    }).then((r: any) => r, () => null),
  ]);

  const tokenHash = (linkResult as any)?.data?.properties?.hashed_token;
  return res.status(200).json({ success: true, tokenHash, userId: user.id });
}
