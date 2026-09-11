// Vercel Serverless Function: /api/deduct-stock
// Atomically deducts purchased quantities from product stocks upon successful order/payment.
import {
  handleCors,
  parseApiRequest,
  sendApiResponse,
  deductCatalogStock,
} from "./_catalog";

export interface DeductItemInput {
  id: string;
  quantity: number;
}

export default async function handler(req: any, res?: any): Promise<any> {
  if (handleCors(req, res)) {
    return;
  }

  const { method, body } = await parseApiRequest(req);

  if (method !== "POST") {
    return sendApiResponse(res, 405, { error: "Method not allowed. Use POST." });
  }

  try {
    const items: DeductItemInput[] = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body)
      ? body
      : [];

    if (!items.length) {
      return sendApiResponse(res, 400, {
        success: false,
        error: "Missing or invalid items array for stock deduction.",
      });
    }

    // Clean & validate item inputs
    const validItems = items
      .filter((item) => item && typeof item.id === "string" && item.id.trim())
      .map((item) => ({
        id: item.id.trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
      }));

    if (!validItems.length) {
      return sendApiResponse(res, 400, {
        success: false,
        error: "No valid product IDs provided in items array.",
      });
    }

    const result = await deductCatalogStock(validItems);

    return sendApiResponse(res, 200, {
      success: true,
      message: `Stock successfully deducted for ${validItems.length} item(s).`,
      data: result,
    });
  } catch (error) {
    console.error("[API /deduct-stock Error]:", error);
    return sendApiResponse(res, 500, {
      success: false,
      error: error instanceof Error ? error.message : "Internal server error deducting stock.",
    });
  }
}
