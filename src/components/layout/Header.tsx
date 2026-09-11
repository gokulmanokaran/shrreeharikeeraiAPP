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
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { validatePincode } from "../../utils/validation";
import { BUSINESS_PHONE } from "../../data/deliveryZones";
import logoImg from "../../assets/logo.png";
import { UserAccountMenu } from "./UserAccountMenu";

interface HeaderProps {
  onSearchOpen?: () => void;
}

export function Header({ onSearchOpen }: HeaderProps) {
  const { itemCount } = useCart();
  const { pincode, deliveryCharge, checkPincode } = useDelivery();
  const navigate = useNavigate();

  const [locationOpen, setLocationOpen] = useState(false);
  const [newPincode, setNewPincode] = useState("");
  const [pincodeError, setPincodeError] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<"idle" | "success" | "error">("idle");

  const { scrollY } = useScroll();
  const headerHeight = useTransform(scrollY, [0, 80], [64, 56]);
  const headerShadow = useTransform(
    scrollY,
    [0, 40],
    ["0 0 0 rgba(0,0,0,0)", "0 2px 16px rgba(0,0,0,0.08)"]
  );

  const handleUpdateLocation = () => {
    const err = validatePincode(newPincode);
    if (err) {
      setPincodeError(err);
      return;
    }
    const { success } = checkPincode(newPincode);
    if (!success) {
      setPincodeError("Sorry, we don't deliver to this pincode yet.");
      setPincodeStatus("error");
    } else {
      setPincodeStatus("success");
      setTimeout(() => {
        setLocationOpen(false);
        setNewPincode("");
        setPincodeStatus("idle");
        setPincodeError("");
      }, 1200);
    }
  };

  return (
    <>
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
              onClick={() => setLocationOpen(true)}
              className="flex items-center gap-1 bg-[#EAF8F0] px-2.5 py-1.5 rounded-full mr-1"
              aria-label="Change delivery location"
            >
              <MapPin size={12} className="text-[#00A651]" />
              <span className="text-xs font-bold text-[#00A651]">
                {pincode || "Set Area"}
              </span>
              <ChevronDown size={10} className="text-[#00A651]" />
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

      {/* Location Bottom Sheet */}
      <BottomSheet
        isOpen={locationOpen}
        onClose={() => {
          setLocationOpen(false);
          setNewPincode("");
          setPincodeError("");
          setPincodeStatus("idle");
        }}
        title="Delivery Location"
      >
        <div className="p-5 space-y-4">
          <div className="bg-[#F5FCF8] rounded-[16px] p-4 border border-[#B9E8CE]">
            <div className="flex items-center gap-2.5 mb-1.5">
              <MapPin size={18} className="text-[#00A651]" />
              <p className="text-sm font-black text-[#111111]">
                Today Order – Tomorrow Evening Delivery Guaranteed
              </p>
            </div>
            <p className="text-xs text-[#555555] leading-relaxed">
              We deliver freshly harvested keerai and greens directly across Coimbatore city service zones.
            </p>
          </div>

          <div className="bg-[#F9F9F9] rounded-[14px] p-4 space-y-2">
            <p className="text-xs font-bold text-[#111111]">📍 How Delivery Location Works:</p>
            <ul className="text-xs text-[#666666] space-y-1.5 list-disc pl-4">
              <li>No manual pincode entry needed.</li>
              <li>At checkout, simply pin your location on Google Maps.</li>
              <li>Delivery availability & charges are verified automatically from your pin.</li>
            </ul>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setLocationOpen(false)}
          >
            Got It
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
