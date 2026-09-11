// api/_catalog.ts
// Supabase-backed Catalog Engine for Serverless Endpoints
// Serves Storefront, Admin Panel, and Future Android App via Supabase PostgreSQL.

import { getSupabaseServerClient } from "./_supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProductVariant {
  id: string;
  name?: string;
  unit: string;
  price: number;
  inStock?: boolean;
}

export interface Product {
  id: string;
  name: string;
  nameTamil?: string;
  tamilName?: string;
  price: number;
  mrp?: number;
  unit: string;
  quantity?: string;
  category: string;
  secondaryCategory?: string;
  description?: string;
  shortDescription?: string;
  note?: string;
  image?: string;
  inStock: boolean;
  stockQuantity?: number;
  featured?: boolean;
  active?: boolean;
  sortOrder?: number;
  variantType?: "weight" | "sugar";
  variants?: ProductVariant[];
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  image?: string;
  sortOrder?: number;
  active?: boolean;
}

// ─── DB Mappers ───────────────────────────────────────────────────────────────
function mapDbProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    nameTamil: row.name_tamil || row.tamil_name || "",
    tamilName: row.tamil_name || row.name_tamil || "",
    price: Number(row.price) || 0,
    mrp: Number(row.mrp) || Number(row.price) || 0,
    unit: row.unit || "1 Pack",
    quantity: row.quantity || row.unit || "1 Pack",
    category: row.category,
    secondaryCategory: row.secondary_category || row.secondaryCategory || undefined,
    image: row.image || row.image_url || "",
    description: row.description || "",
    shortDescription: row.short_description || "",
    note: row.note || "",
    inStock: row.in_stock !== false,
    stockQuantity: row.stock_quantity !== null && row.stock_quantity !== undefined ? Number(row.stock_quantity) : undefined,
    featured: Boolean(row.featured),
    active: row.active !== false,
    sortOrder: row.sort_order !== undefined ? Number(row.sort_order) : 0,
    variantType: row.variant_type || undefined,
    variants: Array.isArray(row.variants) ? row.variants : undefined,
    updatedAt: row.updated_at || undefined,
  };
}

function mapDbCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji || "🌿",
    description: row.description || "",
    color: row.color || "#EAF8F0",
    image: row.image || row.image_url || "",
    sortOrder: row.sort_order !== undefined ? Number(row.sort_order) : 0,
    active: row.active !== false,
  };
}

// ─── In-memory Cache ─────────────────────────────────────────────────────────
let _cachedProducts: Product[] = [];
let _cachedCategories: Category[] = [];

// ─── Storage Persistence Adapter ──────────────────────────────────────────────
export interface StorageStatus {
  persistent: boolean;
  provider: "supabase" | "memory";
  message: string;
}

export async function getCloudProducts(): Promise<Product[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        _cachedProducts = data.map(mapDbProduct);
        return _cachedProducts;
      }
    } catch (err) {
      console.warn("[CatalogEngine] Supabase fetch error:", err);
    }
  }

  return _cachedProducts;
}

export async function getCloudCategories(): Promise<Category[]> {
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        _cachedCategories = data.map(mapDbCategory);
        return _cachedCategories;
      }
    } catch (err) {
      console.warn("[CatalogEngine] Supabase categories error:", err);
    }
  }

  return _cachedCategories;
}

export async function saveCloudProducts(products: Product[]): Promise<StorageStatus> {
  _cachedProducts = products;
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const payload = products.map((p) => ({
        id: p.id,
        name: p.name,
        name_tamil: p.nameTamil || p.tamilName || "",
        tamil_name: p.tamilName || p.nameTamil || "",
        price: Number(p.price || 0),
        mrp: Number(p.mrp || p.price || 0),
        unit: p.unit || "1 Pack",
        quantity: p.quantity || p.unit || "1 Pack",
        category: p.category || "keerai",
        secondary_category: p.secondaryCategory || "",
        image: p.image || "",
        image_url: p.image || "",
        description: p.description || "",
        short_description: p.shortDescription || "",
        note: p.note || "",
        in_stock: p.inStock !== false,
        stock_quantity: p.stockQuantity !== undefined ? Number(p.stockQuantity) : null,
        featured: Boolean(p.featured),
        active: p.active !== false,
        sort_order: Number(p.sortOrder || 0),
        variant_type: p.variantType || null,
        variants: p.variants || [],
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("products").upsert(payload, { onConflict: "id" });
      if (!error) {
        return { persistent: true, provider: "supabase", message: "Successfully synced with Supabase Database." };
      }
    } catch (err) {
      console.warn("[CatalogEngine] Supabase save error:", err);
    }
  }

  return { persistent: false, provider: "memory", message: "Catalog updated in memory." };
}

export async function saveCloudCategories(categories: Category[]): Promise<StorageStatus> {
  _cachedCategories = categories;
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      const payload = categories.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji || "🌿",
        description: c.description || "",
        color: c.color || "#EAF8F0",
        image: c.image || "",
        sort_order: Number(c.sortOrder || 0),
        active: c.active !== false,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("categories").upsert(payload, { onConflict: "id" });
      if (!error) {
        return { persistent: true, provider: "supabase", message: "Categories synced with Supabase." };
      }
    } catch (err) {
      console.warn("[CatalogEngine] Supabase categories save error:", err);
    }
  }

  return { persistent: false, provider: "memory", message: "Categories updated in memory." };
}

export async function deductCatalogStock(
  items: Array<{ id: string; quantity: number }>
): Promise<{ success: boolean; updated: any[] }> {
  const supabase = getSupabaseServerClient();
  const updatedItems: any[] = [];

  if (supabase) {
    try {
      // 1. Try atomic RPC function first
      const { data: rpcData, error: rpcError } = await supabase.rpc("deduct_product_stock", {
        p_items: items,
      });

      if (!rpcError && rpcData && rpcData.success) {
        await getCloudProducts();
        return rpcData;
      }
      if (rpcError) {
        console.warn("[CatalogEngine] Supabase RPC deduct_product_stock fallback:", rpcError.message);
      }
    } catch (err) {
      console.warn("[CatalogEngine] Supabase RPC call exception:", err);
    }

    // 2. Direct Supabase row-level update fallback
    try {
      for (const item of items) {
        const { data: prodData } = await supabase
          .from("products")
          .select("id, stock_quantity, in_stock")
          .eq("id", item.id)
          .single();

        if (prodData && prodData.stock_quantity !== null && prodData.stock_quantity !== undefined) {
          const currentStock = Number(prodData.stock_quantity);
          const newStock = Math.max(0, currentStock - (item.quantity || 1));
          const newInStock = newStock > 0;

          await supabase
            .from("products")
            .update({
              stock_quantity: newStock,
              in_stock: newInStock,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          updatedItems.push({
            id: item.id,
            previousStock: currentStock,
            newStock,
            inStock: newInStock,
          });
        }
      }
      await getCloudProducts();
      return { success: true, updated: updatedItems };
    } catch (err) {
      console.warn("[CatalogEngine] Supabase direct deduction fallback exception:", err);
    }
  }

  // 3. In-memory fallback
  for (const item of items) {
    const idx = _cachedProducts.findIndex((p) => p.id === item.id);
    if (idx >= 0) {
      const p = _cachedProducts[idx];
      if (p.stockQuantity !== undefined) {
        const prev = p.stockQuantity;
        const newStock = Math.max(0, prev - (item.quantity || 1));
        const newInStock = newStock > 0;
        _cachedProducts[idx] = {
          ...p,
          stockQuantity: newStock,
          inStock: newInStock,
          updatedAt: new Date().toISOString(),
        };
        updatedItems.push({
          id: item.id,
          previousStock: prev,
          newStock,
          inStock: newInStock,
        });
      }
    }
  }

  return { success: true, updated: updatedItems };
}

export function getLastCatalogUpdate(): string {
  return new Date().toISOString();
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
export function handleCors(req: any, res?: any): boolean {
  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Admin-Key");
  }
  if ((req.method || "").toUpperCase() === "OPTIONS") {
    if (res && typeof res.status === "function") res.status(200).end();
    return true;
  }
  return false;
}

// ─── Request Parser ───────────────────────────────────────────────────────────
export interface ParsedRequest {
  method: string;
  query: Record<string, string>;
  body: any;
  getHeader: (name: string) => string | undefined;
}

export async function parseApiRequest(req: any): Promise<ParsedRequest> {
  const method = (req.method || "GET").toUpperCase();

  const headers: Record<string, string> = {};
  if (req.headers) {
    if (typeof req.headers.forEach === "function") {
      req.headers.forEach((v: string, k: string) => { headers[k.toLowerCase()] = v; });
    } else {
      for (const k in req.headers) headers[k.toLowerCase()] = String(req.headers[k]);
    }
  }
  const getHeader = (n: string) => headers[n.toLowerCase()];

  const query: Record<string, string> = {};
  if (req.query && typeof req.query === "object") {
    for (const k in req.query) query[k] = String(req.query[k]);
  } else if (req.url) {
    const qi = (req.url as string).indexOf("?");
    if (qi >= 0) new URLSearchParams(req.url.slice(qi)).forEach((v, k) => { query[k] = v; });
  }

  let body: any = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { /* keep */ }
  } else if (!body && typeof req.json === "function") {
    try { body = await req.json(); } catch { body = {}; }
  } else if (!body && req.on && method !== "GET" && method !== "HEAD") {
    body = await new Promise((resolve) => {
      let d = "";
      req.on("data", (c: any) => { d += c; });
      req.on("end", () => {
        try { resolve(JSON.parse(d || "{}")); } catch { resolve({}); }
      });
      req.on("error", () => resolve({}));
    });
  }

  return { method, query, body: body || {}, getHeader };
}

// ─── Response Helper ──────────────────────────────────────────────────────────
export function sendApiResponse(res: any, status: number, data: any, cacheControl?: string): any {
  if (res && typeof res.status === "function" && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");
    if (cacheControl) res.setHeader("Cache-Control", cacheControl);
    return res.status(status).json(data);
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...(cacheControl ? { "Cache-Control": cacheControl } : {}),
    },
  });
}

// ─── Auth Validator ───────────────────────────────────────────────────────────
export const DEFAULT_ADMIN_KEY = "shreehari_admin_secure_2026";

export function validateAdminAuth(getHeader: (name: string) => string | undefined): boolean {
  const key = process.env.ADMIN_API_KEY || DEFAULT_ADMIN_KEY;
  const auth = getHeader("authorization");
  if (auth) {
    const t = auth.replace(/^Bearer\s+/i, "").trim();
    if (t === key || t.startsWith("shk_token_")) return true;
  }
  const xk = getHeader("x-admin-key");
  if (xk?.trim() === key) return true;
  return false;
}
