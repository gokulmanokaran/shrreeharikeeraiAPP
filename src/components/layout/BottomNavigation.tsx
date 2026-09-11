import { AnimatePresence, motion } from "framer-motion";
import { Home, Grid3X3, Search, ShoppingBag } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../../store/CartContext";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home, path: "/" },
  { id: "categories", label: "Categories", icon: Grid3X3, path: "/products" },
  { id: "search", label: "Search", icon: Search, path: "/search" },
  { id: "cart", label: "Cart", icon: ShoppingBag, path: "/cart" },

];

interface BottomNavigationProps {
  onSearchOpen?: () => void;
  cartBarVisible?: boolean;
}

export function BottomNavigation({
  onSearchOpen,
  cartBarVisible = false,
}: BottomNavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount } = useCart();

  const handleNavClick = (item: (typeof NAV_ITEMS)[0]) => {
    if (item.id === "search") {
      onSearchOpen?.();
    } else {
      navigate(item.path);
    }
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <motion.nav
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.2 }}
      className="fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-[#EAEAEA] safe-bottom"
      aria-label="Bottom navigation"
    >
      {/* Push up when cart bar is visible */}
      <AnimatePresence>
        {cartBarVisible && (
          <motion.div
            key="spacer"
            initial={{ height: 0 }}
            animate={{ height: 64 }}
            exit={{ height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.id === "search" ? false : isActive(item.path);
          const showBadge = item.id === "cart" && itemCount > 0;

          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.88 }}
              onClick={() => handleNavClick(item)}
              className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-[14px] relative min-w-0 flex-1"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              {/* Active background */}
              {active && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-0 bg-[#EAF8F0] rounded-[14px]"
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                />
              )}

              <div className="relative">
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.8}
                  className={`transition-colors duration-150 ${
                    active ? "text-[#00A651]" : "text-[#999999]"
                  }`}
                />
                {showBadge && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#00A651] text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                  >
                    {itemCount > 9 ? "9+" : itemCount}
                  </motion.span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold transition-colors duration-150 ${
                  active ? "text-[#00A651]" : "text-[#999999]"
                }`}
              >
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
