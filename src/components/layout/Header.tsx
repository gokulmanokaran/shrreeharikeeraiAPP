import { motion, useScroll, useTransform } from "framer-motion";
import {
  Phone,
  Search,
  ShoppingBag,
  MapPin,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../../store/CartContext";
import { useDelivery } from "../../store/DeliveryContext";
import { MapLocationPicker } from "../features/MapLocationPicker";
import { BUSINESS_PHONE } from "../../data/deliveryZones";
import logoImg from "../../assets/logo.png";
import { UserAccountMenu } from "./UserAccountMenu";

interface HeaderProps {
  onSearchOpen?: () => void;
}

export function Header({ onSearchOpen }: HeaderProps) {
  const { itemCount } = useCart();
  const { savedLocation, pincode, saveLocation } = useDelivery();
  const navigate = useNavigate();

  const [showMapPicker, setShowMapPicker] = useState(false);

  const { scrollY } = useScroll();
  const headerHeight = useTransform(scrollY, [0, 80], [64, 56]);
  const headerShadow = useTransform(
    scrollY,
    [0, 40],
    ["0 0 0 rgba(0,0,0,0)", "0 2px 16px rgba(0,0,0,0.08)"]
  );

  return (
    <>
      {showMapPicker && (
        <MapLocationPicker
          initialLat={savedLocation?.lat}
          initialLng={savedLocation?.lng}
          onConfirm={async (result) => {
            await saveLocation(result);
            setShowMapPicker(false);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      <motion.header
        style={{ height: headerHeight, boxShadow: headerShadow }}
        className="fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md"
      >
        <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center select-none py-1 flex-shrink-0" aria-label="Shree Hari Keerai Home">
            <img
              src={logoImg}
              alt="Shree Hari Keerai"
              className="h-7 sm:h-8 w-auto max-w-[125px] sm:max-w-[155px] object-contain"
            />
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Location pill */}
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowMapPicker(true)}
              id="header-set-area-btn"
              className="flex items-center gap-1 bg-[#EAF8F0] px-2.5 py-1.5 rounded-full mr-1 cursor-pointer"
              aria-label="Set or change delivery location"
            >
              <MapPin size={12} className="text-[#00A651] shrink-0" />
              <span className="text-xs font-bold text-[#00A651]">
                {pincode || "Set Area"}
              </span>
              <ChevronDown size={10} className="text-[#00A651] shrink-0" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onSearchOpen}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Search products"
            >
              <Search size={18} className="text-[#111111]" />
            </motion.button>

            <a
              href={`tel:${BUSINESS_PHONE}`}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Call us"
            >
              <Phone size={18} className="text-[#111111]" />
            </a>

            <UserAccountMenu />

            {/* Cart icon for desktop */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => navigate("/cart")}
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full hover:bg-gray-100 transition-colors relative"
              aria-label={`Cart, ${itemCount} items`}
            >
              <ShoppingBag size={18} className="text-[#111111]" />
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#00A651] text-white text-[9px] font-bold rounded-full flex items-center justify-center"
                >
                  {itemCount > 9 ? "9+" : itemCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Spacer */}
      <div className="h-16" aria-hidden="true" />
    </>
  );
}
