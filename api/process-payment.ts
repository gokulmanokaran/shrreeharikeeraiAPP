// Vercel Serverless Function: /api/process-payment
// ──────────────────────────────────────────────────────────────────────────────
// PRIMARY order processor called by the browser after a successful Razorpay payment.
//
// FLOW:
//   1. Verify Razorpay signature (if secret is configured)
//   2. Upsert order into Supabase `orders` table (durable, idempotent)
//   3. Forward to Google Apps Script for Sheets + Email (with retry & follow redirects)
//   4. Mark sheets_synced / email_sent in Supabase
//   5. Return success to browser
//
// IDEMPOTENCY:
//   If the order is already in Supabase AND confirmed synced to Sheets + Email,
//   we return alreadyProcessed: true to prevent duplicate rows and duplicate emails.
// ──────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { handleCors, parseApiRequest, sendApiResponse } from "./_catalog.js";
import { getSupabaseServerClient } from "./_supabase.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrderItem {
  id?: string;
  name: string;
  nameTamil?: string;
  quantity: number;
  price: number;
  unit?: string;
}

interface ProcessPaymentBody {
  // Storefront order fields
  orderId: string;
  createdAt?: string;
  fullName: string;
  mobile: string;
  alternateMobile?: string;
  email?: string;
  address: string;
  houseNo?: string;
  street?: string;
  area?: string;
  landmark?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  lat?: number | null;
  lng?: number | null;
  mapsLink?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  total: number;
  paymentStatus?: string;
  paymentId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  productsSummary?: string;
  totalQuantity?: number;
  formattedDate?: string;
  source?: string;
  userId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret: string
): boolean {
  const generated = crypto
    .createHmac("sha256", secret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return generated === signature;
}

interface GasCallResult {
  success: boolean;
  sheetUpdated: boolean;
  emailSent: boolean;
  attempts: number;
  lastError?: string;
  responseSnippet?: string;
}

/** Call Google Apps Script webhook with exponential backoff retry */
async function callGoogleAppsScript(
  webhookUrl: string,
  payload: object,
  maxAttempts = 3
): Promise<GasCallResult> {
  let lastError = "";
  let responseSnippet = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      // Give GAS up to 25 seconds per attempt (it can be slow on cold start)
      const timeoutId = setTimeout(() => controller.abort(), 25_000);

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: "follow",
      });
      clearTimeout(timeoutId);

      const text = await res.text().catch(() => "");
      responseSnippet = text.slice(0, 500);

      let parsed: any = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        // GAS may return non-JSON text or redirect HTML wrapper in some environments
      }

      // If HTTP ok or redirect completed
      if (res.ok || res.status === 302 || res.status === 0) {
        const isDuplicate = Boolean(parsed?.duplicate);
        // If sheet was appended OR it was already recognized as duplicate in Sheets
        const sheetUpdated = Boolean(parsed?.sheetUpdated) || isDuplicate || parsed?.status === "success";
        // If email was sent (customer or admin) OR it was duplicate
        const emailSent = Boolean(parsed?.emailSent) || Boolean(parsed?.customerEmailSent) || isDuplicate || parsed?.status === "success";

        console.info(
          `[process-payment] ✅ GAS call completed on attempt ${attempt}.`,
          {
            status: res.status,
            sheetUpdated,
            emailSent,
            duplicate: isDuplicate,
            responseSnippet: text.slice(0, 200),
          }
        );

        return {
          success: true,
          sheetUpdated,
          emailSent,
          attempts: attempt,
          responseSnippet,
        };
      }

      lastError = `HTTP ${res.status}: ${responseSnippet}`;
      console.warn(
        `[process-payment] ⚠️ GAS attempt ${attempt}/${maxAttempts} returned ${res.status}. Will retry.`
      );
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(
        `[process-payment] ⚠️ GAS attempt ${attempt}/${maxAttempts} threw: ${lastError}. Will retry.`
      );
    }

    // Exponential backoff: 1s, 2s, 4s between attempts
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }

  return {
    success: false,
    sheetUpdated: false,
    emailSent: false,
    attempts: maxAttempts,
    lastError,
    responseSnippet,
  };
}

/** Upsert order into Supabase orders table. Returns alreadyProcessed: true ONLY if both Google Sheets & Email are confirmed synced. */
async function upsertOrderToSupabase(
  data: ProcessPaymentBody
): Promise<{ alreadyProcessed: boolean; error?: string; existingOrder?: any }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn("[process-payment] Supabase client not available — order not persisted to DB.");
    return { alreadyProcessed: false };
  }

  const paymentId = data.paymentId || data.razorpayPaymentId || "";
  let existingOrderRow: any = null;

  // 1. Check if this order or payment was ALREADY completely processed & synced to Sheets and Email
  try {
    const { data: existingById } = await supabase
      .from("orders")
      .select("id, user_id, payment_status, sheets_synced, email_sent, retry_count")
      .eq("id", data.orderId)
      .maybeSingle();

    if (existingById) {
      existingOrderRow = existingById;
      const isPaid = String(existingById.payment_status || "").toLowerCase().includes("paid");
      if (isPaid && existingById.sheets_synced && existingById.email_sent) {
        console.info(
          `[process-payment] ℹ️ Order ${data.orderId} already exists in DB and is fully synced (sheets_synced=true, email_sent=true). Skipping duplicate notification.`
        );
        return { alreadyProcessed: true, existingOrder: existingById };
      }
    }

    if (paymentId) {
      const { data: existingByPayment } = await supabase
        .from("orders")
        .select("id, user_id, payment_status, sheets_synced, email_sent, retry_count")
        .eq("razorpay_payment_id", paymentId)
        .maybeSingle();

      if (existingByPayment && existingByPayment.id !== data.orderId) {
        const isPaid = String(existingByPayment.payment_status || "").toLowerCase().includes("paid");
        if (isPaid && existingByPayment.sheets_synced && existingByPayment.email_sent) {
          console.info(
            `[process-payment] ℹ️ Payment ${paymentId} was already processed under order ${existingByPayment.id} (sheets_synced=true, email_sent=true). Skipping duplicate.`
          );
          return { alreadyProcessed: true, existingOrder: existingByPayment };
        }
      }
    }
  } catch (checkErr) {
    console.warn("[process-payment] Supabase idempotency check error:", checkErr);
  }

  // 2. Resolve target user_id (from payload, existing record, or lookup registered user by email)
  let targetUserId = data.userId || existingOrderRow?.user_id || null;
  if (!targetUserId && data.email) {
    try {
      const cleanEmail = data.email.trim().toLowerCase();
      const { data: userList } = await supabase.auth.admin.listUsers();
      const matched = (userList?.users || []).find((u: any) => u.email?.toLowerCase() === cleanEmail);
      if (matched) {
        targetUserId = matched.id;
        console.info(`[process-payment] 🔗 Associated order ${data.orderId} with registered user ${targetUserId} (${cleanEmail}).`);
      }
    } catch (userLookupErr) {
      console.warn("[process-payment] Failed to lookup user by email:", userLookupErr);
    }
  }

  const mapsLink =
    data.mapsLink ||
    (data.lat && data.lng ? `https://www.google.com/maps?q=${data.lat},${data.lng}` : "");

  // These computed values are available for GAS forwarding; prefixed with void to avoid unused-var lint
  void (data.formattedDate ||
    new Date(data.createdAt || Date.now()).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    }));

  void (data.productsSummary ||
    (data.items || [])
      .map((item) => `${item.name}${item.unit ? ` (${item.unit})` : ""} × ${item.quantity}`)
      .join(", "));

  void (data.totalQuantity ||
    (data.items || []).reduce((acc, item) => acc + (item.quantity || 1), 0));

  const row = {
    id: data.orderId,
    user_id: targetUserId,
    razorpay_payment_id: paymentId || null,
    razorpay_order_id: data.razorpayOrderId || null,
    razorpay_signature: data.razorpaySignature || null,
    full_name: data.fullName || "",
    mobile: data.mobile || "",
    email: (data.email || "").trim(),
    address: data.address || "",
    city: data.city || "",
    state: data.state || "",
    pincode: data.pincode || "",
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    maps_link: mapsLink,
    subtotal: Number(data.subtotal || 0),
    delivery_charge: Number(data.deliveryCharge || 0),
    discount: Number(data.discount || 0),
    total: Number(data.total || 0),
    items: data.items || [],
    payment_status: data.paymentStatus || `Paid (Razorpay)${paymentId ? ` · ${paymentId}` : ""}`,
    sheets_synced: existingOrderRow?.sheets_synced ?? false,
    email_sent: existingOrderRow?.email_sent ?? false,
    retry_count: existingOrderRow?.retry_count ?? 0,
    source: data.source || "storefront",
  };

  // 3. Upsert order row (using server service_role key to bypass customer RLS restrictions)
  const { error } = await supabase
    .from("orders")
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.error("[process-payment] Supabase upsert error:", error);
    return { alreadyProcessed: false, error: error.message, existingOrder: existingOrderRow };
  }

  // 4. Server-side stock deduction (deduct once upon paid order)
  try {
    const validItems = (data.items || [])
      .filter((item) => item && item.id)
      .map((item) => ({
        id: String(item.id),
        quantity: Math.max(1, Number(item.quantity) || 1),
      }));
    if (validItems.length > 0 && (!existingOrderRow || existingOrderRow.retry_count === 0)) {
      await supabase.rpc("deduct_product_stock", { p_items: validItems });
      console.info(`[process-payment] ✅ Atomic stock deduction executed for order ${data.orderId}.`);
    }
  } catch (stockErr) {
    console.warn("[process-payment] Stock deduction RPC warning:", stockErr);
  }

  console.info(`[process-payment] Order ${data.orderId} successfully persisted/upserted in Supabase.`);
  return { alreadyProcessed: false, existingOrder: existingOrderRow };
}

/** Update notification status flags in Supabase */
async function updateNotificationStatus(
  orderId: string,
  updates: {
    sheets_synced?: boolean;
    email_sent?: boolean;
    retry_count?: number;
    last_error?: string | null;
    last_attempt_at?: string;
  }
): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return;

  try {
    await supabase.from("orders").update(updates).eq("id", orderId);
  } catch (err: unknown) {
    console.warn("[process-payment] Failed to update notification status:", err);
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req: any, res?: any): Promise<any> {
  if (handleCors(req, res)) return;

  const { method, body } = await parseApiRequest(req);

  if (method !== "POST") {
    return sendApiResponse(res, 405, { error: "Method not allowed. Use POST." });
  }

  const data = body as ProcessPaymentBody;
  const { orderId } = data;

  // ── 0. Basic validation ───────────────────────────────────────────────────
  if (!orderId) {
    return sendApiResponse(res, 400, { error: "Missing orderId in request body." });
  }

  const paymentId = data.paymentId || data.razorpayPaymentId || "";
  const startedAt = new Date().toISOString();

  console.info(`[process-payment] 📦 Processing order ${orderId} | Payment: ${paymentId || "N/A"} | ${startedAt}`);

  // ── 1. Razorpay signature verification (if secret is configured) ──────────
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keySecret && data.razorpayOrderId && data.razorpaySignature && paymentId) {
    const isValid = verifyRazorpaySignature(
      data.razorpayOrderId,
      paymentId,
      data.razorpaySignature,
      keySecret
    );
    if (!isValid) {
      console.error(`[process-payment] ❌ Invalid Razorpay signature for order ${orderId} / payment ${paymentId}`);
      return sendApiResponse(res, 400, {
        success: false,
        error: "Payment signature verification failed.",
        orderId,
      });
    }
    console.info(`[process-payment] ✅ Razorpay signature verified for order ${orderId}.`);
  }

  // ── 2. Upsert order to Supabase (durable persistence, idempotency) ────────
  const { alreadyProcessed, error: dbError, existingOrder } = await upsertOrderToSupabase(data);

  if (alreadyProcessed) {
    // Both Sheets and Email were already synced — return success without duplicate delivery
    console.info(`[process-payment] ℹ️ Order ${orderId} already processed & synced. Returning cached success.`);
    return sendApiResponse(res, 200, {
      success: true,
      orderId,
      alreadyProcessed: true,
      sheetsSynced: true,
      emailSent: true,
      message: "Order was already processed successfully.",
    });
  }

  if (dbError) {
    console.warn(`[process-payment] ⚠️ DB persist warning for order ${orderId}: ${dbError}`);
    // Continue anyway — we will still attempt GAS forward
  }

  // ── 3. Forward to Google Apps Script (Sheets + Email) with retry ──────────
  const webhookUrl =
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    process.env.VITE_ORDER_WEBHOOK_URL ||
    "https://script.google.com/macros/s/AKfycbzjXsA4gHp4u30Qx9RhFamyOIrSjqs2yi9K5wAF1YylK8FU9Ushsex8kffAIIRUR3bI/exec";

  const mapsLink =
    data.mapsLink ||
    (data.lat && data.lng ? `https://www.google.com/maps?q=${data.lat},${data.lng}` : "");

  const formattedDate =
    data.formattedDate ||
    new Date(data.createdAt || Date.now()).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

  const productsSummary =
    data.productsSummary ||
    (data.items || [])
      .map((item) => `${item.name}${item.unit ? ` (${item.unit})` : ""} × ${item.quantity}`)
      .join(", ");

  const totalQuantity =
    data.totalQuantity ||
    (data.items || []).reduce((acc, item) => acc + (item.quantity || 1), 0);

  const gasPayload = {
    ...data,
    paymentId: paymentId || "N/A",
    mapsLink,
    formattedDate,
    productsSummary,
    totalQuantity,
    source: data.source || "storefront",
    _processedAt: startedAt,
  };

  const gasResult = await callGoogleAppsScript(webhookUrl, gasPayload, 3);

  // ── 4. Update notification status in Supabase ─────────────────────────────
  const sheetsSynced = gasResult.sheetUpdated || gasResult.success;
  const emailSent = gasResult.emailSent || gasResult.success;
  const currentRetryCount = existingOrder?.retry_count || 0;

  await updateNotificationStatus(orderId, {
    sheets_synced: sheetsSynced,
    email_sent: emailSent,
    retry_count: currentRetryCount + gasResult.attempts,
    last_error: gasResult.success ? null : (gasResult.lastError ?? null),
    last_attempt_at: new Date().toISOString(),
  });

  // ── 5. Log final outcome ──────────────────────────────────────────────────
  if (gasResult.success) {
    console.info(
      `[process-payment] ✅ ORDER ${orderId} FULLY PROCESSED | Payment: ${paymentId} | Sheets: ${sheetsSynced ? "✅" : "⚠️"} | Email: ${emailSent ? "✅" : "⚠️"} | Attempts: ${gasResult.attempts}`
    );
  } else {
    console.error(
      `[process-payment] ❌ ORDER ${orderId} GAS FORWARD FAILED | Payment: ${paymentId} | Error: ${gasResult.lastError} | Attempts: ${gasResult.attempts} | Order IS persisted in Supabase — retry possible.`
    );
  }

  // ── 6. Respond to browser ─────────────────────────────────────────────────
  // Always return 200 if the order was persisted in Supabase — the browser
  // should not retry just because GAS had a temporary issue.
  return sendApiResponse(res, 200, {
    success: true,
    orderId,
    alreadyProcessed: false,
    sheetsSynced,
    emailSent,
    attempts: gasResult.attempts,
    ...(sheetsSynced && emailSent ? {} : { warning: "Order saved. Sheet/email sync queued for retry." }),
  });
}
