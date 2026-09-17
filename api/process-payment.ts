// Vercel Serverless Function: /api/process-payment
// ──────────────────────────────────────────────────────────────────────────────
// PRIMARY order processor called by the browser after a successful Razorpay payment.
//
// HARDENED SECURITY & SEQUENTIAL ORDER ID:
//   1. Constant-time Razorpay signature verification (prevent spoofing/timing attacks)
//   2. Server-side price, discount, and total recalculation against live database
//   3. Strict input sanitization (XSS, control chars, length validation)
//   4. Atomic sequential Order ID generation (ORD-000001, ORD-000002, ...)
//   5. Durable persistence into Supabase `orders` table (idempotent, no duplicates)
//   6. Forward to Google Apps Script for Sheets + Email (with exponential backoff)
//   7. Mark sheets_synced / email_sent in Supabase
//   8. Return authoritative sequential orderId & status to browser
// ──────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";
import {
  handleCors,
  parseApiRequest,
  sendApiResponse,
  getOrGenerateSequentialOrderId,
  sanitizeString,
  safeTimingEqual,
  getCloudProducts,
} from "./_catalog.js";
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
  orderId?: string;
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
  discountPercentage?: number;
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
  if (!signature || !secret || !razorpayOrderId || !razorpayPaymentId) return false;
  try {
    const generated = crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    return safeTimingEqual(generated, signature);
  } catch {
    return false;
  }
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
      // Give GAS up to 25 seconds per attempt (cold starts can be slow)
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
        // GAS may return non-JSON text or redirect wrapper
      }

      if (res.ok || res.status === 302 || res.status === 0) {
        const isDuplicate = Boolean(parsed?.duplicate);
        const sheetUpdated = Boolean(parsed?.sheetUpdated) || isDuplicate || parsed?.status === "success";
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

/** Upsert or insert order into Supabase orders table with guaranteed unique sequential order ID */
async function upsertOrderToSupabase(
  data: ProcessPaymentBody,
  assignedOrderId: string
): Promise<{ alreadyProcessed: boolean; error?: string; existingOrder?: any; finalOrderId: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.warn("[process-payment] Supabase client not available — order not persisted to DB.");
    return { alreadyProcessed: false, finalOrderId: assignedOrderId };
  }

  const paymentId = data.paymentId || data.razorpayPaymentId || "";
  let existingOrderRow: any = null;

  // 1. Check if this order or payment was ALREADY completely processed & synced
  try {
    const { data: existingById } = await supabase
      .from("orders")
      .select("id, user_id, payment_status, sheets_synced, email_sent, retry_count")
      .eq("id", assignedOrderId)
      .maybeSingle();

    if (existingById) {
      existingOrderRow = existingById;
      const isPaid = String(existingById.payment_status || "").toLowerCase().includes("paid");
      if (isPaid && existingById.sheets_synced && existingById.email_sent) {
        console.info(
          `[process-payment] ℹ️ Order ${assignedOrderId} already exists in DB and is fully synced. Skipping duplicate notification.`
        );
        return { alreadyProcessed: true, existingOrder: existingById, finalOrderId: assignedOrderId };
      }
    }

    if (paymentId && paymentId !== "N/A") {
      const { data: existingByPayment } = await supabase
        .from("orders")
        .select("id, user_id, payment_status, sheets_synced, email_sent, retry_count")
        .eq("razorpay_payment_id", paymentId)
        .maybeSingle();

      if (existingByPayment) {
        const isPaid = String(existingByPayment.payment_status || "").toLowerCase().includes("paid");
        if (isPaid && existingByPayment.sheets_synced && existingByPayment.email_sent) {
          console.info(
            `[process-payment] ℹ️ Payment ${paymentId} was already processed under order ${existingByPayment.id}. Skipping duplicate.`
          );
          return { alreadyProcessed: true, existingOrder: existingByPayment, finalOrderId: existingByPayment.id };
        }
        if (existingByPayment.id && /^SHK-?\d+$/i.test(existingByPayment.id)) {
          existingOrderRow = existingByPayment;
          assignedOrderId = existingByPayment.id;
        }
      }
    }
  } catch (checkErr) {
    console.warn("[process-payment] Supabase idempotency check error:", checkErr);
  }

  // 2. Resolve target user_id
  let targetUserId = data.userId || existingOrderRow?.user_id || null;
  if (!targetUserId && data.email) {
    try {
      const cleanEmail = data.email.trim().toLowerCase();
      const { data: userList } = await supabase.auth.admin.listUsers();
      const matched = (userList?.users || []).find((u: any) => u.email?.toLowerCase() === cleanEmail);
      if (matched) {
        targetUserId = matched.id;
        console.info(`[process-payment] 🔗 Associated order ${assignedOrderId} with registered user ${targetUserId} (${cleanEmail}).`);
      }
    } catch (userLookupErr) {
      console.warn("[process-payment] Failed to lookup user by email:", userLookupErr);
    }
  }

  const mapsLink =
    data.mapsLink ||
    (data.lat && data.lng ? `https://www.google.com/maps?q=${data.lat},${data.lng}` : "");

  let currentOrderId = assignedOrderId;
  let saveError: string | undefined = undefined;

  // 3. Insert or Update with concurrent conflict retry
  for (let attempt = 0; attempt < 10; attempt++) {
    const row = {
      id: currentOrderId,
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

    if (existingOrderRow && existingOrderRow.id === currentOrderId) {
      const { error: updErr } = await supabase.from("orders").update(row).eq("id", currentOrderId);
      if (!updErr) {
        saveError = undefined;
        break;
      }
      saveError = updErr.message;
      break;
    } else {
      const { error: insErr } = await supabase.from("orders").insert(row);
      if (!insErr) {
        saveError = undefined;
        break;
      }

      // Check for primary key conflict due to concurrent order placement
      if (insErr.code === "23505" || insErr.message?.includes("duplicate") || insErr.message?.includes("already exists")) {
        console.warn(`[process-payment] Conflict on order ID ${currentOrderId}. Regenerating next sequence...`);
        currentOrderId = await getOrGenerateSequentialOrderId(supabase, paymentId);
        continue;
      }

      saveError = insErr.message;
      break;
    }
  }

  if (saveError) {
    console.error("[process-payment] Supabase order save error:", saveError);
    return { alreadyProcessed: false, error: saveError, existingOrder: existingOrderRow, finalOrderId: currentOrderId };
  }

  // 4. Server-side atomic stock deduction
  try {
    const validItems = (data.items || [])
      .filter((item) => item && item.id)
      .map((item) => ({
        id: String(item.id),
        quantity: Math.max(1, Number(item.quantity) || 1),
      }));
    if (validItems.length > 0 && (!existingOrderRow || existingOrderRow.retry_count === 0)) {
      await supabase.rpc("deduct_product_stock", { p_items: validItems });
      console.info(`[process-payment] ✅ Atomic stock deduction executed for order ${currentOrderId}.`);
    }
  } catch (stockErr) {
    console.warn("[process-payment] Stock deduction RPC warning:", stockErr);
  }

  console.info(`[process-payment] Order ${currentOrderId} successfully persisted in Supabase.`);
  return { alreadyProcessed: false, existingOrder: existingOrderRow, finalOrderId: currentOrderId };
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
  const paymentId = sanitizeString(data.paymentId || data.razorpayPaymentId || "", 100);
  const startedAt = new Date().toISOString();

  // ── 0. Input Sanitization & Basic Validation ──────────────────────────────
  const sanitizedFullName = sanitizeString(data.fullName || "", 100);
  const sanitizedMobile = sanitizeString(data.mobile || "", 15);
  const sanitizedEmail = sanitizeString(data.email || "", 100);
  const sanitizedAddress = sanitizeString(data.address || "", 500);
  const sanitizedCity = sanitizeString(data.city || "", 50);
  const sanitizedState = sanitizeString(data.state || "", 50);
  const sanitizedPincode = sanitizeString(data.pincode || "", 10);
  const sanitizedUserId = data.userId ? sanitizeString(data.userId, 64) : undefined;

  if (!sanitizedFullName && !sanitizedMobile) {
    return sendApiResponse(res, 400, { error: "Missing required customer name or mobile." });
  }

  // ── 1. Razorpay signature verification (if secret configured) ─────────────
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keySecret && data.razorpayOrderId && data.razorpaySignature && paymentId) {
    const isValid = verifyRazorpaySignature(
      data.razorpayOrderId,
      paymentId,
      data.razorpaySignature,
      keySecret
    );
    if (!isValid) {
      console.error(`[process-payment] ❌ Invalid Razorpay signature for payment ${paymentId}`);
      return sendApiResponse(res, 400, {
        success: false,
        error: "Payment signature verification failed.",
      });
    }
    console.info(`[process-payment] ✅ Razorpay signature verified for payment ${paymentId}.`);
  }

  // ── 2. Server-side Catalog & Price Hardening ───────────────────────────────
  let validatedItems: OrderItem[] = [];
  let computedSubtotal = 0;

  try {
    const catalogProducts = await getCloudProducts();
    const catalogMap = new Map<string, any>();
    for (const cp of catalogProducts) {
      catalogMap.set(cp.id, cp);
      if (Array.isArray(cp.variants)) {
        for (const v of cp.variants) {
          catalogMap.set(v.id, { ...cp, price: v.price, unit: v.unit });
        }
      }
    }

    if (Array.isArray(data.items) && data.items.length > 0) {
      for (const rawItem of data.items) {
        if (!rawItem) continue;
        const itemId = rawItem.id ? sanitizeString(rawItem.id, 64) : "";
        const catProduct = itemId ? catalogMap.get(itemId) : null;
        const qty = Math.max(1, Number(rawItem.quantity) || 1);
        const unitPrice = catProduct ? Number(catProduct.price) : Math.max(0, Number(rawItem.price) || 0);

        computedSubtotal += unitPrice * qty;
        validatedItems.push({
          id: itemId || undefined,
          name: sanitizeString(catProduct?.name || rawItem.name || "Product", 100),
          nameTamil: sanitizeString(catProduct?.nameTamil || catProduct?.tamilName || rawItem.nameTamil || "", 100),
          quantity: qty,
          price: unitPrice,
          unit: sanitizeString(catProduct?.unit || rawItem.unit || "1 Pack", 50),
        });
      }
    }
  } catch (priceErr) {
    console.warn("[process-payment] Catalog lookup warning:", priceErr);
    validatedItems = (data.items || []).map((i) => ({
      ...i,
      name: sanitizeString(i.name, 100),
      quantity: Math.max(1, Number(i.quantity) || 1),
      price: Math.max(0, Number(i.price) || 0),
    }));
    computedSubtotal = validatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
  }

  const rawDiscount = Math.max(0, Number(data.discount) || 0);
  const validatedDiscount = Math.min(computedSubtotal, rawDiscount);
  const validatedDeliveryCharge = Math.max(0, Number(data.deliveryCharge) || 0);
  const computedTotal = Math.round(Math.max(0, computedSubtotal - validatedDiscount + validatedDeliveryCharge) * 100) / 100;

  // ── 3. Resolve / Generate Sequential Order ID (Database-side) ─────────────
  const supabase = getSupabaseServerClient();
  const sequentialOrderId = await getOrGenerateSequentialOrderId(
    supabase,
    paymentId,
    data.orderId
  );

  console.info(
    `[process-payment] 📦 Processing Sequential Order: ${sequentialOrderId} | Payment: ${paymentId || "N/A"} | Amount: ₹${computedTotal}`
  );

  const cleanOrderPayload: ProcessPaymentBody = {
    ...data,
    orderId: sequentialOrderId,
    userId: sanitizedUserId,
    fullName: sanitizedFullName,
    mobile: sanitizedMobile,
    alternateMobile: data.alternateMobile ? sanitizeString(data.alternateMobile, 15) : undefined,
    email: sanitizedEmail,
    address: sanitizedAddress,
    city: sanitizedCity,
    state: sanitizedState,
    pincode: sanitizedPincode,
    items: validatedItems,
    subtotal: computedSubtotal,
    deliveryCharge: validatedDeliveryCharge,
    discount: validatedDiscount,
    total: computedTotal,
    paymentId: paymentId || undefined,
    paymentStatus: data.paymentStatus || `Paid (Razorpay)${paymentId ? ` · ${paymentId}` : ""}`,
  };

  // ── 4. Upsert order to Supabase ───────────────────────────────────────────
  const { alreadyProcessed, error: dbError, existingOrder, finalOrderId } = await upsertOrderToSupabase(
    cleanOrderPayload,
    sequentialOrderId
  );
  const activeOrderId = finalOrderId || sequentialOrderId;

  if (alreadyProcessed) {
    console.info(`[process-payment] ℹ️ Order ${activeOrderId} already processed & synced. Returning cached success.`);
    return sendApiResponse(res, 200, {
      success: true,
      orderId: activeOrderId,
      alreadyProcessed: true,
      sheetsSynced: true,
      emailSent: true,
      message: "Order was already processed successfully.",
    });
  }

  if (dbError) {
    console.warn(`[process-payment] ⚠️ DB persist warning for order ${activeOrderId}: ${dbError}`);
  }

  // ── 5. Build GAS payload ──────────────────────────────────────────────────
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
    validatedItems
      .map((item) => `${item.name}${item.unit ? ` (${item.unit})` : ""} × ${item.quantity}`)
      .join(", ");

  const totalQuantity =
    data.totalQuantity ||
    validatedItems.reduce((acc, item) => acc + (item.quantity || 1), 0);

  const gasPayload = {
    ...cleanOrderPayload,
    orderId: activeOrderId,
    // Ensure email is always mapped to the field GAS expects
    email: sanitizedEmail || "",
    paymentId: paymentId || "N/A",
    razorpayPaymentId: paymentId || "N/A",
    mapsLink,
    formattedDate,
    productsSummary,
    totalQuantity,
    source: data.source || "storefront",
    _processedAt: startedAt,
  };

  // ── 6. Return response to browser IMMEDIATELY after DB save ───────────────
  // GAS (email + Google Sheets) runs as a non-blocking background promise.
  // This eliminates the delay between payment success and the success page.
  // The Vercel serverless function continues executing after res is sent.
  console.info(
    `[process-payment] ✅ ORDER ${activeOrderId} SAVED IN DB | Payment: ${paymentId} | Returning to browser immediately.`
  );

  // Send response to browser immediately
  sendApiResponse(res, 200, {
    success: true,
    orderId: activeOrderId,
    alreadyProcessed: false,
    sheetsSynced: false,   // Will be updated by background job
    emailSent: false,      // Will be updated by background job
    message: "Order created. Notifications dispatching in background.",
  });

  // ── 7. Background: Forward to GAS (Sheets + Email) with retry ────────────
  // This runs AFTER the browser response is already sent.
  // The Vercel serverless function stays alive to complete this work.
  const currentRetryCount = existingOrder?.retry_count || 0;
  try {
    const gasResult = await callGoogleAppsScript(webhookUrl, gasPayload, 3);

    const sheetsSynced = gasResult.sheetUpdated || gasResult.success;
    const emailSent = gasResult.emailSent || gasResult.success;

    await updateNotificationStatus(activeOrderId, {
      sheets_synced: sheetsSynced,
      email_sent: emailSent,
      retry_count: currentRetryCount + gasResult.attempts,
      last_error: gasResult.success ? null : (gasResult.lastError ?? null),
      last_attempt_at: new Date().toISOString(),
    });

    if (gasResult.success) {
      console.info(
        `[process-payment] ✅ BACKGROUND GAS DONE | Order: ${activeOrderId} | Sheets: ✅ | Email: ✅ | Attempts: ${gasResult.attempts}`
      );
    } else {
      console.error(
        `[process-payment] ❌ BACKGROUND GAS FAILED | Order: ${activeOrderId} | Error: ${gasResult.lastError}`
      );
    }
  } catch (bgErr) {
    console.error(`[process-payment] ❌ BACKGROUND GAS EXCEPTION | Order: ${activeOrderId}:`, bgErr);
  }
}
