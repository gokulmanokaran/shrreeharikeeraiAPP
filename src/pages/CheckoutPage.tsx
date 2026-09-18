import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronRight,
  Truck,
  MapPin,
  Edit3,
  Navigation,
  User,
  Phone,
  Mail,
  Pencil,
  Home,
  Landmark,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../store/CartContext";
import { useDelivery } from "../store/DeliveryContext";
import { useProductCatalog } from "../store/ProductContext";
import { Button } from "../components/ui/Button";
import { MapLocationPicker, type MapLocationResult } from "../components/features/MapLocationPicker";
import {
  validateCheckoutForm,
  type CheckoutFormData,
  type CheckoutErrors,
  type DeliveryLocation,
} from "../utils/validation";
import { isValidPincode, MINIMUM_ORDER_VALUE, calculateDeliveryCharge } from "../data/deliveryZones";
import { useAuth } from "../store/AuthContext";

const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, type: "spring" as const, stiffness: 280, damping: 28 },
  }),
};

const GUEST_STORAGE_KEY = "shreehari_guest_details";

function loadSavedGuest() {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as { fullName: string; mobile: string; alternateMobile?: string; email?: string };
  } catch { /* ignore */ }
  return { fullName: "", mobile: "", alternateMobile: "", email: "" };
}

// ─── Reusable Input Field ─────────────────────────────────────────────────────
function InputField({
  id, label, icon, type = "text", inputMode, maxLength,
  value, onChange, error, placeholder, autoComplete, optional,
}: {
  id: string; label: string; icon: React.ReactNode; type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number; value: string; onChange: (v: string) => void;
  error?: string; placeholder: string; autoComplete?: string; optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold text-[#555555] flex items-center gap-1.5">
        <span className="text-[#00A651]">{icon}</span>
        {label}
        {optional && (
          <span className="text-[#AAAAAA] font-normal ml-0.5">(optional)</span>
        )}
      </label>
      <input
        id={id} type={type} inputMode={inputMode} maxLength={maxLength}
        value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete}
        className={`w-full h-12 px-4 border-2 rounded-[12px] text-sm font-medium focus:outline-none transition-colors ${
          error
            ? "border-[#EA4335] bg-red-50/50 focus:border-[#EA4335]"
            : "border-[#EAEAEA] focus:border-[#00A651]"
        }`}
      />
      {error && (
        <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-[#EA4335] text-xs font-semibold px-1">
          {error}
        </motion.p>
      )}
    </div>
  );
}

// ─── Small address chip ───────────────────────────────────────────────────────
function AddrChip({ label, color }: { label: string; color: "green" | "gray" | "blue" }) {
  const s = { green: "bg-[#EAF8F0] text-[#087A43]", gray: "bg-[#F0F0F0] text-[#555555]", blue: "bg-[#EBF3FF] text-[#1A73E8]" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s[color]}`}>{label}</span>;
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal } = useCart();
  const { pincode, setPincode } = useDelivery();
  const { getProductById } = useProductCatalog();

  const minOrder = MINIMUM_ORDER_VALUE;
  const charge = calculateDeliveryCharge(subtotal);
  const total = subtotal + charge;

  const saved = loadSavedGuest();
  const { profile, user } = useAuth();
  const [fullName, setFullName] = useState(saved.fullName);
  const [mobile, setMobile] = useState(saved.mobile);
  const [alternateMobile, setAlternateMobile] = useState(saved.alternateMobile || "");
  const [email, setEmail] = useState(saved.email || "");

  const [delivery, setDelivery] = useState<DeliveryLocation>({
    lat: null,
    lng: null,
    formattedAddress: "",
    street: "",
    area: "",
    city: "",
    district: "",
    state: "",
    pincode,
    houseNo: "",
    landmark: "",
  });

  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [placing, setPlacing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showAddressEdit, setShowAddressEdit] = useState(false);

  const isNavigatingRef = useRef(false);

  // Reset placing state on mount and clear any stale pending order data
  // so a new checkout never inherits a previous order's ID or items.
  useEffect(() => {
    setPlacing(false);
    isNavigatingRef.current = false;
    try {
      sessionStorage.removeItem("shreehari_pending_order");
      localStorage.removeItem("shreehari_pending_order");
    } catch { /* ignore */ }
  }, []);

  // Redirect to cart if empty
  useEffect(() => {
    if (!isNavigatingRef.current && !placing && items.length === 0) {
      navigate("/cart", { replace: true });
    }
  }, [items.length, placing, navigate]);

  // Prefill from the logged-in profile without overwriting details the customer already typed
  useEffect(() => {
    const name =
      profile?.fullName ||
      String(
        user?.user_metadata?.full_name || user?.user_metadata?.name || ""
      );
    const mail = profile?.email || user?.email || "";
    const phone = profile?.mobile || String(user?.user_metadata?.mobile || "");
    if (name) setFullName((prev) => prev || name);
    if (mail) setEmail((prev) => prev || mail);
    if (phone) setMobile((prev) => prev || phone);
  }, [profile, user]);

  const handleMapConfirm = useCallback((result: MapLocationResult) => {
    setDelivery((prev) => ({
      ...prev,
      lat: result.lat,
      lng: result.lng,
      formattedAddress: result.formattedAddress,
      street: result.street,
      area: result.area,
      city: result.city,
      district: result.district,
      state: result.state,
      pincode: result.pincode,
    }));
    if (result.pincode) {
      setPincode(result.pincode);
    }
    setErrors((prev) => ({ ...prev, location: undefined }));
    setShowMap(false);
    setShowAddressEdit(true);
  }, [setPincode]);

  const handleProceedToPayment = () => {
    if (subtotal < minOrder) {
      navigate("/cart");
      return;
    }

    // 1. Live stock verification before proceeding
    for (const item of items) {
      const live = getProductById(item.product.id);
      if (live) {
        if (!live.inStock || (live.stockQuantity !== undefined && live.stockQuantity <= 0)) {
          alert(`Sorry, "${live.name}" is currently out of stock. Please remove it from your cart.`);
          navigate("/cart");
          return;
        }
        if (live.stockQuantity !== undefined && item.quantity > live.stockQuantity) {
          alert(`Sorry, only ${live.stockQuantity} unit(s) of "${live.name}" are available in stock.`);
          navigate("/cart");
          return;
        }
      }
    }

    const formData: CheckoutFormData = {
      fullName: fullName.trim(),
      mobile: mobile.trim(),
      alternateMobile: alternateMobile.trim(),
      email: email.trim(),
      delivery,
    };

    const newErrors = validateCheckoutForm(formData);
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (newErrors.location) setShowMap(true);
      return;
    }

    try {
      localStorage.setItem(
        GUEST_STORAGE_KEY,
        JSON.stringify({ fullName, mobile, alternateMobile, email })
      );
    } catch {
      /* ignore */
    }

    isNavigatingRef.current = true;
    setPlacing(true);

    const orderItems = items.map((i) => ({
      id: i.product.id,
      productId: i.product.productId || (i.product as any).parentId || i.product.id,
      variantId: i.product.variantId,
      name: i.product.name,
      nameTamil: i.product.nameTamil,
      quantity: i.quantity,
      price: i.product.price,
      unit: i.product.unit,
    }));

    // Build full address string
    const fullAddress = [
      delivery.houseNo,
      delivery.street,
      delivery.area,
      delivery.landmark,
      delivery.city || "Coimbatore",
      delivery.district || "Coimbatore",
      delivery.state || "Tamil Nadu",
      delivery.pincode || pincode,
    ]
      .filter(Boolean)
      .join(", ");

    const pendingOrder = {
      orderId: "",
      userId: user?.id || profile?.id || undefined,
      total,
      subtotal,
      discount: 0,
      discountPercentage: 0,
      deliveryCharge: charge,
      fullName: fullName.trim(),
      mobile: mobile.trim(),
      alternateMobile: alternateMobile.trim() || undefined,
      email: email.trim() || undefined,
      pincode: delivery.pincode || pincode,
      lat: delivery.lat,
      lng: delivery.lng,
      address: fullAddress || delivery.formattedAddress,
      street: delivery.street,
      area: delivery.area,
      city: delivery.city || "Coimbatore",
      district: delivery.district || "Coimbatore",
      state: delivery.state || "Tamil Nadu",
      houseNo: delivery.houseNo,
      landmark: delivery.landmark,
      items: orderItems,
      createdAt: new Date().toISOString(),
      paymentStatus: "Pending",
    };

    // Save pending order to sessionStorage only (session-scoped, never leaks into new orders).
    // Do NOT save to localStorage — stale localStorage data is the primary source of
    // old Order IDs and customer details appearing in new checkouts.
    try {
      sessionStorage.setItem("shreehari_pending_order", JSON.stringify(pendingOrder));
    } catch {
      /* ignore */
    }

    navigate("/payment", { state: { order: pendingOrder } });
  };

  if (items.length === 0 && !placing) return null;

  return (
    <>
      {showMap && (
        <MapLocationPicker
          initialLat={delivery.lat}
          initialLng={delivery.lng}
          onConfirm={handleMapConfirm}
          onClose={() => setShowMap(false)}
        />
      )}

      <div className="min-h-dvh bg-[#FAFAFA]">
        {/* Page Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#EAEAEA] bg-white sticky top-0 z-10">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 cursor-pointer"
            aria-label="Go back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black text-[#111111]">Checkout</h1>
          <span className="ml-auto text-xs font-bold text-[#00A651] bg-[#EAF8F0] px-2.5 py-1 rounded-full">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="max-w-lg mx-auto px-4 py-5 pb-20 flex flex-col gap-4">

          {/* ─── 1. Your Details ───────────────────────────────────────────── */}
          <motion.div custom={0} variants={sectionVariants} initial="hidden" animate="visible"
            className="bg-white rounded-[20px] border border-[#EAEAEA] overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAEAEA] bg-[#F9F9F9]">
              <div className="w-6 h-6 rounded-full bg-[#00A651] text-white text-xs font-black flex items-center justify-center">1</div>
              <h2 className="text-sm font-bold text-[#111111]">Your Details</h2>
            </div>
            <div className="p-4 flex flex-col gap-3.5">
              <InputField
                id="checkout-name" label="Full Name" icon={<User size={13} />}
                value={fullName}
                onChange={(v) => { setFullName(v); setErrors((e) => ({ ...e, fullName: undefined })); }}
                error={errors.fullName} placeholder="e.g. Raj Kumar" autoComplete="name"
              />
              <InputField
                id="checkout-mobile"
                label="Mobile Number"
                icon={<Phone size={13} />}
                type="tel"
                inputMode="tel"
                maxLength={10}
                value={mobile}
                onChange={(v) => {
                  setMobile(v.replace(/\D/g, ""));
                  setErrors((err) => ({ ...err, mobile: undefined }));
                }}
                error={errors.mobile}
                placeholder="10-digit Indian mobile number"
                autoComplete="tel"
              />
              <InputField
                id="checkout-alt-mobile" label="Alternative Mobile Number" icon={<Phone size={13} />}
                type="tel" inputMode="tel" maxLength={10} optional
                value={alternateMobile}
                onChange={(v) => { setAlternateMobile(v.replace(/\D/g, "")); setErrors((e) => ({ ...e, alternateMobile: undefined })); }}
                error={errors.alternateMobile} placeholder="10-digit alternative number (optional)" autoComplete="tel"
              />
              <InputField
                id="checkout-email" label="Email Address" icon={<Mail size={13} />}
                type="email" value={email} optional
                onChange={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
                error={errors.email} placeholder="your@email.com (optional)" autoComplete="email"
              />
            </div>
          </motion.div>

          {/* ─── 2. Delivery Address ───────────────────────────────────────── */}
          <motion.div custom={1} variants={sectionVariants} initial="hidden" animate="visible"
            className="bg-white rounded-[20px] border border-[#EAEAEA] overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAEAEA] bg-[#F9F9F9]">
              <div className="w-6 h-6 rounded-full bg-[#EA4335] text-white text-xs font-black flex items-center justify-center">2</div>
              <h2 className="text-sm font-bold text-[#111111]">Delivery Address</h2>
            </div>
            <div className="p-4 flex flex-col gap-3">

              {/* Map Selector Button */}
              <button
                onClick={() => setShowMap(true)}
                className={`w-full flex items-center gap-3.5 p-4 rounded-[16px] border-2 transition-all cursor-pointer text-left ${
                  delivery.lat !== null
                    ? "border-[#00A651] bg-[#EAF8F0]/60"
                    : errors.location
                    ? "border-[#EA4335] bg-red-50"
                    : "border-dashed border-[#CCCCCC] hover:border-[#00A651] hover:bg-[#F5FCF8]"
                }`}
                aria-label="Select delivery location on map"
              >
                <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center flex-shrink-0 shadow-sm ${
                  delivery.lat !== null ? "bg-[#00A651] text-white" : "bg-[#EA4335] text-white"
                }`}>
                  <MapPin size={22} className="fill-current" />
                </div>

                <div className="flex-1 min-w-0">
                  {delivery.lat !== null ? (
                    <>
                      <p className="text-sm font-black text-[#087A43]">Location pinned ✓</p>
                      {delivery.formattedAddress && (
                        <p className="text-xs text-[#555555] mt-0.5 line-clamp-2">{delivery.formattedAddress}</p>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {delivery.city && <AddrChip color="green" label={`🏙 ${delivery.city}`} />}
                        {delivery.district && <AddrChip color="gray" label={delivery.district} />}
                        {delivery.state && <AddrChip color="gray" label={delivery.state} />}
                        {delivery.pincode && <AddrChip color="green" label={`📮 ${delivery.pincode}`} />}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-black text-[#111111]">Select Delivery Location</p>
                      <p className="text-xs text-[#666666] mt-0.5">Open map → tap your location → address auto-fills</p>
                    </>
                  )}
                </div>

                <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 flex-shrink-0 ${
                  delivery.lat !== null
                    ? "bg-white text-[#00A651] border border-[#00A651]/20 shadow-sm"
                    : "bg-[#EA4335] text-white"
                }`}>
                  {delivery.lat !== null
                    ? <><Edit3 size={11} />Change</>
                    : <><Navigation size={11} />Open Map</>}
                </span>
              </button>

              {errors.location && (
                <motion.p role="alert" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="text-[#EA4335] text-xs font-bold px-1">
                  ⚠️ {errors.location}
                </motion.p>
              )}

              {/* Editable Address Details Panel */}
              {delivery.lat !== null && (
                <div>
                  <button
                    onClick={() => setShowAddressEdit((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#00A651] mb-2 cursor-pointer"
                  >
                    <Pencil size={12} />
                    {showAddressEdit ? "Hide address details" : "Edit / Add address details"}
                  </button>

                  {showAddressEdit && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="overflow-hidden flex flex-col gap-3"
                    >
                      {/* Full formatted address — editable */}
                      <div>
                        <label htmlFor="edit-formatted" className="text-xs font-bold text-[#555555] flex items-center gap-1.5 mb-1.5">
                          <span className="text-[#00A651]"><MapPin size={13} /></span>
                          Full Address
                        </label>
                        <textarea
                          id="edit-formatted" rows={2}
                          value={delivery.formattedAddress}
                          onChange={(e) => setDelivery((p) => ({ ...p, formattedAddress: e.target.value }))}
                          className="w-full px-4 py-3 border-2 border-[#EAEAEA] rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#00A651] transition-colors resize-none"
                          placeholder="Auto-filled from map — edit if needed"
                        />
                      </div>

                      {/* Street & Area row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="edit-street" className="text-xs font-bold text-[#555555] block mb-1.5">Door / Street</label>
                          <input id="edit-street" type="text"
                            value={delivery.street}
                            onChange={(e) => setDelivery((p) => ({ ...p, street: e.target.value }))}
                            placeholder="e.g. 12, MG Road"
                            className="w-full h-11 px-3 border-2 border-[#EAEAEA] rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#00A651] transition-colors"
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-area" className="text-xs font-bold text-[#555555] block mb-1.5">Area / Locality</label>
                          <input id="edit-area" type="text"
                            value={delivery.area}
                            onChange={(e) => setDelivery((p) => ({ ...p, area: e.target.value }))}
                            placeholder="e.g. RS Puram"
                            className="w-full h-11 px-3 border-2 border-[#EAEAEA] rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#00A651] transition-colors"
                          />
                        </div>
                      </div>

                      {/* City & District row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="edit-city" className="text-xs font-bold text-[#555555] block mb-1.5">City</label>
                          <input id="edit-city" type="text"
                            value={delivery.city}
                            onChange={(e) => setDelivery((p) => ({ ...p, city: e.target.value }))}
                            placeholder="e.g. Coimbatore"
                            className="w-full h-11 px-3 border-2 border-[#EAEAEA] rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#00A651] transition-colors"
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-district" className="text-xs font-bold text-[#555555] block mb-1.5">District</label>
                          <input id="edit-district" type="text"
                            value={delivery.district}
                            onChange={(e) => setDelivery((p) => ({ ...p, district: e.target.value }))}
                            placeholder="e.g. Coimbatore"
                            className="w-full h-11 px-3 border-2 border-[#EAEAEA] rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#00A651] transition-colors"
                          />
                        </div>
                      </div>

                      {/* State & Pincode row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="edit-state" className="text-xs font-bold text-[#555555] block mb-1.5">State</label>
                          <input id="edit-state" type="text"
                            value={delivery.state}
                            onChange={(e) => setDelivery((p) => ({ ...p, state: e.target.value }))}
                            placeholder="e.g. Tamil Nadu"
                            className="w-full h-11 px-3 border-2 border-[#EAEAEA] rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#00A651] transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-[#555555] block mb-1.5">Delivery Pincode</label>
                          <div className="h-11 px-3.5 bg-[#F5F5F5] border-2 border-[#EAEAEA] rounded-[12px] flex items-center justify-between">
                            <span className="text-xs font-bold text-[#111111] flex items-center gap-1">
                              <span>📮</span>
                              <span>{delivery.pincode || "Not detected"}</span>
                            </span>
                            {delivery.pincode && isValidPincode(delivery.pincode) && (
                              <span className="text-[10px] font-bold text-[#00A651] bg-[#EAF8F0] px-2 py-0.5 rounded-full border border-[#B9E8CE]">
                                Verified ✓
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* House No & Landmark row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="edit-houseno" className="text-xs font-bold text-[#555555] flex items-center gap-1 mb-1.5">
                            <Home size={11} className="text-[#00A651]" /> House / Flat No.
                          </label>
                          <input id="edit-houseno" type="text"
                            value={delivery.houseNo}
                            onChange={(e) => setDelivery((p) => ({ ...p, houseNo: e.target.value }))}
                            placeholder="e.g. 12A, Flat 304"
                            className="w-full h-11 px-3 border-2 border-[#EAEAEA] rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#00A651] transition-colors"
                          />
                        </div>
                        <div>
                          <label htmlFor="edit-landmark" className="text-xs font-bold text-[#555555] flex items-center gap-1 mb-1.5">
                            <Landmark size={11} className="text-[#00A651]" /> Landmark
                          </label>
                          <input id="edit-landmark" type="text"
                            value={delivery.landmark}
                            onChange={(e) => setDelivery((p) => ({ ...p, landmark: e.target.value }))}
                            placeholder="e.g. Near bus stand"
                            className="w-full h-11 px-3 border-2 border-[#EAEAEA] rounded-[12px] text-sm font-medium focus:outline-none focus:border-[#00A651] transition-colors"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>

          {/* ─── 3. Delivery Method ────────────────────────────────────────── */}
          <motion.div custom={2} variants={sectionVariants} initial="hidden" animate="visible"
            className="bg-white rounded-[20px] border border-[#EAEAEA] overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAEAEA] bg-[#F9F9F9]">
              <div className="w-6 h-6 rounded-full bg-[#00A651] text-white text-xs font-black flex items-center justify-center">3</div>
              <h2 className="text-sm font-bold text-[#111111]">Delivery</h2>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-4 bg-[#EAF8F0] rounded-[16px] p-4 border-2 border-[#00A651]">
                <div className="w-11 h-11 bg-[#00A651] rounded-[12px] flex items-center justify-center flex-shrink-0">
                  <Truck size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#111111]">Today Order – Tomorrow Evening Delivery Guaranteed</p>
                  <p className="text-xs text-[#666666] mt-0.5">Order placed today will be delivered tomorrow evening guaranteed</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-black text-[#00A651]">
                    {charge === 0 ? "FREE" : `₹${charge}`}
                  </p>
                  <p className="text-xs text-[#999999]">charge</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ─── 4. Order Summary ─────────────────────────────────────────── */}
          <motion.div custom={3} variants={sectionVariants} initial="hidden" animate="visible"
            className="bg-white rounded-[20px] border border-[#EAEAEA] overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#EAEAEA] bg-[#F9F9F9]">
              <div className="w-6 h-6 rounded-full bg-[#00A651] text-white text-xs font-black flex items-center justify-center">4</div>
              <h2 className="text-sm font-bold text-[#111111]">Order Summary</h2>
            </div>
            <div className="p-4">
              <div className="flex flex-col gap-2 mb-4">
                {items.map((item) => (
                  <div key={item.product.id} className="flex justify-between items-start text-sm">
                    <div className="flex-1 min-w-0 mr-3">
                      <span className="text-[#666666] truncate block">
                        {item.product.name}
                        {item.product.nameTamil && <span className="text-[#00A651]"> / {item.product.nameTamil}</span>}
                        {" "}× {item.quantity}
                      </span>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="font-semibold text-[#111111]">₹{item.product.price * item.quantity}</span>
                      {item.product.mrp && item.product.mrp > item.product.price ? (
                        <span className="text-[10px] text-[#888888] line-through">
                          ₹{item.product.mrp * item.quantity}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#EAEAEA] pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#666666]">Subtotal</span>
                  <span className="font-semibold text-[#111111]">₹{subtotal}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#666666]">Delivery Charge</span>
                  <span className="font-semibold">
                    {charge === 0 ? (
                      <span className="text-[#00A651]">FREE (₹0)</span>
                    ) : (
                      <span className="text-[#111111]">₹{charge}</span>
                    )}
                  </span>
                </div>
                <div className="border-t border-[#EAEAEA] pt-2 flex justify-between">
                  <span className="font-bold text-[#111111]">Total Payable</span>
                  <span className="text-xl font-black text-[#111111]">₹{total}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ─── Confirm & Pay ─────────────────────────────────────────────── */}
          <motion.div custom={4} variants={sectionVariants} initial="hidden" animate="visible">
            {errors.payment && (
              <div className="bg-[#FFF2F2] border border-[#FFD0D0] text-[#D92D20] text-xs font-semibold rounded-xl p-3.5 mb-3 flex items-center justify-between gap-2 shadow-xs">
                <span className="flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>{errors.payment}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setErrors((prev) => ({ ...prev, payment: undefined }))}
                  className="text-[#999999] hover:text-[#111111] text-sm font-bold px-1 cursor-pointer"
                  aria-label="Dismiss payment error"
                >
                  ✕
                </button>
              </div>
            )}
            <div className="bg-[#F9F9F9] rounded-xl p-3 mb-3 border border-[#EAEAEA] text-[11px] text-[#666666] leading-relaxed text-center">
              By confirming, you agree to our{" "}
              <Link to="/terms-and-conditions" target="_blank" className="text-[#00A651] font-semibold underline">Terms & Conditions</Link>,{" "}
              <Link to="/privacy-policy" target="_blank" className="text-[#00A651] font-semibold underline">Privacy Policy</Link>, and{" "}
              <Link to="/refund-policy" target="_blank" className="text-[#00A651] font-semibold underline">Refund Policy</Link>.
            </div>

            <Button
              variant="primary" size="xl" fullWidth
              loading={placing} onClick={handleProceedToPayment}
              icon={<ChevronRight size={18} />} iconPosition="right"
              id="checkout-place-order-btn"
            >
              {placing ? "Proceeding to Payment…" : `Proceed to Payment · ₹${total}`}
            </Button>
            <p className="text-xs text-[#999999] text-center mt-3 leading-relaxed">
              No account needed. Today Order – Tomorrow Evening Delivery Guaranteed to your pinned location.
            </p>
          </motion.div>

        </div>
      </div>
    </>
  );
}
