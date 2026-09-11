import React, { useState } from "react";
import { Lock, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function LoginView() {
  const { login } = useAuth();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;

    setLoading(true);
    setError(null);
    try {
      await login(pin.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Access denied. Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#1E293B]">
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#00A651]/20 border border-[#00A651]/40 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00A651]/10">
            <ShieldCheck size={32} className="text-[#00A651]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Shree Hari Keerai</h1>
          <p className="text-sm font-semibold text-[#00A651] uppercase tracking-wider mt-1">
            Central Catalog Management
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Secure Admin Access for Website & Android API
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs">
            <AlertCircle size={18} className="flex-shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Administrator PIN / Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter Admin PIN (e.g. 2026)"
                autoFocus
                className="w-full h-12 pl-11 pr-4 bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-[#00A651] focus:ring-1 focus:ring-[#00A651] transition-all"
              />
              <Lock size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Default access PIN: <code className="text-slate-300">2026</code>
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full h-12 bg-[#00A651] hover:bg-[#008f45] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00A651]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Unlock Admin Dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Protected server-side · Real-time synchronization with Central Product API
          </p>
        </div>
      </div>
    </div>
  );
}
