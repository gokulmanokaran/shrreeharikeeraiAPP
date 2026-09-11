import { Package, CheckCircle2, XCircle, FolderTree, Activity } from "lucide-react";
import { Product, Category } from "../types";

interface StatsCardsProps {
  products: Product[];
  categories: Category[];
  lastSyncedAt: Date | null;
}

export function StatsCards({ products, categories, lastSyncedAt }: StatsCardsProps) {
  const total = products.length;
  const inStock = products.filter((p) => p.inStock).length;
  const outOfStock = products.filter((p) => !p.inStock).length;
  const totalCategories = categories.length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
      {/* Total Products */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Total Catalog
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Package size={16} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-white">{total}</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Active catalog items</p>
        </div>
      </div>

      {/* In Stock */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Available / In Stock
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-emerald-400">{inStock}</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Purchasable now</p>
        </div>
      </div>

      {/* Out of Stock */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Out of Stock
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <XCircle size={16} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-rose-400">{outOfStock}</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Hidden from purchase</p>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Categories
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <FolderTree size={16} />
          </div>
        </div>
        <div className="mt-3">
          <span className="text-2xl sm:text-3xl font-black text-white">{totalCategories}</span>
          <p className="text-[11px] text-slate-500 mt-0.5">Display categories</p>
        </div>
      </div>

      {/* API Sync Status */}
      <div className="col-span-2 lg:col-span-1 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Central API Status
          </span>
          <div className="w-8 h-8 rounded-lg bg-[#00A651]/10 text-[#00A651] flex items-center justify-center">
            <Activity size={16} />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-emerald-400">Live & Synced</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 truncate">
            {lastSyncedAt ? `Synced at ${lastSyncedAt.toLocaleTimeString()}` : "Connected"}
          </p>
        </div>
      </div>
    </div>
  );
}
