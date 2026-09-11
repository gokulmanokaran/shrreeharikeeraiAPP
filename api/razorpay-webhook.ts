// Vercel Serverless Function: /api/razorpay-webhook
// ──────────────────────────────────────────────────────────────────────────────
// Server-side Razorpay webhook handler — the TRUE SAFETY NET for successful payments.
//
// This endpoint is called DIRECTLY by Razorpay's servers (not the browser), so it
// works even if:
//   - The customer's browser crashed after payment
//   - Mobile network dropped after payment but before our callback ran
//   - The browser tab was closed mid-navigation
//   - The client-side /api/process-payment call timed out
//
// SETUP:
//   1. In Razorpay Dashboard → Settings → Webhooks → Add new webhook
//   2. URL: https://your-domain.vercel.app/api/razorpay-webhook
//   3. Events: payment.captured, payment.failed (optional)
//   4. Secret: generate a random secret and add as RAZORPAY_WEBHOOK_SECRET in Vercel env vars
//
// IMPORTANT: Razorpay retries webhook delivery for up to 3 days if it gets a non-200 response.
// We MUST return 200 quickly (within 5s) to acknowledge receipt.
// Actual processing can happen async but we must persist ASAP.
//
// IDEMPOTENCY:
//   The Supabase orders table has a unique index on razorpay_payment_id.
//   Duplicate events simply result in a no-op upsert and return 200.
// ──────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import { handleCors, parseApiRequest, sendApiResponse } from "./_catalog";
import { getSupabaseServerClient } from "./_supabase";

// ── Webhook Signature Verification ───────────────────────────────────────────

function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const generated = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature));
}

// ── GAS Forward with Retry ────────────────────────────────────────────────────

async function forwardToGoogleAppsScript(
  webhookUrl: string,
  payload: object,
  maxAttempts = 3
): Promise<{ success: boolean; attempts: number; lastError?: string }> {
  let lastError = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok || res.status === 302 || res.status === 0) {
        const text = await res.text().catch(() => "");
        console.info(`[razorpay-webhook] ✅ GAS forwarded on attempt ${attempt}.`, text.slice(0, 100));
        return { success: true, attempts: attempt };
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    console.warn(`[razorpay-webhook] ⚠️ GAS attempt ${attempt}/${maxAttempts} failed: ${lastError}`);
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }
  return { success: false, attempts: maxAttempts, lastError };
}

// ── Order Builder from Razorpay Webhook Payload ────────────────────────────────

interface RazorpayWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        order_id?: string;
        amount: number;
        currency: string;
        status: string;
        description?: string;
        contact?: string;
        email?: string;
        notes?: Record<string, string>;
        created_at?: number;
      };
    };
  };
}

// ── Main Handler ──────────────────────────────────────────────────────────────

export default async function handler(req: any, res?: any): Promise<any> {
  // Razorpay uses POST only; respond to CORS preflight
  if (handleCors(req, res)) return;

  const { method, body, getHeader } = await parseApiRequest(req);

  if (method !== "POST") {
    return sendApiResponse(res, 405, { error: "Method not allowed." });
  }

  // ── 1. Capture raw body for signature verification ────────────────────────
  // The raw body string is needed for HMAC — we need it before JSON parsing.
  // `parseApiRequest` already parsed it, so reconstruct from body object.
  const rawBodyStr =
    typeof req.body === "string"
      ? req.body
      : JSON.stringify(body);

  // ── 2. Verify webhook signature ───────────────────────────────────────────
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const razorpaySignatureHeader = getHeader("x-razorpay-signature") || "";

  if (webhookSecret && razorpaySignatureHeader) {
    try {
      const isValid = verifyWebhookSignature(rawBodyStr, razorpaySignatureHeader, webhookSecret);
      if (!isValid) {
        console.error("[razorpay-webhook] ❌ Webhook signature verification FAILED — possible spoofing attempt.");
        return sendApiResponse(res, 400, { error: "Invalid webhook signature." });
      }
      console.info("[razorpay-webhook] ✅ Webhook signature verified.");
    } catch (err) {
      console.error("[razorpay-webhook] Signature verification exception:", err);
      return sendApiResponse(res, 400, { error: "Signature verification failed." });
    }
  } else if (!webhookSecret) {
    // If no secret is configured, log a warning but continue (for initial setup / testing)
    console.warn(
      "[razorpay-webhook] ⚠️ RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification. Configure this in Vercel env vars for production security."
    );
  }

  const webhookData = body as RazorpayWebhookPayload;
  const eventType = webhookData?.event || "";

  console.info(`[razorpay-webhook] 📡 Received event: ${eventType}`);

  // ── 3. Only process payment.captured events ────────────────────────────────
  if (eventType !== "payment.captured") {
    // Acknowledge receipt for other events without processing
    console.info(`[razorpay-webhook] ℹ️ Ignored non-capture event: ${eventType}`);
    return sendApiResponse(res, 200, { received: true, event: eventType, processed: false });
  }

  const paymentEntity = webhookData?.payload?.payment?.entity;
  if (!paymentEntity) {
    console.error("[razorpay-webhook] ❌ payment.captured event missing payment entity.");
    return sendApiResponse(res, 400, { error: "Invalid webhook payload — missing payment entity." });
  }

  const razorpayPaymentId = paymentEntity.id;
  const razorpayOrderId = paymentEntity.order_id || "";
  const notes = paymentEntity.notes || {};
  // We embed storefrontOrderId in the Razorpay notes field during checkout
  const storefrontOrderId = notes.storefrontOrderId || notes.orderId || "";
  const amountInPaise = paymentEntity.amount || 0;
  const amountInRupees = amountInPaise / 100;

  console.info(
    `[razorpay-webhook] 💰 payment.captured | Payment: ${razorpayPaymentId} | Order: ${razorpayOrderId} | Storefront Order: ${storefrontOrderId} | Amount: ₹${amountInRupees}`
  );

  // ── 4. Check Supabase for existing order record ────────────────────────────
  const supabase = getSupabaseServerClient();
  let existingOrder: any = null;
  let sheetsAlreadySynced = false;

  if (supabase && storefrontOrderId) {
    try {
      const { data: orderRow } = await supabase
        .from("orders")
        .select("id, sheets_synced, email_sent, full_name, mobile, email, address, city, state, pincode, lat, lng, maps_link, items, subtotal, delivery_charge, discount, total, payment_status, retry_count")
        .eq("id", storefrontOrderId)
        .maybeSingle();

      if (orderRow) {
        existingOrder = orderRow;
        sheetsAlreadySynced = orderRow.sheets_synced && orderRow.email_sent;
        console.info(
          `[razorpay-webhook] Found existing Supabase order ${storefrontOrderId}. SheetsSync: ${orderRow.sheets_synced}, EmailSent: ${orderRow.email_sent}`
        );
      }
    } catch (err) {
      console.warn("[razorpay-webhook] Supabase lookup error:", err);
    }
  }

  // If order is already fully processed — acknowledge and return
  if (sheetsAlreadySynced) {
    console.info(`[razorpay-webhook] ℹ️ Order ${storefrontOrderId} already fully processed. Idempotent response.`);
    return sendApiResponse(res, 200, {
      received: true,
      event: eventType,
      processed: false,
      reason: "Already processed",
      orderId: storefrontOrderId,
    });
  }

  // ── 5. If we don't have a Supabase order record yet, create a minimal one ──
  // This handles the case where the browser /api/process-payment never fired
  // (e.g. browser crashed) but Razorpay is notifying us of a captured payment.
  const webhookUrl =
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    process.env.VITE_ORDER_WEBHOOK_URL ||
    "https://script.google.com/macros/s/AKfycbzjXsA4gHp4u30Qx9RhFamyOIrSjqs2yi9K5wAF1YylK8FU9Ushsex8kffAIIRUR3bI/exec";

  const processedAt = new Date().toISOString();

  let gasPayload: Record<string, unknown>;

  if (existingOrder) {
    // Build GAS payload from the Supabase-persisted order data (complete info)
    const mapsLink =
      existingOrder.maps_link ||
      (existingOrder.lat && existingOrder.lng
        ? `https://www.google.com/maps?q=${existingOrder.lat},${existingOrder.lng}`
        : "");

    const items = Array.isArray(existingOrder.items) ? existingOrder.items : [];
    const productsSummary = items
      .map((item: any) => `${item.name}${item.unit ? ` (${item.unit})` : ""} × ${item.quantity}`)
      .join(", ");
    const totalQuantity = items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
    const formattedDate = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });

    gasPayload = {
      orderId: storefrontOrderId || existingOrder.id,
      fullName: existingOrder.full_name,
      mobile: existingOrder.mobile,
      email: existingOrder.email,
      address: existingOrder.address,
      city: existingOrder.city,
      state: existingOrder.state,
      pincode: existingOrder.pincode,
      lat: existingOrder.lat,
      lng: existingOrder.lng,
      mapsLink,
      items,
      subtotal: existingOrder.subtotal,
      deliveryCharge: existingOrder.delivery_charge,
      discount: existingOrder.discount,
      total: existingOrder.total,
      paymentStatus: existingOrder.payment_status,
      paymentId: razorpayPaymentId,
      razorpayPaymentId,
      razorpayOrderId,
      productsSummary,
      totalQuantity,
      formattedDate,
      source: "razorpay-webhook",
      _webhookTriggered: true,
      _processedAt: processedAt,
    };
  } else {
    // Minimal payload from Razorpay webhook data only (browser data was lost)
    // We only have payment amount + notes — better than nothing
    const fallbackOrderId = storefrontOrderId || `SHK-WEBHOOK-${razorpayPaymentId}`;
    const formattedDate = new Date(
      (paymentEntity.created_at || Date.now() / 1000) * 1000
    ).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

    console.warn(
      `[razorpay-webhook] ⚠️ No Supabase record for storefront order ${storefrontOrderId}. ` +
      `This means the browser never called /api/process-payment. ` +
      `Sending minimal order data to GAS from Razorpay webhook payload.`
    );

    gasPayload = {
      orderId: fallbackOrderId,
      fullName: paymentEntity.notes?.customerName || notes.fullName || "Unknown Customer",
      mobile: paymentEntity.contact?.replace("+91", "") || "",
      email: paymentEntity.email || "",
      address: notes.address || "See Razorpay Dashboard",
      total: amountInRupees,
      subtotal: amountInRupees,
      deliveryCharge: 0,
      discount: 0,
      items: [],
      productsSummary: notes.productsSummary || "See Razorpay Dashboard",
      totalQuantity: 1,
      paymentId: razorpayPaymentId,
      razorpayPaymentId,
      razorpayOrderId,
      paymentStatus: `Paid (Razorpay) · ${razorpayPaymentId}`,
      formattedDate,
      source: "razorpay-webhook-fallback",
      _webhookTriggered: true,
      _missingBrowserData: true,
      _processedAt: processedAt,
    };

    // Persist minimal record to Supabase for tracking
    if (supabase && fallbackOrderId) {
      await supabase
        .from("orders")
        .insert({
          id: fallbackOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_order_id: razorpayOrderId,
          full_name: gasPayload.fullName as string,
          mobile: gasPayload.mobile as string,
          email: gasPayload.email as string,
          address: gasPayload.address as string,
          subtotal: amountInRupees,
          delivery_charge: 0,
          discount: 0,
          total: amountInRupees,
          items: [],
          payment_status: gasPayload.paymentStatus as string,
          sheets_synced: false,
          email_sent: false,
          source: "razorpay-webhook-fallback",
        })
        .then(() => {/* inserted */})
        .catch((err) => {
          // Unique constraint = already exists, safe to ignore
          if (!String(err?.message).includes("duplicate")) {
            console.warn("[razorpay-webhook] Fallback Supabase insert error:", err);
          }
        });
    }
  }

  // ── 6. Forward to Google Apps Script ──────────────────────────────────────
  const gasResult = await forwardToGoogleAppsScript(webhookUrl, gasPayload, 3);

  // ── 7. Update Supabase notification status ────────────────────────────────
  if (supabase && (storefrontOrderId || existingOrder?.id)) {
    const targetId = storefrontOrderId || existingOrder?.id;
    const currentRetryCount = existingOrder?.retry_count || 0;
    await supabase
      .from("orders")
      .update({
        razorpay_payment_id: razorpayPaymentId,
        razorpay_order_id: razorpayOrderId,
        sheets_synced: gasResult.success,
        email_sent: gasResult.success,
        retry_count: currentRetryCount + gasResult.attempts,
        last_error: gasResult.success ? null : (gasResult.lastError ?? null),
        last_attempt_at: new Date().toISOString(),
      })
      .eq("id", targetId)
      .catch((err) => console.warn("[razorpay-webhook] Status update error:", err));
  }

  // ── 8. Log outcome ────────────────────────────────────────────────────────
  if (gasResult.success) {
    console.info(
      `[razorpay-webhook] ✅ WEBHOOK ORDER ${storefrontOrderId} PROCESSED | Payment: ${razorpayPaymentId} | Sheets: ✅ | Email: ✅ | Attempts: ${gasResult.attempts}`
    );
  } else {
    console.error(
      `[razorpay-webhook] ❌ WEBHOOK ORDER ${storefrontOrderId} GAS FAILED | Payment: ${razorpayPaymentId} | Error: ${gasResult.lastError} | Attempts: ${gasResult.attempts}`
    );
  }

  // Always return 200 to Razorpay so it does not retry unnecessarily
  return sendApiResponse(res, 200, {
    received: true,
    event: eventType,
    processed: true,
    orderId: storefrontOrderId,
    paymentId: razorpayPaymentId,
    sheetsSynced: gasResult.success,
  });
}
