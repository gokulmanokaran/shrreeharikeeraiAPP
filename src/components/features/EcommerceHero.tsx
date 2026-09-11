import { motion } from "framer-motion";
import { ArrowRight, Truck, ShoppingBag, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const containerVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      staggerChildren: 0.08,
      ease: "easeOut" as const,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 320, damping: 26 },
  },
};

export function EcommerceHero() {
  const navigate = useNavigate();

  return (
    <section className="px-4 pt-3 pb-2 max-w-lg mx-auto" aria-label="Pre-order Announcement">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#00A651] via-[#087A43] to-[#065A31] p-5 text-white shadow-lg"
        style={{
          boxShadow: "0 10px 28px -6px rgba(0, 166, 81, 0.35)",
        }}
      >
        {/* Subtle geometric glass circles */}
        <div
          className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 blur-[1px] pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-12 -left-10 w-32 h-32 rounded-full bg-white/5 pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col gap-3">
          {/* ── PRE-ORDER NOW — Prominent headline ────────────────────────── */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2 mb-1">
              {/* Pulsing dot indicator */}
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFE9B8] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FFE9B8]" />
              </span>
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">
                Now accepting orders
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Zap size={20} className="text-[#FFE9B8] flex-shrink-0 fill-[#FFE9B8]" />
              <h1 className="text-[22px] font-black tracking-tight leading-none text-white drop-shadow-sm uppercase">
                PRE-ORDER NOW
              </h1>
            </div>
            <p className="text-[12px] font-semibold text-white/80 mt-1 leading-snug">
              Fresh Greens &amp; Natural Foods · Delivered to Your Doorstep
            </p>
          </motion.div>

          {/* 4 Key Business Highlights in 2-Col Grid */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="flex items-center gap-2 bg-white/12 backdrop-blur-sm rounded-[12px] p-2 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-[#FFE9B8]">
                ⭐
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-white leading-tight">Today Order</p>
                <p className="text-[9px] text-white/75 font-medium truncate">Tomorrow Evening Delivery Guaranteed</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/12 backdrop-blur-sm rounded-[12px] p-2 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
                <Truck size={12} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-white leading-tight">Distance Delivery</p>
                <p className="text-[9px] text-white/75 font-medium truncate">From ₹30 to ₹80</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/12 backdrop-blur-sm rounded-[12px] p-2 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-white">
                🏷️
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-white leading-tight">Up to 10% Off</p>
                <p className="text-[9px] text-white/75 font-medium truncate">Auto discount on order</p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/12 backdrop-blur-sm rounded-[12px] p-2 border border-white/10">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 text-[#FFE9B8]">
                🌿
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold text-white leading-tight">100% Fresh</p>
                <p className="text-[9px] text-white/75 font-medium truncate">Farm to doorstep</p>
              </div>
            </div>
          </motion.div>

          {/* Action Row */}
          <motion.div variants={itemVariants} className="flex items-center gap-3 pt-1">
            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => navigate("/products")}
              className="flex-1 h-11 bg-white text-[#087A43] hover:bg-[#FAF8F1] font-black text-sm rounded-[13px] shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer select-none"
              aria-label="Shop Now"
            >
              <ShoppingBag size={16} className="text-[#00A651]" />
              <span>Shop Now</span>
              <ArrowRight size={15} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate("/products?category=keerai")}
              className="h-11 px-4 bg-white/15 hover:bg-white/25 text-white font-bold text-xs rounded-[13px] border border-white/20 transition-all cursor-pointer"
              aria-label="Explore Keerai"
            >
              Keerai 🌿
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
