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
        signal: AbortSignal.timeout(24000),
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

  // 2. FALLBACK: Resend API (for verified domain or owner email)
  if (RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(5000),
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
    } catch (e: any) {
      console.warn("[send-otp] Resend fallback error:", e?.message);
    }
  }

  return { ok: false, error: lastError || "Could not send verification email. Please try again." };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, password, fullName, resend: isResend, userId } = req.body || {};
  if (!email) return res.status(400).json({ error: "Email is required" });

  const cleanEmail = email.trim().toLowerCase();
  const serverClient = getSupabaseServerClient();
  if (!serverClient) return res.status(500).json({ error: "Server configuration error" });

  const otp = generateOtp();
  const otpExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // ── RESEND FLOW ────────────────────────────────────────────────────────────
  if (isResend) {
    let existingUser: any = null;
    if (userId) {
      const { data: userById } = await serverClient.auth.admin.getUserById(userId);
      if (userById?.user && userById.user.email?.toLowerCase() === cleanEmail) {
        existingUser = userById.user;
      }
    }
    if (!existingUser) {
      const { data: listData } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      existingUser = (listData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
    }

    if (!existingUser) {
      return res.status(404).json({ error: "No account found with this email. Please sign up." });
    }

    const displayName = existingUser.user_metadata?.full_name || (fullName ? fullName.trim() : cleanEmail.split("@")[0]);

    // Run updateUser and sendOtpEmail in parallel for speed
    const [, emailResult] = await Promise.all([
      serverClient.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { ...existingUser.user_metadata, pending_otp: otp, otp_expiry: otpExpiry },
      }),
      sendOtpEmail(cleanEmail, otp, displayName),
    ]);

    if (!emailResult.ok) {
      return res.status(400).json({
        error: `Could not send verification email to ${cleanEmail}. ${emailResult.error || ""}`,
        emailSendFailed: true,
      });
    }

    return res.status(200).json({ success: true, userId: existingUser.id });
  }

  // ── FRESH SIGNUP FLOW ──────────────────────────────────────────────────────
  if (!password || !fullName) return res.status(400).json({ error: "Password and full name are required" });

  // Fast check: is this email already confirmed and in profiles? (~35ms indexed query)
  const { data: existingProfile } = await serverClient
    .from("profiles")
    .select("id")
    .ilike("email", cleanEmail)
    .maybeSingle();

  if (existingProfile) {
    return res.status(409).json({
      error: "An account already exists with this email address. Please log in instead.",
      emailAlreadyExists: true,
    });
  }

  // Run createUser AND sendOtpEmail in PARALLEL for maximum speed!
  const [createResult, emailResult] = await Promise.all([
    serverClient.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName.trim(),
        pending_otp: otp,
        otp_expiry: otpExpiry,
      },
    }),
    sendOtpEmail(cleanEmail, otp, fullName.trim()),
  ]);

  // Handle user already registered (unconfirmed account from previous attempt)
  if (createResult.error) {
    if (/already/i.test(createResult.error.message) || createResult.error.status === 422) {
      const { data: listData } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = (listData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
      if (existing) {
        const isVerified = Boolean(existing.email_confirmed_at || existing.confirmed_at);
        if (isVerified) {
          return res.status(409).json({
            error: "An account already exists with this email address. Please log in instead.",
            emailAlreadyExists: true,
          });
        }

        // Update the existing unconfirmed user with the new password and OTP
        await serverClient.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: { ...existing.user_metadata, full_name: fullName.trim(), pending_otp: otp, otp_expiry: otpExpiry },
        });

        if (!emailResult.ok) {
          return res.status(400).json({
            error: `Could not send verification email to ${cleanEmail}. ${emailResult.error || ""}`,
            emailSendFailed: true,
          });
        }

        return res.status(200).json({ success: true, userId: existing.id });
      }
    }
    return res.status(500).json({ error: createResult.error.message });
  }

  // If email sending failed, clean up the unconfirmed user so user can retry cleanly
  if (!emailResult.ok) {
    if (createResult.data?.user?.id) {
      await serverClient.auth.admin.deleteUser(createResult.data.user.id).catch(() => {});
    }
    return res.status(400).json({
      error: `Could not send verification email to ${cleanEmail}. ${emailResult.error || "Please try again."}`,
      emailSendFailed: true,
    });
  }

  return res.status(200).json({
    success: true,
    userId: createResult.data?.user?.id,
  });
}
