import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays } from "lucide-react";

const BANNERS = [
  {
    id: "pre-order",
    tag: "WEEKDAY DELIVERY NOTICE",
    title: "Freshness Delivered Daily",
    subtitle: "Order Today – Delivered Tomorrow Evening",
    chips: [],
    gradient: "from-[#00A651] via-[#087A43] to-[#065A31]",
    accent: "rgba(255,255,255,0.12)",
    targetCategory: "all",
  },
  {
    id: "weekend-delivery",
    tag: "WEEKEND DELIVERY NOTICE",
    title: "Orders placed on Saturday & Sunday",
    subtitle: "will be delivered on Monday.",
    chips: [],
    gradient: "from-[#033E20] via-[#065A31] to-[#087A43]",
    accent: "rgba(255,255,255,0.14)",
    targetCategory: "all",
  },
  {
    id: "premium-dry-fruits",
    tag: "PREMIUM SELECTION",
    title: "Wholesome Dry Fruits & Seeds",
    subtitle: "Natural, unsalted & nutrient-dense whole foods",
    chips: ["🌰 Almonds & Cashews", "🫘 Pista & Walnuts", "🌱 Chia & Flax", "✨ Dates & Figs"],
    gradient: "from-[#111111] via-[#1E3A2B] to-[#087A43]",
    accent: "rgba(0,166,81,0.25)",
    targetCategory: "dry-fruits",
  },
];

export function PromoCarousel() {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const dragStart = useRef(0);
  const navigate = useNavigate();

  const nextSlide = useCallback(() => {
    setActive((prev) => (prev + 1) % BANNERS.length);
  }, []);

  const prevSlide = useCallback(() => {
    setActive((prev) => (prev - 1 + BANNERS.length) % BANNERS.length);
  }, []);

  // Auto-scroll every 3.5 seconds when not paused by user touch
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      nextSlide();
    }, 3500);
    return () => clearInterval(interval);
  }, [isPaused, nextSlide]);

  return (
    <div
      className="w-full pt-1 pb-1"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 2000)}
    >
      <div className="relative overflow-hidden rounded-[18px] select-none shadow-sm h-[112px] sm:h-[116px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -25 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragStart={(_, info) => {
              dragStart.current = info.point.x;
            }}
            onDragEnd={(_, info) => {
              const delta = info.point.x - dragStart.current;
              if (delta < -30) nextSlide();
              else if (delta > 30) prevSlide();
            }}
            onClick={() =>
              navigate(
                BANNERS[active].targetCategory === "all"
                  ? "/products"
                  : `/products?category=${BANNERS[active].targetCategory}`
              )
            }
            className={`bg-gradient-to-br ${BANNERS[active].gradient} rounded-[18px] px-4 py-2.5 sm:py-3 text-white relative overflow-hidden cursor-pointer h-full w-full flex flex-col justify-between`}
          >
            {/* Subtle background circle */}
            <div
              className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
              style={{ background: BANNERS[active].accent }}
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Row 1: Tag & Action */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full tracking-wider border border-white/10 uppercase">
                  {(BANNERS[active].id === "weekend-delivery" || BANNERS[active].id === "pre-order") && (
                    <CalendarDays size={10} className="text-white" />
                  )}
                  {BANNERS[active].tag}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white/90 bg-black/15 px-2 py-0.5 rounded-full">
                  <span>Shop</span>
                  <ArrowRight size={10} />
                </span>
              </div>

              {/* Row 2: Title & Subtitle */}
              {BANNERS[active].id === "weekend-delivery" ? (
                <div>
                  <h2 className="text-white text-[13px] sm:text-[14.5px] font-bold tracking-tight leading-tight">
                    Orders placed on{" "}
                    <span className="text-amber-300 font-black">
                      Saturday & Sunday
                    </span>{" "}
                    will be delivered on{" "}
                    <span className="text-white font-black underline decoration-2 decoration-white/60 underline-offset-2">
                      Monday
                    </span>
                    .
                  </h2>
                  <p className="text-[10.5px] sm:text-[11px] text-white/85 font-medium truncate mt-0.5">
                    🌿 Fresh weekend harvests dispatched directly on Monday evening
                  </p>
                </div>
              ) : BANNERS[active].id === "pre-order" ? (
                <div>
                  <h2 className="text-white text-[13px] sm:text-[14.5px] font-bold tracking-tight leading-tight">
                    Order on{" "}
                    <span className="text-amber-300 font-black">
                      Mon – Fri
                    </span>
                    {" "}and receive your delivery by{" "}
                    <span className="text-white font-black underline decoration-2 decoration-white/60 underline-offset-2">
                      Next-Day Evening
                    </span>
                    .
                  </h2>
                  <p className="text-[10.5px] sm:text-[11px] text-white/85 font-medium truncate mt-0.5">
                    🚚 Same-day order cut-off · Fresh farm harvests · Doorstep delivery
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-white text-[15px] font-black tracking-tight leading-tight">
                    {BANNERS[active].title}
                  </h2>
                  <p className="text-[11px] text-white/80 font-medium truncate mt-0.5">
                    {BANNERS[active].subtitle}
                  </p>
                </div>
              )}

              {/* Row 3: Compact Chips (only rendered if chips exist) */}
              {BANNERS[active].chips.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                  {BANNERS[active].chips.map((chip) => (
                    <span
                      key={chip}
                      className="flex-shrink-0 text-[10px] font-bold bg-white/15 backdrop-blur-sm text-white px-2 py-0.5 rounded-[8px] border border-white/10"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Animated Progress / Pagination Dots */}
        <div className="flex justify-center gap-1.5 mt-2 pb-0.5">
          {BANNERS.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => setActive(i)}
              animate={{
                width: i === active ? 16 : 5,
                backgroundColor: i === active ? "#00A651" : "#EAEAEA",
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="h-1 rounded-full cursor-pointer"
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
