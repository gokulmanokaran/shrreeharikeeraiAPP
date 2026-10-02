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
  let lastError = "";

  // 1. PRIMARY: Google Apps Script Webhook (Gmail - no domain restriction, works for any recipient)
  const webhookUrl =
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    process.env.VITE_ORDER_WEBHOOK_URL ||
    process.env.ORDER_WEBHOOK_URL ||
    "https://script.google.com/macros/s/AKfycbzjXsA4gHp4u30Qx9RhFamyOIrSjqs2yi9K5wAF1YylK8FU9Ushsex8kffAIIRUR3bI/exec";
  if (webhookUrl) {
    try {
      const gasRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "send_otp",
          email: to,
          otp,
          fullName: name,
        }),
      });
      const gasText = await gasRes.text();
      let gasData: any = {};
      try { gasData = JSON.parse(gasText); } catch {}
      if (gasData?.success && gasData?.emailSent) {
        console.log(`[send-otp] OTP sent via Google Apps Script to ${to}`);
        return { ok: true };
      }
      lastError = gasData?.error || "Google Apps Script did not confirm delivery";
      console.warn(`[send-otp] GAS response for ${to}:`, gasText.slice(0, 200));
    } catch (gasErr: any) {
      lastError = gasErr?.message || "GAS exception";
      console.warn("[send-otp] Google Apps Script error:", lastError);
    }
  }

  // 2. FALLBACK: Resend API (only works if recipient is verified owner email OR domain is verified)
  if (RESEND_API_KEY) {
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
          html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;"><h2 style="color:#00A651;margin:0 0 16px 0;">Shree Hari Keerai</h2><p style="color:#333;font-size:16px;">Hello <strong>${name}</strong>,</p><p style="color:#555;font-size:14px;">Your email verification code is:</p><div style="background:#EAF8F0;border:2px solid #00A651;border-radius:12px;padding:24px;text-align:center;margin:24px 0;"><span style="font-size:38px;font-weight:900;letter-spacing:12px;color:#00A651;">${otp}</span></div><p style="color:#666;font-size:14px;">This code expires in <strong>60 minutes</strong>.</p><p style="color:#666;font-size:14px;">If you did not sign up, please ignore this email.</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0;"><p style="color:#999;font-size:12px;">Fresh greens delivered across Coimbatore · Shree Hari Keerai</p></div>`,
        }),
      });

      if (res.ok) {
        return { ok: true };
      }

      const errData = await res.json().catch(() => ({} as Record<string, string>));
      lastError = (errData as Record<string, string>).message || "Resend email send failed";
      console.warn(`[send-otp] Resend also failed for ${to}: ${lastError}`);
    } catch (e: any) {
      lastError = (e as any)?.message || "Resend exception";
    }
  }

  return { ok: false, error: lastError || "Could not send verification email. Please try again." };
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
      return res.status(400).json({
        error: `Could not send verification email to ${cleanEmail}. ${emailResult.error || ""}`,
        emailSendFailed: true,
      });
    }

    await serverClient.auth.admin.updateUserById(existingUser.id, {
      user_metadata: { ...existingUser.user_metadata, pending_otp: otp, otp_expiry: otpExpiry },
    });

    return res.status(200).json({ success: true, userId: existingUser.id });
  }

  if (!password || !fullName) return res.status(400).json({ error: "Password and full name are required" });

  // 1. Try sending the OTP email first
  const emailResult = await sendOtpEmail(cleanEmail, otp, fullName.trim());

  if (!emailResult.ok) {
    return res.status(400).json({
      error: `Could not send verification email to ${cleanEmail}. ${emailResult.error || "Resend test account only allows sending to shreeharikeerai1@gmail.com until domain is verified."}`,
      emailSendFailed: true,
    });
  }

  // 2. Create the user in unconfirmed state with pending_otp
  const { data: newUserData, error: createError } = await serverClient.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: false,
    user_metadata: {
      full_name: fullName.trim(),
      pending_otp: otp,
      otp_expiry: otpExpiry,
    },
  });

  if (createError) {
    if (/already/i.test(createError.message) || createError.status === 422) {
      return res.status(409).json({ error: "An account already exists with this email address. Please log in instead.", emailAlreadyExists: true });
    }
    return res.status(500).json({ error: createError.message });
  }

  return res.status(200).json({
    success: true,
    userId: newUserData?.user?.id,
  });
}
