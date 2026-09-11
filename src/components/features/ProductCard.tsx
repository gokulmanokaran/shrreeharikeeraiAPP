import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Product, getVariantProduct } from "../../data/products";
import { useCart } from "../../store/CartContext";
import { ProductImage } from "../ui/ProductImage";

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { addItem, incrementItem, decrementItem, getItemQuantity } = useCart();
  const navigate = useNavigate();

  // Local selected variant state
  const hasVariants = Boolean(product.variants && product.variants.length > 0);
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants?.[0]?.id || product.id
  );

  const activeVariant =
    product.variants?.find((v) => v.id === selectedVariantId) || product.variants?.[0];
  const effectiveProduct = activeVariant
    ? getVariantProduct(product, activeVariant)
    : product;

  const qty = getItemQuantity(effectiveProduct.id);

  const isOutOfStock =
    !effectiveProduct.inStock ||
    (effectiveProduct.stockQuantity !== undefined && effectiveProduct.stockQuantity <= 0);

  const isMaxStockReached =
    effectiveProduct.stockQuantity !== undefined && qty >= effectiveProduct.stockQuantity;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    addItem(effectiveProduct);
  };

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMaxStockReached) return;
    incrementItem(effectiveProduct.id);
  };

  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    decrementItem(effectiveProduct.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{
        delay: (index % 4) * 0.07,
        type: "spring",
        stiffness: 280,
        damping: 26,
      }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/products/${product.id}`)}
      className="bg-white rounded-[16px] border border-[#EAEAEA] overflow-hidden cursor-pointer relative flex flex-col justify-between transition-shadow hover:shadow-md"
      style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
      role="article"
      aria-label={`${product.name}, ₹${effectiveProduct.price} per ${effectiveProduct.unit}`}
    >
      <div>
        {/* Image */}
        <div className="relative overflow-hidden">
          <ProductImage
            src={product.image}
            alt={product.name}
            className="w-full rounded-none"
            priority={index < 4}
          />
          {isOutOfStock ? (
            <div className="absolute top-2 right-2 z-10 pointer-events-none">
              <span
                className="text-[10px] font-black tracking-wide uppercase px-2 py-1 rounded-md shadow-sm"
                style={{
                  background: "rgba(220,38,38,0.92)",
                  color: "#ffffff",
                  backdropFilter: "blur(2px)",
                  WebkitBackdropFilter: "blur(2px)",
                  letterSpacing: "0.04em",
                }}
              >
                Out of Stock
              </span>
            </div>
          ) : effectiveProduct.mrp && effectiveProduct.mrp > effectiveProduct.price ? (
            <div className="absolute top-2 left-2 z-10 pointer-events-none">
              <span className="text-[10px] font-black text-[#087A43] bg-[#EAF8F0] border border-[#CDEED9] px-1.5 py-0.5 rounded-md shadow-xs">
                Save ₹{effectiveProduct.mrp - effectiveProduct.price}
              </span>
            </div>
          ) : null}
        </div>

        {/* Info */}
        <div className="p-2.5 pb-1">
          {/* English name */}
          <h3 className="text-[13px] font-bold text-[#111111] line-clamp-1 leading-tight">
            {product.name}
          </h3>
          {/* Tamil name */}
          {product.nameTamil && (
            <p className="text-[11px] text-[#00A651] font-semibold line-clamp-1 leading-tight mb-1">
              {product.nameTamil}
            </p>
          )}

          {/* Note badge for products with variants */}
          {hasVariants && product.note && (
            <div className="mb-1">
              <span className="inline-block text-[10px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200/60">
                {product.note}
              </span>
            </div>
          )}

          {/* Unit / Variant Selector */}
          {hasVariants && product.variants ? (
            <div
              className="mt-1 mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              {product.variantType === "sugar" ? (
                /* Fresh Juices Sugar Selector next to Pack Size */
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-[#777777] font-semibold tracking-wide">
                    {product.unit}
                  </span>
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="appearance-none bg-[#F4FAF6] hover:bg-[#EAF8F0] active:bg-[#DEF4E8] text-[#087A43] text-[11px] font-bold py-1 pl-2 pr-5 rounded-md border border-[#CDEED9] cursor-pointer focus:outline-none transition-colors"
                      aria-label={`Select sugar preference for ${product.name}`}
                    >
                      {product.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.unit}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={11}
                      className="absolute right-1.5 text-[#087A43] pointer-events-none stroke-[2.5]"
                    />
                  </div>
                </div>
              ) : (
                /* Weight/Quantity Variant Selector */
                <div className="relative inline-flex items-center w-full">
                  <select
                    value={selectedVariantId}
                    onChange={(e) => setSelectedVariantId(e.target.value)}
                    className="w-full appearance-none bg-[#F4FAF6] hover:bg-[#EAF8F0] active:bg-[#DEF4E8] text-[#087A43] text-[11px] font-bold py-1 pl-2 pr-6 rounded-md border border-[#CDEED9] cursor-pointer focus:outline-none transition-colors"
                    aria-label={`Select quantity for ${product.name}`}
                  >
                    {product.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.unit} — ₹{v.price}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={11}
                    className="absolute right-1.5 text-[#087A43] pointer-events-none stroke-[2.5]"
                  />
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-[#999999] font-medium mb-2">
              {product.unit}
              {product.note && ` · ${product.note}`}
            </p>
          )}
        </div>
      </div>

      {/* Price & Action Row */}
      <div className="px-2.5 pb-2.5 pt-0">
        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-[#F5F5F5]">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-sm font-black text-[#111111]">
              ₹{effectiveProduct.price}
            </span>
            {effectiveProduct.mrp && effectiveProduct.mrp > effectiveProduct.price && (
              <span className="text-[11px] text-[#888888] line-through font-medium truncate">
                ₹{effectiveProduct.mrp}
              </span>
            )}
          </div>

          {/* Add / Qty control */}
          <AnimatePresence mode="wait" initial={false}>
            {qty === 0 ? (
              <motion.button
                key="add"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                disabled={isOutOfStock}
                onClick={handleAdd}
                className="h-7 px-3 bg-[#00A651] text-white text-xs font-bold rounded-full flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 hover:bg-[#008f45] active:scale-95 transition-all cursor-pointer shadow-sm"
                aria-label={`Add ${product.name} to cart`}
              >
                <Plus size={11} strokeWidth={3} />
                Add
              </motion.button>
            ) : (
              <motion.div
                key="qty"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 24 }}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 bg-[#EAF8F0] rounded-full px-1 border border-[#D0EEDB]"
              >
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={handleDecrement}
                  className="w-6 h-6 bg-[#00A651] text-white rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
                  aria-label={`Remove one ${product.name}`}
                >
                  <Minus size={10} strokeWidth={3} />
                </motion.button>
                <motion.span
                  key={qty}
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="text-xs font-black text-[#00A651] w-5 text-center"
                >
                  {qty}
                </motion.span>
                <motion.button
                  whileTap={{ scale: isMaxStockReached ? 1 : 0.85 }}
                  onClick={handleIncrement}
                  disabled={isMaxStockReached}
                  className="w-6 h-6 bg-[#00A651] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer"
                  aria-label={`Add another ${product.name}`}
                  title={isMaxStockReached ? "Maximum stock reached" : "Add one more"}
                >
                  <Plus size={10} strokeWidth={3} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
