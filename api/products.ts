// Vercel Serverless Function: /api/products
// Central Product API for Website, Separate Admin Panel, and Future Android App.
import {
  Product,
  getCloudProducts,
  saveCloudProducts,
  validateAdminAuth,
  getLastCatalogUpdate,
  handleCors,
  parseApiRequest,
  sendApiResponse,
} from "./_catalog";

export default async function handler(req: any, res?: any): Promise<any> {
  // Handle CORS preflight
  if (handleCors(req, res)) {
    return;
  }

  const { method, query, body, getHeader } = await parseApiRequest(req);
  const productId = query.id;
  const category = query.category;
  const search = query.search;
  const inStockOnly = query.inStock === "true";

  // ── GET: Public Read Products ──────────────────────────────────────────────
  if (method === "GET") {
    try {
      let products = await getCloudProducts();

      // Single Product Lookup by ID
      if (productId) {
        const found = products.find(
          (p) => p.id === productId || p.variants?.some((v) => v.id === productId)
        );
        if (!found) {
          return sendApiResponse(res, 404, {
            success: false,
            error: "Product not found",
            id: productId,
          });
        }
        return sendApiResponse(
          res,
          200,
          { success: true, data: found },
          "public, max-age=0, s-maxage=30, stale-while-revalidate=86400"
        );
      }

      // Filter by Category
      if (category && category !== "all") {
        products = products.filter((p) => p.category === category || p.secondaryCategory === category);
      }

      // Filter by Stock Status
      if (inStockOnly) {
        products = products.filter((p) => p.inStock === true);
      }

      // Filter by Search query
      if (search && search.trim()) {
        const q = search.toLowerCase().trim();
        products = products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.nameTamil && p.nameTamil.toLowerCase().includes(q)) ||
            (p.tamilName && p.tamilName.toLowerCase().includes(q)) ||
            p.category.toLowerCase().includes(q) ||
            p.unit.toLowerCase().includes(q)
        );
      }

      return sendApiResponse(
        res,
        200,
        {
          success: true,
          count: products.length,
          lastUpdated: getLastCatalogUpdate(),
          data: products,
        },
        "public, max-age=0, s-maxage=30, stale-while-revalidate=86400"
      );
    } catch (err) {
      console.error("[API /products GET Error]:", err);
      return sendApiResponse(res, 500, {
        success: false,
        error: err instanceof Error ? err.message : "Internal Error fetching products",
      });
    }
  }

  // ── Protected Admin Write Operations (POST, PUT, DELETE, PATCH) ───────────
  if (!validateAdminAuth(getHeader)) {
    return sendApiResponse(res, 401, {
      success: false,
      error: "Unauthorized. Valid Admin authentication token or PIN required.",
    });
  }

  // ── POST: Create New Product / Bulk Sync ───────────────────────────────────
  if (method === "POST") {
    try {
      // Bulk Sync / Save All Products
      if (Array.isArray(body)) {
        const saveResult = await saveCloudProducts(body);
        return sendApiResponse(res, 200, {
          success: true,
          message: `Successfully saved ${body.length} products to Central API.`,
          count: body.length,
          lastUpdated: getLastCatalogUpdate(),
          storage: saveResult,
        });
      }

      // Single Product Creation
      const parsedStock =
        body.stockQuantity !== undefined && body.stockQuantity !== null && body.stockQuantity !== ""
          ? Number(body.stockQuantity)
          : undefined;

      const autoInStock =
        body.inStock !== undefined
          ? Boolean(body.inStock)
          : parsedStock !== undefined
          ? parsedStock > 0
          : true;

      const newProduct: Product = {
        ...body,
        id: body.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: body.name || "Untitled Product",
        nameTamil: body.nameTamil || body.tamilName || "",
        tamilName: body.tamilName || body.nameTamil || "",
        price: Number(body.price) || 0,
        mrp: Number(body.mrp) || Number(body.price) || 0,
        unit: body.unit || "1 Pack",
        category: body.category || "keerai",
        secondaryCategory: body.secondaryCategory || body.secondary_category || undefined,
        stockQuantity: parsedStock,
        inStock: parsedStock !== undefined && parsedStock === 0 ? false : autoInStock,
        active: body.active !== false,
        updatedAt: new Date().toISOString(),
      };

      const existingProducts = await getCloudProducts();
      const existingIdx = existingProducts.findIndex((p) => p.id === newProduct.id);

      let updatedList: Product[];
      if (existingIdx >= 0) {
        updatedList = [...existingProducts];
        updatedList[existingIdx] = newProduct;
      } else {
        updatedList = [newProduct, ...existingProducts];
      }

      const saveResult = await saveCloudProducts(updatedList);

      return sendApiResponse(res, 201, {
        success: true,
        message: "Product created and saved successfully.",
        data: newProduct,
        lastUpdated: getLastCatalogUpdate(),
        storage: saveResult,
      });
    } catch (err) {
      console.error("[API /products POST Error]:", err);
      return sendApiResponse(res, 400, {
        success: false,
        error: err instanceof Error ? err.message : "Error creating product",
      });
    }
  }

  // ── PUT / PATCH: Update Existing Product ───────────────────────────────────
  if (method === "PUT" || method === "PATCH") {
    try {
      const updateData = body;
      const targetId = updateData.id || productId;

      if (!targetId) {
        return sendApiResponse(res, 400, {
          success: false,
          error: "Product ID is required for update.",
        });
      }

      const existingProducts = await getCloudProducts();
      const index = existingProducts.findIndex((p) => p.id === targetId);

      if (index === -1) {
        return sendApiResponse(res, 404, {
          success: false,
          error: `Product with ID "${targetId}" not found in catalog.`,
        });
      }

      const current = existingProducts[index];

      const parsedStock =
        updateData.stockQuantity !== undefined
          ? updateData.stockQuantity === null || updateData.stockQuantity === ""
            ? undefined
            : Number(updateData.stockQuantity)
          : current.stockQuantity;

      let effectiveInStock =
        updateData.inStock !== undefined ? Boolean(updateData.inStock) : current.inStock;

      if (parsedStock !== undefined) {
        if (parsedStock === 0) {
          effectiveInStock = false;
        } else if (parsedStock > 0 && updateData.inStock === undefined && !effectiveInStock) {
          effectiveInStock = true;
        }
      }

      const updatedProduct: Product = {
        ...current,
        ...updateData,
        id: current.id, // ID must remain constant
        nameTamil:
          updateData.nameTamil !== undefined
            ? updateData.nameTamil
            : updateData.tamilName !== undefined
            ? updateData.tamilName
            : current.nameTamil,
        tamilName:
          updateData.tamilName !== undefined
            ? updateData.tamilName
            : updateData.nameTamil !== undefined
            ? updateData.nameTamil
            : current.tamilName,
        price: updateData.price !== undefined ? Number(updateData.price) : current.price,
        mrp: updateData.mrp !== undefined ? Number(updateData.mrp) : current.mrp ?? current.price,
        stockQuantity: parsedStock,
        inStock: effectiveInStock,
        updatedAt: new Date().toISOString(),
      };

      const updatedList = [...existingProducts];
      updatedList[index] = updatedProduct;

      const saveResult = await saveCloudProducts(updatedList);

      return sendApiResponse(res, 200, {
        success: true,
        message: `Product "${updatedProduct.name}" (#${updatedProduct.id}) updated successfully.`,
        data: updatedProduct,
        lastUpdated: getLastCatalogUpdate(),
        storage: saveResult,
      });
    } catch (err) {
      console.error("[API /products PUT Error]:", err);
      return sendApiResponse(res, 400, {
        success: false,
        error: err instanceof Error ? err.message : "Error updating product",
      });
    }
  }

  // ── DELETE: Remove Product ────────────────────────────────────────────────
  if (method === "DELETE") {
    try {
      const targetId = productId || body?.id;

      if (!targetId) {
        return sendApiResponse(res, 400, {
          success: false,
          error: "Product ID is required for deletion.",
        });
      }

      const existingProducts = await getCloudProducts();
      const filtered = existingProducts.filter((p) => p.id !== targetId);

      if (filtered.length === existingProducts.length) {
        return sendApiResponse(res, 404, {
          success: false,
          error: `Product with ID "${targetId}" not found.`,
        });
      }

      const saveResult = await saveCloudProducts(filtered);

      return sendApiResponse(res, 200, {
        success: true,
        message: `Product #${targetId} successfully removed.`,
        remainingCount: filtered.length,
        lastUpdated: getLastCatalogUpdate(),
        storage: saveResult,
      });
    } catch (err) {
      console.error("[API /products DELETE Error]:", err);
      return sendApiResponse(res, 400, {
        success: false,
        error: err instanceof Error ? err.message : "Error deleting product",
      });
    }
  }

  return sendApiResponse(res, 405, { error: "Method not allowed" });
}
