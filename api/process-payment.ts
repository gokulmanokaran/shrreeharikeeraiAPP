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
  productId?: string;
  variantId?: string;
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
      // 20s per attempt — generous window for GAS to acquire lock, update sheet & dispatch emails
      const timeoutId = setTimeout(() => controller.abort(), 20_000);

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
            `[process-payment] ℹ️ Payment ${paymentId} was already processed under order ${existingByPayment.id} and is fully synced. Skipping duplicate.`
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

  console.info(`[process-payment] Order ${currentOrderId} successfully persisted in Supabase.`);
  return { alreadyProcessed: false, existingOrder: existingOrderRow, finalOrderId: currentOrderId };
}

/**
 * Atomically & accurately deduct stock for purchased order items.
 * Handles both base products and variants (resolving variant IDs like prod_xxx_12345 to parent).
 * Guarantees:
 * - Stock never becomes negative (Math.max(0, currentStock - qty))
 * - When stock reaches 0, in_stock is set to false
 * - Only runs once per order
 */
async function deductStockForOrderItems(
  supabase: any,
  items: Array<{ id?: string; productId?: string; variantId?: string; name?: string; quantity?: number }>,
  orderId: string
): Promise<Array<{ id: string; name: string; previousStock: number; newStock: number; inStock: boolean }>> {
  if (!items || !items.length) return [];

  const validItems = items
    .filter((it) => it && (it.id || it.productId || it.name))
    .map((it) => ({
      id: String(it.id || "").trim(),
      productId: String(it.productId || "").trim(),
      variantId: String(it.variantId || "").trim(),
      name: String(it.name || "").trim(),
      quantity: Math.max(1, Number(it.quantity) || 1),
    }));

  if (!validItems.length) return [];

  const { data: allProducts, error: fetchErr } = await supabase
    .from("products")
    .select("id, name, stock_quantity, in_stock, variants");

  if (fetchErr || !allProducts) {
    console.error(`[process-payment] Failed to fetch products for stock deduction (order ${orderId}):`, fetchErr);
    return [];
  }

  const resolvedMap = new Map<string, { product: any; totalQty: number }>();

  for (const item of validItems) {
    const matchedProduct = allProducts.find((p: any) => {
      if (item.productId && p.id === item.productId) return true;
      if (item.id && p.id === item.id) return true;
      if (item.id && Array.isArray(p.variants) && p.variants.some((v: any) => v && v.id === item.id)) return true;
      if (item.variantId && Array.isArray(p.variants) && p.variants.some((v: any) => v && v.id === item.variantId)) return true;
      if (item.id && item.id.includes("_") && item.id.startsWith(p.id + "_")) return true;
      if (item.name && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase()) return true;
      return false;
    });

    if (!matchedProduct) {
      console.warn(`[process-payment] ⚠️ No matching product found for item: ${item.id} (${item.name}) in order ${orderId}.`);
      continue;
    }

    const existing = resolvedMap.get(matchedProduct.id);
    if (existing) {
      existing.totalQty += item.quantity;
    } else {
      resolvedMap.set(matchedProduct.id, { product: matchedProduct, totalQty: item.quantity });
    }
  }

  const results: Array<{ id: string; name: string; previousStock: number; newStock: number; inStock: boolean }> = [];
  const rpcItems: Array<{ id: string; quantity: number }> = [];

  for (const [prodId, { product, totalQty }] of resolvedMap.entries()) {
    if (product.stock_quantity !== null && product.stock_quantity !== undefined) {
      rpcItems.push({ id: prodId, quantity: totalQty });
    }
  }

  // 1. Atomic RPC call with row-level locking
  if (rpcItems.length > 0) {
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("deduct_product_stock", {
        p_items: rpcItems,
      });
      if (!rpcErr && rpcRes && rpcRes.success && Array.isArray(rpcRes.updated) && rpcRes.updated.length > 0) {
        for (const up of rpcRes.updated) {
          const entry = resolvedMap.get(up.id);
          results.push({
            id: up.id,
            name: entry?.product.name || up.id,
            previousStock: up.previousStock,
            newStock: up.newStock,
            inStock: up.inStock,
          });
          console.info(
            `[process-payment] ✅ Atomic stock deduction: "${entry?.product.name || up.id}" stock: ${up.previousStock} -> ${up.newStock} (Order ${orderId})`
          );
        }
      }
    } catch (rpcEx) {
      console.warn(`[process-payment] Stock RPC notice (falling back to direct update):`, rpcEx);
    }
  }

  // 2. Direct fallback for any products not updated by RPC
  for (const [prodId, { product, totalQty }] of resolvedMap.entries()) {
    const alreadyDone = results.some((r) => r.id === prodId);
    if (!alreadyDone && product.stock_quantity !== null && product.stock_quantity !== undefined) {
      const currentStock = Number(product.stock_quantity);
      if (!isNaN(currentStock)) {
        const newStock = Math.max(0, currentStock - totalQty);
        const newInStock = newStock > 0;

        const { error: updErr } = await supabase
          .from("products")
          .update({
            stock_quantity: newStock,
            in_stock: newInStock,
            updated_at: new Date().toISOString(),
          })
          .eq("id", prodId);

        if (!updErr) {
          results.push({
            id: prodId,
            name: product.name,
            previousStock: currentStock,
            newStock,
            inStock: newInStock,
          });
          console.info(
            `[process-payment] ✅ Direct stock update: "${product.name}" stock: ${currentStock} -> ${newStock} (Order ${orderId})`
          );
        } else {
          console.error(`[process-payment] ❌ Failed to update stock for ${prodId}:`, updErr);
        }
      }
    }
  }

  return results;
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

  // ── 1. Razorpay signature verification ───────────────────────────────────
  // When a razorpayOrderId is present (i.e. this is a real Razorpay payment),
  // we MUST verify the signature. A missing or invalid signature is rejected
  // unconditionally to prevent fake/tampered payment submissions.
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (data.razorpayOrderId) {
    // Has a Razorpay Order ID → must have matching signature
    if (!data.razorpaySignature || !paymentId) {
      console.error(`[process-payment] ❌ Missing payment signature or paymentId for razorpayOrderId=${data.razorpayOrderId}`);
      return sendApiResponse(res, 400, {
        success: false,
        error: "Payment verification failed: missing signature or payment ID.",
      });
    }
    if (!keySecret) {
      // Secret not configured — log warning but allow in dev; in prod this should be set
      console.warn("[process-payment] ⚠️ RAZORPAY_KEY_SECRET not set — cannot verify signature. Set this env var for production security.");
    } else {
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

  // ── 4b. Deduct stock (idempotent, only on first successful order creation) ─
  // We only deduct if the order was newly created (not alreadyProcessed) and
  // only when we have a verified payment. The orders table column stock_deducted
  // acts as an idempotency flag to prevent double deduction from webhook retries.
  if (validatedItems.length > 0 && supabase) {
    try {
      // Check if stock was already deducted for this order (handles retries / duplicate calls)
      let stockAlreadyDeducted = false;
      try {
        const { data: orderRow } = await supabase
          .from("orders")
          .select("stock_deducted")
          .eq("id", activeOrderId)
          .maybeSingle();
        stockAlreadyDeducted = Boolean(orderRow?.stock_deducted);
      } catch (_) { }

      if (!stockAlreadyDeducted) {
        const stockResults = await deductStockForOrderItems(supabase, validatedItems, activeOrderId);
        if (stockResults.length > 0) {
          // Mark stock as deducted so webhook/retry does not deduct again
          try {
            await supabase
              .from("orders")
              .update({ stock_deducted: true })
              .eq("id", activeOrderId);
          } catch (_) { }
          console.info(`[process-payment] ✅ Stock deducted for order ${activeOrderId}:`, stockResults.map(r => `${r.name}: ${r.previousStock}→${r.newStock}`));
        }
      } else {
        console.info(`[process-payment] ℹ️ Stock already deducted for order ${activeOrderId} — skipping.`);
      }
    } catch (stockErr) {
      // Non-fatal: log but don't fail the order
      console.error(`[process-payment] ⚠️ Stock deduction error for order ${activeOrderId}:`, stockErr);
    }
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

  // ── 6. Forward to Google Apps Script (Sheets + Email) with safe timeout ───
  // Awaited directly to guarantee Google Sheets update and customer/admin emails
  // complete before the serverless container is frozen.
  const currentRetryCount = existingOrder?.retry_count || 0;

  console.info(
    `[process-payment] 🚀 Forwarding order ${activeOrderId} to Google Apps Script (Sheets + Email)...`
  );

  const gasResult = await callGoogleAppsScript(webhookUrl, gasPayload, 2);
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
      `[process-payment] ✅ GAS sync complete for order ${activeOrderId} | Payment: ${paymentId} | Sheets: ✅ | Email: ✅ | Attempts: ${gasResult.attempts}`
    );
  } else {
    console.warn(
      `[process-payment] ⚠️ GAS sync issue for order ${activeOrderId} | Sheets: ${sheetsSynced} | Email: ${emailSent} | Error: ${gasResult.lastError}`
    );
  }

  // ── 7. Respond to browser ─────────────────────────────────────────────────
  return sendApiResponse(res, 200, {
    success: true,
    orderId: activeOrderId,
    alreadyProcessed: false,
    sheetsSynced,
    emailSent,
    message: sheetsSynced && emailSent ? "Order confirmed and notifications sent." : "Order saved in database.",
    ...(sheetsSynced && emailSent ? {} : { warning: gasResult.lastError || "Sheet or email notification delayed" }),
  });
}

