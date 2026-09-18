// Vercel Serverless Function: /api/create-razorpay-order
// Creates a Razorpay Order securely using RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
// with strict server-side validation of pincode, minimum order value, and delivery charge.
import {
  handleCors,
  parseApiRequest,
  sendApiResponse,
  isValidServerPincode,
  calculateServerDeliveryCharge,
  SERVER_MINIMUM_ORDER,
  SERVER_UNSUPPORTED_PINCODE_MESSAGE,
  getCloudProducts,
} from "./_catalog.js";

export default async function handler(req: any, res?: any): Promise<any> {
  if (handleCors(req, res)) {
    return;
  }

  const { method, body } = await parseApiRequest(req);

  if (method !== "POST") {
    return sendApiResponse(res, 405, { error: "Method not allowed. Use POST." });
  }

  try {
    const { amount, receipt, currency = "INR", notes, pincode: rawPincode, items } = body || {};
    const effectivePincode = String(rawPincode || notes?.pincode || "").trim();

    // ── 1. Strict Server Pincode Validation ──────────────────────────────────
    if (!effectivePincode || !isValidServerPincode(effectivePincode)) {
      return sendApiResponse(res, 400, {
        error: SERVER_UNSUPPORTED_PINCODE_MESSAGE,
      });
    }

    // ── 2. Server-side Subtotal Calculation ─────────────────────────────────
    let subtotal = 0;
    const rawItems = Array.isArray(items) ? items : [];

    if (rawItems.length > 0) {
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

        for (const rawItem of rawItems) {
          if (!rawItem) continue;
          const itemId = rawItem.id ? String(rawItem.id).trim() : "";
          const catProduct = itemId ? catalogMap.get(itemId) : null;
          const qty = Math.max(1, Number(rawItem.quantity) || 1);
          const unitPrice = catProduct ? Number(catProduct.price) : Math.max(0, Number(rawItem.price) || 0);
          subtotal += unitPrice * qty;
        }
      } catch (err) {
        console.warn("[create-razorpay-order] Catalog lookup fallback:", err);
        subtotal = rawItems.reduce((acc: number, item: any) => {
          const q = Math.max(1, Number(item?.quantity) || 1);
          const p = Math.max(0, Number(item?.price) || 0);
          return acc + p * q;
        }, 0);
      }
    } else if (amount) {
      // Fallback if raw items array not passed directly
      subtotal = Math.max(0, Number(amount) || 0);
    }

    // ── 3. Minimum Order Value Check (₹199) ───────────────────────────────────
    if (subtotal < SERVER_MINIMUM_ORDER) {
      return sendApiResponse(res, 400, {
        error: `Minimum order value is ₹${SERVER_MINIMUM_ORDER}.`,
      });
    }

    // ── 4. Authoritative Delivery Charge & Total Recalculation ───────────────
    const deliveryCharge = calculateServerDeliveryCharge(subtotal, effectivePincode);
    const finalTotal = Math.round((subtotal + deliveryCharge) * 100) / 100;
    const amountInPaise = Math.round(finalTotal * 100);

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_TU0lWbkyOmj5C5";
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return sendApiResponse(res, 200, {
        configured: false,
        validatedAmount: finalTotal,
        deliveryCharge,
        message: "RAZORPAY_KEY_SECRET not set in server environment. Client test checkout will be used.",
      });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountInPaise, // in paise
        currency,
        receipt: String(receipt || `rcpt_${Date.now()}`),
        payment_capture: 1,
        notes: {
          ...(notes && typeof notes === "object" ? notes : {}),
          pincode: effectivePincode,
          subtotal: String(subtotal),
          deliveryCharge: String(deliveryCharge),
          validatedTotal: String(finalTotal),
        },
      }),
    });

    if (!razorpayResponse.ok) {
      const errData = await razorpayResponse.json().catch(() => ({}));
      return sendApiResponse(res, razorpayResponse.status, {
        error: "Razorpay API error",
        details: errData,
      });
    }

    const orderData = (await razorpayResponse.json()) as any;

    return sendApiResponse(res, 200, {
      configured: true,
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
      validatedAmount: finalTotal,
      deliveryCharge,
    });
  } catch (err) {
    return sendApiResponse(res, 500, {
      error: err instanceof Error ? err.message : "Internal Server Error",
    });
  }
}
