// Vercel Serverless Function: /api/create-razorpay-order
// Creates a Razorpay Order securely using RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.
import { handleCors, parseApiRequest, sendApiResponse } from "./_catalog";

export default async function handler(req: any, res?: any): Promise<any> {
  if (handleCors(req, res)) {
    return;
  }

  const { method, body } = await parseApiRequest(req);

  if (method !== "POST") {
    return sendApiResponse(res, 405, { error: "Method not allowed. Use POST." });
  }

  try {
    const { amount, receipt, currency = "INR" } = body || {};

    const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || "rzp_test_TU0lWbkyOmj5C5";
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      return sendApiResponse(res, 200, {
        configured: false,
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
        amount: Math.round(Number(amount) * 100), // in paise
        currency,
        receipt: String(receipt || `rcpt_${Date.now()}`),
        payment_capture: 1,
      }),
    });

    if (!razorpayResponse.ok) {
      const errData = await razorpayResponse.json().catch(() => ({}));
      return sendApiResponse(res, razorpayResponse.status, {
        error: "Razorpay API error",
        details: errData,
      });
    }

    const orderData = await razorpayResponse.json();

    return sendApiResponse(res, 200, {
      configured: true,
      orderId: orderData.id,
      amount: orderData.amount,
      currency: orderData.currency,
    });
  } catch (err) {
    return sendApiResponse(res, 500, {
      error: err instanceof Error ? err.message : "Internal Server Error",
    });
  }
}
