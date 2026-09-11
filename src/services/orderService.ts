/**
 * Order Notification & Google Sheets Service
 * ──────────────────────────────────────────
 * PRODUCTION-READY: Routes order data through the reliable Vercel backend
 * (/api/process-payment) instead of calling Google Apps Script directly from
 * the browser. This ensures:
 *
 *  ✅ Order is persisted in Supabase immediately (survives browser crash)
 *  ✅ GAS is called with retry from the server (not affected by page navigation)
 *  ✅ Proper idempotency: same orderId processed only once, even with retries
 *  ✅ Concurrent orders do not interfere with each other
 *  ✅ Structured logging with Payment ID, Order ID, attempt count, error reason
 *
 * FALLBACK CHAIN:
 *   1. POST /api/process-payment (Vercel backend — primary, reliable path)
 *   2. POST /api/order-webhook (Vercel backend — secondary)
 *   3. Direct GAS call (tertiary, legacy — browser keepalive)
 *   4. Queue to localStorage for retry on next app load
 */

import { getSupabaseClient } from "../lib/supabase";

export interface OrderItemPayload {
  id?: string;
  name: string;
  nameTamil?: string;
  quantity: number;
  price: number;
  unit?: string;
}

export interface OrderNotificationPayload {
  orderId: string;
  createdAt: string;
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
  items: OrderItemPayload[];
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  discountPercentage?: number;
  total: number;
  paymentStatus: string;
  paymentId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
}

export interface OrderNotificationResult {
  success: boolean;
  orderId: string;
  alreadyProcessed?: boolean;
  message?: string;
  error?: string;
  path?: string; // Which path succeeded: "backend" | "webhook" | "direct" | "queued"
}

// ── Storage keys ──────────────────────────────────────────────────────────────
const SUBMITTED_ORDERS_KEY = "shreehari_submitted_order_ids";
const PENDING_QUEUE_KEY = "shreehari_pending_order_notifications";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format products into a concise string for Google Sheets */
export function formatProductsSummary(items: OrderItemPayload[]): string {
  return items
    .map((item) => {
      const unit = item.unit ? ` (${item.unit})` : "";
      return `${item.name}${unit} × ${item.quantity}`;
    })
    .join(", ");
}

/** Format total quantity of items */
export function getTotalQuantity(items: OrderItemPayload[]): number {
  return items.reduce((acc, item) => acc + (item.quantity || 1), 0);
}

/** Get the configured Google Apps Script Webhook URL (legacy fallback) */
export function getWebhookUrl(): string {
  return (
    (typeof window !== "undefined"
      ? (import.meta.env.VITE_ORDER_WEBHOOK_URL as string) ||
        (import.meta.env.VITE_GOOGLE_SHEETS_WEBHOOK_URL as string)
      : "") ||
    "https://script.google.com/macros/s/AKfycbzjXsA4gHp4u30Qx9RhFamyOIrSjqs2yi9K5wAF1YylK8FU9Ushsex8kffAIIRUR3bI/exec"
  );
}

/** Check if this order was already notified (local dedup — secondary guard) */
function isOrderAlreadyNotified(orderId: string): boolean {
  try {
    const raw = localStorage.getItem(SUBMITTED_ORDERS_KEY);
    if (!raw) return false;
    const ids: string[] = JSON.parse(raw);
    return ids.includes(orderId);
  } catch {
    return false;
  }
}

/** Mark order as notified in localStorage */
function markOrderNotified(orderId: string): void {
  try {
    const raw = localStorage.getItem(SUBMITTED_ORDERS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(orderId)) {
      ids.push(orderId);
      localStorage.setItem(SUBMITTED_ORDERS_KEY, JSON.stringify(ids.slice(-100)));
    }
  } catch {
    // Ignore storage issues
  }
}

/** Queue failed order for background retry */
function queuePendingNotification(payload: unknown): void {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    const queue: unknown[] = raw ? JSON.parse(raw) : [];
    // Avoid duplicate queuing of the same order
    const typedPayload = payload as { orderId?: string };
    const orderId = typedPayload?.orderId;
    if (orderId) {
      const alreadyQueued = (queue as Array<{ payload?: { orderId?: string } }>).some(
        (q) => q?.payload?.orderId === orderId
      );
      if (alreadyQueued) return;
    }
    queue.push({ payload, queuedAt: new Date().toISOString() });
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
    console.info(`[OrderService] 📥 Order ${orderId || "?"} queued for background retry.`);
  } catch {
    // Ignore storage issues
  }
}

// ── Retry helper ──────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ── Primary path: POST /api/process-payment (Vercel backend) ─────────────────

async function submitViaBackend(
  requestBody: Record<string, unknown>,
  orderId: string,
  paymentId: string
): Promise<OrderNotificationResult | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.info(
        `[OrderService] 🚀 Attempt ${attempt}/3 → /api/process-payment | Order: ${orderId} | Payment: ${paymentId}`
      );
      const res = await fetchWithTimeout(
        "/api/process-payment",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
        15_000 // 15s per attempt
      );

      if (res.ok) {
        const data = await res.json();
        console.info(
          `[OrderService] ✅ /api/process-payment succeeded | Order: ${orderId} | AlreadyProcessed: ${data.alreadyProcessed} | SheetsSync: ${data.sheetsSynced}`
        );
        return {
          success: true,
          orderId,
          alreadyProcessed: data.alreadyProcessed,
          message: data.message || "Order processed",
          path: "backend",
        };
      }

      const errText = await res.text().catch(() => "");
      console.warn(
        `[OrderService] ⚠️ /api/process-payment attempt ${attempt} returned ${res.status}: ${errText.slice(0, 200)}`
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[OrderService] ⚠️ /api/process-payment attempt ${attempt} threw: ${errMsg}`);
    }

    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
    }
  }
  return null; // All attempts failed
}

// ── Secondary path: POST /api/order-webhook (Vercel backend) ─────────────────

async function submitViaOrderWebhook(
  requestBody: Record<string, unknown>,
  orderId: string
): Promise<OrderNotificationResult | null> {
  try {
    console.info(`[OrderService] 🔄 Falling back to /api/order-webhook | Order: ${orderId}`);
    const res = await fetchWithTimeout(
      "/api/order-webhook",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
      20_000
    );
    if (res.ok) {
      const data = await res.json();
      console.info(`[OrderService] ✅ /api/order-webhook succeeded | Order: ${orderId}`);
      return { success: true, orderId, message: data.message, path: "webhook" };
    }
    console.warn(`[OrderService] ⚠️ /api/order-webhook returned ${res.status} for order ${orderId}`);
  } catch (err) {
    console.warn("[OrderService] ⚠️ /api/order-webhook threw:", err);
  }
  return null;
}

// ── Tertiary path: direct GAS call (legacy keepalive) ────────────────────────

async function submitDirectToGas(
  requestBody: Record<string, unknown>,
  webhookUrl: string,
  orderId: string
): Promise<OrderNotificationResult> {
  try {
    console.info(`[OrderService] 🔄 Last resort: direct GAS call | Order: ${orderId}`);
    const res = await fetch(webhookUrl, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(requestBody),
      mode: "no-cors",
    });
    // no-cors always returns opaque response — we optimistically treat as success
    if (res.type === "opaque" || res.status === 0 || res.ok) {
      console.info(`[OrderService] ✅ Direct GAS call dispatched | Order: ${orderId}`);
      return { success: true, orderId, path: "direct" };
    }
  } catch (err) {
    console.warn("[OrderService] ⚠️ Direct GAS call threw:", err);
  }
  return { success: false, orderId, error: "All paths failed", path: "queued" };
}

/** Direct client-side persist to Supabase orders table (Guaranteed immediate DB save) */
export async function persistOrderDirectToSupabase(
  payload: OrderNotificationPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn("[OrderService] Supabase client not initialized for direct save.");
      return { success: false, error: "Supabase client uninitialized" };
    }

    const mapsLink =
      payload.mapsLink ||
      (payload.lat && payload.lng ? `https://www.google.com/maps?q=${payload.lat},${payload.lng}` : "");

    const paymentId = payload.paymentId || payload.razorpayPaymentId || null;

    const row = {
      id: payload.orderId,
      razorpay_payment_id: paymentId || null,
      razorpay_order_id: payload.razorpayOrderId || null,
      razorpay_signature: payload.razorpaySignature || null,
      full_name: payload.fullName || "",
      mobile: payload.mobile || "",
      email: payload.email || "",
      address: payload.address || "",
      city: payload.city || "",
      state: payload.state || "",
      pincode: payload.pincode || "",
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
      maps_link: mapsLink,
      subtotal: Number(payload.subtotal || 0),
      delivery_charge: Number(payload.deliveryCharge || 0),
      discount: Number(payload.discount || 0),
      total: Number(payload.total || 0),
      items: payload.items || [],
      payment_status: payload.paymentStatus || `Paid (Razorpay)${paymentId ? ` · ${paymentId}` : ""}`,
      sheets_synced: false,
      email_sent: false,
      retry_count: 0,
      source: "storefront",
    };

    const { error } = await supabase.from("orders").upsert(row, { onConflict: "id" });
    if (error) {
      console.warn("[OrderService] Direct Supabase upsert error:", error.message);
      return { success: false, error: error.message };
    }

    console.info(`[OrderService] ⚡ Direct Supabase upsert succeeded for order ${payload.orderId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[OrderService] Direct Supabase upsert exception:", msg);
    return { success: false, error: msg };
  }
}

/** Update order sync flags in Supabase client-side */
export async function updateDirectSupabaseStatus(
  orderId: string,
  updates: { sheets_synced?: boolean; email_sent?: boolean }
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.from("orders").update(updates).eq("id", orderId);
  } catch {
    // ignore
  }
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Submits order details through a reliable dual-layer flow:
 *   0. Immediate direct save to Supabase (survives any serverless failure)
 *   1. /api/process-payment (Vercel, with server-side persistence + GAS retry)
 *   2. /api/order-webhook (Vercel, with GAS retry)
 *   3. Direct GAS call (keepalive, browser best-effort)
 *   4. localStorage queue (next app load retry)
 */
export async function submitOrderNotification(
  payload: OrderNotificationPayload
): Promise<OrderNotificationResult> {
  const { orderId } = payload;
  const paymentId = payload.paymentId || payload.razorpayPaymentId || "N/A";

  console.info(
    `[OrderService] 📦 submitOrderNotification START | Order: ${orderId} | Payment: ${paymentId} | Customer: ${payload.email || payload.mobile}`
  );

  // ── Step 0: Immediate Direct Supabase Save (First line of defense) ───────
  const directDbPromise = persistOrderDirectToSupabase(payload);

  // Local dedup guard (secondary to server-side idempotency)
  if (isOrderAlreadyNotified(orderId)) {
    console.info(`[OrderService] ℹ️ Order ${orderId} already marked as notified locally. Skipping.`);
    await directDbPromise;
    return { success: true, orderId, alreadyProcessed: true, message: "Already notified" };
  }

  // ── Build enriched request body ─────────────────────────────────────────
  const mapsLink =
    payload.mapsLink ||
    (payload.lat && payload.lng ? `https://www.google.com/maps?q=${payload.lat},${payload.lng}` : "");

  const totalQuantity = getTotalQuantity(payload.items);
  const productsSummary = formatProductsSummary(payload.items);

  const formattedDate = new Date(payload.createdAt || Date.now()).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const requestBody: Record<string, unknown> = {
    ...payload,
    paymentId: paymentId !== "N/A" ? paymentId : payload.paymentId || "",
    mapsLink,
    productsSummary,
    totalQuantity,
    formattedDate,
    source: "Shree Hari Keerai Storefront",
  };

  const webhookUrl = getWebhookUrl();

  // ── 1. Primary: /api/process-payment ──────────────────────────────────
  const backendResult = await submitViaBackend(requestBody, orderId, paymentId);
  if (backendResult?.success) {
    markOrderNotified(orderId);
    console.info(
      `[OrderService] ✅ Order ${orderId} DONE via backend | Payment: ${paymentId} | Path: ${backendResult.path}`
    );
    return backendResult;
  }

  // ── 2. Secondary: /api/order-webhook ──────────────────────────────────
  const webhookResult = await submitViaOrderWebhook(requestBody, orderId);
  if (webhookResult?.success) {
    markOrderNotified(orderId);
    updateDirectSupabaseStatus(orderId, { sheets_synced: true, email_sent: true });
    console.info(
      `[OrderService] ✅ Order ${orderId} DONE via order-webhook | Payment: ${paymentId}`
    );
    return webhookResult;
  }

  // ── 3. Tertiary: direct GAS call ───────────────────────────────────────
  const directResult = await submitDirectToGas(requestBody, webhookUrl, orderId);
  if (directResult.success) {
    markOrderNotified(orderId);
    updateDirectSupabaseStatus(orderId, { sheets_synced: true, email_sent: true });
    console.info(
      `[OrderService] ✅ Order ${orderId} dispatched via direct GAS | Payment: ${paymentId}`
    );
    return directResult;
  }

  // Wait for direct DB persist before failing
  await directDbPromise;

  // ── 4. Queue for retry on next app load ────────────────────────────────
  console.error(
    `[OrderService] ❌ ALL PATHS FAILED for order ${orderId} | Payment: ${paymentId} | Queuing for retry.`
  );
  queuePendingNotification(requestBody);
  return {
    success: false,
    orderId,
    error: "All notification paths failed. Order queued for background retry.",
    path: "queued",
  };
}

/**
 * Background retry worker — attempts to resend any queued orders.
 * Called on every app mount (App.tsx ScrollToTop) to recover from
 * previous failures automatically.
 */
export async function retryPendingOrderNotifications(): Promise<void> {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return;
    const queue: Array<{ payload: OrderNotificationPayload; queuedAt: string }> = JSON.parse(raw);
    if (!queue.length) return;

    console.info(`[OrderService] 🔁 Retrying ${queue.length} queued order(s)...`);

    // Clear queue before processing to prevent re-queuing on concurrent mount
    localStorage.removeItem(PENDING_QUEUE_KEY);

    for (const item of queue) {
      const { payload } = item;
      if (!payload?.orderId) continue;

      // Skip if already notified on a previous retry
      if (isOrderAlreadyNotified(payload.orderId)) {
        console.info(`[OrderService] ℹ️ Queued order ${payload.orderId} already notified. Skipping.`);
        continue;
      }

      console.info(`[OrderService] 🔁 Retrying queued order ${payload.orderId} (queued at ${item.queuedAt})`);
      await submitOrderNotification(payload);
    }
  } catch (err) {
    console.warn("[OrderService] Retry worker error:", err);
  }
}
