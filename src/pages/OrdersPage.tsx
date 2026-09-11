import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";
import { Button } from "../components/ui/Button";
import { useAuth } from "../store/AuthContext";
import { getSupabaseClient } from "../lib/supabase";
import { Package, MapPin } from "lucide-react";

interface OrderRow {
  id: string;
  created_at: string;
  total: number;
  payment_status: string;
  items: { name?: string; quantity?: number }[];
  address?: string;
  city?: string;
}

export default function OrdersPage() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const email = profile?.email || user?.email || "";
  const mobile = profile?.mobile || String(user?.user_metadata?.mobile || "");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = getSupabaseClient();
      if (!supabase || (!email && !mobile)) {
        setLoading(false);
        return;
      }
      let query = supabase.from("orders").select("id, created_at, total, payment_status, items, address, city").order("created_at", { ascending: false }).limit(50);
      if (email && mobile) {
        query = query.or(`email.eq.${email},mobile.eq.${mobile}`);
      } else if (email) {
        query = query.eq("email", email);
      } else {
        query = query.eq("mobile", mobile);
      }
      const { data } = await query;
      if (!cancelled) {
        setOrders((data as OrderRow[]) || []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [email, mobile]);

  return (
    <>
      <Header onSearchOpen={() => navigate("/search")} />
      <main className="pb-24 max-w-lg mx-auto px-4 pt-5">
        <h1 className="text-xl font-black text-[#111111] mb-1">My Orders</h1>
        <p className="text-sm text-[#666666] mb-5">Orders placed with this account.</p>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 rounded-full border-3 border-[#EAF8F0] border-t-[#00A651] animate-spin" />
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
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-[20px] border border-[#EAEAEA] shadow-sm p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-black text-[#111111]">{order.id}</p>
                    <p className="text-[11px] text-[#888888]">
                      {new Date(order.created_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAF8F0] text-[#087A43]">
                    {order.payment_status || "Paid"}
                  </span>
                </div>
                <p className="text-xs text-[#555555] mb-2">
                  {(order.items || []).map((i) => `${i.name || "Item"} × ${i.quantity || 1}`).join(", ") || "Order items"}
                </p>
                {(order.address || order.city) && (
                  <p className="text-[11px] text-[#888888] flex items-start gap-1 mb-2">
                    <MapPin size={12} className="mt-0.5 text-[#00A651] shrink-0" />
                    {[order.address, order.city].filter(Boolean).join(", ")}
                  </p>
                )}
                <p className="text-sm font-black text-[#00A651]">₹{Number(order.total || 0).toFixed(0)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </>
  );
}
