import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./context/AuthContext";
import { LoginView } from "./components/LoginView";
import { DashboardNavbar } from "./components/DashboardNavbar";
import { StatsCards } from "./components/StatsCards";
import { ProductList } from "./components/ProductList";
import { ProductFormModal } from "./components/ProductFormModal";
import { SafeImageModal } from "./components/SafeImageModal";
import { CategoryModal } from "./components/CategoryModal";
import { ApiInspectorModal } from "./components/ApiInspectorModal";
import { OrdersModal } from "./components/OrdersModal";
import {
  fetchProducts,
  fetchCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStock,
  toggleProductActive,
} from "./services/api";
import { Product, Category } from "./types";

export default function App() {
  const { isAuthenticated } = useAuth();

  // Clear stale localStorage product cache so the shared catalog.json is always preferred
  useEffect(() => {
    try {
      // Clear both v2 and v3 stale local caches so the DB is always the source of truth
      const v2 = localStorage.getItem("shk_admin_local_products_v2");
      if (v2) localStorage.removeItem("shk_admin_local_products_v2");

      const v3 = localStorage.getItem("shk_admin_local_products_v3");
      if (v3) {
        const parsed = JSON.parse(v3);
        if (!Array.isArray(parsed) || parsed.length < 50) {
          localStorage.removeItem("shk_admin_local_products_v3");
        }
      }
    } catch {
      localStorage.removeItem("shk_admin_local_products_v2");
      localStorage.removeItem("shk_admin_local_products_v3");
    }
  }, []);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Modals state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [replacingImageProduct, setReplacingImageProduct] = useState<Product | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isApiInspectorOpen, setIsApiInspectorOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);

  // Quick stock updating ID
  const [isUpdatingStockId, setIsUpdatingStockId] = useState<string | null>(null);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(prods);
      setCategories(cats);
      setLastSyncedAt(new Date());
    } catch (err) {
      console.warn("[AdminApp] Error loading data:", err);
      showToast("⚠️ Failed to load latest data from API.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // Handle 1-Click Stock Toggle
  const handleToggleStock = async (productId: string, currentStock: boolean) => {
    setIsUpdatingStockId(productId);
    try {
      const updated = await toggleProductStock(productId, !currentStock);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, inStock: updated.inStock, stockQuantity: updated.stockQuantity }
            : p
        )
      );
      showToast(
        `✓ ${updated.name} marked ${updated.inStock ? `In Stock (${updated.stockQuantity || 20} units)` : "Out of Stock"}.`
      );
    } catch (err) {
      showToast("❌ Failed to update stock status.");
    } finally {
      setIsUpdatingStockId(null);
    }
  };

  // Handle Save Product (Create or Update)
  const handleSaveProduct = async (productData: Partial<Product>) => {
    if (editingProduct) {
      const updated = await updateProduct({
        ...productData,
        id: editingProduct.id,
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      showToast(`✓ Product "${updated.name}" updated successfully.`);
    } else {
      const created = await createProduct(productData);
      setProducts((prev) => [created, ...prev]);
      showToast(`✓ New product "${created.name}" created successfully.`);
    }
  };

  // Handle Delete Product
  const handleDeleteProduct = async (product: Product) => {
    const ok = window.confirm(
      `Are you sure you want to delete "${product.name}" (#${product.id})?\n\nThis will permanently remove it from the database.`
    );
    if (!ok) return;

    try {
      await deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      showToast(`✓ Product "${product.name}" deleted.`);
    } catch (err) {
      showToast("❌ Error deleting product.");
    }
  };

  // Handle Toggle Active/Inactive
  const handleToggleActive = async (product: Product) => {
    const newActive = !product.active;
    try {
      const updated = await toggleProductActive(product.id, newActive);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      showToast(
        newActive
          ? `✓ "${product.name}" is now Active (visible on website).`
          : `✓ "${product.name}" is now Inactive (hidden from website).`
      );
    } catch {
      showToast("❌ Failed to update product status.");
    }
  };

  // If not logged in, render secure Login View
  if (!isAuthenticated) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <DashboardNavbar
        onRefresh={loadData}
        isRefreshing={isRefreshing}
        onOpenCategories={() => setIsCategoryModalOpen(true)}
        onOpenApiInspector={() => setIsApiInspectorOpen(true)}
        onOpenOrders={() => setIsOrdersModalOpen(true)}
        onAddNewProduct={() => {
          setEditingProduct(null);
          setIsFormOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* KPI Stats */}
        <StatsCards
          products={products}
          categories={categories}
          lastSyncedAt={lastSyncedAt}
        />

        {/* Loading Spinner or Product Table */}
        {loading ? (
          <div className="py-24 text-center">
            <span className="inline-block w-8 h-8 border-3 border-[#00A651]/30 border-t-[#00A651] rounded-full animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-400">Loading Central Catalog...</p>
          </div>
        ) : (
          <ProductList
            products={products}
            categories={categories}
            onEditProduct={(p) => {
              setEditingProduct(p);
              setIsFormOpen(true);
            }}
            onReplaceImage={(p) => setReplacingImageProduct(p)}
            onToggleStock={handleToggleStock}
            onDeleteProduct={handleDeleteProduct}
            onToggleActive={handleToggleActive}
            onAddNewProduct={() => {
              setEditingProduct(null);
              setIsFormOpen(true);
            }}
            isUpdatingStockId={isUpdatingStockId}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-slate-700 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Live Orders Modal */}
      <OrdersModal
        isOpen={isOrdersModalOpen}
        onClose={() => setIsOrdersModalOpen(false)}
      />

      {/* Edit / Create Product Modal */}
      <ProductFormModal
        product={editingProduct}
        categories={categories}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProduct(null);
        }}
        onSave={handleSaveProduct}
      />

      {/* Safe Image Replacement Modal */}
      <SafeImageModal
        product={replacingImageProduct}
        isOpen={Boolean(replacingImageProduct)}
        onClose={() => setReplacingImageProduct(null)}
        onSuccess={(updated) => {
          setProducts((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          );
          showToast(`✓ Image for "${updated.name}" updated successfully.`);
        }}
      />

      {/* Categories Manager Modal */}
      <CategoryModal
        categories={categories}
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onRefresh={loadData}
      />

      {/* API Inspector Modal */}
      <ApiInspectorModal
        isOpen={isApiInspectorOpen}
        onClose={() => setIsApiInspectorOpen(false)}
      />
    </div>
  );
}
