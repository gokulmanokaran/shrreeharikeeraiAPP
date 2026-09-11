import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../../store/CartContext";
import { useDelivery } from "../../store/DeliveryContext";
import { DEFAULT_MINIMUM_ORDER } from "../../data/deliveryZones";

export function CartBar() {
  const { itemCount, subtotal, discountedSubtotal } = useCart();
  const { deliveryCharge, minimumOrder } = useDelivery();
  const navigate = useNavigate();

  const isVisible = itemCount > 0;
  const minOrder = minimumOrder ?? DEFAULT_MINIMUM_ORDER;
  const shortfall = Math.max(0, minOrder - subtotal);
  const canCheckout = subtotal >= minOrder;
  const total = discountedSubtotal + (deliveryCharge ?? 0);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="cart-bar"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 32 }}
          className="fixed left-0 right-0 z-10 px-4"
          style={{ bottom: "72px" }} // above bottom nav
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/cart")}
            className={`w-full max-w-lg mx-auto flex items-center rounded-[16px] overflow-hidden shadow-xl ${
              canCheckout
                ? "bg-[#00A651]"
                : "bg-[#666666]"
            }`}
            aria-label={`View cart: ${itemCount} items, ₹${total}`}
          >
            {/* Left: item count */}
            <div className="bg-black/20 px-4 py-3.5 flex items-center gap-2 flex-shrink-0">
              <ShoppingBag size={16} className="text-white" />
              <motion.span
                key={itemCount}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
                className="text-white text-sm font-bold"
              >
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </motion.span>
            </div>

            {/* Center: status or total */}
            <div className="flex-1 px-4 py-3.5">
              {!canCheckout ? (
                <p className="text-white/90 text-xs font-semibold">
                  Add ₹{shortfall} more to checkout
                </p>
              ) : (
                <motion.p
                  key={total}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  className="text-white text-sm font-bold"
                >
                  ₹{total} total
                </motion.p>
              )}
            </div>

            {/* Right arrow */}
            <div className="px-4 py-3.5 flex-shrink-0">
              <ChevronRight size={18} className="text-white" />
            </div>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
