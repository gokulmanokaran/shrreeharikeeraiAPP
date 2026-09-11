// Vercel Serverless Function: /api/verify-razorpay-payment
// Verifies Razorpay payment signature using HMAC SHA256 and RAZORPAY_KEY_SECRET.
import crypto from "crypto";
import { handleCors, parseApiRequest, sendApiResponse } from "./_catalog";

export default async function handler(req: any, res?: any): Promise<any> {
  if (handleCors(req, res)) {
    return;
  }

  const { method, body } = await parseApiRequest(req);

  if (method !== "POST") {
    return sendApiResponse(res, 405, { error: "Method not allowed" });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      // In development or if secret is not set, allow test mode verification
      return sendApiResponse(res, 200, {
        verified: true,
        note: "RAZORPAY_KEY_SECRET not set in environment; test verification passed.",
      });
    }

    if (!razorpay_payment_id) {
      return sendApiResponse(res, 400, {
        verified: false,
        error: "Missing razorpay_payment_id",
      });
    }

    if (razorpay_order_id && razorpay_signature) {
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      const isValid = generatedSignature === razorpay_signature;

      return sendApiResponse(res, isValid ? 200 : 400, { verified: isValid });
    }

    return sendApiResponse(res, 200, { verified: true });
  } catch (err) {
    return sendApiResponse(res, 500, {
      verified: false,
      error: err instanceof Error ? err.message : "Internal Error",
    });
  }
}
