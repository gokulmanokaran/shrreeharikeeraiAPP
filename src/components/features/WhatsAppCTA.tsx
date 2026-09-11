import { motion } from "framer-motion";
import { MessageCircle, Phone } from "lucide-react";
import { BUSINESS_PHONE } from "../../data/deliveryZones";

export function WhatsAppCTA() {
  return (
    <section className="px-0 py-2">
      <div className="w-full">
        <div
          className="rounded-[20px] p-5 flex flex-col gap-4"
          style={{
            background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
          }}
        >
          <div>
            <h2 className="text-white text-lg font-black mb-1">
              Questions? We're here.
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Reach out via WhatsApp or call us directly for orders, queries or
              delivery information.
            </p>
          </div>

          <div className="flex gap-3">
            <motion.a
              whileTap={{ scale: 0.96 }}
              href={`https://wa.me/91${BUSINESS_PHONE}?text=Hi%20Shree%20Hari%20Keerai%2C%20I%20have%20a%20query%20about%20your%20products.`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-white text-[#25D366] font-bold text-sm h-11 rounded-[12px]"
            >
              <MessageCircle size={17} />
              WhatsApp
            </motion.a>
            <motion.a
              whileTap={{ scale: 0.96 }}
              href={`tel:${BUSINESS_PHONE}`}
              className="flex-1 flex items-center justify-center gap-2 bg-white/20 text-white font-bold text-sm h-11 rounded-[12px]"
            >
              <Phone size={17} />
              Call Us
            </motion.a>
          </div>
        </div>
      </div>
    </section>
  );
}
