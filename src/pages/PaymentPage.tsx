import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Lock,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  AlertCircle,
  MapPin,
  User,
  Phone,
  RefreshCw,
  ShoppingBag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useCart } from "../store/CartContext";
import { useDelivery } from "../store/DeliveryContext";
import { useProductCatalog } from "../store/ProductContext";
import { Button } from "../components/ui/Button";
import { processPayment } from "../services/paymentService";
import { submitOrderNotification, type OrderNotificationPayload } from "../services/orderService";
import { deductLiveProductStock } from "../services/productService";

const PENDING_ORDER_KEY = "shreehari_pending_order";

export default function PaymentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items, clearCart } = useCart();
  const { deliveryCharge } = useDelivery();
  const { refreshProducts } = useProductCatalog();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showItems, setShowItems] = useState(false);
  const isNavigatingRef = useRef(false);


  // Retrieve pending order from navigation state or localStorage fallback
  const pendingOrder = useMemo<OrderNotificationPayload | null>(() => {
    const stateOrder = location.state?.order as OrderNotificationPayload | undefined;
    if (stateOrder && stateOrder.orderId) return stateOrder;

    try {
      const stored =
        sessionStorage.getItem(PENDING_ORDER_KEY) ||
        localStorage.getItem(PENDING_ORDER_KEY);
      if (stored) {
        return JSON.parse(stored) as OrderNotificationPayload;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [location.state]);

  // If no order data and no cart items, redirect back to cart
  useEffect(() => {
    if (!pendingOrder && items.length === 0 && !isNavigatingRef.current) {
      navigate("/cart", { replace: true });
    }
  }, [pendingOrder, items.length, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!pendingOrder) {
    return (
      <div className="min-h-dvh bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm max-w-sm w-full text-center">
          <AlertCircle size={40} className="text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900 mb-1">No Active Order Found</h2>
          <p className="text-sm text-gray-600 mb-4">
            Please select your items and fill in checkout details to proceed with payment.
          </p>
          <Button onClick={() => navigate("/cart")} className="w-full">
            Return to Cart
          </Button>
        </div>
      </div>
    );
  }

  const {
    orderId,
    total,
    subtotal,
    deliveryCharge: charge,
    discount,
    fullName,
    mobile,
    email,
    address,
    items: orderItems,
  } = pendingOrder;

  const handlePayWithRazorpay = async () => {
    if (isProcessing) return; // Prevent duplicate triggers

    setIsProcessing(true);
    setErrorMessage(null);

    // Timeout safety fallback: prevent permanent lock if popup is blocked
    const safetyTimeout = setTimeout(() => {
      setIsProcessing(false);
    }, 12000);

    try {
      const paymentResult = await processPayment({
        orderId,
        amount: total,
        currency: "INR",
        customerName: fullName,
        customerEmail: email || undefined,
        customerPhone: mobile,
        description: `Shree Hari Keerai — Order #${orderId}`,
      });

      clearTimeout(safetyTimeout);

      if (!paymentResult.success) {
        setIsProcessing(false);
        setErrorMessage(
          paymentResult.error || "Payment was not completed. You can retry whenever you are ready."
        );
        return;
      }

      // ── Payment Succeeded ──────────────────────────────────────────────────
      isNavigatingRef.current = true;
      const razorpayPaymentId = paymentResult.razorpayPaymentId || "";
      const razorpayOrderId = paymentResult.razorpayOrderId || "";
      const razorpaySignature = paymentResult.razorpaySignature || "";

      const completedOrder: OrderNotificationPayload = {
        ...pendingOrder,
        paymentStatus: `Paid (Razorpay)${razorpayPaymentId ? ` · ${razorpayPaymentId}` : ""}`,
        paymentId: razorpayPaymentId,
        razorpayPaymentId,
        razorpayOrderId,
        razorpaySignature,
      };

      // 1. Show saving state — backend is persisting to Supabase + Google Sheets
      setIsProcessing(false);
      setIsSaving(true);

      // 2. Deduct stock automatically upon successful payment (non-blocking)
      deductLiveProductStock(completedOrder.items).catch(() => {});
      refreshProducts().catch(() => {});

      // 3. Persist completed order locally (for OrderSuccessPage fallback)
      try {
        localStorage.setItem("shreehari_latest_order", JSON.stringify(completedOrder));
        const existingRaw = localStorage.getItem("shreehari_orders");
        const existing = existingRaw ? JSON.parse(existingRaw) : [];
        localStorage.setItem(
          "shreehari_orders",
          JSON.stringify([completedOrder, ...existing])
        );
        sessionStorage.removeItem(PENDING_ORDER_KEY);
        localStorage.removeItem(PENDING_ORDER_KEY);
      } catch {
        /* ignore */
      }

      // 4. Send to backend (Supabase + Google Sheets + Email) — AWAITED with timeout
      // The backend persists to Supabase first (durable), then calls GAS.
      // We give it up to 12 seconds. If it times out, the Razorpay webhook
      // will handle it server-to-server as a safety net.
      const notificationPromise = submitOrderNotification(completedOrder);
      const timeoutPromise = new Promise<OrderNotificationPayload>((resolve) =>
        setTimeout(() => resolve(completedOrder), 12_000)
      );

      const notifResult = await Promise.race([notificationPromise, timeoutPromise]);

      if (typeof notifResult === "object" && "success" in notifResult) {
        if (notifResult.success) {
          console.info(`[PaymentPage] ✅ Order #${orderId} fully persisted and notified (path: ${notifResult.path}).`);
        } else {
          console.warn(`[PaymentPage] ⚠️ Order #${orderId} queued for background retry (path: ${notifResult.path}). Razorpay webhook will also attempt.`);
        }
      } else {
        console.info(`[PaymentPage] ⏱️ Order #${orderId} notification timed out on client — backend/webhook will handle.`);
      }

      // 5. Clear cart and navigate to success page
      clearCart();
      navigate("/order-success", { replace: true, state: completedOrder });
    } catch (err) {
      clearTimeout(safetyTimeout);
      setIsProcessing(false);
      setIsSaving(false);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while connecting to the payment gateway. Please retry."
      );
    }
  };


  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/checkout");
    }
  };

  return (
    <div className="min-h-dvh bg-[#F9FAF9] pb-24">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-[#EAEAEA] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            disabled={isProcessing}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            aria-label="Back to checkout"
          >
            <ArrowLeft size={19} className="text-[#111111]" />
          </button>
          <div>
            <h1 className="text-base font-extrabold text-[#111111] leading-tight">Payment</h1>
            <p className="text-[11px] text-[#00A651] font-bold">Order ID: #{orderId}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-[#EAF8F0] text-[#00A651] text-xs font-bold px-2.5 py-1 rounded-full">
          <ShieldCheck size={14} className="stroke-[2.5]" />
          <span>100% Secure</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Error / Alert Notification */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm"
            >
              <AlertCircle size={20} className="text-[#EA4335] flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-[#EA4335] mb-0.5">Payment Notice</h3>
                <p className="text-xs text-red-700 leading-relaxed">{errorMessage}</p>
                <button
                  onClick={handlePayWithRazorpay}
                  disabled={isProcessing}
                  className="mt-2 text-xs font-extrabold bg-[#EA4335] text-white px-3 py-1.5 rounded-lg hover:bg-red-600 active:scale-95 transition-all inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={12} className={isProcessing ? "animate-spin" : ""} />
                  Retry Payment Now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Total Amount Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#00A651] to-[#007C3D] text-white rounded-[22px] p-5 shadow-lg shadow-[#00A651]/20 flex items-center justify-between"
        >
          <div>
            <span className="text-xs font-medium text-emerald-100 uppercase tracking-wider block">
              Total Payable Amount
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-black tracking-tight">₹{total}</span>
              <span className="text-xs text-emerald-100">
                ({orderItems?.length || items.length} items)
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/90 mt-1 flex items-center gap-1">
              <CheckCircle2 size={12} /> Includes all taxes & delivery
            </p>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
            <Lock size={22} className="stroke-[2.5]" />
          </div>
        </motion.div>

        {/* ─── 1. Payment Options ────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[#EAEAEA] bg-[#FAFAFA] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00A651]"></span>
              <h2 className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">
                Select Payment Method
              </h2>
            </div>
            <span className="text-[11px] text-[#00A651] font-bold">Instant Activation</span>
          </div>

          <div className="p-4 flex flex-col gap-3">
            {/* Razorpay Online Option (Default Active) */}
            <div className="border-2 border-[#00A651] bg-[#F5FCF8] rounded-[16px] p-4 relative cursor-pointer">
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#00A651] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                    <CheckCircle2 size={18} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-[#111111]">
                      Online Payment (Razorpay)
                    </h3>
                    <p className="text-[11px] text-[#666666]">
                      UPI, Cards, NetBanking, & Wallets
                    </p>
                  </div>
                </div>
                <span className="bg-[#00A651] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  FASTEST
                </span>
              </div>

              {/* Supported Payment Badges */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#00A651]/15">
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-[#E0F2E9] text-center">
                  <Smartphone size={16} className="text-[#00A651] mb-1" />
                  <span className="text-[10px] font-bold text-[#333333]">UPI / GPay</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-[#E0F2E9] text-center">
                  <CreditCard size={16} className="text-[#00A651] mb-1" />
                  <span className="text-[10px] font-bold text-[#333333]">Cards</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-[#E0F2E9] text-center">
                  <Building2 size={16} className="text-[#00A651] mb-1" />
                  <span className="text-[10px] font-bold text-[#333333]">NetBanking</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-[#E0F2E9] text-center">
                  <Wallet size={16} className="text-[#00A651] mb-1" />
                  <span className="text-[10px] font-bold text-[#333333]">Wallets</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── 2. Delivery & Customer Details Summary ────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm p-4"
        >
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#F0F0F0]">
            <h3 className="text-xs font-extrabold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
              <MapPin size={14} className="text-[#00A651]" /> Delivery Address
            </h3>
            <button
              onClick={handleBack}
              disabled={isProcessing}
              className="text-xs font-bold text-[#00A651] hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-[#444444]">
            <p className="font-extrabold text-sm text-[#111111] flex items-center gap-1.5">
              <User size={13} className="text-gray-400" /> {fullName}
            </p>
            <p className="flex items-center gap-1.5 text-gray-600 font-medium">
              <Phone size={13} className="text-gray-400" /> +91 {mobile}
            </p>
            <p className="text-gray-700 leading-relaxed mt-1 bg-[#F9FAF9] p-2.5 rounded-xl border border-[#EEEEEE]">
              {address}
            </p>
          </div>
        </motion.div>

        {/* ─── 3. Order Items & Bill Breakdown ──────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm overflow-hidden"
        >
          <button
            onClick={() => setShowItems((v) => !v)}
            className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag size={15} className="text-[#00A651]" />
              <span className="text-xs font-extrabold text-[#111111] uppercase tracking-wider">
                Order Items ({orderItems?.length || 0})
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[#00A651]">
              <span>{showItems ? "Hide details" : "View items"}</span>
              {showItems ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </button>

          {showItems && orderItems && (
            <div className="px-4 pb-3 border-t border-[#F0F0F0] divide-y divide-[#F5F5F5]">
              {orderItems.map((item, idx) => (
                <div key={item.id || idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-[#111111]">{item.name}</p>
                    {item.unit && <p className="text-[10px] text-gray-500">{item.unit}</p>}
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-gray-900">
                      ₹{item.price} × {item.quantity}
                    </span>
                    <p className="font-extrabold text-[#00A651]">
                      ₹{item.price * item.quantity}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Price Breakdown */}
          <div className="p-4 border-t border-[#EAEAEA] bg-[#FAFAFA] flex flex-col gap-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Item Subtotal</span>
              <span className="font-semibold text-gray-900">₹{subtotal}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-[#00A651] font-bold">
                <span>Offer Discount</span>
                <span>-₹{discount}</span>
              </div>
            )}

            <div className="flex justify-between text-gray-600">
              <span>Delivery Charge</span>
              <span className="font-semibold text-gray-900">
                {charge === 0 ? (
                  <span className="text-[#00A651] font-bold">FREE</span>
                ) : (
                  `₹${charge}`
                )}
              </span>
            </div>

            <div className="flex justify-between text-sm font-black text-[#111111] pt-2 border-t border-[#EAEAEA]">
              <span>Total To Pay</span>
              <span className="text-[#00A651] text-base">₹{total}</span>
            </div>
          </div>
        </motion.div>

        {/* Security / Trust Badges */}
        <div className="flex items-center justify-center gap-4 py-2 text-center text-gray-500 text-[11px] font-medium">
          <span className="flex items-center gap-1">
            <Lock size={12} className="text-[#00A651]" /> 256-Bit SSL Secured
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} className="text-[#00A651]" /> Verified by Razorpay
          </span>
        </div>
      </div>

      {/* ─── Bottom Floating Sticky Payment Bar ────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#EAEAEA] p-4 shadow-xl">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
              Total Amount
            </span>
            <span className="text-xl font-black text-[#111111] leading-none">
              ₹{total}
            </span>
          </div>

          <Button
            id="btn-confirm-pay"
            type="button"
            size="lg"
            onClick={handlePayWithRazorpay}
            loading={isProcessing || isSaving}
            className="flex-1 h-13 text-base font-extrabold rounded-[16px] shadow-lg shadow-[#00A651]/25 hover:shadow-xl transition-all cursor-pointer"
          >
            <span>
              {isSaving
                ? "Saving order…"
                : isProcessing
                ? "Opening Gateway…"
                : `Pay ₹${total} Securely`}
            </span>
          </Button>

        </div>
      </div>
    </div>
  );
}
