import { Product, Category, AdminSession } from "../types";
import { INITIAL_PRODUCTS } from "./initialProducts";
import { getAdminSupabaseClient } from "../lib/supabase";

const AUTH_TOKEN_KEY = "shk_admin_auth_token";
const AUTH_SESSION_KEY = "shk_admin_session";
const LOCAL_CATALOG_KEY = "shk_admin_local_products_v3";
const LOCAL_CATEGORIES_KEY = "shk_admin_local_categories_v3";

export function getStoredToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AdminSession): void {
  localStorage.setItem(AUTH_TOKEN_KEY, session.token);
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_SESSION_KEY);
}

/** Map DB row to Product interface */
function mapRowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    nameTamil: row.name_tamil || row.tamil_name || "",
    tamilName: row.tamil_name || row.name_tamil || "",
    price: Number(row.price) || 0,
    mrp: Number(row.mrp) || Number(row.price) || 0,
    unit: row.unit || "1 Pack",
    quantity: row.quantity || row.unit || "1 Pack",
    category: row.category || "keerai",
    secondaryCategory: row.secondary_category || row.secondaryCategory || "",
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

/** Map DB row to Category interface */
function mapRowToCategory(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji || "🌿",
    description: row.description || "",
    color: row.color || "#EAF8F0",
    image: row.image || "",
    sortOrder: row.sort_order !== undefined ? Number(row.sort_order) : 0,
    active: row.active !== false,
  };
}

// ── Admin Authentication
export async function authenticateAdmin(passwordOrPin: string): Promise<AdminSession> {
  const clean = (passwordOrPin || "").trim();

  // Valid Administrator credentials
  const validCredentials = ["2026", "2026b", "admin2026", "shreehari2026", "shreehari_admin_secure_2026"];
  if (validCredentials.includes(clean) || clean.toLowerCase() === "2026" || clean.toLowerCase() === "2026b") {
    const session: AdminSession = {
      token: "shk_token_admin_2026",
      role: "admin",
      storeName: "Shree Hari Keerai",
      issuedAt: new Date().toISOString(),
    };
    saveSession(session);
    return session;
  }

  // Check backend serverless auth if configured
  try {
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: clean, password: clean }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        const session: AdminSession = {
          token: data.token || "shk_token_admin_2026",
          role: data.role || "admin",
          storeName: data.storeName || "Shree Hari Keerai",
          issuedAt: new Date().toISOString(),
        };
        saveSession(session);
        return session;
      }
    }
  } catch {
    // fallback
  }

  throw new Error("Invalid Administrator PIN or password. (Default PIN: 2026)");
}

// ── Products API — directly queries Supabase Database
export async function fetchProducts(): Promise<Product[]> {
  const supabase = getAdminSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const list = data.map(mapRowToProduct);
        localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(list));
        return list;
      }
      if (error) {
        console.warn("[AdminApi] Supabase fetchProducts error:", error.message);
      }
    } catch (err) {
      console.warn("[AdminApi] Supabase exception:", err);
    }
  }

  // Fallback to Central REST API
  try {
    const res = await fetch(`/api/products?_ts=${Date.now()}`, {
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      if (list.length > 0) {
        const mapped = list.map(mapRowToProduct);
        localStorage.setItem(LOCAL_CATALOG_KEY, JSON.stringify(mapped));
        return mapped;
      }
    }
  } catch (err) {
    console.warn("[AdminApi] REST API fallback unreachable:", err);
  }

  // Fallback to local storage
  try {
    const stored = localStorage.getItem(LOCAL_CATALOG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }

  return INITIAL_PRODUCTS;
}

export async function createProduct(product: Partial<Product>): Promise<Product> {
  const newProduct: Product = {
    id: product.id || `prod_${Date.now().toString(36)}`,
    name: product.name || "Untitled Product",
    nameTamil: product.nameTamil || product.tamilName || "",
    tamilName: product.tamilName || product.nameTamil || "",
    price: Number(product.price) || 0,
    mrp: Number(product.mrp) || Number(product.price) || 0,
    unit: product.unit || "1 Pack",
    quantity: product.quantity || product.unit || "1 Pack",
    category: product.category || "keerai",
    secondaryCategory: product.secondaryCategory || "",
    image: product.image || "",
    inStock: product.inStock !== false,
    stockQuantity: product.stockQuantity,
    featured: Boolean(product.featured),
    active: product.active !== false,
    description: product.description || "",
    shortDescription: product.shortDescription || "",
    note: product.note || "",
    variantType: product.variantType,
    variants: product.variants,
    updatedAt: new Date().toISOString(),
  };

  const supabase = getAdminSupabaseClient();
  if (supabase) {
    const dbPayload = {
      id: newProduct.id,
      name: newProduct.name,
      name_tamil: newProduct.nameTamil,
      tamil_name: newProduct.tamilName,
      price: newProduct.price,
      mrp: newProduct.mrp,
      unit: newProduct.unit,
      quantity: newProduct.quantity,
      category: newProduct.category,
      secondary_category: newProduct.secondaryCategory || "",
      image: newProduct.image,
      image_url: newProduct.image,
      description: newProduct.description,
      short_description: newProduct.shortDescription,
      note: newProduct.note,
      in_stock: newProduct.inStock,
      stock_quantity: newProduct.stockQuantity !== undefined ? newProduct.stockQuantity : null,
      featured: newProduct.featured,
      active: newProduct.active,
      variant_type: newProduct.variantType || null,
      variants: newProduct.variants || [],
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("products")
      .upsert(dbPayload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase error creating product: ${error.message}`);
    }

    const saved = data ? mapRowToProduct(data) : newProduct;
    return saved;
  }

  // REST API Fallback
  const res = await fetch("/api/products", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStoredToken() || "shreehari_admin_secure_2026"}`,
      "x-admin-key": "shreehari_admin_secure_2026",
    },
    body: JSON.stringify(newProduct),
  });

  if (!res.ok) {
    throw new Error(`Failed to create product on server (Status ${res.status}).`);
  }

  const json = await res.json();
  return json.data || newProduct;
}

export async function updateProduct(product: Partial<Product> & { id: string }): Promise<Product> {
  const supabase = getAdminSupabaseClient();

  if (supabase) {
    const dbPayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (product.name !== undefined) dbPayload.name = product.name;
    if (product.nameTamil !== undefined) {
      dbPayload.name_tamil = product.nameTamil;
      dbPayload.tamil_name = product.nameTamil;
    }
    if (product.tamilName !== undefined) {
      dbPayload.tamil_name = product.tamilName;
      dbPayload.name_tamil = product.tamilName;
    }
    if (product.price !== undefined) dbPayload.price = Number(product.price);
    if (product.mrp !== undefined) dbPayload.mrp = Number(product.mrp);
    if (product.unit !== undefined) dbPayload.unit = product.unit;
    if (product.quantity !== undefined) dbPayload.quantity = product.quantity;
    if (product.category !== undefined) dbPayload.category = product.category;
    if (product.secondaryCategory !== undefined) dbPayload.secondary_category = product.secondaryCategory;
    if (product.image !== undefined) {
      dbPayload.image = product.image;
      dbPayload.image_url = product.image;
    }
    if (product.description !== undefined) dbPayload.description = product.description;
    if (product.shortDescription !== undefined) dbPayload.short_description = product.shortDescription;
    if (product.note !== undefined) dbPayload.note = product.note;
    if (product.inStock !== undefined) dbPayload.in_stock = Boolean(product.inStock);
    if (product.stockQuantity !== undefined) dbPayload.stock_quantity = product.stockQuantity;
    if (product.featured !== undefined) dbPayload.featured = Boolean(product.featured);
    if (product.active !== undefined) dbPayload.active = Boolean(product.active);
    if (product.variantType !== undefined) dbPayload.variant_type = product.variantType;
    if (product.variants !== undefined) dbPayload.variants = product.variants;

    const { data, error } = await supabase
      .from("products")
      .update(dbPayload)
      .eq("id", product.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase error updating product: ${error.message}`);
    }

    return data ? mapRowToProduct(data) : (product as Product);
  }

  // REST API Fallback
  const res = await fetch("/api/products", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStoredToken() || "shreehari_admin_secure_2026"}`,
      "x-admin-key": "shreehari_admin_secure_2026",
    },
    body: JSON.stringify(product),
  });

  if (!res.ok) {
    throw new Error(`Server responded with status ${res.status} while updating product.`);
  }

  const json = await res.json();
  return json.data || (product as Product);
}

export async function toggleProductStock(id: string, inStock: boolean): Promise<Product> {
  const stockQuantity = inStock ? 20 : 0;
  return updateProduct({ id, inStock, stockQuantity });
}

export async function toggleProductActive(id: string, active: boolean): Promise<Product> {
  return updateProduct({ id, active });
}

export async function deleteProduct(id: string): Promise<boolean> {
  const supabase = getAdminSupabaseClient();

  if (supabase) {
    // Hard delete — permanently removes the row from the database
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }

    return true;
  }

  // REST API Fallback
  const res = await fetch("/api/products", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStoredToken() || "shreehari_admin_secure_2026"}`,
      "x-admin-key": "shreehari_admin_secure_2026",
    },
    body: JSON.stringify({ id }),
  });

  if (!res.ok) {
    throw new Error(`Server responded with status ${res.status} while deleting product.`);
  }

  return true;
}

// ── Categories API
export async function fetchCategories(): Promise<Category[]> {
  const supabase = getAdminSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const list = data.map(mapRowToCategory);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(list));
        return list;
      }
    } catch (err) {
      console.warn("[AdminApi] Supabase categories error:", err);
    }
  }

  // REST Fallback
  try {
    const res = await fetch(`/api/categories?_ts=${Date.now()}`);
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
      if (list.length > 0) {
        const mapped = list.map(mapRowToCategory);
        localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(mapped));
        return mapped;
      }
    }
  } catch {
    // fallback
  }

  return [
    { id: "new-arrivals", name: "New Arrivals", emoji: "✨", description: "Freshly added new arrivals", color: "#FEF3C7", sortOrder: 0, active: true },
    { id: "keerai", name: "Greens (Keerai)", emoji: "🌿", description: "Fresh leafy greens", color: "#EAF8F0", sortOrder: 1, active: true },
    { id: "microgreens", name: "Microgreens", emoji: "🌱", description: "Nutrient-packed microgreens (40g Pack)", color: "#E8F5E9", sortOrder: 2, active: true },
    { id: "vegetables", name: "Cut Vegetables", emoji: "🧅", description: "Ready-to-use cut vegetables", color: "#FFF8E7", sortOrder: 3, active: true },
    { id: "cut-fruits", name: "Cut Fruits", emoji: "🍓", description: "Fresh cut fruits", color: "#FFF0F5", sortOrder: 4, active: true },
    { id: "sprouts", name: "Sprouts", emoji: "🫘", description: "Fresh & nutritious sprouts", color: "#F0FFF4", sortOrder: 5, active: true },
    { id: "fresh-juices", name: "Fresh Juices", emoji: "🥤", description: "Freshly squeezed juices", color: "#FFFBE6", sortOrder: 6, active: true },
    { id: "premium-products", name: "Natural Powders", emoji: "✨", description: "Pure natural herbal powders", color: "#FAF0FF", sortOrder: 7, active: true },
    { id: "nuts-seeds", name: "Nuts & Seeds", emoji: "🥜", description: "Nutritious nuts & seeds", color: "#FFF5E6", sortOrder: 8, active: true },
    { id: "healthy-snacks", name: "Healthy Snacks", emoji: "🍿", description: "Guilt-free healthy snacks", color: "#F5FCF8", sortOrder: 9, active: true },
    { id: "seasonal-exotic-fruits", name: "Seasonal & Exotic Fruits", emoji: "🍍", description: "Seasonal & exotic fruits", color: "#FFF8EE", sortOrder: 10, active: true },
    { id: "mushrooms", name: "Mushrooms", emoji: "🍄", description: "Fresh & dried mushrooms", color: "#F5F0FF", sortOrder: 11, active: true },
    { id: "cold-pressed-oil", name: "Cold Pressed Oil", emoji: "🫙", description: "Pure cold pressed oils", color: "#FFFAEB", sortOrder: 12, active: true },
  ];
}

export async function saveCategory(category: Partial<Category>): Promise<Category> {
  const newCat: Category = {
    id: category.id || `cat_${Date.now()}`,
    name: category.name || "Category",
    emoji: category.emoji || "📦",
    description: category.description || "",
    color: category.color || "#EAF8F0",
    image: category.image || "",
    sortOrder: category.sortOrder || 99,
    active: category.active !== false,
  };

  const supabase = getAdminSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("categories")
      .upsert({
        id: newCat.id,
        name: newCat.name,
        emoji: newCat.emoji,
        description: newCat.description,
        color: newCat.color,
        image: newCat.image || "",
        sort_order: newCat.sortOrder,
        active: newCat.active,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      throw new Error(`Supabase error saving category: ${error.message}`);
    }

    return data ? mapRowToCategory(data) : newCat;
  }

  // REST Fallback
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStoredToken() || "shreehari_admin_secure_2026"}`,
      "x-admin-key": "shreehari_admin_secure_2026",
    },
    body: JSON.stringify(newCat),
  });

  if (!res.ok) {
    throw new Error(`Server error (${res.status}) while saving category.`);
  }

  const json = await res.json();
  return json.data || newCat;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const supabase = getAdminSupabaseClient();

  if (supabase) {
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase delete category failed: ${error.message}`);
    }

    return true;
  }

  // REST API Fallback
  const res2 = await fetch("/api/categories", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getStoredToken() || "shreehari_admin_secure_2026"}`,
      "x-admin-key": "shreehari_admin_secure_2026",
    },
    body: JSON.stringify({ id }),
  });

  if (!res2.ok) {
    throw new Error(`Server responded with status ${res2.status} while deleting category.`);
  }

  return true;
}

// ── Safe Image Upload & Verification
export async function uploadProductImage(
  imagePayload: string,
  imageName?: string,
  productId?: string
): Promise<{ imageUrl: string; verified: boolean }> {
  // If it's already a valid external URL, return immediately
  if (imagePayload.startsWith("http://") || imagePayload.startsWith("https://") || imagePayload.startsWith("/product-images/")) {
    return { imageUrl: imagePayload, verified: true };
  }

  // Upload to Central API / Storage
  try {
    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getStoredToken() || "shreehari_admin_secure_2026"}`,
        "x-admin-key": "shreehari_admin_secure_2026",
      },
      body: JSON.stringify({ image: imagePayload, imageName, productId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.imageUrl) {
        return { imageUrl: data.imageUrl, verified: Boolean(data.verified) };
      }
    }
  } catch (err) {
    console.warn("[AdminApi] Image upload API failed:", err);
  }

  // Fallback to data URI for immediate preview
  if (imagePayload.startsWith("data:image/")) {
    return { imageUrl: imagePayload, verified: true };
  }

  throw new Error("Failed to process product image. Please supply a valid image URL or file.");
}
