import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { useProductCatalog } from "../../store/ProductContext";
import { ProductCategory } from "../../data/products";

interface CategorySidebarProps {
  activeCategory?: ProductCategory | "all";
  onSelect?: (id: ProductCategory | "all") => void;
}

export function CategorySidebar({ activeCategory, onSelect }: CategorySidebarProps) {
  const navigate = useNavigate();
  const { categories } = useProductCatalog();

  const handleCategoryClick = (id: string) => {
    if (onSelect) {
      onSelect(id as ProductCategory);
    } else {
      navigate(`/products?category=${id}`);
    }
  };

  return (
    <div className="bg-white rounded-[22px] border border-[#EAEAEA] shadow-sm p-3.5 sticky top-20 select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-2 pb-3 mb-1.5 border-b border-[#F0F0F0]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#EAF8F0] text-[#00A651] flex items-center justify-center">
            <LayoutGrid size={15} strokeWidth={2.5} />
          </div>
          <h2 className="text-[13.5px] font-black text-[#111111] tracking-tight">
            Categories
          </h2>
        </div>
        <span className="text-[10.5px] font-bold text-[#087A43] bg-[#EAF8F0] px-2 py-0.5 rounded-full">
          {categories.length} Items
        </span>
      </div>

      {/* Category Vertical List */}
      <div className="flex flex-col gap-1 max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar pr-0.5">
        {categories.map((cat, index) => {
          const isActive = activeCategory === cat.id;

          return (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02, duration: 0.2 }}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCategoryClick(cat.id)}
              className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-[14px] text-left transition-all cursor-pointer ${
                isActive
                  ? "bg-[#00A651] text-white shadow-xs font-bold"
                  : "hover:bg-[#EAF8F0]/70 text-[#222222]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Emoji / Image container */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-[15px] flex-shrink-0 transition-transform group-hover:scale-110 overflow-hidden ${
                    isActive ? "bg-white/20 border border-white/20" : "border border-black/5"
                  }`}
                  style={{ background: isActive ? undefined : cat.color }}
                >
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt={cat.name}
                      className="w-full h-full object-cover p-0.5"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    cat.emoji
                  )}
                </div>

                {/* Category name & sub-info */}
                <div className="min-w-0">
                  <p
                    className={`text-xs font-bold truncate leading-tight transition-colors ${
                      isActive ? "text-white" : "text-[#222222] group-hover:text-[#00A651]"
                    }`}
                  >
                    {cat.name}
                  </p>
                  <p
                    className={`text-[9.5px] font-medium truncate mt-0.5 transition-colors ${
                      isActive ? "text-white/80" : "text-[#888888] group-hover:text-[#666666]"
                    }`}
                  >
                    {cat.description}
                  </p>
                </div>
              </div>

              {/* Arrow Indicator */}
              <ChevronRight
                size={14}
                className={`flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${
                  isActive ? "text-white" : "text-[#CCCCCC] group-hover:text-[#00A651]"
                }`}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
