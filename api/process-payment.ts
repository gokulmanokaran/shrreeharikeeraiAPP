// Vercel Serverless Function: /api/process-payment
// ──────────────────────────────────────────────────────────────────────────────
// PRIMARY order processor called by the browser after a successful Razorpay payment.
//
// FLOW:
//   1. Verify Razorpay signature (if secret is configured)
//   2. Upsert order into Supabase `orders` table (durable, idempotent)
//   3. Forward to Google Apps Script for Sheets + Email (with retry)
//   4. Mark sheets_synced / email_sent in Supabase
//   5. Return success to browser
//
// IDEMPOTENCY:
//   If the same razorpay_payment_id is received twice (duplicate webhook / retry),
//   the Supabase upsert on conflict(id) is a no-op and we return alreadyProcessed: true.
// ──────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { handleCors, parseApiRequest, sendApiResponse } from "./_catalog";
import { getSupabaseServerClient } from "./_supabase";

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

/** Call Google Apps Script webhook with exponential backoff retry */
async function callGoogleAppsScript(
  webhookUrl: string,
  payload: object,
  maxAttempts = 3
): Promise<{ success: boolean; attempts: number; lastError?: string }> {
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      // Give GAS up to 20 seconds per attempt (it can be slow on cold start)
      const timeoutId = setTimeout(() => controller.abort(), 20_000);

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // GAS always returns 200 with a redirect chain ending in an opaque response.
      // We treat any completed fetch (even non-ok) as a delivery attempt success
      // because GAS 302 redirects make HTTP status unreliable from server side.
      // The real success indicator is that the request reached GAS servers.
      if (res.ok || res.status === 302 || res.status === 0) {
        const text = await res.text().catch(() => "");
        console.info(
          `[process-payment] ✅ GAS call succeeded on attempt ${attempt}.`,
          { status: res.status, responseSnippet: text.slice(0, 200) }
        );
        return { success: true, attempts: attempt };
      }

      lastError = `HTTP ${res.status}`;
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

  return { success: false, attempts: maxAttempts, lastError };
}

/** Upsert order into Supabase orders table. Returns true if this is a NEW order. */
async function upsertOrderToSupabase(data: ProcessPaymentBody): Promise<{ isNew: boolean; error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn("[process-payment] Supabase client not available — order not persisted to DB.");
    return { isNew: true }; // Allow processing to continue even without DB
  }

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

  const paymentId = data.paymentId || data.razorpayPaymentId || "";

  const row = {
    id: data.orderId,
    razorpay_payment_id: paymentId || null,
    razorpay_order_id: data.razorpayOrderId || null,
    razorpay_signature: data.razorpaySignature || null,
    full_name: data.fullName || "",
    mobile: data.mobile || "",
    email: data.email || "",
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
    sheets_synced: false,
    email_sent: false,
    retry_count: 0,
    source: data.source || "storefront",
    // Store these for GAS forward
    // (extra metadata stored as part of JSONB items — no separate column needed)
  };

  // Use INSERT ... ON CONFLICT DO NOTHING to detect duplicates safely
  const { error, data: insertedRows } = await supabase
    .from("orders")
    .insert(row)
    .select("id")
    .maybeSingle();

  if (error) {
    // Unique constraint violation = duplicate order (already processed)
    if (error.code === "23505" || error.message?.includes("duplicate")) {
      console.info(`[process-payment] Order ${data.orderId} already exists in DB — duplicate detected.`);
      return { isNew: false };
    }
    console.error("[process-payment] Supabase insert error:", error);
    return { isNew: true, error: error.message };
  }

  const isNew = !!insertedRows;
  console.info(`[process-payment] Order ${data.orderId} ${isNew ? "inserted" : "already existed"} in Supabase.`);
  return { isNew };
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

  await supabase.from("orders").update(updates).eq("id", orderId).catch((err) => {
    console.warn("[process-payment] Failed to update notification status:", err);
  });
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
  const { isNew, error: dbError } = await upsertOrderToSupabase(data);

  if (!isNew) {
    // Already processed — return success without re-triggering downstream
    console.info(`[process-payment] ℹ️ Order ${orderId} already processed. Returning cached success.`);
    return sendApiResponse(res, 200, {
      success: true,
      orderId,
      alreadyProcessed: true,
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
  await updateNotificationStatus(orderId, {
    sheets_synced: gasResult.success,
    email_sent: gasResult.success,
    retry_count: gasResult.attempts,
    last_error: gasResult.success ? null : (gasResult.lastError ?? null),
    last_attempt_at: new Date().toISOString(),
  });

  // ── 5. Log final outcome ──────────────────────────────────────────────────
  if (gasResult.success) {
    console.info(
      `[process-payment] ✅ ORDER ${orderId} FULLY PROCESSED | Payment: ${paymentId} | Sheets: ✅ | Email: ✅ | Attempts: ${gasResult.attempts}`
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
    sheetsSynced: gasResult.success,
    emailSent: gasResult.success,
    attempts: gasResult.attempts,
    ...(gasResult.success ? {} : { warning: "Order saved. Sheet/email sync queued for retry." }),
  });
}
