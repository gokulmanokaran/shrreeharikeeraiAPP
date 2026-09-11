import { useState, useEffect, useCallback } from "react";
import {
  X,
  RefreshCw,
  ShoppingBag,
  Clock,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Search,
  ChevronDown,
  ChevronUp,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { getAdminSupabaseClient } from "../lib/supabase";

export interface OrderItem {
  id?: string;
  name: string;
  nameTamil?: string;
  quantity: number;
  price: number;
  unit?: string;
}

export interface DbOrder {
  id: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  razorpay_signature: string | null;
  full_name: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
  maps_link: string;
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  items: OrderItem[];
  payment_status: string;
  sheets_synced: boolean;
  email_sent: boolean;
  retry_count: number;
  last_error: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

interface OrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrdersModal({ isOpen, onClose }: OrdersModalProps) {
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setRefreshing(true);
    try {
      const supabase = getAdminSupabaseClient();
      if (!supabase) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.warn("[OrdersModal] Fetch error:", error);
      } else if (data) {
        setOrders(data as DbOrder[]);
      }
    } catch (err) {
      console.warn("[OrdersModal] Exception:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
    }
  }, [isOpen, fetchOrders]);

  if (!isOpen) return null;

  const filteredOrders = orders.filter((o) => {
    const term = searchTerm.toLowerCase();
    return (
      o.id.toLowerCase().includes(term) ||
      o.full_name.toLowerCase().includes(term) ||
      o.mobile.toLowerCase().includes(term) ||
      o.email?.toLowerCase().includes(term) ||
      (o.razorpay_payment_id && o.razorpay_payment_id.toLowerCase().includes(term)) ||
      o.city.toLowerCase().includes(term) ||
      o.pincode.toLowerCase().includes(term)
    );
  });

  const totalRevenue = orders.reduce((acc, o) => acc + (Number(o.total) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00A651]/10 text-[#00A651] flex items-center justify-center font-bold">
              <ShoppingBag size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Live Customer Orders</h2>
                <span className="text-xs bg-slate-800 text-slate-300 font-semibold px-2.5 py-0.5 rounded-full border border-slate-700">
                  {orders.length} Total
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Direct realtime database sync with Supabase & Google Sheets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              disabled={refreshing}
              title="Refresh Orders"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-[#00A651]" : ""} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-3 gap-3 px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Receipt size={15} className="text-[#00A651]" />
            <span>Total Orders: <strong>{orders.length}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="text-emerald-400 font-bold">₹</span>
            <span>Total Value: <strong>₹{totalRevenue.toLocaleString("en-IN")}</strong></span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <FileSpreadsheet size={15} className="text-blue-400" />
            <span>Synced to Sheets: <strong>{orders.filter((o) => o.sheets_synced).length}</strong></span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search by Order ID, Customer Name, Mobile, Payment ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-[#00A651] transition-colors"
            />
          </div>
        </div>

        {/* Orders List / Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="py-20 text-center">
              <span className="inline-block w-8 h-8 border-3 border-[#00A651]/30 border-t-[#00A651] rounded-full animate-spin mb-3" />
              <p className="text-sm text-slate-400">Loading orders from Supabase...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <ShoppingBag size={36} className="mx-auto mb-2 text-slate-600" />
              <p className="text-sm font-semibold text-slate-400">No orders found</p>
              <p className="text-xs text-slate-500 mt-1">
                {searchTerm
                  ? "No orders match your search query."
                  : "When customers place orders on the storefront, they will appear here in real time."}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id;
              const dateStr = new Date(order.created_at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
                timeStyle: "short",
              });

              return (
                <div
                  key={order.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden transition-all hover:border-slate-700"
                >
                  {/* Summary Header */}
                  <div
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                        ₹{order.total}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-sm">#{order.id}</span>
                          <span className="text-xs text-slate-400">· {order.full_name || "Guest"}</span>
                          <span className="text-[11px] bg-emerald-500/10 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
                            {order.payment_status || "Paid"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {dateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <Phone size={12} /> {order.mobile}
                          </span>
                          {order.email && (
                            <span className="flex items-center gap-1">
                              <Mail size={12} /> {order.email}
                            </span>
                          )}
                          {order.city && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} /> {order.city} {order.pincode ? `(${order.pincode})` : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 font-medium block">
                          {(order.items || []).length} items
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                          {order.sheets_synced ? (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 size={11} /> Sheets
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                              <AlertCircle size={11} /> Sheets Pending
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-slate-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-900 bg-slate-900/30 text-xs space-y-4">
                      {/* Customer & Delivery Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                        <div>
                          <h4 className="font-bold text-slate-300 text-xs mb-1.5 uppercase tracking-wider">
                            Customer Details
                          </h4>
                          <p className="text-slate-200"><strong>Name:</strong> {order.full_name}</p>
                          <p className="text-slate-200"><strong>Mobile:</strong> {order.mobile}</p>
                          {order.email && <p className="text-slate-200"><strong>Email:</strong> {order.email}</p>}
                          {order.razorpay_payment_id && (
                            <p className="text-slate-200 font-mono text-[11px] mt-1">
                              <strong>Payment ID:</strong> {order.razorpay_payment_id}
                            </p>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-300 text-xs mb-1.5 uppercase tracking-wider">
                            Delivery Address
                          </h4>
                          <p className="text-slate-300 leading-relaxed">{order.address || "Address not provided"}</p>
                          <p className="text-slate-400 mt-1">
                            {order.city} {order.state} {order.pincode}
                          </p>
                          {order.maps_link && (
                            <a
                              href={order.maps_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#00A651] hover:underline mt-1.5 font-semibold"
                            >
                              <ExternalLink size={12} /> Open in Google Maps
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Items Ordered */}
                      <div>
                        <h4 className="font-bold text-slate-300 text-xs mb-2 uppercase tracking-wider">
                          Ordered Items ({order.items?.length || 0})
                        </h4>
                        <div className="bg-slate-900/60 rounded-xl border border-slate-800 divide-y divide-slate-800/60">
                          {(order.items || []).map((item, idx) => (
                            <div key={idx} className="p-2.5 flex items-center justify-between">
                              <div>
                                <span className="text-slate-200 font-medium">{item.name}</span>
                                {item.nameTamil && (
                                  <span className="text-slate-500 ml-1.5 font-tamil">
                                    ({item.nameTamil})
                                  </span>
                                )}
                                {item.unit && (
                                  <span className="text-slate-500 text-[11px] block">{item.unit}</span>
                                )}
                              </div>
                              <div className="text-right font-mono">
                                <span className="text-slate-400">Qty {item.quantity}</span> × ₹{item.price} ={" "}
                                <strong className="text-white">₹{item.quantity * item.price}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Financials Breakdown */}
                      <div className="flex justify-end">
                        <div className="w-64 bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1 text-slate-400">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="text-slate-200">₹{order.subtotal}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Delivery Charge:</span>
                            <span className="text-slate-200">₹{order.delivery_charge}</span>
                          </div>
                          {Number(order.discount) > 0 && (
                            <div className="flex justify-between text-emerald-400">
                              <span>Discount:</span>
                              <span>-₹{order.discount}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-slate-700 pt-1 font-bold text-white text-sm">
                            <span>Total Paid:</span>
                            <span className="text-emerald-400">₹{order.total}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
