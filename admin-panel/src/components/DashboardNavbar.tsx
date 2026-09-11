import { LogOut, ExternalLink, RefreshCw, Layers, Code, Plus, ShoppingBag } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface DashboardNavbarProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenCategories: () => void;
  onOpenApiInspector: () => void;
  onAddNewProduct: () => void;
  onOpenOrders: () => void;
}

export function DashboardNavbar({
  onRefresh,
  isRefreshing,
  onOpenCategories,
  onOpenApiInspector,
  onAddNewProduct,
  onOpenOrders,
}: DashboardNavbarProps) {
  const { logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#00A651] rounded-xl flex items-center justify-center font-black text-white text-lg shadow-md shadow-[#00A651]/20">
            🌿
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                Shree Hari Keerai
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#00A651]/20 text-[#00A651] px-2 py-0.5 rounded-full border border-[#00A651]/30">
                Admin
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Central Product Management · Web & Android
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Orders Button */}
          <button
            onClick={onOpenOrders}
            title="View Live Customer Orders"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-xl shadow-md shadow-blue-600/20 transition-all cursor-pointer"
          >
            <ShoppingBag size={15} />
            <span className="hidden xs:inline">Orders</span>
          </button>

          {/* Add Product Button */}
          <button
            onClick={onAddNewProduct}
            className="flex items-center gap-1.5 bg-[#00A651] hover:bg-[#008f45] text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl shadow-md shadow-[#00A651]/20 transition-all cursor-pointer"
          >
            <Plus size={16} strokeWidth={3} />
            <span className="hidden xs:inline">Add Product</span>
          </button>

          {/* Manage Categories */}
          <button
            onClick={onOpenCategories}
            title="Manage Categories"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <Layers size={15} />
            <span className="hidden md:inline">Categories</span>
          </button>

          {/* API Inspector */}
          <button
            onClick={onOpenApiInspector}
            title="View API JSON & Android Endpoints"
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl border border-slate-700 transition-all cursor-pointer"
          >
            <Code size={15} />
            <span className="hidden md:inline">API Info</span>
          </button>

          {/* Sync / Refresh */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Reload from Central API"
            className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={15} className={isRefreshing ? "animate-spin text-[#00A651]" : ""} />
          </button>

          {/* View Live Website */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            title="Open Live Customer Storefront"
            className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all"
          >
            <ExternalLink size={15} />
          </a>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sign Out"
            className="w-9 h-9 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
