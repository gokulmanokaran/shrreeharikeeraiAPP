/**
 * Supabase Product & Category Service
 * ────────────────────────────────────
 * Single Source of Truth for the Storefront.
 * 1. Queries Supabase PostgreSQL database directly.
 * 2. Implements real-time synchronization and stale-while-revalidate local cache.
 * 3. Falls back smoothly if network is temporarily offline.
 */
import { Product, PRODUCTS } from "../data/products";
import { Category, CATEGORIES } from "../data/categories";
import { getSupabaseClient } from "../lib/supabase";

const CACHED_PRODUCTS_KEY = "shreehari_cached_products_v4";
const CACHED_CATEGORIES_KEY = "shreehari_cached_categories_v4";
const CACHE_TIMESTAMP_KEY = "shreehari_catalog_last_synced";

/** Map Supabase DB Row to Frontend Product Interface */
export function mapDbProductToProduct(row: any): Product {
  const stockQty =
    row.stock_quantity !== null && row.stock_quantity !== undefined
      ? Number(row.stock_quantity)
      : undefined;

  const isExplicitlyInStock = row.in_stock !== false;
  const inStock =
    isExplicitlyInStock && (stockQty === undefined || isNaN(stockQty) || stockQty > 0);

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
    inStock,
    stockQuantity: stockQty !== undefined && !isNaN(stockQty) ? stockQty : undefined,
    featured: Boolean(row.featured),
    active: row.active !== false,
    sortOrder: row.sort_order !== undefined ? Number(row.sort_order) : 0,
    variantType: row.variant_type || undefined,
    variants: Array.isArray(row.variants) ? row.variants : undefined,
    updatedAt: row.updated_at || undefined,
  };
}

/** Map Supabase DB Row to Frontend Category Interface */
export function mapDbCategoryToCategory(row: any): Category {
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

/** Get cached products or fallback to initial catalog */
export function getStoredProducts(): Product[] {
  try {
    const raw = localStorage.getItem(CACHED_PRODUCTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("[ProductService] Error reading cached products:", err);
  }
  return PRODUCTS;
}

/** Get cached categories or fallback to initial categories */
export function getStoredCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CACHED_CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("[ProductService] Error reading cached categories:", err);
  }
  return CATEGORIES;
}

/** Save products to local cache */
export function cacheProducts(products: Product[]): void {
  try {
    localStorage.setItem(CACHED_PRODUCTS_KEY, JSON.stringify(products));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
  } catch (err) {
    console.warn("[ProductService] Error caching products:", err);
  }
}

/** Save categories to local cache */
export function cacheCategories(categories: Category[]): void {
  try {
    localStorage.setItem(CACHED_CATEGORIES_KEY, JSON.stringify(categories));
  } catch (err) {
    console.warn("[ProductService] Error caching categories:", err);
  }
}

/**
 * Fetches live products from Supabase Database (or REST API fallback)
 */
export async function fetchLiveProducts(): Promise<Product[]> {
  const supabase = getSupabaseClient();

  // 1. Fetch from Supabase Database
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapDbProductToProduct);
        cacheProducts(mapped);
        return mapped;
      }
      if (error) {
        console.warn("[ProductService] Supabase products error:", error.message);
      }
    } catch (err) {
      console.warn("[ProductService] Supabase fetch exception:", err);
    }
  }

  // 2. Fallback to API endpoint
  try {
    const res = await fetch(`/api/products?_ts=${Date.now()}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      if (list.length > 0) {
        const mapped = list.map(mapDbProductToProduct);
        cacheProducts(mapped);
        return mapped;
      }
    }
  } catch (err) {
    console.info("[ProductService] API fallback unreachable. Serving cached catalog.", err);
  }

  return getStoredProducts();
}

/**
 * Fetches live categories from Supabase Database (or REST API fallback)
 */
export async function fetchLiveCategories(): Promise<Category[]> {
  const supabase = getSupabaseClient();

  // 1. Fetch from Supabase Database
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapDbCategoryToCategory);
        cacheCategories(mapped);
        return mapped;
      }
      if (error) {
        console.warn("[ProductService] Supabase categories error:", error.message);
      }
    } catch (err) {
      console.warn("[ProductService] Supabase categories fetch exception:", err);
    }
  }

  // 2. Fallback to API endpoint
  try {
    const res = await fetch(`/api/categories?_ts=${Date.now()}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
    });

    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      if (list.length > 0) {
        const mapped = list.map(mapDbCategoryToCategory);
        cacheCategories(mapped);
        return mapped;
      }
    }
  } catch (err) {
    console.info("[ProductService] API fallback unreachable. Serving cached categories.", err);
  }

  return getStoredCategories();
}

/** Helper: Find product by ID in a given products array (including variant matches) */
export function findProductById(products: Product[], id: string): Product | undefined {
  const direct = products.find((p) => p.id === id);
  if (direct) return direct;

  const parent = products.find((p) => p.variants?.some((v) => v.id === id));
  if (parent && parent.variants) {
    const variant = parent.variants.find((v) => v.id === id);
    if (variant) {
      const isSugar = parent.variantType === "sugar";
      const isParentInStock =
        parent.inStock !== false &&
        (parent.stockQuantity === undefined || parent.stockQuantity > 0);
      return {
        ...parent,
        id: variant.id,
        price: variant.price,
        mrp: parent.mrp,
        unit: isSugar ? `${parent.unit} (${variant.unit})` : variant.unit,
        inStock: variant.inStock !== false && isParentInStock,
        stockQuantity: parent.stockQuantity,
      };
    }
  }

  return undefined;
}

/** Helper: Search products in a given products array */
export function filterProductsByQuery(products: Product[], query: string): Product[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.nameTamil && p.nameTamil.toLowerCase().includes(q)) ||
      (p.tamilName && p.tamilName.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      (p.note && p.note.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      p.variants?.some((v) => v.unit.toLowerCase().includes(q) || (v.name && v.name.toLowerCase().includes(q)))
  );
}

/**
 * Deduct stock upon successful payment / order placement.
 * Updates local cache instantly and syncs with Central API & Supabase database.
 */
export async function deductLiveProductStock(
  orderItems: Array<{ id?: string; quantity?: number }>
): Promise<void> {
  const validItems = orderItems
    .filter((item) => item && item.id)
    .map((item) => ({
      id: item.id as string,
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));

  if (!validItems.length) return;

  // 1. Instantly update local cached catalog so Storefront reflects deductions right away
  try {
    const stored = getStoredProducts();
    const updated = stored.map((prod) => {
      // Direct product match or variant match
      const deduction =
        validItems.find((i) => i.id === prod.id) ||
        validItems.find((i) => prod.variants?.some((v) => v.id === i.id));

      if (deduction && prod.stockQuantity !== undefined) {
        const newStock = Math.max(0, prod.stockQuantity - deduction.quantity);
        return {
          ...prod,
          stockQuantity: newStock,
          inStock: newStock > 0,
          updatedAt: new Date().toISOString(),
        };
      }
      return prod;
    });

    cacheProducts(updated);
  } catch (err) {
    console.warn("[ProductService] Local stock cache decrement error:", err);
  }

  // 2. Call Central Serverless API
  try {
    const res = await fetch("/api/deduct-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: validItems }),
    });
    if (res.ok) {
      console.info("[ProductService] Central API stock deduction confirmed.");
    }
  } catch (err) {
    console.warn("[ProductService] Stock deduction API call warning:", err);
  }

  // 3. Directly call Supabase RPC if client is initialized
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.rpc("deduct_product_stock", { p_items: validItems });
    } catch (err) {
      console.warn("[ProductService] Supabase RPC direct call warning:", err);
    }
  }
}
