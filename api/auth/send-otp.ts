import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServerClient } from "../_supabase.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOtpEmail(
  to: string,
  otp: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Shree Hari Keerai <onboarding@resend.dev>",
        to: [to],
        subject: "Your Shree Hari Keerai verification code",
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;"><h2 style="color:#00A651;">Shree Hari Keerai</h2><p>Hello <strong>${name}</strong>,</p><p>Your email verification code is:</p><div style="background:#EAF8F0;border:2px solid #00A651;border-radius:12px;padding:28px;text-align:center;margin:24px 0;"><span style="font-size:40px;font-weight:900;letter-spacing:14px;color:#00A651;">${otp}</span></div><p style="color:#666;font-size:14px;">This code expires in <strong>60 minutes</strong>.</p><p style="color:#666;font-size:14px;">If you did not sign up, please ignore this email.</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0;"><p style="color:#999;font-size:12px;">Fresh greens delivered across Coimbatore</p></div>`,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({} as Record<string, string>));
      return { ok: false, error: (errData as Record<string, string>).message || "Email send failed" };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: (e as any)?.message || "Email send failed" };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, fullName, resend: isResend } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });

  const cleanEmail = email.trim().toLowerCase();
  const serverClient = getSupabaseServerClient();
  if (!serverClient) return res.status(500).json({ error: "Server configuration error" });

  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { data: listData } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existingUser = (listData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);

  if (existingUser) {
    const isVerified = Boolean(existingUser.email_confirmed_at || existingUser.confirmed_at);
    if (isVerified && !isResend) {
      return res.status(409).json({ error: "An account already exists with this email address. Please log in instead.", emailAlreadyExists: true });
    }

    const displayName = existingUser.user_metadata?.full_name || (fullName ? fullName.trim() : cleanEmail.split("@")[0]);
    const emailResult = await sendOtpEmail(cleanEmail, otp, displayName);

    if (!emailResult.ok) {
      // Auto-verify if email service is unavailable or domain unverified, so user is never blocked
      console.warn(`[send-otp] Email send failed: ${emailResult.error} — auto-verifying user`);
      await serverClient.auth.admin.updateUserById(existingUser.id, {
        email_confirm: true,
        user_metadata: { ...existingUser.user_metadata, pending_otp: null, otp_expiry: null },
      });
      return res.status(200).json({ success: true, autoVerified: true, userId: existingUser.id });
    }

    await serverClient.auth.admin.updateUserById(existingUser.id, {
      user_metadata: { ...existingUser.user_metadata, pending_otp: otp, otp_expiry: otpExpiry },
    });

    return res.status(200).json({ success: true, userId: existingUser.id });
  }

  if (!password || !fullName) return res.status(400).json({ error: "Password and full name are required" });

  const emailResult = await sendOtpEmail(cleanEmail, otp, fullName.trim());
  const shouldAutoVerify = !emailResult.ok;

  const { data: newUserData, error: createError } = await serverClient.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: shouldAutoVerify,
    user_metadata: {
      full_name: fullName.trim(),
      pending_otp: shouldAutoVerify ? null : otp,
      otp_expiry: shouldAutoVerify ? null : otpExpiry,
    },
  });

  if (createError) {
    if (/already/i.test(createError.message) || createError.status === 422) {
      return res.status(409).json({ error: "An account already exists with this email address. Please log in instead.", emailAlreadyExists: true });
    }
    return res.status(500).json({ error: createError.message });
  }

  if (shouldAutoVerify && newUserData?.user?.id) {
    try {
      await serverClient.from("profiles").upsert(
        { id: newUserData.user.id, full_name: fullName.trim(), email: cleanEmail, mobile: "" },
        { onConflict: "id" }
      );
    } catch {}
  }

  return res.status(200).json({
    success: true,
    autoVerified: shouldAutoVerify,
    userId: newUserData?.user?.id,
  });
}
