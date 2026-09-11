// Vercel Serverless Function: /api/order-webhook
// Forwards order payloads to Google Apps Script or other backend services securely.
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
    const orderData = body;

    if (!orderData || !orderData.orderId) {
      return sendApiResponse(res, 400, { error: "Invalid order data: orderId is required." });
    }

    const targetWebhookUrl =
      process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
      process.env.VITE_ORDER_WEBHOOK_URL ||
      process.env.ORDER_WEBHOOK_URL ||
      "https://script.google.com/macros/s/AKfycbzjXsA4gHp4u30Qx9RhFamyOIrSjqs2yi9K5wAF1YylK8FU9Ushsex8kffAIIRUR3bI/exec";

    if (!targetWebhookUrl) {
      console.info("[API /order-webhook] Order received (No downstream webhook URL configured yet):", orderData.orderId);
      return sendApiResponse(res, 200, {
        success: true,
        orderId: orderData.orderId,
        note: "Order recorded in API. Configure GOOGLE_SHEETS_WEBHOOK_URL in Vercel environment variables to forward directly.",
      });
    }

    // Forward to Google Apps Script Webhook
    const upstreamRes = await fetch(targetWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(orderData),
    });

    const upstreamText = await upstreamRes.text();
    let upstreamJson: unknown;
    try {
      upstreamJson = JSON.parse(upstreamText);
    } catch {
      upstreamJson = { raw: upstreamText };
    }

    return sendApiResponse(res, 200, {
      success: true,
      orderId: orderData.orderId,
      upstream: upstreamJson,
    });
  } catch (error) {
    console.error("[API /order-webhook] Error processing order notification:", error);
    return sendApiResponse(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
    });
  }
}
