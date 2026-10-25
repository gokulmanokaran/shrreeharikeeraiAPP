import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Product } from "../data/products";
import { calculateDiscount, type DiscountResult } from "../utils/price";
import { useProductCatalog } from "./ProductContext";
import { useAuth } from "./AuthContext";
import { findProductById } from "../services/productService";
import { getSupabaseClient } from "../lib/supabase";
import {
  fetchUserCart,
  upsertCartItem,
  removeCartItem,
  clearUserCart,
  validateCartWithLiveCatalog,
  type CartItem,
} from "../services/cartService";

// Re-export CartItem
export type { CartItem };

// ── Types ────────────────────────────────────────────────────────────────────

export interface ToastNotification {
  id: number;
  message: string;
  type: "add" | "remove";
}

interface CartState {
  items: CartItem[];
  isLoading: boolean;
}

type CartAction =
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "HYDRATE"; items: CartItem[] }
  | { type: "ADD"; product: Product; addedPrice?: number }
  | { type: "REMOVE"; productId: string }
  | { type: "INCREMENT"; productId: string }
  | { type: "DECREMENT"; productId: string }
  | { type: "CLEAR" };

// ── Reducer ──────────────────────────────────────────────────────────────────

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };

    case "HYDRATE":
      return { ...state, items: action.items, isLoading: false };

    case "ADD": {
      const existing = state.items.find((i) => i.product.id === action.product.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.product.id === action.product.id
              ? {
                  ...i,
                  product: { ...i.product, ...action.product },
                  quantity: i.quantity + 1,
                  addedPrice: i.addedPrice ?? action.addedPrice ?? action.product.price,
                }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            product: action.product,
            quantity: 1,
            addedPrice: action.addedPrice ?? action.product.price,
          },
        ],
      };
    }

    case "REMOVE":
      return {
        ...state,
        items: state.items.filter((i) => i.product.id !== action.productId),
      };

    case "INCREMENT":
      return {
        ...state,
        items: state.items.map((i) =>
          i.product.id === action.productId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      };

    case "DECREMENT": {
      const item = state.items.find((i) => i.product.id === action.productId);
      if (!item) return state;
      if (item.quantity <= 1) {
        return {
          ...state,
          items: state.items.filter((i) => i.product.id !== action.productId),
        };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.product.id === action.productId
            ? { ...i, quantity: i.quantity - 1 }
            : i
        ),
      };
    }

    case "CLEAR":
      return { ...state, items: [] };

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discount: DiscountResult;
  discountedSubtotal: number;
  isLoading: boolean;
  hasOutOfStockItems: boolean;
  hasPriceChangedItems: boolean;
  hasStockExceededItems: boolean;
  toast: ToastNotification | null;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  incrementItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { products } = useProductCatalog();
  const { user } = useAuth();

  const [state, dispatch] = useReducer(cartReducer, { items: [], isLoading: false });
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep references to avoid closures over stale props/state
  const stateRef = useRef(state);
  stateRef.current = state;
  const productsRef = useRef(products);
  productsRef.current = products;
  const userRef = useRef(user);
  userRef.current = user;

  // Track active user ID to cleanly reset cart state across account switches
  const currentUserIdRef = useRef<string | null>(null);

  // Trigger modern top snackbar
  const triggerToast = useCallback((message: string, type: "add" | "remove") => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ id: Date.now(), message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  // ── Core Loader: Hydrate user cart from Supabase ────────────────────────────
  const loadCartFromSupabase = useCallback(
    async (userId: string, isSilent = false) => {
      if (!isSilent) dispatch({ type: "SET_LOADING", isLoading: true });

      try {
        const result = await fetchUserCart(userId);
        if (!result.success || !result.data) {
          if (!isSilent) dispatch({ type: "SET_LOADING", isLoading: false });
          return;
        }

        const currentCatalog = productsRef.current;
        const hydratedItems: CartItem[] = [];

        for (const row of result.data) {
          const liveProduct = findProductById(currentCatalog, row.product_id);
          if (liveProduct) {
            const addedPrice = Number(row.added_price ?? liveProduct.price);
            const isPriceChanged = liveProduct.price !== addedPrice;
            const isOutOfStock =
              liveProduct.inStock === false ||
              (liveProduct.stockQuantity !== undefined && liveProduct.stockQuantity <= 0);
            const isStockExceeded =
              liveProduct.stockQuantity !== undefined && row.quantity > liveProduct.stockQuantity;

            hydratedItems.push({
              product: liveProduct,
              quantity: row.quantity,
              addedPrice,
              priceChanged: isPriceChanged,
              previousPrice: isPriceChanged ? addedPrice : undefined,
              isOutOfStock,
              stockExceeded: isStockExceeded,
              availableStock: liveProduct.stockQuantity,
              isInactive: liveProduct.active === false,
            });
          }
        }

        dispatch({ type: "HYDRATE", items: hydratedItems });
      } catch (err) {
        console.warn("[CartContext] Error loading user cart from Supabase:", err);
        if (!isSilent) dispatch({ type: "SET_LOADING", isLoading: false });
      }
    },
    []
  );

  // ── User Change Lifecycle: Complete User Isolation & Realtime Subscription ─
  useEffect(() => {
    const activeUser = user;
    const previousUserId = currentUserIdRef.current;
    const newUserId = activeUser?.id || null;

    // Detect User Logout or Switch
    if (previousUserId && previousUserId !== newUserId) {
      // Clear local UI cart immediately — NEVER leak User A's cart into User B's session
      dispatch({ type: "CLEAR" });
    }

    currentUserIdRef.current = newUserId;

    if (!activeUser) {
      // Guest user session: do not query Supabase with invalid ID
      return;
    }

    // 1. Initial Load from Supabase for this authenticated user
    loadCartFromSupabase(activeUser.id);

    // 2. Realtime Subscription: Instant Multi-Device Synchronization
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channelName = `cart-sync-${activeUser.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `user_id=eq.${activeUser.id}`,
        },
        () => {
          // Sync changes made on another phone, tablet, or browser tab
          loadCartFromSupabase(activeUser.id, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadCartFromSupabase]);

  // ── Real-Time Catalog Validation: Always reflect database price/stock updates ─
  useEffect(() => {
    if (state.items.length === 0 || !products || products.length === 0) return;

    const { items: updated, hasChanges } = validateCartWithLiveCatalog(
      state.items,
      products
    );

    if (hasChanges) {
      dispatch({ type: "HYDRATE", items: updated });
    }
  }, [products, state.items]);

  // ── Cart Mutators with Optimistic UI & Supabase Persistence ─────────────────

  const addItem = useCallback(
    (product: Product) => {
      const currentProducts = productsRef.current;
      const currentItems = stateRef.current.items;
      const currentUser = userRef.current;
      const liveProduct = findProductById(currentProducts, product.id) || product;

      // 1. Out of stock guard
      if (
        liveProduct.inStock === false ||
        (liveProduct.stockQuantity !== undefined && liveProduct.stockQuantity <= 0)
      ) {
        triggerToast(`⚠️ Sorry, ${liveProduct.name} is out of stock`, "remove");
        return;
      }

      // 2. Stock limit guard
      const existing = currentItems.find((i) => i.product.id === liveProduct.id);
      const currentQty = existing ? existing.quantity : 0;
      if (liveProduct.stockQuantity !== undefined && currentQty >= liveProduct.stockQuantity) {
        triggerToast(
          `⚠️ Only ${liveProduct.stockQuantity} unit${liveProduct.stockQuantity === 1 ? "" : "s"} available in stock`,
          "remove"
        );
        return;
      }

      const nextQuantity = currentQty + 1;

      // Optimistic UI update
      dispatch({ type: "ADD", product: liveProduct, addedPrice: liveProduct.price });
      triggerToast(`✓ ${liveProduct.name} added to cart`, "add");

      // Supabase Persistence (Source of Truth)
      if (currentUser) {
        upsertCartItem(currentUser.id, liveProduct.id, nextQuantity, liveProduct.price).catch(
          (err) => console.warn("[CartContext] Supabase upsert notice:", err)
        );
      }
    },
    [triggerToast]
  );

  const removeItem = useCallback(
    (productId: string) => {
      const item = stateRef.current.items.find((i) => i.product.id === productId);
      const currentUser = userRef.current;
      const name = item ? item.product.name : "Item";

      // Optimistic UI update
      dispatch({ type: "REMOVE", productId });
      triggerToast(`✓ ${name} removed from cart`, "remove");

      // Supabase Persistence
      if (currentUser) {
        removeCartItem(currentUser.id, productId).catch((err) =>
          console.warn("[CartContext] Supabase remove notice:", err)
        );
      }
    },
    [triggerToast]
  );

  const incrementItem = useCallback(
    (productId: string) => {
      const currentProducts = productsRef.current;
      const item = stateRef.current.items.find((i) => i.product.id === productId);
      const currentUser = userRef.current;
      const live = findProductById(currentProducts, productId) || item?.product;

      if (!item || !live) return;

      // Stock limit guard
      if (live.stockQuantity !== undefined && item.quantity >= live.stockQuantity) {
        triggerToast(
          `⚠️ Maximum available stock reached (${live.stockQuantity} units)`,
          "remove"
        );
        return;
      }

      const nextQuantity = item.quantity + 1;

      // Optimistic UI update
      dispatch({ type: "INCREMENT", productId });
      triggerToast(`✓ ${live.name} added to cart`, "add");

      // Supabase Persistence
      if (currentUser) {
        upsertCartItem(currentUser.id, productId, nextQuantity, item.addedPrice || live.price).catch(
          (err) => console.warn("[CartContext] Supabase increment notice:", err)
        );
      }
    },
    [triggerToast]
  );

  const decrementItem = useCallback(
    (productId: string) => {
      const item = stateRef.current.items.find((i) => i.product.id === productId);
      const currentUser = userRef.current;
      if (!item) return;

      const nextQuantity = item.quantity - 1;

      if (item.quantity === 1) {
        triggerToast(`✓ ${item.product.name} removed from cart`, "remove");
        dispatch({ type: "DECREMENT", productId });

        if (currentUser) {
          removeCartItem(currentUser.id, productId).catch((err) =>
            console.warn("[CartContext] Supabase remove notice:", err)
          );
        }
      } else {
        dispatch({ type: "DECREMENT", productId });

        if (currentUser) {
          upsertCartItem(currentUser.id, productId, nextQuantity, item.addedPrice || item.product.price).catch(
            (err) => console.warn("[CartContext] Supabase decrement notice:", err)
          );
        }
      }
    },
    [triggerToast]
  );

  const clearCart = useCallback(() => {
    const currentUser = userRef.current;
    dispatch({ type: "CLEAR" });

    if (currentUser) {
      clearUserCart(currentUser.id).catch((err) =>
        console.warn("[CartContext] Supabase clear notice:", err)
      );
    }
  }, []);

  const refreshCart = useCallback(async () => {
    const currentUser = userRef.current;
    if (currentUser) {
      await loadCartFromSupabase(currentUser.id);
    }
  }, [loadCartFromSupabase]);

  const getItemQuantity = useCallback(
    (productId: string) =>
      stateRef.current.items.find((i) => i.product.id === productId)?.quantity ?? 0,
    []
  );

  // ── Derived State & Financial Calculations (Always from Latest DB Price) ─────

  const itemCount = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items]
  );

  const subtotal = useMemo(
    () =>
      state.items.reduce(
        (sum, i) => sum + i.product.price * i.quantity,
        0
      ),
    [state.items]
  );

  const discount = useMemo(() => calculateDiscount(subtotal), [subtotal]);

  const discountedSubtotal = useMemo(
    () => subtotal - discount.amount,
    [subtotal, discount.amount]
  );

  const hasOutOfStockItems = useMemo(
    () => state.items.some((i) => i.isOutOfStock),
    [state.items]
  );

  const hasPriceChangedItems = useMemo(
    () => state.items.some((i) => i.priceChanged),
    [state.items]
  );

  const hasStockExceededItems = useMemo(
    () => state.items.some((i) => i.stockExceeded),
    [state.items]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      itemCount,
      subtotal,
      discount,
      discountedSubtotal,
      isLoading: state.isLoading,
      hasOutOfStockItems,
      hasPriceChangedItems,
      hasStockExceededItems,
      toast,
      addItem,
      removeItem,
      incrementItem,
      decrementItem,
      clearCart,
      getItemQuantity,
      refreshCart,
    }),
    [
      state.items,
      itemCount,
      subtotal,
      discount,
      discountedSubtotal,
      state.isLoading,
      hasOutOfStockItems,
      hasPriceChangedItems,
      hasStockExceededItems,
      toast,
      addItem,
      removeItem,
      incrementItem,
      decrementItem,
      clearCart,
      getItemQuantity,
      refreshCart,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
