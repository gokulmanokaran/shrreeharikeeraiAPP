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
import { getItem, setItem, STORAGE_KEYS } from "../utils/storage";
import { calculateDiscount, type DiscountResult } from "../utils/price";
import { useProductCatalog } from "./ProductContext";
import { findProductById } from "../services/productService";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface ToastNotification {
  id: number;
  message: string;
  type: "add" | "remove";
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: "ADD"; product: Product }
  | { type: "REMOVE"; productId: string }
  | { type: "INCREMENT"; productId: string }
  | { type: "DECREMENT"; productId: string }
  | { type: "CLEAR" }
  | { type: "HYDRATE"; items: CartItem[] };

// ── Helper: Sync cart items with latest product catalog ───────────────────────

function syncItemsWithCatalog(
  items: CartItem[],
  catalog: Product[]
): { updated: CartItem[]; hasChanged: boolean } {
  if (!catalog || catalog.length === 0 || !items || items.length === 0) {
    return { updated: items, hasChanged: false };
  }

  let hasChanged = false;
  const updated = items.map((item) => {
    const live = findProductById(catalog, item.product.id);
    if (!live) return item;

    if (
      item.product.price !== live.price ||
      item.product.mrp !== live.mrp ||
      item.product.inStock !== live.inStock ||
      item.product.stockQuantity !== live.stockQuantity ||
      item.product.name !== live.name ||
      item.product.nameTamil !== live.nameTamil ||
      item.product.image !== live.image ||
      item.product.unit !== live.unit
    ) {
      hasChanged = true;
      return {
        ...item,
        product: {
          ...item.product,
          ...live,
        },
      };
    }
    return item;
  });

  return { updated, hasChanged };
}

// ── Reducer ──────────────────────────────────────────────────────────────────

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "HYDRATE":
      return { items: action.items };

    case "ADD": {
      const existing = state.items.find(
        (i) => i.product.id === action.product.id
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product.id === action.product.id
              ? { ...i, product: { ...i.product, ...action.product }, quantity: i.quantity + 1 }
              : i
          ),
        };
      }
      return { items: [...state.items, { product: action.product, quantity: 1 }] };
    }

    case "REMOVE":
      return {
        items: state.items.filter((i) => i.product.id !== action.productId),
      };

    case "INCREMENT":
      return {
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
          items: state.items.filter((i) => i.product.id !== action.productId),
        };
      }
      return {
        items: state.items.map((i) =>
          i.product.id === action.productId
            ? { ...i, quantity: i.quantity - 1 }
            : i
        ),
      };
    }

    case "CLEAR":
      return { items: [] };

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
  toast: ToastNotification | null;
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  incrementItem: (productId: string) => void;
  decrementItem: (productId: string) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
}

const CartContext = createContext<CartContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { products } = useProductCatalog();
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  // Hydrate from localStorage on mount (and sync with current products if available)
  useEffect(() => {
    const saved = getItem<CartItem[]>(STORAGE_KEYS.CART, []);
    if (saved.length > 0) {
      const { updated } = syncItemsWithCatalog(saved, products);
      dispatch({ type: "HYDRATE", items: updated });
    }
  }, []);

  // Synchronize cart items with the latest live products (e.g. price change in admin / DB / realtime sync)
  useEffect(() => {
    if (state.items.length === 0 || !products || products.length === 0) return;
    const { updated, hasChanged } = syncItemsWithCatalog(state.items, products);
    if (hasChanged) {
      dispatch({ type: "HYDRATE", items: updated });
    }
  }, [products, state.items]);

  // Persist to localStorage on every change
  useEffect(() => {
    setItem(STORAGE_KEYS.CART, state.items);
  }, [state.items]);

  const addItem = useCallback(
    (product: Product) => {
      const liveProduct = findProductById(products, product.id) || product;

      // 1. Out of stock guard
      if (
        liveProduct.inStock === false ||
        (liveProduct.stockQuantity !== undefined && liveProduct.stockQuantity <= 0)
      ) {
        triggerToast(`⚠️ Sorry, ${liveProduct.name} is out of stock`, "remove");
        return;
      }

      // 2. Stock limit guard
      const existing = state.items.find((i) => i.product.id === liveProduct.id);
      const currentQty = existing ? existing.quantity : 0;
      if (liveProduct.stockQuantity !== undefined && currentQty >= liveProduct.stockQuantity) {
        triggerToast(
          `⚠️ Only ${liveProduct.stockQuantity} unit${liveProduct.stockQuantity === 1 ? "" : "s"} available in stock`,
          "remove"
        );
        return;
      }

      dispatch({ type: "ADD", product: liveProduct });
      triggerToast(`✓ ${liveProduct.name} added to cart`, "add");
    },
    [products, state.items, triggerToast]
  );

  const removeItem = useCallback(
    (productId: string) => {
      const item = state.items.find((i) => i.product.id === productId);
      const name = item ? item.product.name : "Item";
      dispatch({ type: "REMOVE", productId });
      triggerToast(`✓ ${name} removed from cart`, "remove");
    },
    [state.items, triggerToast]
  );

  const incrementItem = useCallback(
    (productId: string) => {
      const item = state.items.find((i) => i.product.id === productId);
      const live = findProductById(products, productId) || item?.product;
      if (item && live) {
        // Stock limit guard
        if (
          live.stockQuantity !== undefined &&
          item.quantity >= live.stockQuantity
        ) {
          triggerToast(
            `⚠️ Maximum available stock reached (${live.stockQuantity} units)`,
            "remove"
          );
          return;
        }

        triggerToast(`✓ ${live.name} added to cart`, "add");
      }
      dispatch({ type: "INCREMENT", productId });
    },
    [products, state.items, triggerToast]
  );

  const decrementItem = useCallback(
    (productId: string) => {
      const item = state.items.find((i) => i.product.id === productId);
      if (item) {
        if (item.quantity === 1) {
          triggerToast(`✓ ${item.product.name} removed from cart`, "remove");
        }
      }
      dispatch({ type: "DECREMENT", productId });
    },
    [state.items, triggerToast]
  );

  const clearCart = useCallback(() => {
    dispatch({ type: "CLEAR" });
  }, []);

  const getItemQuantity = useCallback(
    (productId: string) =>
      state.items.find((i) => i.product.id === productId)?.quantity ?? 0,
    [state.items]
  );

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

  // Auto-calculated discount — never manipulable from the outside
  const discount = useMemo(() => calculateDiscount(subtotal), [subtotal]);

  const discountedSubtotal = useMemo(
    () => subtotal - discount.amount,
    [subtotal, discount.amount]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      itemCount,
      subtotal,
      discount,
      discountedSubtotal,
      toast,
      addItem,
      removeItem,
      incrementItem,
      decrementItem,
      clearCart,
      getItemQuantity,
    }),
    [
      state.items,
      itemCount,
      subtotal,
      discount,
      discountedSubtotal,
      toast,
      addItem,
      removeItem,
      incrementItem,
      decrementItem,
      clearCart,
      getItemQuantity,
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
