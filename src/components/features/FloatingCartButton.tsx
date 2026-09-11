import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../../store/CartContext";

export function FloatingCartButton() {
  const { itemCount, subtotal, discountedSubtotal } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on cart, checkout, payment, and order success pages
  const isCartOrCheckout =
    location.pathname === "/cart" ||
    location.pathname === "/checkout" ||
    location.pathname === "/payment" ||
    location.pathname === "/order-success" ||
    location.pathname === "/pincode" ||
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password";

  const isVisible = itemCount > 0 && !isCartOrCheckout;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="floating-cart"
          initial={{ scale: 0, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0, y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className="fixed bottom-6 right-5 z-40"
        >
          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate("/cart")}
            className="flex items-center gap-2.5 bg-[#00A651] hover:bg-[#087A43] text-white px-4 py-3.5 rounded-full shadow-2xl border-2 border-white/30 cursor-pointer select-none"
            style={{
              boxShadow: "0 10px 30px rgba(0, 166, 81, 0.45)",
            }}
            aria-label={`View Cart with ${itemCount} items, ₹${subtotal}`}
          >
            <div className="relative">
              <ShoppingBag size={20} className="text-white" strokeWidth={2.2} />
              <motion.span
                key={itemCount}
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 20 }}
                className="absolute -top-2 -right-2.5 w-5 h-5 bg-white text-[#00A651] text-[11px] font-black rounded-full flex items-center justify-center shadow-md border border-[#00A651]/20"
              >
                {itemCount > 99 ? "99+" : itemCount}
              </motion.span>
            </div>

            <span className="text-sm font-black text-white pl-1">
              ₹{discountedSubtotal}
            </span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
