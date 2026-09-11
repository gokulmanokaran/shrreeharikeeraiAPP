import { motion } from "framer-motion";
import { Leaf, Sparkles, Truck, Heart } from "lucide-react";

const WHY_CARDS = [
  {
    icon: Leaf,
    title: "Fresh Products",
    description: "Handpicked fresh greens and produce delivered at peak freshness.",
    color: "#EAF8F0",
    iconColor: "#00A651",
  },
  {
    icon: Sparkles,
    title: "Premium Quality",
    description: "Carefully selected dry fruits, seeds and premium healthy products.",
    color: "#FFF5E6",
    iconColor: "#D4A017",
  },
  {
    icon: Truck,
    title: "Convenient Delivery",
    description: "Today Order – Tomorrow Evening Delivery Guaranteed directly to your door.",
    color: "#F0F8FF",
    iconColor: "#3B82F6",
  },
  {
    icon: Heart,
    title: "Carefully Selected",
    description: "Every product is thoughtfully chosen to be natural and wholesome.",
    color: "#FFF0F5",
    iconColor: "#E05080",
  },
];

export function WhyChooseUs() {
  return (
    <section className="px-0 py-4">
      <div className="w-full">
        <div className="mb-4 px-1">
          <h2 className="text-base sm:text-lg font-black text-[#111111]">Why Shree Hari?</h2>
          <p className="text-xs sm:text-sm text-[#666666] mt-0.5">
            We bring the best of nature to your doorstep.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {WHY_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, type: "spring", stiffness: 280, damping: 28 }}
                className="rounded-[16px] p-4 flex flex-col gap-2.5"
                style={{ background: card.color }}
              >
                <div
                  className="w-9 h-9 rounded-[12px] flex items-center justify-center"
                  style={{ background: `${card.iconColor}18` }}
                >
                  <Icon size={18} style={{ color: card.iconColor }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#111111] mb-0.5">
                    {card.title}
                  </h3>
                  <p className="text-xs text-[#666666] leading-relaxed">
                    {card.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
