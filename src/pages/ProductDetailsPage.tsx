import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Minus, Plus, ShoppingBag, Check } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getVariantProduct } from "../data/products";
import { useCart } from "../store/CartContext";
import { useProductCatalog } from "../store/ProductContext";
import { ProductImage } from "../components/ui/ProductImage";
import { Button } from "../components/ui/Button";

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, incrementItem, decrementItem, getItemQuantity, itemCount } =
    useCart();
  const { getProductById } = useProductCatalog();

  const product = id ? getProductById(id) : undefined;

  // Selected variant state
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  useEffect(() => {
    window.scrollTo(0, 0);
    if (product?.variants && product.variants.length > 0) {
      // If the incoming ID was already a variant ID, preserve it, else default to first variant
      const matchingVariant = product.variants.find((v) => v.id === id);
      setSelectedVariantId(matchingVariant ? matchingVariant.id : product.variants[0].id);
    } else if (product) {
      setSelectedVariantId(product.id);
    }
  }, [id, product]);

  if (!product) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-5">
        <span className="text-4xl">🌿</span>
        <h1 className="text-lg font-black text-[#111111]">Product not found</h1>
        <Button variant="primary" size="md" onClick={() => navigate("/products")}>
          Browse Products
        </Button>
      </div>
    );
  }

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

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="min-h-dvh bg-white"
    >
      {/* Back button overlay */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center px-4 pt-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center border border-[#EAEAEA] cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft size={18} className="text-[#111111]" />
        </motion.button>
      </div>

      {/* Hero image */}
      <motion.div
        initial={{ scale: 1.05 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full relative"
        style={{ height: "45vw", maxHeight: 280 }}
      >
        <ProductImage
          src={product.image}
          alt={product.name}
          className="w-full h-full rounded-none"
          aspectRatio="3/2"
          priority={true}
        />
        {isOutOfStock ? (
          <div className="absolute top-3 right-3 z-10 pointer-events-none">
            <span
              className="text-[11px] font-black tracking-wide uppercase px-2.5 py-1.5 rounded-md shadow-md"
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
          <div className="absolute top-3 right-3 z-10 pointer-events-none">
            <span className="text-[11px] font-black text-[#087A43] bg-white/95 backdrop-blur-sm border border-[#CDEED9] px-2.5 py-1 rounded-md shadow-sm">
              Save ₹{effectiveProduct.mrp - effectiveProduct.price}
            </span>
          </div>
        ) : null}
      </motion.div>

      {/* Content */}
      <div className="px-5 pt-5 pb-24">
        {/* Category badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <span className="inline-block bg-[#EAF8F0] text-[#00A651] text-xs font-bold px-2.5 py-1 rounded-full mb-3 capitalize">
            {product.category.replace(/-/g, " ")}
          </span>
        </motion.div>

        {/* Name & price */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="text-2xl font-black text-[#111111] tracking-tight mb-1">
            {product.name}
          </h1>
          {product.nameTamil && (
            <p className="text-base font-semibold text-[#00A651] mb-1">
              {product.nameTamil}
            </p>
          )}

          {/* Dynamic Price Display with crossed-out MRP */}
          <div className="flex items-baseline gap-2.5 mb-2 flex-wrap">
            <span className="text-3xl font-black text-[#00A651]">
              ₹{effectiveProduct.price}
            </span>
            {effectiveProduct.mrp && effectiveProduct.mrp > effectiveProduct.price && (
              <>
                <span className="text-lg text-[#888888] line-through font-semibold">
                  ₹{effectiveProduct.mrp}
                </span>
                <span className="text-xs font-bold text-[#087A43] bg-[#EAF8F0] border border-[#CDEED9] px-2.5 py-0.5 rounded-full">
                  Save ₹{effectiveProduct.mrp - effectiveProduct.price} (
                  {Math.round(
                    ((effectiveProduct.mrp - effectiveProduct.price) /
                      effectiveProduct.mrp) *
                      100
                  )}
                  % OFF)
                </span>
              </>
            )}
            <span className="text-sm text-[#888888] font-semibold">
              / {effectiveProduct.unit}
            </span>
          </div>

          {product.note && (
            <span className="text-xs bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-full">
              {product.note}
            </span>
          )}
        </motion.div>

        {/* Variant Selection Options */}
        {product.variants && product.variants.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="my-5 p-4 rounded-2xl bg-[#F8FAF9] border border-[#E3EFE7]"
          >
            <p className="text-xs font-bold text-[#444444] uppercase tracking-wider mb-2.5">
              {product.variantType === "sugar" ? "Sugar Option" : "Select Quantity / Weight"}
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {product.variants.map((v) => {
                const isSelected = v.id === selectedVariantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#00A651] text-white border-[#00A651] shadow-sm scale-[1.02]"
                        : "bg-white text-[#222222] border-[#DCE8E0] hover:border-[#00A651]/50"
                    }`}
                  >
                    <span>{v.unit}</span>
                    <div className="flex items-center gap-1">
                      {product.variantType !== "sugar" && (
                        <span className={isSelected ? "text-white/90" : "text-[#00A651]"}>
                          ₹{v.price}
                        </span>
                      )}
                      {isSelected && <Check size={16} strokeWidth={3} className="ml-1" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Availability Status */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center gap-2 my-4"
        >
          <div
            className={`w-2 h-2 rounded-full ${
              !isOutOfStock ? "bg-[#00A651]" : "bg-red-500"
            }`}
          />
          <span
            className={`text-sm font-semibold ${
              !isOutOfStock ? "text-[#00A651]" : "text-red-500"
            }`}
          >
            {!isOutOfStock
              ? effectiveProduct.stockQuantity !== undefined && effectiveProduct.stockQuantity <= 5
                ? `In Stock (Only ${effectiveProduct.stockQuantity} left!)`
                : "In Stock"
              : "Out of Stock — Currently Unavailable"}
          </span>
        </motion.div>

        {/* Description */}
        {product.description && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6"
          >
            <h2 className="text-sm font-bold text-[#111111] mb-2">About this product</h2>
            <p className="text-sm text-[#666666] leading-relaxed">
              {product.description}
            </p>
          </motion.div>
        )}

        {/* Divider */}
        <div className="border-t border-[#EAEAEA] my-5" />

        {/* Quantity + Add to Cart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex flex-col gap-4"
        >
          {qty > 0 && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-semibold text-[#666666]">
                Quantity
              </span>
              <div className="flex items-center gap-3 bg-[#EAF8F0] rounded-full px-2 py-1.5 border border-[#CDEED9]">
                <motion.button
                  whileTap={{ scale: 0.85 }}
                  onClick={() => decrementItem(effectiveProduct.id)}
                  className="w-8 h-8 bg-[#00A651] text-white rounded-full flex items-center justify-center cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} strokeWidth={3} />
                </motion.button>
                <motion.span
                  key={qty}
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                  className="text-base font-black text-[#00A651] w-6 text-center"
                >
                  {qty}
                </motion.span>
                <motion.button
                  whileTap={{ scale: isMaxStockReached ? 1 : 0.85 }}
                  onClick={() => !isMaxStockReached && incrementItem(effectiveProduct.id)}
                  disabled={isMaxStockReached}
                  className="w-8 h-8 bg-[#00A651] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center cursor-pointer"
                  aria-label="Increase quantity"
                  title={isMaxStockReached ? "Maximum stock reached" : "Increase quantity"}
                >
                  <Plus size={14} strokeWidth={3} />
                </motion.button>
              </div>
              <span className="text-sm font-black text-[#111111] ml-auto">
                ₹{effectiveProduct.price * qty}
              </span>
            </div>
          )}

          <AnimatePresence mode="wait">
            {qty === 0 ? (
              <motion.div
                key="add-btn"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Button
                  variant="primary"
                  size="xl"
                  fullWidth
                  disabled={isOutOfStock}
                  onClick={() => addItem(effectiveProduct)}
                  icon={<ShoppingBag size={18} />}
                  iconPosition="left"
                >
                  {isOutOfStock ? "Out of Stock" : "Add to Cart"}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="view-cart-btn"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Button
                  variant="secondary"
                  size="xl"
                  fullWidth
                  onClick={() => navigate("/cart")}
                  icon={<ShoppingBag size={18} />}
                  iconPosition="left"
                >
                  View Cart ({itemCount} items)
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
