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

export interface OrderItem {
  id?: string;
  productId?: string;
  variantId?: string;
  name: string;
  nameTamil?: string;
  quantity: number;
  price: number;
  unit?: string;
}

export interface PaymentPayload {
  orderId: string;
  amount: number; // in INR (rupees, not paise)
  currency?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  description: string;
  userId?: string;
  preferredMethod?: string;
  pincode?: string;
  items?: OrderItem[];
  onPaymentFailed?: (errorMsg: string) => void;
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
 */
export function isAndroidWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return ua.includes("Android") && /\bwv\b/.test(ua);
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
 * Server-side Razorpay Order Creator (creates official order_... on Razorpay server with strict validation)
 */
async function createBackendRazorpayOrder(payload: PaymentPayload): Promise<{ orderId?: string; validatedAmount?: number; error?: string } | undefined> {
  if (typeof window === "undefined") return undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("/api/create-razorpay-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: payload.amount,
        receipt: payload.orderId,
        currency: payload.currency || "INR",
        pincode: payload.pincode,
        items: payload.items,
        notes: {
          storefrontOrderId: payload.orderId,
          userId: payload.userId || "",
          customerEmail: payload.customerEmail || "",
          customerPhone: payload.customerPhone || "",
          pincode: payload.pincode || "",
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data.orderId) {
        console.info(`[PaymentService] ✅ Created Razorpay server order: ${data.orderId} (₹${data.validatedAmount || payload.amount})`);
        return { orderId: data.orderId, validatedAmount: data.validatedAmount };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      return { error: errData.error || "Payment order creation failed." };
    }
  } catch (e) {
    console.warn("[PaymentService] Server-side Razorpay order creation notice:", e);
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

  // Attempt backend order generation with notes & validation
  const backendResult = await createBackendRazorpayOrder(payload);
  if (backendResult?.error) {
    return {
      success: false,
      error: backendResult.error,
    };
  }
  const backendOrderId = backendResult?.orderId;
  const paymentAmount = backendResult?.validatedAmount ?? payload.amount;

  const androidWebView = isAndroidWebView();

  return new Promise((resolve) => {
    let isCompleted = false;
    let lastFailureReason: string | null = null;

    const options: RazorpayOptions = {
      key: razorpayKey,
      amount: Math.round(paymentAmount * 100), // Amount in paise
      currency: payload.currency || "INR",
      name: "Shree Hari Keerai",
      description: payload.description || `Order #${payload.orderId}`,
      ...(backendOrderId ? { order_id: backendOrderId } : {}),
      prefill: {
        name: payload.customerName,
        email: payload.customerEmail || undefined,
        contact: payload.customerPhone,
        ...(payload.preferredMethod ? { method: payload.preferredMethod } : {}),
      },
      notes: {
        storefrontOrderId: payload.orderId,
        userId: payload.userId || "",
        customerEmail: payload.customerEmail || "",
        customerPhone: payload.customerPhone || "",
        paymentMethod: payload.preferredMethod || "upi",
      },
      theme: {
        color: "#00A651",
      },
      ...(androidWebView
        ? {
            webview_intent: true,
            config: {
              supports_upi_intent: 1 as const,
            },
          }
        : {}),
      handler: (response: RazorpaySuccessResponse) => {
        if (isCompleted) return;
        isCompleted = true;

        console.info("[PaymentService] ✅ Razorpay success handler invoked:", response.razorpay_payment_id);

        resolve({
          success: true,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id || backendOrderId,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          if (isCompleted) return;
          isCompleted = true;
          console.info("[PaymentService] ℹ️ Razorpay modal dismissed/closed by user.");
          resolve({
            success: false,
            error: lastFailureReason || "Payment was cancelled or closed. You can retry when ready.",
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

      // Listen for failed transaction attempts inside the modal
      rzp.on("payment.failed", (response: RazorpayFailureResponse) => {
        const errorMsg =
          response.error?.description ||
          response.error?.reason ||
          "Payment attempt failed. Please try a different payment method or retry.";
        console.warn("[PaymentService] ⚠️ Payment attempt failed inside modal:", errorMsg);
        lastFailureReason = errorMsg;

        // Notify UI without closing or terminating the session.
        // If the customer retries inside Razorpay modal and succeeds, handler will fire!
        if (payload.onPaymentFailed) {
          payload.onPaymentFailed(errorMsg);
        }
      });

      rzp.open();
    } catch (err) {
      if (!isCompleted) {
        isCompleted = true;
        resolve({
          success: false,
          error: err instanceof Error ? err.message : "Failed to open Razorpay modal.",
        });
      }
    }
  });
}
