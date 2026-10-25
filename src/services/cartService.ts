import { getSupabaseClient } from "../lib/supabase";
import { Product } from "../data/products";
import { findProductById } from "./productService";

// ── Database Row Representation ──────────────────────────────────────────────

export interface CartRow {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  added_price?: number | null;
  created_at?: string;
  updated_at?: string;
}

// ── In-Memory / Context Cart Item with Real-Time Validation Status ─────────────

export interface CartItem {
  product: Product;
  quantity: number;
  // Live Validation Flags & Diagnostics
  addedPrice?: number;
  priceChanged?: boolean;
  previousPrice?: number;
  isOutOfStock?: boolean;
  stockExceeded?: boolean;
  availableStock?: number;
  isInactive?: boolean;
}

export interface CartValidationReport {
  items: CartItem[];
  hasChanges: boolean;
  hasPriceChange: boolean;
  hasOutOfStock: boolean;
  hasStockExceeded: boolean;
  verifiedSubtotal: number;
}

// Track whether the cart_items table is verified in Supabase
let _tableMissingNotified = false;

// ── Supabase Cart Operations ──────────────────────────────────────────────────

/**
 * Fetch all cart items for the authenticated user directly from Supabase.
 */
export async function fetchUserCart(
  userId: string
): Promise<{ success: boolean; data: CartRow[]; isTableMissing?: boolean; error?: string }> {
  if (!userId) {
    return { success: false, data: [], error: "No user ID provided" };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { success: false, data: [], error: "Supabase client unavailable" };
  }

  try {
    const { data, error } = await supabase
      .from("cart_items")
      .select("id, user_id, product_id, quantity, added_price, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      const isMissing = error.code === "PGRST205" || error.message?.includes("cart_items");
      if (isMissing && !_tableMissingNotified) {
        _tableMissingNotified = true;
        console.warn(
          "[CartService] Notice: public.cart_items table not found in Supabase. Run supabase/cart-items.sql to activate DB persistence."
        );
      }
      return { success: false, data: [], isTableMissing: isMissing, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    return { success: false, data: [], error: err?.message || "Failed to fetch user cart" };
  }
}

/**
 * Upsert a single cart item into Supabase. Updates quantity if already present.
 */
export async function upsertCartItem(
  userId: string,
  productId: string,
  quantity: number,
  addedPrice?: number
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !productId || quantity <= 0) {
    return { success: false, error: "Invalid parameters" };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Supabase client unavailable" };

  try {
    const { error } = await supabase.from("cart_items").upsert(
      {
        user_id: userId,
        product_id: productId,
        quantity,
        added_price: addedPrice ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,product_id" }
    );

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to upsert cart item" };
  }
}

/**
 * Remove a specific product from user's Supabase cart.
 */
export async function removeCartItem(
  userId: string,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId || !productId) return { success: false, error: "Invalid parameters" };

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Supabase client unavailable" };

  try {
    const { error } = await supabase
      .from("cart_items")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to remove cart item" };
  }
}

/**
 * Clear all cart items for a user in Supabase (e.g. after successful order).
 */
export async function clearUserCart(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  if (!userId) return { success: false, error: "Invalid user ID" };

  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Supabase client unavailable" };

  try {
    const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to clear user cart" };
  }
}

/**
 * Merge temporary items into user's Supabase cart (e.g. on customer login).
 */
export async function mergeGuestItemsIntoUserCart(
  userId: string,
  guestItems: Array<{ product: Product; quantity: number }>
): Promise<void> {
  if (!userId || !guestItems || guestItems.length === 0) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // 1. Fetch current user cart from Supabase to merge quantities
    const { data: existingRows } = await supabase
      .from("cart_items")
      .select("product_id, quantity")
      .eq("user_id", userId);

    const existingMap = new Map<string, number>();
    (existingRows || []).forEach((row) => {
      existingMap.set(row.product_id, row.quantity);
    });

    // 2. Prepare merged upsert payload
    const upserts = guestItems.map((item) => {
      const existingQty = existingMap.get(item.product.id) || 0;
      const mergedQty = Math.max(item.quantity, existingQty);
      return {
        user_id: userId,
        product_id: item.product.id,
        quantity: mergedQty,
        added_price: item.product.price,
        updated_at: new Date().toISOString(),
      };
    });

    if (upserts.length > 0) {
      await supabase.from("cart_items").upsert(upserts, { onConflict: "user_id,product_id" });
    }
  } catch (err) {
    console.warn("[CartService] Guest cart merge notice:", err);
  }
}

// ── Authoritative Real-Time Product Validation ───────────────────────────────

/**
 * Validates cart items against the latest live catalog from Supabase.
 * - Detects price adjustments made by admin
 * - Detects out of stock state
 * - Detects stock reductions below cart quantity
 * - Detects inactive or deleted products
 * - Computes verified subtotal using ONLY fresh database prices
 */
export function validateCartWithLiveCatalog(
  currentItems: CartItem[],
  catalog: Product[]
): CartValidationReport {
  if (!catalog || catalog.length === 0 || !currentItems || currentItems.length === 0) {
    const verifiedSubtotal = currentItems.reduce(
      (sum, i) => sum + i.product.price * i.quantity,
      0
    );
    return {
      items: currentItems,
      hasChanges: false,
      hasPriceChange: false,
      hasOutOfStock: false,
      hasStockExceeded: false,
      verifiedSubtotal,
    };
  }

  let hasChanges = false;
  let hasPriceChange = false;
  let hasOutOfStock = false;
  let hasStockExceeded = false;
  let verifiedSubtotal = 0;

  const updatedItems: CartItem[] = currentItems.map((item) => {
    const live = findProductById(catalog, item.product.id);

    // 1. Product Deleted or Inactive in Catalog
    if (!live || live.active === false) {
      hasChanges = true;
      hasOutOfStock = true;
      return {
        ...item,
        isInactive: true,
        isOutOfStock: true,
      };
    }

    // 2. Out of Stock Check
    const isLiveInStock =
      live.inStock !== false &&
      (live.stockQuantity === undefined || live.stockQuantity > 0);

    if (!isLiveInStock) {
      hasOutOfStock = true;
    }

    // 3. Stock Limit Check
    const availableStock = live.stockQuantity;
    const isStockExceeded =
      availableStock !== undefined && item.quantity > availableStock;

    if (isStockExceeded) {
      hasStockExceeded = true;
    }

    // 4. Price Change Check
    const recordedPrice = item.addedPrice ?? item.product.price;
    const isPriceChanged = live.price !== recordedPrice;
    if (isPriceChanged) {
      hasPriceChange = true;
      hasChanges = true;
    }

    // 5. Detect changes in product metadata (name, unit, image, stock, price)
    if (
      item.product.price !== live.price ||
      item.product.mrp !== live.mrp ||
      item.product.inStock !== live.inStock ||
      item.product.stockQuantity !== live.stockQuantity ||
      item.product.name !== live.name ||
      item.product.unit !== live.unit ||
      item.product.image !== live.image ||
      item.isOutOfStock !== !isLiveInStock ||
      item.stockExceeded !== isStockExceeded ||
      item.availableStock !== availableStock ||
      item.priceChanged !== isPriceChanged
    ) {
      hasChanges = true;
    }

    // Always use the latest live price for subtotal calculation
    verifiedSubtotal += live.price * item.quantity;

    return {
      product: {
        ...item.product,
        ...live,
      },
      quantity: item.quantity,
      addedPrice: recordedPrice,
      priceChanged: isPriceChanged,
      previousPrice: isPriceChanged ? recordedPrice : undefined,
      isOutOfStock: !isLiveInStock,
      stockExceeded: isStockExceeded,
      availableStock,
      isInactive: false,
    };
  });

  return {
    items: updatedItems,
    hasChanges,
    hasPriceChange,
    hasOutOfStock,
    hasStockExceeded,
    verifiedSubtotal,
  };
}
