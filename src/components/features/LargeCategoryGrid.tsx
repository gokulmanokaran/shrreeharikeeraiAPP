import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useProductCatalog } from "../../store/ProductContext";

export function LargeCategoryGrid() {
  const navigate = useNavigate();
  const { categories } = useProductCatalog();

  return (
    <section aria-label="Shop by category" className="py-2">
      {/* Section Header */}
      <div className="px-1 mb-3.5 sm:mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg md:text-xl font-black text-[#111111] tracking-tight">
            Shop by Category
          </h2>
          <p className="text-xs text-[#777777] font-medium mt-0.5">
            Farm fresh greens, natural choices & premium essentials
          </p>
        </div>
      </div>

      {/* 2-Column Grid on Mobile, 3-4 Columns on Desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 md:gap-5 px-0.5">
        {categories.map((cat, index) => (
          <motion.button
            key={cat.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-20px" }}
            transition={{
              delay: (index % 4) * 0.05,
              type: "spring",
              stiffness: 280,
              damping: 24,
            }}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate(`/products?category=${cat.id}`)}
            className="flex flex-col items-center cursor-pointer group text-center select-none"
            aria-label={`Shop ${cat.name}`}
          >
            {/* Large Rounded Image Card */}
            <div className="w-full aspect-square bg-[#F7F5F0] rounded-[24px] sm:rounded-[28px] p-3 sm:p-4.5 flex items-center justify-center overflow-hidden border border-[#ECE8DE]/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all duration-300 group-hover:bg-[#F1EEE6] group-hover:border-[#DDD7C9] group-hover:shadow-md relative">
              <img
                src={cat.image || "/product-images/dwarf-copper-leaves.jpg"}
                alt={cat.name}
                loading="lazy"
                className="w-full h-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.09)] transition-transform duration-300 group-hover:scale-108"
              />
            </div>

            {/* Category Name */}
            <h3 className="text-[13.5px] sm:text-[15px] font-bold text-[#1E293B] group-hover:text-[#00A651] text-center mt-2.5 sm:mt-3 transition-colors tracking-tight leading-tight px-1">
              {cat.name}
            </h3>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
