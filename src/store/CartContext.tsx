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
import type { Product } from "../data/products";
import { getItem, setItem, STORAGE_KEYS } from "../utils/storage";
import { calculateDiscount, type DiscountResult } from "../utils/price";

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
              ? { ...i, quantity: i.quantity + 1 }
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

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = getItem<CartItem[]>(STORAGE_KEYS.CART, []);
    if (saved.length > 0) {
      dispatch({ type: "HYDRATE", items: saved });
    }
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    setItem(STORAGE_KEYS.CART, state.items);
  }, [state.items]);

  const addItem = useCallback(
    (product: Product) => {
      // 1. Out of stock guard
      if (
        product.inStock === false ||
        (product.stockQuantity !== undefined && product.stockQuantity <= 0)
      ) {
        triggerToast(`⚠️ Sorry, ${product.name} is out of stock`, "remove");
        return;
      }

      // 2. Stock limit guard
      const existing = state.items.find((i) => i.product.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      if (product.stockQuantity !== undefined && currentQty >= product.stockQuantity) {
        triggerToast(
          `⚠️ Only ${product.stockQuantity} unit${product.stockQuantity === 1 ? "" : "s"} available in stock`,
          "remove"
        );
        return;
      }

      dispatch({ type: "ADD", product });
      triggerToast(`✓ ${product.name} added to cart`, "add");
    },
    [state.items, triggerToast]
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
      if (item) {
        // Stock limit guard
        if (
          item.product.stockQuantity !== undefined &&
          item.quantity >= item.product.stockQuantity
        ) {
          triggerToast(
            `⚠️ Maximum available stock reached (${item.product.stockQuantity} units)`,
            "remove"
          );
          return;
        }

        triggerToast(`✓ ${item.product.name} added to cart`, "add");
      }
      dispatch({ type: "INCREMENT", productId });
    },
    [state.items, triggerToast]
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
