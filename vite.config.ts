import { defineConfig, type Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "node:url";


// ── Shared Local Dev API ─────────────────────────────────────────────────────
// Serves /api/products and /api/categories from data/catalog.json
// The admin panel writes to this same file → changes reflect immediately.
// ─────────────────────────────────────────────────────────────────────────────

const CATALOG_FILE = path.resolve(__dirname, "data/catalog.json");

function readCatalog(): { products: unknown[]; categories: unknown[] } {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const raw = fs.readFileSync(CATALOG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        products: Array.isArray(parsed.products) ? parsed.products : [],
        categories: Array.isArray(parsed.categories) ? parsed.categories : [],
      };
    }
  } catch (e) {
    console.warn("[DevAPI] Could not read data/catalog.json:", e);
  }
  return { products: [], categories: [] };
}

function autoSeedIfEmpty(): void {
  const catalog = readCatalog();
  if (catalog.products.length > 0) return; // already seeded

  console.log("[DevAPI] catalog.json is empty — auto-seeding from _catalog.ts...");
  try {
    // Dynamically require the seed script
    const { execSync } = require("child_process");
    execSync("npx tsx scripts/seed-catalog.ts", {
      cwd: __dirname,
      stdio: "inherit",
    });
    console.log("[DevAPI] ✅ Auto-seed complete.");
  } catch (e) {
    console.warn("[DevAPI] Auto-seed failed:", e);
  }
}

function localDevApiPlugin(): Plugin {
  return {
    name: "sri-hari-local-dev-api",
    configureServer(server) {
      // Auto-seed on startup if catalog.json is missing/empty
      autoSeedIfEmpty();

      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        const env = loadEnv(server.config.mode, process.cwd(), "");
        for (const [key, value] of Object.entries(env)) {
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
        if (!process.env.SUPABASE_URL) {
          process.env.SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
        }
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
        }

        if (url.startsWith("/api/auth/check-email") && (req.method === "POST" || req.method === "OPTIONS")) {
          if (req.method === "OPTIONS") {
            res.statusCode = 200;
            res.end();
            return;
          }
          let rawBody = "";
          req.on("data", (chunk: any) => {
            rawBody += chunk;
          });
          req.on("end", async () => {
            try {
              const body = JSON.parse(rawBody || "{}");
              const targetEmail = String(body?.email || "").trim().toLowerCase();
              if (!targetEmail) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 400;
                res.end(JSON.stringify({ exists: false, error: "Email is required" }));
                return;
              }

              const serverModUrl = pathToFileURL(path.resolve(__dirname, "api/_supabase.ts")).href;
              const { getSupabaseServerClient } = (await import(serverModUrl)) as {
                getSupabaseServerClient: () => any;
              };
              const serverClient = getSupabaseServerClient();
              if (!serverClient) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ exists: false }));
                return;
              }

              const { data } = await serverClient.auth.admin.listUsers();
              const existingUser = (data?.users || []).find(
                (u: any) => u.email?.toLowerCase() === targetEmail
              );

              if (!existingUser) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ exists: false, isVerified: false }));
                return;
              }

              const isVerified = Boolean(
                existingUser.email_confirmed_at ||
                existingUser.confirmed_at ||
                existingUser.user_metadata?.email_verified === true
              );

              const checkOnly = Boolean(body?.checkOnly || body?.action === "forgot-password");
              if (checkOnly) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ exists: isVerified, isVerified }));
                return;
              }

              if (isVerified) {
                res.setHeader("Content-Type", "application/json");
                res.statusCode = 200;
                res.end(JSON.stringify({ exists: true, isVerified: true }));
                return;
              }

              // Clean stale unverified signup
              try {
                await serverClient.auth.admin.deleteUser(existingUser.id);
                console.log(`[DevAPI check-email] Cleaned stale unverified user ${existingUser.id}`);
              } catch (delErr: any) {
                console.warn("[DevAPI check-email] Delete failed:", delErr.message);
              }

              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ exists: false, isVerified: false, wasCleaned: true }));
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ exists: false, isVerified: false }));
            }
          });
          return;
        }

        // POST /api/auth/send-otp  (local dev)
        if (url.startsWith("/api/auth/send-otp") && (req.method === "POST" || req.method === "OPTIONS")) {
          if (req.method === "OPTIONS") { res.statusCode = 200; res.end(); return; }
          let rawBody = "";
          req.on("data", (chunk: any) => { rawBody += chunk; });
          req.on("end", async () => {
            try {
              const body = JSON.parse(rawBody || "{}");
              const { email, password, fullName, resend: isResend } = body;
              if (!email) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Email is required" }));
                return;
              }

              const serverModUrl = pathToFileURL(path.resolve(__dirname, "api/_supabase.ts")).href;
              const { getSupabaseServerClient } = (await import(serverModUrl)) as {
                getSupabaseServerClient: () => any;
              };
              const serverClient = getSupabaseServerClient();
              if (!serverClient) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Server configuration error" }));
                return;
              }

              const cleanEmail = String(email).trim().toLowerCase();
              const otp = Math.floor(100000 + Math.random() * 900000).toString();
              const otpExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();

              const apiKey = process.env.RESEND_API_KEY || "";
              let emailSent = false;
              let emailError = "";

              // 1. PRIMARY: Google Apps Script Webhook (Gmail - works for any recipient)
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
                      email: cleanEmail,
                      otp,
                      fullName: fullName || "Customer",
                    }),
                  });
                  const gasText = await gasRes.text();
                  let gasData: any = {};
                  try { gasData = JSON.parse(gasText); } catch {}
                  if (gasData?.success && gasData?.emailSent) {
                    console.log(`[DevAPI send-otp] Successfully sent OTP via Google Apps Script to ${cleanEmail}`);
                    emailSent = true;
                  } else {
                    emailError = gasData?.error || "Google Apps Script did not send OTP";
                  }
                } catch (gasErr: any) {
                  emailError = gasErr?.message || "GAS error";
                  console.warn("[DevAPI send-otp] GAS error:", emailError);
                }
              }

              // 2. FALLBACK: Resend
              if (!emailSent && apiKey) {
                try {
                  const resendRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      from: "Shree Hari Keerai <onboarding@resend.dev>",
                      to: [cleanEmail],
                      subject: "Your Shree Hari Keerai verification code",
                      html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;"><h2 style="color:#00A651;margin:0 0 16px 0;">Shree Hari Keerai</h2><p style="color:#333;font-size:16px;">Hello <strong>${fullName || "Customer"}</strong>,</p><p style="color:#555;font-size:14px;">Your email verification code is:</p><div style="background:#EAF8F0;border:2px solid #00A651;border-radius:12px;padding:24px;text-align:center;margin:24px 0;"><span style="font-size:38px;font-weight:900;letter-spacing:12px;color:#00A651;">${otp}</span></div><p style="color:#666;font-size:14px;">This code expires in <strong>60 minutes</strong>.</p><p style="color:#666;font-size:14px;">If you did not sign up, please ignore this email.</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0;"><p style="color:#999;font-size:12px;">Fresh greens delivered across Coimbatore · Shree Hari Keerai</p></div>`,
                    }),
                  });
                  if (resendRes.ok) {
                    emailSent = true;
                  } else {
                    const errData: any = await resendRes.json().catch(() => ({}));
                    emailError = errData?.message || "Resend email send failed";
                    console.warn(`[DevAPI send-otp] Resend failed for ${cleanEmail}:`, emailError);
                  }
                } catch (e: any) {
                  emailError = e?.message || "Resend error";
                }
              }

              if (!emailSent) {
                console.error(`[DevAPI send-otp] Could not send OTP to ${cleanEmail}: ${emailError}`);
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  error: `Could not send OTP to ${cleanEmail}. Resend free account only sends to shreeharikeerai1@gmail.com until domain is verified. Please test with shreeharikeerai1@gmail.com or verify domain on resend.com.`,
                  emailSendFailed: true,
                }));
                return;
              }

              const { data: listData } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
              const existingUser = (listData?.users || []).find((u: any) => u.email?.toLowerCase() === cleanEmail);

              if (existingUser) {
                const isVerified = Boolean(existingUser.email_confirmed_at || existingUser.confirmed_at);
                if (isVerified && !isResend) {
                  res.statusCode = 409;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "An account already exists with this email address. Please log in instead.", emailAlreadyExists: true }));
                  return;
                }

                await serverClient.auth.admin.updateUserById(existingUser.id, {
                  user_metadata: { ...existingUser.user_metadata, pending_otp: otp, otp_expiry: otpExpiry },
                });
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, userId: existingUser.id }));
                return;
              }

              if (!password || !fullName) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Password and full name are required" }));
                return;
              }

              const { data: newUserData, error: createError } = await serverClient.auth.admin.createUser({
                email: cleanEmail,
                password,
                email_confirm: false,
                user_metadata: {
                  full_name: String(fullName).trim(),
                  pending_otp: otp,
                  otp_expiry: otpExpiry,
                },
              });

              if (createError) {
                if (/already/i.test(createError.message) || createError.status === 422) {
                  res.statusCode = 409;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: "An account already exists with this email address. Please log in instead.", emailAlreadyExists: true }));
                  return;
                }
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: createError.message }));
                return;
              }

              console.log(`[DevAPI send-otp] OTP sent to ${cleanEmail}. Waiting for OTP verification.`);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, userId: newUserData?.user?.id }));
            } catch (err: any) {
              console.error("[DevAPI send-otp]:", err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err?.message || "Internal error" }));
              }
            }
          });
          return;
        }

        // POST /api/auth/verify-otp  (local dev)
        if (url.startsWith("/api/auth/verify-otp") && (req.method === "POST" || req.method === "OPTIONS")) {
          if (req.method === "OPTIONS") { res.statusCode = 200; res.end(); return; }
          let rawBody = "";
          req.on("data", (chunk: any) => { rawBody += chunk; });
          req.on("end", async () => {
            try {
              const body = JSON.parse(rawBody || "{}");
              const { email, otp, userId } = body;
              if (!email || !otp) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Email and OTP are required" }));
                return;
              }

              const serverModUrl = pathToFileURL(path.resolve(__dirname, "api/_supabase.ts")).href;
              const { getSupabaseServerClient } = (await import(serverModUrl)) as {
                getSupabaseServerClient: () => any;
              };
              const serverClient = getSupabaseServerClient();
              if (!serverClient) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Server configuration error" }));
                return;
              }

              const cleanEmail = String(email).trim().toLowerCase();
              const cleanOtp = String(otp).trim();

              let user: any = null;
              if (userId) {
                const { data: userData } = await serverClient.auth.admin.getUserById(userId);
                if (userData?.user && userData.user.email?.toLowerCase() === cleanEmail) {
                  user = userData.user;
                }
              }

              if (!user) {
                const { data: listData } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
                user = (listData?.users || []).find((u: any) => u.email?.toLowerCase() === cleanEmail);
              }

              if (!user) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "No account found. Please sign up again." }));
                return;
              }

              const storedOtp = user.user_metadata?.pending_otp;
              const otpExpiry = user.user_metadata?.otp_expiry;

              if (!storedOtp) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "No verification code found. Please request a new one." }));
                return;
              }

              if (new Date() > new Date(otpExpiry)) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Verification code has expired. Please request a new one." }));
                return;
              }

              if (storedOtp !== cleanOtp) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Incorrect verification code. Please try again." }));
                return;
              }

              await serverClient.auth.admin.updateUserById(user.id, {
                email_confirm: true,
                user_metadata: { ...user.user_metadata, pending_otp: null, otp_expiry: null },
              });

              const [, linkResult] = await Promise.all([
                serverClient.from("profiles").upsert(
                  { id: user.id, full_name: user.user_metadata?.full_name || "", email: cleanEmail, mobile: "" },
                  { onConflict: "id" }
                ).catch(() => null),
                serverClient.auth.admin.generateLink({
                  type: "magiclink",
                  email: cleanEmail,
                }).catch(() => null),
              ]);

              const tokenHash = (linkResult as any)?.data?.properties?.hashed_token;
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, tokenHash, userId: user.id }));
            } catch (err: any) {
              console.error("[DevAPI verify-otp]:", err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err?.message || "Internal error" }));
              }
            }
          });
          return;
        }

        // POST /api/auth/forgot-password (local dev)
        if (url.startsWith("/api/auth/forgot-password") && (req.method === "POST" || req.method === "OPTIONS")) {
          if (req.method === "OPTIONS") { res.statusCode = 200; res.end(); return; }
          let rawBody = "";
          req.on("data", (chunk: any) => { rawBody += chunk; });
          req.on("end", async () => {
            try {
              const body = JSON.parse(rawBody || "{}");
              const { email, redirectTo } = body;
              if (!email) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Email is required" }));
                return;
              }

              const serverModUrl = pathToFileURL(path.resolve(__dirname, "api/_supabase.ts")).href;
              const { getSupabaseServerClient } = (await import(serverModUrl)) as {
                getSupabaseServerClient: () => any;
              };
              const serverClient = getSupabaseServerClient();
              if (!serverClient) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "Server configuration error" }));
                return;
              }

              const cleanEmail = String(email).trim().toLowerCase();
              const { data: listData } = await serverClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
              const user = (listData?.users || []).find((u: any) => u.email?.toLowerCase() === cleanEmail);

              if (!user) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ notFound: true, error: "No account found with this email address. Please create an account first." }));
                return;
              }

              const fallbackRedirect = "http://localhost:5173/reset-password";
              const targetRedirect = redirectTo || fallbackRedirect;

              const { data: linkData, error: linkError } = await serverClient.auth.admin.generateLink({
                type: "recovery",
                email: cleanEmail,
                options: {
                  redirectTo: targetRedirect,
                },
              });

              if (linkError || !linkData?.properties?.action_link) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: linkError?.message || "Could not generate password reset link" }));
                return;
              }

              const actionLink = linkData.properties.action_link;
              const displayName = user.user_metadata?.full_name || cleanEmail.split("@")[0];

              const subject = "🔐 Reset Your Password — Shree Hari Keerai";
              const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;"><h2 style="color:#00A651;margin:0 0 16px 0;">Shree Hari Keerai</h2><p style="color:#333;font-size:16px;">Hello <strong>${displayName}</strong>,</p><p style="color:#555;font-size:14px;line-height:1.5;">We received a request to reset your password. Click the button below to set a new password for your account:</p><div style="text-align:center;margin:28px 0;"><a href="${actionLink}" target="_blank" style="display:inline-block;background-color:#00A651;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:16px;font-weight:bold;letter-spacing:0.5px;">Set New Password 🔐</a></div><p style="color:#777;font-size:12px;line-height:1.5;">Or copy and paste this link into your browser:<br><a href="${actionLink}" style="color:#00A651;word-break:break-all;">${actionLink}</a></p><p style="color:#666;font-size:13px;margin-top:20px;">This link will expire in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email.</p><hr style="border:none;border-top:1px solid #eee;margin:24px 0;"><p style="color:#999;font-size:12px;">Fresh greens delivered across Coimbatore · Shree Hari Keerai</p></div>`;

              const apiKey = process.env.RESEND_API_KEY || "";
              let emailSent = false;

              // 1. PRIMARY: Google Apps Script Webhook (Gmail - works for any recipient)
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
                      action: "send_password_reset",
                      email: cleanEmail,
                      resetLink: actionLink,
                      fullName: displayName,
                      html,
                    }),
                  });
                  const gasText = await gasRes.text();
                  let gasData: any = {};
                  try { gasData = JSON.parse(gasText); } catch {}
                  if (gasData?.success && gasData?.emailSent) {
                    console.log(`[DevAPI forgot-password] Successfully sent password reset email via GAS to ${cleanEmail}`);
                    emailSent = true;
                  }
                } catch (gasErr: any) {
                  console.warn("[DevAPI forgot-password] GAS error:", gasErr?.message);
                }
              }

              // 2. FALLBACK: Resend
              if (!emailSent && apiKey) {
                try {
                  const resendRes = await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${apiKey}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      from: "Shree Hari Keerai <onboarding@resend.dev>",
                      to: [cleanEmail],
                      subject,
                      html,
                    }),
                  });
                  emailSent = resendRes.ok;
                } catch {
                  emailSent = false;
                }
              }

              if (!emailSent) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  error: `Could not send password reset email to ${cleanEmail}. Resend free account only sends to shreeharikeerai1@gmail.com until domain is verified. Please test with shreeharikeerai1@gmail.com or verify domain on resend.com.`,
                }));
                return;
              }

              console.log(`[DevAPI forgot-password] Password reset link sent to ${cleanEmail}`);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (err: any) {
              console.error("[DevAPI forgot-password]:", err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err?.message || "Internal error" }));
              }
            }
          });
          return;
        }


        // GET /api/products
        if (url.startsWith("/api/products") && req.method === "GET") {
          const catalog = readCatalog();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              count: catalog.products.length,
              data: catalog.products,
              source: "local-file",
            })
          );
          return;
        }

        // GET /api/categories
        if (url.startsWith("/api/categories") && req.method === "GET") {
          const catalog = readCatalog();
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              success: true,
              count: catalog.categories.length,
              data: catalog.categories,
              source: "local-file",
            })
          );
          return;
        }

        // Helper to adapt Node http.ServerResponse for serverless handler compatibility
        const adaptRes = (r: any) => {
          if (!r.status) {
            r.status = function (s: number) {
              this.statusCode = s;
              return this;
            };
          }
          if (!r.json) {
            r.json = function (obj: any) {
              this.setHeader("Content-Type", "application/json");
              this.end(JSON.stringify(obj));
              return this;
            };
          }
          return r;
        };

        // Serverless handlers for payment & order lifecycle
        if (
          url.startsWith("/api/create-razorpay-order") ||
          url.startsWith("/api/verify-razorpay-payment") ||
          url.startsWith("/api/process-payment") ||
          url.startsWith("/api/order-webhook") ||
          url.startsWith("/api/razorpay-webhook")
        ) {
          adaptRes(res);
          (async () => {
            try {
              let handlerMod: any;
              if (url.startsWith("/api/create-razorpay-order")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/create-razorpay-order.ts")).href);
              } else if (url.startsWith("/api/verify-razorpay-payment")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/verify-razorpay-payment.ts")).href);
              } else if (url.startsWith("/api/process-payment")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/process-payment.ts")).href);
              } else if (url.startsWith("/api/order-webhook")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/order-webhook.ts")).href);
              } else if (url.startsWith("/api/razorpay-webhook")) {
                handlerMod = await import(pathToFileURL(path.resolve(__dirname, "api/razorpay-webhook.ts")).href);
              }

              if (handlerMod?.default) {
                await handlerMod.default(req, res);
              } else {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "Handler not found" }));
              }
            } catch (err: any) {
              console.error("[DevAPI Error]:", err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: err?.message || "Internal error" }));
              }
            }
          })();
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localDevApiPlugin()],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router-dom/")
          ) {
            return "vendor-react";
          }
          if (id.includes("node_modules/framer-motion/")) {
            return "vendor-motion";
          }
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("node_modules/@supabase/")) {
            return "vendor-supabase";
          }
        },
      },
    },

  },
});
