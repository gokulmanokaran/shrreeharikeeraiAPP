import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Trash2 } from "lucide-react";
import { useCart } from "../../store/CartContext";

export function TopSnackbar() {
  const { toast } = useCart();

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 450, damping: 30 }}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl border backdrop-blur-md max-w-sm ${
              toast.type === "remove"
                ? "bg-[#111111]/90 text-white border-white/10 shadow-black/20"
                : "bg-white/95 text-[#111111] border-[#00A651]/30 shadow-[#00A651]/15"
            }`}
            style={{
              boxShadow:
                toast.type === "remove"
                  ? "0 10px 30px rgba(0,0,0,0.25)"
                  : "0 10px 30px rgba(0,166,81,0.2)",
            }}
          >
            {toast.type === "remove" ? (
              <Trash2 size={16} className="text-red-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 size={16} className="text-[#00A651] flex-shrink-0" />
            )}
            <span className="text-xs font-bold tracking-tight truncate">
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
