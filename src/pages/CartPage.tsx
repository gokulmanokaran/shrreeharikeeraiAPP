import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, Tag, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../store/CartContext";
import { useDelivery } from "../store/DeliveryContext";
import { useProductCatalog } from "../store/ProductContext";
import { useAuth } from "../store/AuthContext";
import { ProductImage } from "../components/ui/ProductImage";
import { Button } from "../components/ui/Button";
import { DEFAULT_MINIMUM_ORDER } from "../data/deliveryZones";

export default function CartPage() {
  const navigate = useNavigate();
  const {
    items,
    itemCount,
    subtotal,
    discount,
    discountedSubtotal,
    incrementItem,
    decrementItem,
    removeItem,
    clearCart,
  } = useCart();
  const { deliveryCharge, minimumOrder } = useDelivery();
  const { getProductById } = useProductCatalog();
  const { user } = useAuth();

  const charge = deliveryCharge ?? 0;
  // Use per-pincode minimum order (falls back to default if not available)
  const minOrder = minimumOrder ?? DEFAULT_MINIMUM_ORDER;
  const total = discountedSubtotal + charge;
  const shortfall = Math.max(0, minOrder - subtotal);

  // Check if any items are currently out of stock in live catalog
  const hasOutOfStockItems = items.some((item) => {
    const live = getProductById(item.product.id);
    if (live) {
      return !live.inStock || (live.stockQuantity !== undefined && live.stockQuantity <= 0);
    }
    return !item.product.inStock || (item.product.stockQuantity !== undefined && item.product.stockQuantity <= 0);
  });

  const canCheckout = subtotal >= minOrder && !hasOutOfStockItems;

  if (items.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#EAEAEA] bg-white sticky top-0 z-10">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black text-[#111111]">Your Cart</h1>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-5 pb-20">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
          >
            <div className="w-24 h-24 bg-[#EAF8F0] rounded-full flex items-center justify-center mb-4">
              <ShoppingBag size={40} className="text-[#00A651]" strokeWidth={1.5} />
            </div>
          </motion.div>
          <h2 className="text-xl font-black text-[#111111]">
            Your cart is waiting
          </h2>
          <p className="text-sm text-[#999999] text-center">
            Your cart is waiting for something fresh 🌿
          </p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate("/products")}
          >
            Start Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#FAFAFA] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#EAEAEA] bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black text-[#111111]">
            Cart ({itemCount})
          </h1>
        </div>
        <button
          onClick={clearCart}
          className="text-sm font-semibold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
          aria-label="Clear all items from cart"
        >
          Clear all
        </button>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {/* Out of stock warning banner */}
        {hasOutOfStockItems && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-[14px] px-4 py-3 flex items-center gap-2 text-red-700 text-xs font-bold"
          >
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <span>Some items in your cart are currently out of stock. Please remove them to proceed.</span>
          </motion.div>
        )}

        {/* Minimum order notice */}
        {subtotal < minOrder && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-[14px] px-4 py-3"
          >
            <p className="text-amber-800 text-sm font-semibold">
              Add ₹{shortfall} more to place your order.
            </p>
            <p className="text-amber-600 text-xs mt-0.5">
              Minimum order value for your area is ₹{minOrder}
            </p>
          </motion.div>
        )}

        {/* Discount badge */}
        {discount.amount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-3 bg-green-50 border border-green-200 rounded-[14px] px-4 py-2.5 flex items-center gap-2"
          >
            <Tag size={14} className="text-[#00A651] flex-shrink-0" />
            <p className="text-[#087A43] text-sm font-semibold">
              🎉 {discount.percentage}% discount applied — you save ₹{discount.amount}!
            </p>
          </motion.div>
        )}

        {/* Cart items */}
        <div className="px-4 py-4 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {items.map((item) => {
              const live = getProductById(item.product.id);
              const liveInStock = live
                ? live.inStock && (live.stockQuantity === undefined || live.stockQuantity > 0)
                : item.product.inStock && (item.product.stockQuantity === undefined || item.product.stockQuantity > 0);
              const availableStock = live?.stockQuantity ?? item.product.stockQuantity;
              const isMaxStockReached =
                availableStock !== undefined && item.quantity >= availableStock;

              return (
                <motion.div
                  key={item.product.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={`bg-white rounded-[16px] p-3 flex gap-3 border ${
                    !liveInStock ? "border-red-300 bg-red-50/20" : "border-[#EAEAEA]"
                  }`}
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
                >
                  {/* Image */}
                  <div className="w-16 h-16 rounded-[12px] overflow-hidden flex-shrink-0 relative">
                    <ProductImage
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-full h-full"
                    />
                    {!liveInStock && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-[9px] font-black text-white uppercase text-center px-1">
                          Out of Stock
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <h3 className="text-sm font-bold text-[#111111] truncate">
                          {item.product.name}
                        </h3>
                        {item.product.nameTamil && (
                          <p className="text-[11px] text-[#00A651] font-semibold truncate">
                            {item.product.nameTamil}
                          </p>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[#999999] font-medium">
                      {item.product.unit}
                      {item.product.note ? ` · ${item.product.note}` : ""}
                    </p>

                    {/* Stock Status text */}
                    {!liveInStock ? (
                      <p className="text-xs font-bold text-red-600 mt-0.5">
                        Out of Stock — Please remove
                      </p>
                    ) : availableStock !== undefined && availableStock <= 5 ? (
                      <p className="text-xs font-semibold text-amber-600 mt-0.5">
                        Only {availableStock} left in stock
                      </p>
                    ) : (
                      <p className="text-xs text-[#00A651] font-semibold mt-0.5">
                        In Stock
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      {/* Qty control */}
                      <div className="flex items-center gap-2 bg-[#EAF8F0] rounded-full px-1.5 py-1">
                        <motion.button
                          whileTap={{ scale: 0.85 }}
                          onClick={() => decrementItem(item.product.id)}
                          className="w-6 h-6 bg-[#00A651] text-white rounded-full flex items-center justify-center cursor-pointer"
                          aria-label={`Decrease ${item.product.name} quantity`}
                        >
                          <Minus size={10} strokeWidth={3} />
                        </motion.button>
                        <motion.span
                          key={item.quantity}
                          initial={{ scale: 0.7 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500 }}
                          className="text-sm font-black text-[#00A651] w-5 text-center"
                        >
                          {item.quantity}
                        </motion.span>
                        <motion.button
                          whileTap={{ scale: isMaxStockReached ? 1 : 0.85 }}
                          onClick={() => !isMaxStockReached && incrementItem(item.product.id)}
                          disabled={isMaxStockReached || !liveInStock}
                          className="w-6 h-6 bg-[#00A651] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center cursor-pointer"
                          aria-label={`Increase ${item.product.name} quantity`}
                        >
                          <Plus size={10} strokeWidth={3} />
                        </motion.button>
                      </div>

                      {/* Price + MRP + remove */}
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end">
                          <motion.span
                            key={item.quantity * item.product.price}
                            initial={{ opacity: 0.5 }}
                            animate={{ opacity: 1 }}
                            className="text-sm font-black text-[#111111]"
                          >
                            ₹{item.product.price * item.quantity}
                          </motion.span>
                          {item.product.mrp && item.product.mrp > item.product.price ? (
                            <span className="text-[10px] text-[#888888] line-through font-medium">
                              ₹{item.product.mrp * item.quantity}
                            </span>
                          ) : null}
                        </div>
                        <button
                          onClick={() => removeItem(item.product.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-400 hover:bg-red-100 transition-colors cursor-pointer"
                          aria-label={`Remove ${item.product.name} from cart`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Order summary */}
        <div className="mx-4 mb-4 bg-white rounded-[16px] border border-[#EAEAEA] overflow-hidden">
          <div className="p-4 border-b border-[#EAEAEA]">
            <h2 className="text-sm font-bold text-[#111111]">Order Summary</h2>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-[#666666]">Subtotal ({itemCount} items)</span>
              <span className="font-semibold text-[#111111]">₹{subtotal}</span>
            </div>
            {discount.amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-[#00A651] flex items-center gap-1">
                  <Tag size={12} />
                  Discount ({discount.percentage}%)
                </span>
                <span className="font-semibold text-[#00A651]">−₹{discount.amount}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#666666]">Delivery Charge</span>
              <span className="font-semibold text-[#111111]">₹{charge}</span>
            </div>
            <div className="border-t border-[#EAEAEA] pt-2 flex justify-between">
              <span className="font-bold text-[#111111]">Total</span>
              <span className="font-black text-lg text-[#111111]">₹{total}</span>
            </div>
          </div>
        </div>

        {/* Proceed button */}
        <div className="px-4 pb-12">
          <Button
            variant="primary"
            size="xl"
            fullWidth
            disabled={!canCheckout}
            onClick={() => {
              if (!user) {
                navigate("/login", { state: { from: { pathname: "/checkout" } } });
              } else {
                navigate("/checkout");
              }
            }}
          >
            {hasOutOfStockItems
              ? "Remove Out of Stock Items to Proceed"
              : canCheckout
              ? `Proceed to Checkout · ₹${total}`
              : `Add ₹${shortfall} more to proceed`}
          </Button>
        </div>
      </div>
    </div>
  );
}
