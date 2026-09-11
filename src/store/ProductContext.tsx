import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
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

  // Background synchronization from Supabase Database
  const syncCatalog = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(false);
    setIsSyncing(true);

    try {
      const [liveProds, liveCats] = await Promise.all([
        fetchLiveProducts(),
        fetchLiveCategories(),
      ]);

      if (liveProds && liveProds.length > 0) {
        setProducts(liveProds);
      }
      if (liveCats && liveCats.length > 0) {
        setCategories(liveCats);
      }
      setLastSyncedAt(new Date());
    } catch (err) {
      console.warn("[ProductContext] Sync error:", err);
    } finally {
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

  // Supabase Realtime live subscription
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel("storefront-realtime-catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          console.info("[Realtime] Product change detected in Supabase. Refreshing storefront...");
          syncCatalog(false);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories" },
        () => {
          console.info("[Realtime] Category change detected in Supabase. Refreshing storefront...");
          syncCatalog(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncCatalog]);

  // Auto re-sync when tab gains focus / visibility or periodically
  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        syncCatalog(false);
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncCatalog(false);
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
