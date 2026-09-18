import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ShoppingBag, Home } from "lucide-react";

interface OrderSuccessModalProps {
  isOpen: boolean;
  orderId: string;
  totalAmount?: number;
  onViewOrder: () => void;
  onGoHome: () => void;
}

export function OrderSuccessModal({
  isOpen,
  orderId,
  totalAmount,
  onViewOrder,
  onGoHome,
}: OrderSuccessModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Centered Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 20 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className="relative w-full max-w-sm sm:max-w-md bg-white rounded-[28px] p-6 sm:p-7 shadow-2xl border border-[#EAEAEA] text-center z-10 overflow-hidden"
            style={{
              boxShadow:
                "0 24px 60px -12px rgba(0, 166, 81, 0.22), 0 12px 36px rgba(0, 0, 0, 0.16)",
            }}
          >
            {/* Top subtle decorative ambient glow */}
            <div
              className="absolute -top-16 -right-16 w-36 h-36 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(0,166,81,0.18) 0%, transparent 70%)",
              }}
            />
            <div
              className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(11,175,91,0.12) 0%, transparent 70%)",
              }}
            />

            {/* Floating micro celebration confetti dots */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{
                  opacity: [0, 0.9, 0.6],
                  scale: [0.4, 1, 0.8],
                  y: [0, -10 + (i % 2 === 0 ? -6 : 6)],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                className="absolute w-2 h-2 rounded-full pointer-events-none"
                style={{
                  top: `${16 + (i * 12) % 36}%`,
                  left: `${10 + (i * 15) % 80}%`,
                  backgroundColor:
                    i % 3 === 0
                      ? "#00A651"
                      : i % 3 === 1
                      ? "#3B82F6"
                      : "#F59E0B",
                }}
              />
            ))}

            {/* Animated Green Checkmark Icon */}
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#EAF8F0] border-4 border-white shadow-lg flex items-center justify-center mx-auto mb-4">
              <motion.div
                initial={{ scale: 0, rotate: -35 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 420,
                  damping: 20,
                  delay: 0.12,
                }}
              >
                <CheckCircle2
                  size={46}
                  className="text-[#00A651]"
                  strokeWidth={2.5}
                />
              </motion.div>
            </div>

            {/* Success Heading */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
            >
              <span className="inline-block bg-[#EAF8F0] text-[#00A651] text-[11px] font-extrabold px-3 py-0.5 rounded-full mb-2 tracking-wider uppercase">
                Order Confirmed
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-[#111111] tracking-tight leading-snug">
                🎉 Your Order Placed Successfully!
              </h2>
              <p className="text-xs sm:text-sm text-[#666666] mt-1.5 font-medium">
                Thank you for ordering with Shree Hari Keerai.
              </p>
            </motion.div>

            {/* Order Reference Box */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-[#F9FAF9] border border-[#EAEAEA] rounded-[18px] p-3.5 my-5 w-full text-left space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#777777] font-semibold">Order ID</span>
                <span className="font-extrabold text-[#111111] font-mono tracking-wider text-xs sm:text-sm bg-white px-2.5 py-1 rounded-lg border border-[#EAEAEA] shadow-2xs">
                  #{orderId}
                </span>
              </div>
              {totalAmount !== undefined && (
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#EAEAEA]">
                  <span className="text-[#777777] font-semibold">Amount Paid</span>
                  <span className="font-black text-[#00A651] text-sm sm:text-base">
                    ₹{totalAmount}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col gap-2.5 w-full"
            >
              {/* 1. View Order Button -> Navigate to Order History */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onViewOrder}
                className="w-full h-12 sm:h-13 bg-[#00A651] hover:bg-[#008f45] active:bg-[#007a3b] text-white text-sm sm:text-base font-extrabold rounded-[16px] shadow-lg shadow-[#00A651]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <ShoppingBag size={18} strokeWidth={2.2} />
                <span>View Order</span>
              </motion.button>

              {/* 2. Home Button -> Navigate to Home Page */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={onGoHome}
                className="w-full h-12 sm:h-13 bg-[#F5F5F5] hover:bg-[#EAEAEA] active:bg-[#E0E0E0] text-[#222222] text-sm sm:text-base font-bold rounded-[16px] border border-[#E2E2E2] flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Home size={18} strokeWidth={2.2} />
                <span>Home</span>
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
