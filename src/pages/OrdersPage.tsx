import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Button } from "../components/ui/Button";
import { useAuth } from "../store/AuthContext";
import { getSupabaseClient } from "../lib/supabase";
import { Package, MapPin, ShoppingBag, Clock } from "lucide-react";
import { SkeletonOrdersList } from "../components/ui/SkeletonLoader";

export interface OrderProductItem {
  id?: string;
  productId?: string;
  variantId?: string;
  name: string;
  nameTamil?: string;
  quantity: number;
  price: number;
  unit?: string;
}

interface OrderRow {
  id: string;
  created_at: string;
  total: number;
  subtotal?: number;
  delivery_charge?: number;
  discount?: number;
  payment_status: string;
  items: OrderProductItem[] | string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

function parseOrderItems(raw: unknown): OrderProductItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as OrderProductItem[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as OrderProductItem[];
    } catch {
      return [];
    }
  }
  return [];
}

function formatPaymentStatus(status?: string): string {
  if (!status) return "Paid";
  if (status.startsWith("pay_")) return "Paid (GPay)";

  // Extract main status part before transaction ID or dot separator
  let clean = status.split(" · ")[0].trim();

  // Replace any Razorpay mention with GPay (e.g. Paid (Razorpay) -> Paid (GPay))
  if (/razorpay/i.test(clean)) {
    clean = clean.replace(/razorpay/gi, "GPay");
  }

  // Remove any leftover transaction IDs
  const withoutPay = clean.replace(/pay_[a-zA-Z0-9_]+/gi, "").trim();
  return withoutPay || "Paid (GPay)";
}

export default function OrdersPage() {
  const { profile, user, initializing } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const email = (profile?.email || user?.email || "").trim().toLowerCase();
  const userId = user?.id || profile?.id || "";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (initializing) return;

      const supabase = getSupabaseClient();
      if (!supabase || (!userId && !email)) {
        setLoading(false);
        setOrders([]);
        return;
      }

      try {
        let query = supabase
          .from("orders")
          .select("id, created_at, total, subtotal, delivery_charge, discount, payment_status, items, address, city, state, pincode")
          .order("created_at", { ascending: false })
          .limit(50);

        // Filter out abandoned / uncompleted checkout sessions
        query = query.not("payment_status", "ilike", "%Initiated%").not("payment_status", "ilike", "%Pending%");

        if (userId && email) {
          query = query.or(`user_id.eq.${userId},email.ilike.${email}`);
        } else if (userId) {
          query = query.eq("user_id", userId);
        } else {
          query = query.ilike("email", email);
        }

        const { data, error } = await query;
        if (!cancelled) {
          let list: OrderRow[] = !error && data ? (data as OrderRow[]) : [];

          // Seamless immediate visibility fallback for the active customer account
          try {
            const rawLocal = localStorage.getItem("shreehari_orders");
            if (rawLocal) {
              const localOrders = JSON.parse(rawLocal);
              if (Array.isArray(localOrders)) {
                for (const lo of localOrders) {
                  const loId = lo.id || lo.orderId;
                  const loEmail = String(lo.email || "").trim().toLowerCase();
                  const loUserId = lo.userId || lo.user_id;
                  const matchesUser =
                    (userId && loUserId === userId) ||
                    (email && loEmail === email);

                  if (matchesUser && loId && !list.some((existing) => existing.id === loId)) {
                    list.unshift({
                      id: loId,
                      created_at: lo.createdAt || lo.created_at || new Date().toISOString(),
                      total: Number(lo.total || 0),
                      subtotal: lo.subtotal !== undefined ? Number(lo.subtotal) : undefined,
                      delivery_charge: lo.deliveryCharge !== undefined ? Number(lo.deliveryCharge) : lo.delivery_charge !== undefined ? Number(lo.delivery_charge) : undefined,
                      discount: lo.discount !== undefined ? Number(lo.discount) : undefined,
                      payment_status: lo.paymentStatus || lo.payment_status || "Paid (GPay)",
                      items: lo.items || [],
                      address: lo.address,
                      city: lo.city,
                      state: lo.state,
                      pincode: lo.pincode,
                    });
                  }
                }
              }
            }
          } catch {
            /* ignore fallback parse issues */
          }

          setOrders(list);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setOrders([]);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId, email, initializing]);

  return (
    <>
      <Header onSearchOpen={() => navigate("/search")} />
      <main className="pb-24 max-w-lg mx-auto px-4 pt-5">
        <h1 className="text-xl font-black text-[#111111] mb-1">My Orders</h1>
        <p className="text-sm text-[#666666] mb-5">Orders placed with this account.</p>

        {loading || initializing ? (
          <SkeletonOrdersList count={3} />
        ) : !userId && !email ? (
          <div className="bg-white rounded-[20px] border border-[#EAEAEA] p-8 text-center">
            <Package size={32} className="mx-auto text-[#00A651] mb-3" />
            <p className="text-sm font-bold text-[#111111] mb-1">Please Sign In</p>
            <p className="text-xs text-[#666666] mb-4">Sign in with your account to view your past orders and deliveries.</p>
            <Button variant="primary" size="md" onClick={() => navigate("/login?returnTo=/orders")}>
              Sign In
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-[20px] border border-[#EAEAEA] p-8 text-center">
            <Package size={32} className="mx-auto text-[#00A651] mb-3" />
            <p className="text-sm font-bold text-[#111111] mb-1">No orders yet</p>
            <p className="text-xs text-[#666666] mb-4">Your delivered and upcoming orders will appear here.</p>
            <Button variant="primary" size="md" onClick={() => navigate("/products")}>
              Browse Products
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const itemsList = parseOrderItems(order.items);
              const computedSubtotal = order.subtotal ?? itemsList.reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);
              const deliveryFee = order.delivery_charge !== undefined ? order.delivery_charge : (order.total > computedSubtotal ? order.total - computedSubtotal : 0);

              return (
                <div key={order.id} className="bg-white rounded-[22px] border border-[#EAEAEA] shadow-sm overflow-hidden transition-all hover:shadow-md">
                  {/* Order Card Header */}
                  <div className="p-4 bg-[#FBFDFB] border-b border-[#EAEAEA] flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#111111] tracking-wide">#{order.id}</span>
                      </div>
                      <p className="text-[11px] text-[#777777] mt-0.5 flex items-center gap-1">
                        <Clock size={11} className="text-[#00A651]" />
                        {new Date(order.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-[#EAF8F0] text-[#087A43] border border-[#CDEED9] shrink-0">
                      {formatPaymentStatus(order.payment_status)}
                    </span>
                  </div>

                  {/* Ordered Products Section */}
                  <div className="p-4">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <ShoppingBag size={14} className="text-[#00A651]" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#444444]">
                        Ordered Products {itemsList.length > 0 && `(${itemsList.length})`}
                      </h3>
                    </div>

                    {itemsList.length > 0 ? (
                      <div className="divide-y divide-[#F0F0F0] border border-[#EEEEEE] rounded-[14px] overflow-hidden bg-[#FAFAFA] mb-3">
                        {itemsList.map((item, idx) => {
                          const unitPrice = Number(item.price) || 0;
                          const qty = Number(item.quantity) || 1;
                          const itemTotal = unitPrice * qty;

                          return (
                            <div key={item.id || idx} className="p-3 flex items-center justify-between gap-3 bg-white">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-[#111111] truncate">{item.name}</span>
                                  {item.nameTamil && (
                                    <span className="text-[11px] text-[#00A651] font-medium">
                                      ({item.nameTamil})
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {item.unit && (
                                    <span className="text-[10px] text-[#777777] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                                      {item.unit}
                                    </span>
                                  )}
                                  <span className="text-[11px] text-[#666666]">
                                    ₹{unitPrice} × {qty}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-black text-[#111111]">₹{itemTotal}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 rounded-[12px] bg-[#F9F9F9] border border-[#EAEAEA] mb-3 text-center">
                        <p className="text-xs text-[#777777]">Products recorded on order receipt.</p>
                      </div>
                    )}

                    {/* Delivery Address */}
                    {(order.address || order.city) && (
                      <div className="text-[11px] text-[#666666] flex items-start gap-1.5 mb-3 bg-[#F9FBFA] p-2.5 rounded-[12px] border border-[#EAEAEA]">
                        <MapPin size={13} className="mt-0.5 text-[#00A651] shrink-0" />
                        <span className="leading-tight">
                          {[order.address, order.city, order.pincode].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}

                    {/* Cost Breakdown & Total */}
                    <div className="pt-2 border-t border-[#EEEEEE] flex items-center justify-between text-xs">
                      <div className="text-[#666666] flex items-center gap-2 text-[11px]">
                        {computedSubtotal > 0 && (
                          <span>Subtotal: <strong className="text-[#333333]">₹{computedSubtotal}</strong></span>
                        )}
                        <span>•</span>
                        <span>Delivery: <strong className="text-[#333333]">{deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}</strong></span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-[#888888] mr-1.5">Total:</span>
                        <span className="text-base font-black text-[#00A651]">₹{Number(order.total || 0).toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </>
  );
}
