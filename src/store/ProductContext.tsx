import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Product, PRODUCTS } from "../data/products";
import { Category, CATEGORIES } from "../data/categories";
import {
  fetchLiveProducts,
  fetchLiveCategories,
  getStoredProducts,
  getStoredCategories,
  findProductById,
  filterProductsByQuery,
} from "../services/productService";
import { getSupabaseClient } from "../lib/supabase";

interface ProductContextValue {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  refreshProducts: () => Promise<void>;
  getProductById: (id: string) => Product | undefined;
  getProductsByCategory: (category: string | "all") => Product[];
  searchProducts: (query: string) => Product[];
}

const ProductContext = createContext<ProductContextValue | null>(null);

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(() => getStoredProducts());
  const [categories, setCategories] = useState<Category[]>(() => getStoredCategories());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const isSyncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);
  const realtimeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

function areProductsEqual(a: Product[], b: Product[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p1 = a[i];
    const p2 = b[i];
    if (
      p1.id !== p2.id ||
      p1.price !== p2.price ||
      p1.mrp !== p2.mrp ||
      p1.inStock !== p2.inStock ||
      p1.stockQuantity !== p2.stockQuantity ||
      p1.category !== p2.category ||
      p1.secondaryCategory !== p2.secondaryCategory ||
      p1.name !== p2.name ||
      p1.nameTamil !== p2.nameTamil ||
      p1.unit !== p2.unit ||
      p1.image !== p2.image ||
      p1.active !== p2.active ||
      p1.featured !== p2.featured ||
      p1.updatedAt !== p2.updatedAt
    ) {
      return false;
    }
  }
  return true;
}

function areCategoriesEqual(a: Category[], b: Category[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].name !== b[i].name ||
      a[i].emoji !== b[i].emoji ||
      a[i].color !== b[i].color ||
      a[i].sortOrder !== b[i].sortOrder ||
      a[i].active !== b[i].active
    ) {
      return false;
    }
  }
  return true;
}

  // Background synchronization from Supabase Database with deduplication
  const syncCatalog = useCallback(async (isInitial = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    if (isInitial) setIsLoading(false);
    setIsSyncing(true);

    try {
      const [liveProds, liveCats] = await Promise.all([
        fetchLiveProducts(),
        fetchLiveCategories(),
      ]);

      if (liveProds && liveProds.length > 0) {
        setProducts((prev) => (areProductsEqual(prev, liveProds) ? prev : liveProds));
      }
      if (liveCats && liveCats.length > 0) {
        setCategories((prev) => (areCategoriesEqual(prev, liveCats) ? prev : liveCats));
      }
      const now = new Date();
      setLastSyncedAt(now);
      lastSyncTimeRef.current = now.getTime();
    } catch (err) {
      console.warn("[ProductContext] Sync error:", err);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  // Purge old stale caches so new categories and secondaryCategory load fresh
  useEffect(() => {
    try {
      localStorage.removeItem("shreehari_cached_products_v2");
      localStorage.removeItem("shreehari_cached_categories_v2");
      localStorage.removeItem("shreehari_cached_products_v3");
      localStorage.removeItem("shreehari_cached_categories_v3");
    } catch {
      // ignore
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    syncCatalog(true);
  }, [syncCatalog]);

  // Supabase Realtime live subscription with debounce to protect against update bursts
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const triggerDebouncedSync = () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      realtimeDebounceTimerRef.current = setTimeout(() => {
        syncCatalog(false);
      }, 600);
    };

    const channel = supabase
      .channel("storefront-realtime-catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          triggerDebouncedSync();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => {
          triggerDebouncedSync();
        }
      )
      .subscribe();

    return () => {
      if (realtimeDebounceTimerRef.current) {
        clearTimeout(realtimeDebounceTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [syncCatalog]);

  // Auto re-sync when tab gains focus / visibility, throttled to max once every 30s
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastSyncTimeRef.current;
        if (elapsed > 30000) {
          syncCatalog(false);
        }
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastSyncTimeRef.current;
        if (elapsed > 60000) {
          syncCatalog(false);
        }
      }
    }, 60000);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      clearInterval(interval);
    };
  }, [syncCatalog]);

  const getProductByIdCallback = useCallback(
    (id: string) => findProductById(products, id),
    [products]
  );

  const getProductsByCategoryCallback = useCallback(
    (cat: string | "all") => {
      if (!cat || cat === "all") return products;
      return products.filter((p) => p.category === cat || p.secondaryCategory === cat);
    },
    [products]
  );

  const searchProductsCallback = useCallback(
    (query: string) => filterProductsByQuery(products, query),
    [products]
  );

  const refreshProductsCallback = useCallback(async () => {
    await syncCatalog(false);
  }, [syncCatalog]);

  const value = useMemo<ProductContextValue>(
    () => ({
      products,
      categories,
      isLoading,
      isSyncing,
      lastSyncedAt,
      refreshProducts: refreshProductsCallback,
      getProductById: getProductByIdCallback,
      getProductsByCategory: getProductsByCategoryCallback,
      searchProducts: searchProductsCallback,
    }),
    [
      products,
      categories,
      isLoading,
      isSyncing,
      lastSyncedAt,
      refreshProductsCallback,
      getProductByIdCallback,
      getProductsByCategoryCallback,
      searchProductsCallback,
    ]
  );

  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
}

export function useProductCatalog(): ProductContextValue {
  const ctx = useContext(ProductContext);
  if (!ctx) {
    return {
      products: PRODUCTS,
      categories: CATEGORIES,
      isLoading: false,
      isSyncing: false,
      lastSyncedAt: null,
      refreshProducts: async () => {},
      getProductById: (id: string) => findProductById(PRODUCTS, id),
      getProductsByCategory: (cat: string | "all") =>
        cat === "all" ? PRODUCTS : PRODUCTS.filter((p) => p.category === cat || p.secondaryCategory === cat),
      searchProducts: (q: string) => filterProductsByQuery(PRODUCTS, q),
    };
  }
  return ctx;
}
