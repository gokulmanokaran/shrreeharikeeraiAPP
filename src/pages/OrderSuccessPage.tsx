import { motion } from "framer-motion";
import {
  CheckCircle2,
  ShoppingBag,
  Truck,
  Calendar,
  MapPin,
  Tag,
  ExternalLink,
  User,
  Phone,
  Mail,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { useEffect, useMemo } from "react";

interface SuccessState {
  orderId?: string;
  total?: number;
  subtotal?: number;
  discount?: number;
  discountPercentage?: number;
  deliveryCharge?: number;
  pincode?: string;
  lat?: number;
  lng?: number;
  address?: string;
  houseNo?: string;
  landmark?: string;
  city?: string;
  state?: string;
  fullName?: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  paymentId?: string;
  items?: Array<{
    id: string;
    name: string;
    nameTamil?: string;
    quantity: number;
    price: number;
    unit?: string;
  }>;
}

export default function OrderSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Load from location.state OR fallback to latest saved order in localStorage
  const order = useMemo(() => {
    const stateOrder = location.state as SuccessState | null;
    if (stateOrder && stateOrder.orderId) return stateOrder;
    try {
      const stored = localStorage.getItem("shreehari_latest_order");
      if (stored) return JSON.parse(stored) as SuccessState;
    } catch { /* fallback */ }
    return {
      orderId: "SHK782910",
      total: 230,
      subtotal: 200,
      deliveryCharge: 30,
      discount: 0,
      discountPercentage: 0,
      pincode: "641014",
      items: [],
    };
  }, [location.state]);

  const orderId = order.orderId || "SHK782910";
  const total = order.total ?? 230;
  const subtotal = order.subtotal ?? total;
  const deliveryCharge = order.deliveryCharge ?? 30;
  const discount = order.discount ?? 0;
  const discountPercentage = order.discountPercentage ?? 0;
  const lat = order.lat;
  const lng = order.lng;
  const address = order.address;
  const city = order.city;
  const state = order.state;
  const pincode = order.pincode;
  const fullName = order.fullName;
  const mobile = order.mobile;
  const alternateMobile = order.alternateMobile;
  const email = order.email;
  const items = order.items || [];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#F5FCF8] via-[#FAF8F1] to-white pb-16">
      {/* Celebration background elements */}
      <div className="relative overflow-hidden pt-12 pb-6 px-4">
        {/* Confetti particles */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -20, x: (i % 2 === 0 ? 1 : -1) * (i * 25 + 10), scale: 0.5, rotate: 0 }}
            animate={{ opacity: [0, 1, 0.8, 0], y: [0, 120 + (i % 4) * 30], rotate: [0, i % 2 === 0 ? 180 : -180], scale: [0.5, 1, 0.8] }}
            transition={{ duration: 2.5, delay: i * 0.12, repeat: Infinity, repeatDelay: 3, ease: "easeOut" }}
            className="absolute top-8 left-1/2 w-2.5 h-2.5 rounded-sm pointer-events-none"
            style={{
              backgroundColor:
                i % 4 === 0 ? "#00A651" : i % 4 === 1 ? "#0BAF5B" : i % 4 === 2 ? "#D4A017" : "#3B82F6",
            }}
          />
        ))}

        <div className="max-w-md mx-auto flex flex-col items-center text-center">
          {/* Animated Green Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-[#EAF8F0] border-4 border-white shadow-xl flex items-center justify-center mb-5"
            style={{ boxShadow: "0 10px 30px rgba(0, 166, 81, 0.25)" }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.25, type: "spring", stiffness: 400 }}
            >
              <CheckCircle2 size={44} className="text-[#00A651]" strokeWidth={2.5} />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="inline-block bg-[#EAF8F0] text-[#00A651] text-xs font-extrabold px-3 py-1 rounded-full mb-2 tracking-wide">
              ORDER CONFIRMED
            </span>
            <h1 className="text-2xl font-black text-[#111111] tracking-tight">
              Order Placed Successfully! 🎉
            </h1>
            <p className="text-sm text-[#666666] mt-1">
              Your natural farm-fresh products are being prepped for delivery.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, type: "spring", stiffness: 280, damping: 26 }}
          className="bg-white rounded-[22px] p-5 border border-[#EAEAEA] shadow-sm mb-6"
        >
          {/* Header info */}
          <div className="flex items-center justify-between pb-4 border-b border-[#EAEAEA]">
            <div>
              <p className="text-xs font-semibold text-[#999999]">Order Reference</p>
              <p className="text-sm font-black text-[#111111] tracking-wider">#{orderId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-[#999999]">Total Paid</p>
              <p className="text-base font-black text-[#00A651]">₹{total}</p>
            </div>
          </div>

          {/* Customer Details */}
          {(fullName || mobile || email) && (
            <div className="py-3 border-b border-[#EAEAEA] space-y-2">
              <p className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-2">
                Customer Details
              </p>
              {fullName && (
                <div className="flex items-center gap-2 text-xs">
                  <User size={13} className="text-[#00A651] flex-shrink-0" />
                  <span className="text-[#111111] font-semibold">{fullName}</span>
                </div>
              )}
              {mobile && (
                <div className="flex items-center gap-2 text-xs">
                  <Phone size={13} className="text-[#00A651] flex-shrink-0" />
                  <span className="text-[#555555]">
                    {mobile}
                    {alternateMobile && <span className="text-[#888888]"> (Alt: {alternateMobile})</span>}
                  </span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2 text-xs">
                  <Mail size={13} className="text-[#00A651] flex-shrink-0" />
                  <span className="text-[#555555]">{email}</span>
                </div>
              )}
            </div>
          )}

          {/* Ordered items list */}
          {items.length > 0 && (
            <div className="py-3 border-b border-[#EAEAEA] space-y-1.5">
              <p className="text-xs font-bold text-[#888888] uppercase tracking-wider mb-2">
                Ordered Items
              </p>
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs">
                  <span className="text-[#555555] truncate pr-2">
                    {item.name}
                    {item.nameTamil && <span className="text-[#00A651]"> / {item.nameTamil}</span>}
                    {" "}× {item.quantity}
                  </span>
                  <span className="font-semibold text-[#111111] flex-shrink-0">
                    ₹{item.price * item.quantity}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Price breakdown */}
          <div className="py-3 border-b border-[#EAEAEA] space-y-2">
            <div className="flex justify-between text-xs text-[#666666]">
              <span>Subtotal</span>
              <span className="font-semibold text-[#111111]">₹{subtotal}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-xs text-[#00A651]">
                <span className="flex items-center gap-1">
                  <Tag size={12} />
                  Discount ({discountPercentage}%)
                </span>
                <span className="font-semibold">−₹{discount}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-[#666666]">
              <span>Delivery Charge</span>
              <span className="font-semibold text-[#111111]">₹{deliveryCharge}</span>
            </div>
          </div>

          {/* Delivery Highlights */}
          <div className="py-4 space-y-3.5 border-b border-[#EAEAEA]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#EAF8F0] flex items-center justify-center flex-shrink-0 text-[#00A651]">
                <Truck size={16} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-[#111111]">Expected Delivery</p>
                <p className="text-xs text-[#666666]">Today Order – Tomorrow Evening Delivery Guaranteed</p>
              </div>
            </div>

            {/* Delivery Location */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#EA4335]/10 flex items-center justify-center flex-shrink-0 text-[#EA4335]">
                <MapPin size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#111111]">Delivery Address</p>
                  {lat && lng && (
                    <a
                      href={`https://www.google.com/maps?q=${lat},${lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-[#4285F4] hover:underline flex items-center gap-0.5 flex-shrink-0"
                    >
                      <span>View Map</span>
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                {address && (
                  <p className="text-xs text-[#087A43] font-semibold mt-0.5">📍 {address}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {city && (
                    <span className="text-[10px] bg-[#EAF8F0] text-[#087A43] font-semibold px-1.5 py-0.5 rounded-full">{city}</span>
                  )}
                  {state && (
                    <span className="text-[10px] bg-[#F5F5F5] text-[#555555] font-semibold px-1.5 py-0.5 rounded-full">{state}</span>
                  )}
                  {pincode && (
                    <span className="text-[10px] bg-[#EAF8F0] text-[#00A651] font-bold px-1.5 py-0.5 rounded-full">📮 {pincode}</span>
                  )}
                </div>
                {deliveryCharge > 0 && (
                  <p className="text-[11px] text-[#888888] mt-0.5">Delivery Fee: ₹{deliveryCharge}</p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#F5FCF8] flex items-center justify-center flex-shrink-0 text-[#087A43]">
                <Calendar size={16} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-[#111111]">Order Placed At</p>
                <p className="text-xs text-[#666666]">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })},{" "}
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Quality Promise */}
          <div className="pt-4 flex items-center gap-2 bg-[#F5FCF8] rounded-[14px] p-3 text-xs text-[#087A43] font-medium">
            <span className="text-sm">🌿</span>
            <span>Cleaned fresh leafy greens &amp; premium whole foods guaranteed.</span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col gap-3"
        >
          <Button
            variant="primary"
            size="xl"
            fullWidth
            onClick={() => navigate("/products")}
            icon={<ShoppingBag size={18} />}
          >
            Continue Shopping
          </Button>
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onClick={() => navigate("/")}
          >
            Back to Home
          </Button>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3 text-[11px] text-[#888888]">
            <Link to="/refund-policy" className="hover:text-[#00A651] underline">Cancellation & Refund Policy</Link>
            <span>•</span>
            <Link to="/privacy-policy" className="hover:text-[#00A651] underline">Privacy Policy</Link>
            <span>•</span>
            <Link to="/terms-and-conditions" className="hover:text-[#00A651] underline">Terms</Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
