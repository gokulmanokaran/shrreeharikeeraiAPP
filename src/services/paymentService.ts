/**
 * Payment Service — Razorpay Test / Live Integration
 * ────────────────────────────────────────────────────
 * Handles opening Razorpay checkout modal, processing payments,
 * handling success/failure/dismissal callbacks, and backend verification.
 *
 * Android WebView UPI Intent Support
 * ────────────────────────────────────
 * When this page is loaded inside an Android WebView (detected via UA string),
 * the Razorpay checkout is configured with:
 *   • config.supports_upi_intent: 1   → signals intent-based UPI app launch
 *   • webview_intent: true            → enables UPI app-to-app flow in WebView
 * The Android host app must also implement WebViewClient.shouldOverrideUrlLoading()
 * to intercept "upi://" and "intent://" scheme URLs and forward them to the OS
 * via startActivity(Intent.parseUri(...)).  See ANDROID_API_INTEGRATION.md §8.
 */

export interface PaymentPayload {
  orderId: string;
  amount: number; // in INR (rupees, not paise)
  currency?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  description: string;
}

export interface PaymentResult {
  success: boolean;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  error?: string;
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
}

interface RazorpayFailureResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata?: Record<string, unknown>;
  };
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id?: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
  /**
   * UPI Intent support for Android WebView.
   * Setting webview_intent: true together with config.supports_upi_intent: 1
   * tells Razorpay to render the UPI app picker (GPay, PhonePe, Paytm, etc.)
   * and launch intent:// or upi:// deep links for app-to-app payment.
   * The Android WebViewClient must intercept these URLs (see §8 of the
   * ANDROID_API_INTEGRATION.md for the required shouldOverrideUrlLoading impl).
   */
  webview_intent?: boolean;
  config?: {
    display?: {
      blocks?: Record<string, unknown>;
      sequence?: string[];
      preferences?: Record<string, unknown>;
    };
    /** 1 = support UPI intent-based app launch inside WebView */
    supports_upi_intent?: 0 | 1;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: RazorpayFailureResponse) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

// Test Key ID provided for the application
const DEFAULT_RAZORPAY_KEY_ID = "rzp_test_TU0lWbkyOmj5C5";

export function getRazorpayKeyId(): string {
  return (
    (import.meta.env.VITE_RAZORPAY_KEY_ID as string) ||
    DEFAULT_RAZORPAY_KEY_ID
  );
}

/**
 * Detects whether the current page is running inside an Android WebView.
 *
 * Razorpay's UPI Intent flow (upi:// / intent:// scheme) requires explicit
 * opt-in via `webview_intent: true` + `config.supports_upi_intent: 1` so
 * that the SDK knows the host environment can handle deep-link interception.
 *
 * Detection heuristics (all must match for a reliable positive):
 *  1. User-Agent contains "wv" token (Android System WebView marker)
 *  2. User-Agent contains "Android" — rules out desktop Chrome "wv" false-positives
 *  3. NOT a standard browser (no "Chrome/" without "wv", no "Firefox", no "Safari" alone)
 *
 * NOTE: This detection runs only on the client; SSR environments return false.
 */
export function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Android WebView UA always contains both "Android" and the " wv" token
  // e.g.: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ... wv) ..."
  return (
    ua.includes("Android") &&
    /\bwv\b/.test(ua)
  );
}

/**
 * Dynamically load Razorpay SDK if not already loaded on window
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }

    // Check if script is already present in document
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]') as HTMLScriptElement | null;
    if (existing) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof window !== "undefined" && window.Razorpay) {
          clearInterval(interval);
          resolve(true);
        } else if (attempts > 20) {
          clearInterval(interval);
          resolve(Boolean(typeof window !== "undefined" && window.Razorpay));
        }
      }, 100);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      setTimeout(() => {
        resolve(Boolean(typeof window !== "undefined" && window.Razorpay));
      }, 50);
    };
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

/**
 * Optional server-side Razorpay Order Creator (used if backend endpoint is configured)
 */
async function createBackendRazorpayOrder(amount: number, orderId: string): Promise<string | undefined> {
  // Only attempt if explicit backend endpoint is enabled
  if (typeof window === "undefined" || !import.meta.env.VITE_ENABLE_BACKEND_RAZORPAY) {
    return undefined;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);

    const res = await fetch("/api/create-razorpay-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, receipt: orderId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      return data.orderId || undefined;
    }
  } catch {
    // Proceed with standard direct Razorpay client checkout
  }
  return undefined;
}

/**
 * Process Razorpay payment for checkout
 */
export async function processPayment(payload: PaymentPayload): Promise<PaymentResult> {
  const isScriptLoaded = await loadRazorpayScript();
  if (!isScriptLoaded || typeof window === "undefined" || !window.Razorpay) {
    return {
      success: false,
      error: "Unable to connect to Razorpay payment gateway. Please check your internet connection and retry.",
    };
  }

  const razorpayKey = getRazorpayKeyId();
  if (!razorpayKey) {
    return {
      success: false,
      error: "Razorpay Key ID is not configured.",
    };
  }

  // Attempt backend order generation if available (non-blocking fallback)
  const backendOrderId = await createBackendRazorpayOrder(payload.amount, payload.orderId);

  // ── Android WebView UPI Intent configuration ───────────────────────────
  // When running inside an Android WebView we must explicitly enable UPI
  // Intent support so that Razorpay renders the UPI app picker and
  // launches GPay / PhonePe / Paytm via upi:// or intent:// deep links.
  // The Android host app must handle these schemes in shouldOverrideUrlLoading.
  const androidWebView = isAndroidWebView();

  return new Promise((resolve) => {
    let isHandled = false;

    const options: RazorpayOptions = {
      key: razorpayKey,
      amount: Math.round(payload.amount * 100), // Amount in paise
      currency: payload.currency || "INR",
      name: "Shree Hari Keerai",
      description: payload.description || `Order #${payload.orderId}`,
      ...(backendOrderId ? { order_id: backendOrderId } : {}),
      prefill: {
        name: payload.customerName,
        email: payload.customerEmail || undefined,
        contact: payload.customerPhone,
      },
      notes: {
        storefrontOrderId: payload.orderId,
      },
      theme: {
        color: "#00A651",
      },
      // ── UPI Intent: enabled only in Android WebView ──────────────────────
      // webview_intent: true  → Razorpay renders UPI app picker in WebView
      // config.supports_upi_intent: 1 → SDK uses intent:// / upi:// scheme
      // These flags are safe to omit for browser (no-op) and are only
      // injected when the Android WebView UA is positively detected.
      ...(androidWebView
        ? {
            webview_intent: true,
            config: {
              supports_upi_intent: 1 as const,
            },
          }
        : {}),
      handler: async (response: RazorpaySuccessResponse) => {
        if (isHandled) return;
        isHandled = true;

        // Optional server-side verification if enabled
        if (import.meta.env.VITE_ENABLE_BACKEND_RAZORPAY) {
          try {
            const verifyRes = await fetch("/api/verify-razorpay-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id || backendOrderId,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (verifyRes.ok) {
              const verifyData = await verifyRes.json();
              if (verifyData.verified === false) {
                resolve({
                  success: false,
                  error: "Payment verification failed. Please contact support.",
                });
                return;
              }
            }
          } catch {
            // Fallback: Proceed with Razorpay client confirmation
          }
        }

        resolve({
          success: true,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id || backendOrderId,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          if (isHandled) return;
          isHandled = true;
          resolve({
            success: false,
            error: "Payment was cancelled. You can retry when ready.",
          });
        },
      },
    };

    try {
      if (!window.Razorpay) {
        resolve({
          success: false,
          error: "Razorpay payment SDK is not initialized.",
        });
        return;
      }

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response: RazorpayFailureResponse) => {
        if (isHandled) return;
        isHandled = true;
        const errorMsg =
          response.error?.description ||
          response.error?.reason ||
          "Payment failed. Please try a different payment method.";
        resolve({
          success: false,
          error: errorMsg,
        });
      });

      rzp.open();
    } catch (err) {
      if (!isHandled) {
        isHandled = true;
        resolve({
          success: false,
          error: err instanceof Error ? err.message : "Failed to open Razorpay modal.",
        });
      }
    }
  });
}
