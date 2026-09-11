// Vercel Serverless Function: /api/order-webhook
// ──────────────────────────────────────────────────────────────────────────────
// Forwards order payloads to Google Apps Script securely, with:
//   • Retry with exponential backoff (3 attempts)
//   • Idempotency check via Supabase orders table
//   • Structured logging of all attempts
// ──────────────────────────────────────────────────────────────────────────────
import { handleCors, parseApiRequest, sendApiResponse } from "./_catalog";
import { getSupabaseServerClient } from "./_supabase";

/** Forward to GAS with retry + exponential backoff */
async function forwardWithRetry(
  url: string,
  payload: object,
  maxAttempts = 3
): Promise<{ success: boolean; attempts: number; lastError?: string; responseSnippet?: string }> {
  let lastError = "";
  let responseSnippet = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text().catch(() => "");
      responseSnippet = text.slice(0, 300);

      if (res.ok || res.status === 302 || res.status === 0) {
        console.info(`[order-webhook] ✅ GAS responded on attempt ${attempt} | status: ${res.status}`);
        return { success: true, attempts: attempt, responseSnippet };
      }

      lastError = `HTTP ${res.status}: ${responseSnippet}`;
      console.warn(`[order-webhook] ⚠️ Attempt ${attempt}/${maxAttempts} — ${lastError}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`[order-webhook] ⚠️ Attempt ${attempt}/${maxAttempts} threw: ${lastError}`);
    }

    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
      console.info(`[order-webhook] ⏳ Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return { success: false, attempts: maxAttempts, lastError, responseSnippet };
}

export default async function handler(req: any, res?: any): Promise<any> {
  if (handleCors(req, res)) return;

  const { method, body } = await parseApiRequest(req);

  if (method !== "POST") {
    return sendApiResponse(res, 405, { error: "Method not allowed. Use POST." });
  }

  try {
    const orderData = body;
    const orderId: string = orderData?.orderId || "";

    if (!orderId) {
      return sendApiResponse(res, 400, { error: "Invalid order data: orderId is required." });
    }

    const paymentId: string = orderData?.paymentId || orderData?.razorpayPaymentId || "N/A";
    const customerEmail: string = orderData?.email || "N/A";

    console.info(
      `[order-webhook] 📦 Received order ${orderId} | Payment: ${paymentId} | Customer: ${customerEmail}`
    );

    // ── Idempotency: check if already fully processed in Supabase ─────────
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data: existing } = await supabase
          .from("orders")
          .select("id, sheets_synced, email_sent")
          .eq("id", orderId)
          .maybeSingle();

        if (existing?.sheets_synced && existing?.email_sent) {
          console.info(`[order-webhook] ℹ️ Order ${orderId} already processed — skipping duplicate.`);
          return sendApiResponse(res, 200, {
            success: true,
            orderId,
            alreadyProcessed: true,
          });
        }
      } catch (err) {
        console.warn("[order-webhook] Supabase idempotency check error:", err);
        // Continue anyway
      }
    }

    const targetWebhookUrl =
      process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
      process.env.VITE_ORDER_WEBHOOK_URL ||
      process.env.ORDER_WEBHOOK_URL ||
      "https://script.google.com/macros/s/AKfycbzjXsA4gHp4u30Qx9RhFamyOIrSjqs2yi9K5wAF1YylK8FU9Ushsex8kffAIIRUR3bI/exec";

    // ── Forward to Google Apps Script with retry ──────────────────────────
    const result = await forwardWithRetry(targetWebhookUrl, orderData, 3);

    // ── Persist or update order in Supabase ───────────────────────────────
    if (supabase) {
      const mapsLink =
        orderData.mapsLink ||
        (orderData.lat && orderData.lng ? `https://www.google.com/maps?q=${orderData.lat},${orderData.lng}` : "");

      const formattedDate =
        orderData.formattedDate ||
        new Date(orderData.createdAt || Date.now()).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        });

      const orderRow = {
        id: orderId,
        razorpay_payment_id: paymentId !== "N/A" ? paymentId : null,
        razorpay_order_id: orderData.razorpayOrderId || null,
        razorpay_signature: orderData.razorpaySignature || null,
        full_name: orderData.fullName || "",
        mobile: orderData.mobile || "",
        email: orderData.email || "",
        address: orderData.address || "",
        city: orderData.city || "",
        state: orderData.state || "",
        pincode: orderData.pincode || "",
        lat: orderData.lat ?? null,
        lng: orderData.lng ?? null,
        maps_link: mapsLink,
        subtotal: Number(orderData.subtotal || 0),
        delivery_charge: Number(orderData.deliveryCharge || 0),
        discount: Number(orderData.discount || 0),
        total: Number(orderData.total || 0),
        items: orderData.items || [],
        payment_status: orderData.paymentStatus || `Paid (Razorpay)${paymentId !== "N/A" ? ` · ${paymentId}` : ""}`,
        sheets_synced: result.success,
        email_sent: result.success,
        retry_count: result.attempts,
        last_error: result.success ? null : (result.lastError ?? null),
        last_attempt_at: new Date().toISOString(),
        source: orderData.source || "storefront",
      };

      await supabase
        .from("orders")
        .upsert(orderRow, { onConflict: "id" })
        .catch((err) => console.warn("[order-webhook] Supabase order upsert error:", err));
    }

    if (result.success) {
      console.info(
        `[order-webhook] ✅ ORDER ${orderId} FORWARDED | Payment: ${paymentId} | Sheets: ✅ | Email: ✅ | Attempts: ${result.attempts}`
      );
    } else {
      console.error(
        `[order-webhook] ❌ ORDER ${orderId} FORWARD FAILED | Payment: ${paymentId} | Error: ${result.lastError} | Attempts: ${result.attempts}`
      );
    }

    return sendApiResponse(res, 200, {
      success: result.success,
      orderId,
      attempts: result.attempts,
      upstream: { responseSnippet: result.responseSnippet },
      ...(result.success ? {} : { warning: result.lastError }),
    });
  } catch (error) {
    console.error("[order-webhook] Unhandled error:", error);
    return sendApiResponse(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
}
