import { handleCors, parseApiRequest, sendApiResponse, getOrGenerateSequentialOrderId } from "./_catalog.js";
import { getSupabaseServerClient } from "./_supabase.js";

export default async function handler(req: any, res?: any): Promise<any> {
  if (handleCors(req, res)) return;
  const { method } = await parseApiRequest(req);
  if (method !== "GET" && method !== "POST") {
    return sendApiResponse(res, 405, { error: "Method not allowed. Use GET or POST." });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    console.error("[generate-order-id] Supabase client not initialized. Ensure SUPABASE_SERVICE_ROLE_KEY is configured.");
    return sendApiResponse(res, 500, { success: false, error: "Supabase client uninitialized" });
  }

  try {
    const orderId = await getOrGenerateSequentialOrderId(supabase);
    return sendApiResponse(res, 200, { success: true, orderId });
  } catch (err) {
    console.error("[generate-order-id] Failed to generate order ID:", err);
    return sendApiResponse(res, 500, { success: false, error: "Failed to generate order ID" });
  }
}
