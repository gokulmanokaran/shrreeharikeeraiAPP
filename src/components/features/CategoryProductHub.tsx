import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductCategory, Product } from "../../data/products";
import { useProductCatalog } from "../../store/ProductContext";
import { ProductCard } from "./ProductCard";
import { Sparkles } from "lucide-react";

export function CategoryProductHub() {
  const { categories, products } = useProductCatalog();
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all");

  // Filter products based on selected category
  const filteredProducts: Product[] =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category === selectedCategory || p.secondaryCategory === selectedCategory);

  const activeCategoryObj = categories.find((c) => c.id === selectedCategory);
  const activeTitle = selectedCategory === "all" ? "All Products" : activeCategoryObj?.name || "Products";
  const activeEmoji = selectedCategory === "all" ? "🌿" : activeCategoryObj?.emoji || "🌿";

  return (
    <div className="w-full flex gap-2 sm:gap-3 md:gap-5 items-start mt-2">
      {/* ─── Left Side: Compact Vertical Category Rail ──────────────────────── */}
      <nav
        aria-label="Categories menu"
        className="w-[74px] sm:w-[84px] md:w-56 lg:w-64 flex-shrink-0 sticky top-[72px] sm:top-[76px] self-start max-h-[calc(100vh-85px)] overflow-y-auto no-scrollbar bg-white rounded-[18px] sm:rounded-[22px] p-1 sm:p-2 border border-[#EAEAEA] shadow-2xs select-none"
      >
        <div className="flex flex-col gap-1 sm:gap-1.5 pb-2">
          {/* "All" Category Option */}
          <button
            onClick={() => setSelectedCategory("all")}
            className={`w-full flex flex-col md:flex-row items-center md:gap-2.5 p-1.5 sm:p-2 rounded-[14px] transition-all cursor-pointer text-center md:text-left relative ${
              selectedCategory === "all"
                ? "bg-[#EAF8F0] text-[#087A43] font-black border-l-3 border-[#00A651] shadow-2xs"
                : "hover:bg-gray-50 text-[#555555] font-semibold border-l-3 border-transparent"
            }`}
          >
            <div
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] flex items-center justify-center text-lg flex-shrink-0 transition-transform ${
                selectedCategory === "all"
                  ? "bg-[#00A651] text-white shadow-xs scale-105"
                  : "bg-[#F4F4F4] text-[#444444]"
              }`}
            >
              <Sparkles size={18} />
            </div>
            <div className="min-w-0 mt-1 md:mt-0">
              <span className="text-[10px] sm:text-[11px] md:text-xs block leading-tight truncate">
                All Items
              </span>
              <span className="hidden md:block text-[9.5px] text-gray-400 font-normal">
                {products.length} Products
              </span>
            </div>
          </button>

          {/* List of 12 Specific Categories */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full flex flex-col md:flex-row items-center md:gap-2.5 p-1.5 sm:p-2 rounded-[14px] transition-all cursor-pointer text-center md:text-left relative ${
                  isSelected
                    ? "bg-[#EAF8F0] text-[#087A43] font-black border-l-3 border-[#00A651] shadow-2xs"
                    : "hover:bg-gray-50 text-[#555555] font-semibold border-l-3 border-transparent"
                }`}
                aria-label={`Category ${cat.name}`}
              >
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[12px] flex items-center justify-center text-lg sm:text-xl flex-shrink-0 transition-transform overflow-hidden relative ${
                    isSelected
                      ? "ring-2 ring-[#00A651]/50 scale-105 shadow-xs"
                      : "border border-black/5"
                  }`}
                  style={{ background: cat.color }}
                >
                  <span className="absolute inset-0 flex items-center justify-center select-none text-base sm:text-lg">
                    {cat.emoji}
                  </span>
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover relative z-1"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 mt-1 md:mt-0">
                  <span
                    className={`text-[9.5px] sm:text-[10.5px] md:text-xs block leading-tight line-clamp-2 md:line-clamp-1 ${
                      isSelected ? "text-[#087A43] font-black" : "text-[#444444]"
                    }`}
                  >
                    {cat.name}
                  </span>
                  <span className="hidden md:block text-[9.5px] text-gray-400 font-normal truncate mt-0.5">
                    {cat.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ─── Right Side: 2-Column Product Grid ──────────────────────────────── */}
      <section className="flex-1 min-w-0">
        {/* Header with Active Category Name & Item Count */}
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            {activeCategoryObj?.image ? (
              <img
                src={activeCategoryObj.image}
                alt={activeTitle}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <span className="text-base sm:text-lg">{activeEmoji}</span>
            )}
            <h2 className="text-sm sm:text-base md:text-lg font-black text-[#111111] truncate">
              {activeTitle}
            </h2>
          </div>
          <span className="text-[10.5px] sm:text-xs font-bold text-[#087A43] bg-[#EAF8F0] border border-[#00A651]/20 px-2.5 py-0.5 rounded-full flex-shrink-0">
            {filteredProducts.length} Items
          </span>
        </div>

        {/* 2-Column Product Grid with Smooth Transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5 md:gap-3"
          >
            {filteredProducts.length === 0 ? (
              <div className="col-span-2 md:col-span-3 lg:col-span-4 flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-gray-100 p-6">
                <span className="text-4xl mb-2">🌿</span>
                <p className="text-sm font-bold text-[#111111]">No products available in this category</p>
                <p className="text-xs text-[#888888] mt-1">Please select another category on the left.</p>
              </div>
            ) : (
              filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </section>
    </div>
  );
}
