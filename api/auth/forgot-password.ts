import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSupabaseServerClient } from "../_supabase.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

async function sendResetEmail(
  to: string,
  resetLink: string,
  name: string
): Promise<{ ok: boolean; error?: string }> {
  let lastError = "";

  const subject = "🔐 Reset Your Password — Shree Hari Keerai";
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;"><h2 style="color:#00A651;margin:0 0 16px 0;">Shree Hari Keerai</h2><p style="color:#333;font-size:16px;">Hello <strong>${name}</strong>,</p><p style="color:#555;font-size:14px;line-height:1.5;">We received a request to reset your password. Click the button below to set a new password for your account:</p><div style="text-align:center;margin:28px 0;"><a href="${resetLink}" target="_blank" style="display:inline-block;background-color:#00A651;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:bold;letter-spacing:0.5px;">Set New Password 🔐</a></div><p style="color:#777;font-size:12px;line-height:1.5;">Or copy and paste this link into your browser:<br><a href="${resetLink}" style="color:#00A651;word-break:break-all;">${resetLink}</a></p><p style="color:#666;font-size:13px;margin-top:20px;">This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0;"><p style="color:#999;font-size:12px;">Fresh greens delivered across Coimbatore · Shree Hari Keerai</p></div>`;

  // 1. Try Resend
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
          subject,
          html,
        }),
      });

      if (res.ok) {
        return { ok: true };
      }

      const errData = await res.json().catch(() => ({} as Record<string, string>));
      lastError = (errData as Record<string, string>).message || "Resend email send failed";
      console.warn(`[forgot-password] Resend failed for ${to}:`, lastError);
    } catch (e: any) {
      lastError = e?.message || "Resend exception";
    }
  }

  // 2. Fallback to Google Apps Script Webhook
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.VITE_ORDER_WEBHOOK_URL || "";
  if (webhookUrl) {
    try {
      const gasRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "send_password_reset",
          email: to,
          resetLink,
          fullName: name,
          html,
        }),
      });
      const gasText = await gasRes.text();
      let gasData: any = {};
      try { gasData = JSON.parse(gasText); } catch {}
      if (gasData?.success && gasData?.emailSent) {
        console.log(`[forgot-password] Successfully sent password reset email via Google Apps Script to ${to}`);
        return { ok: true };
      }
    } catch (gasErr: any) {
      console.warn("[forgot-password] GAS fallback error:", gasErr?.message);
    }
  }

  return { ok: false, error: lastError || "Could not send password reset email" };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, redirectTo } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const serverClient = getSupabaseServerClient();
  if (!serverClient) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  // Find user by email
  const { data: listData, error: listError } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) {
    return res.status(500).json({ error: listError.message });
  }

  const user = (listData?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(404).json({
      notFound: true,
      error: "No account found with this email address. Please create an account first.",
    });
  }

  // Generate secure recovery link using admin client (no Supabase SMTP needed)
  const fallbackRedirect = process.env.VITE_SITE_URL ? `${process.env.VITE_SITE_URL}/reset-password` : "https://shrreeharikeerai-app.vercel.app/reset-password";
  const targetRedirect = redirectTo || fallbackRedirect;

  const { data: linkData, error: linkError } = await serverClient.auth.admin.generateLink({
    type: "recovery",
    email: cleanEmail,
    options: {
      redirectTo: targetRedirect,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    return res.status(500).json({ error: linkError?.message || "Could not generate password reset link" });
  }

  const actionLink = linkData.properties.action_link;
  const displayName = user.user_metadata?.full_name || cleanEmail.split("@")[0];

  const emailResult = await sendResetEmail(cleanEmail, actionLink, displayName);
  if (!emailResult.ok) {
    return res.status(400).json({
      error: `Could not send reset email to ${cleanEmail}. ${emailResult.error || ""}`,
    });
  }

  return res.status(200).json({ success: true });
}
