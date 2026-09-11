// Vercel Serverless Function: /api/categories
// Central Categories API for Website, Separate Admin Panel, and Future Android App.
import {
  Category,
  getCloudCategories,
  saveCloudCategories,
  validateAdminAuth,
  handleCors,
  parseApiRequest,
  sendApiResponse,
} from "./_catalog";

export default async function handler(req: any, res?: any): Promise<any> {
  // Handle CORS preflight
  if (handleCors(req, res)) {
    return;
  }

  const { method, body, getHeader } = await parseApiRequest(req);

  // ── GET: Public Read Categories ───────────────────────────────────────────
  if (method === "GET") {
    try {
      const categories = await getCloudCategories();
      return sendApiResponse(
        res,
        200,
        {
          success: true,
          count: categories.length,
          data: categories,
        },
        "public, max-age=0, s-maxage=60, stale-while-revalidate=86400"
      );
    } catch (err) {
      console.error("[API /categories GET Error]:", err);
      return sendApiResponse(res, 500, {
        success: false,
        error: err instanceof Error ? err.message : "Internal Error fetching categories",
      });
    }
  }

  // ── Protected Admin Write Methods (POST, PUT) ─────────────────────────────
  if (!validateAdminAuth(getHeader)) {
    return sendApiResponse(res, 401, {
      success: false,
      error: "Unauthorized. Valid Admin credentials required.",
    });
  }

  if (method === "POST" || method === "PUT") {
    try {
      if (Array.isArray(body)) {
        const saveResult = await saveCloudCategories(body);
        return sendApiResponse(res, 200, {
          success: true,
          message: `Successfully synchronized ${body.length} categories.`,
          count: body.length,
          data: body,
          storage: saveResult,
        });
      }

      const newCat: Category = {
        id: body.id || `cat_${Date.now()}`,
        name: body.name || "Untitled Category",
        emoji: body.emoji || "📦",
        description: body.description || "",
        color: body.color || "#F5F5F5",
        sortOrder: body.sortOrder || 99,
        active: body.active !== false,
      };

      const existing = await getCloudCategories();
      const idx = existing.findIndex((c) => c.id === newCat.id);

      let updatedList: Category[];
      if (idx >= 0) {
        updatedList = [...existing];
        updatedList[idx] = newCat;
      } else {
        updatedList = [...existing, newCat];
      }

      const saveResult = await saveCloudCategories(updatedList);

      return sendApiResponse(res, 200, {
        success: true,
        message: "Category saved successfully.",
        data: newCat,
        storage: saveResult,
      });
    } catch (err) {
      console.error("[API /categories POST/PUT Error]:", err);
      return sendApiResponse(res, 400, {
        success: false,
        error: err instanceof Error ? err.message : "Error saving category",
      });
    }
  }

  return sendApiResponse(res, 405, { error: "Method not allowed" });
}
