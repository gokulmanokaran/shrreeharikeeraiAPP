import { useState, useEffect } from "react";
import { X, CheckCircle2, Copy, ExternalLink, RefreshCw, Server, Database, Save } from "lucide-react";
import { fetchProducts } from "../services/api";
import { getAdminSupabaseConfig, setCustomAdminSupabaseConfig, getAdminSupabaseClient } from "../lib/supabase";
import { Product } from "../types";

interface ApiInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiInspectorModal({ isOpen, onClose }: ApiInspectorModalProps) {
  if (!isOpen) return null;

  const currentConfig = getAdminSupabaseConfig();
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(currentConfig.url);
  const [supabaseKeyInput, setSupabaseKeyInput] = useState(currentConfig.key);

  const [sampleData, setSampleData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const productsApiUrl = `${window.location.origin}/api/products`;
  const categoriesApiUrl = `${window.location.origin}/api/categories`;

  const loadPreview = () => {
    setLoading(true);
    fetchProducts()
      .then((data) => setSampleData(data.slice(0, 3)))
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPreview();
  }, []);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSupabaseConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    setCustomAdminSupabaseConfig(supabaseUrlInput.trim(), supabaseKeyInput.trim());

    try {
      const client = getAdminSupabaseClient();
      if (!client) {
        throw new Error("Please enter both Supabase Project URL and API Key.");
      }

      const { data, error } = await client.from("products").select("id").limit(5);
      if (error) {
        throw new Error(error.message);
      }

      const count = Array.isArray(data) ? data.length : 0;
      setTestResult({
        success: true,
        msg: `✓ Supabase Connected Successfully! Found ${count > 0 ? count + "+ " : ""}products in database.`,
      });
      loadPreview();
    } catch (err) {
      setTestResult({
        success: false,
        msg: err instanceof Error ? `Connection Failed: ${err.message}` : "Failed to connect to Supabase.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleResetSupabase = () => {
    setCustomAdminSupabaseConfig(null, null);
    setSupabaseUrlInput("");
    setSupabaseKeyInput("");
    setTestResult({ success: true, msg: "Reset to environment default." });
    loadPreview();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Supabase Database & API Status</h2>
              <p className="text-xs text-slate-400">
                Single authoritative PostgreSQL source for Storefront, Admin Panel & Android App
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Supabase Connection Configuration */}
          <form onSubmit={handleSaveSupabaseConfig} className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database size={14} className="text-[#00A651]" />
                Supabase Database Connection
              </label>
              <button
                type="button"
                onClick={handleResetSupabase}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Reset to Default
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Connect directly to your Supabase PostgreSQL project. Products and category edits persist immediately across all platforms.
            </p>
            <div className="space-y-2">
              <input
                type="text"
                value={supabaseUrlInput}
                onChange={(e) => setSupabaseUrlInput(e.target.value)}
                placeholder="Supabase Project URL (e.g. https://xyzcompany.supabase.co)"
                className="w-full h-10 px-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00A651]"
              />
              <input
                type="password"
                value={supabaseKeyInput}
                onChange={(e) => setSupabaseKeyInput(e.target.value)}
                placeholder="Supabase Anon Key or Service Role Key"
                className="w-full h-10 px-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00A651]"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={testing}
                className="h-10 px-5 bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                {testing ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                <span>Save & Test Supabase</span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-2.5 rounded-xl text-xs font-semibold ${
                  testResult.success
                    ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
                }`}
              >
                {testResult.msg}
              </div>
            )}
          </form>

          {/* REST Endpoints for Android & API */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Server size={14} className="text-blue-400" />
              Central REST Endpoints (for Future Android App)
            </h3>

            {/* Products Endpoint */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 font-mono mb-1">
                  GET
                </span>
                <p className="text-xs text-white font-mono truncate">{productsApiUrl}</p>
                <p className="text-[10px] text-slate-500">Fetches live 90+ product catalog directly from Supabase</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyUrl(productsApiUrl)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
                <a
                  href={productsApiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>

            {/* Categories Endpoint */}
            <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 font-mono mb-1">
                  GET
                </span>
                <p className="text-xs text-white font-mono truncate">{categoriesApiUrl}</p>
                <p className="text-[10px] text-slate-500">Fetches live categories from Supabase</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyUrl(categoriesApiUrl)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy size={13} />
                  <span>Copy</span>
                </button>
                <a
                  href={categoriesApiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>

          {copied && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold text-center">
              ✓ URL Copied to clipboard!
            </div>
          )}

          {/* Sample JSON Payload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Live Data Preview
              </h3>
              {loading && <RefreshCw size={14} className="animate-spin text-slate-400" />}
            </div>
            <pre className="p-4 bg-slate-950/90 border border-slate-800 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
              {JSON.stringify(sampleData, null, 2)}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 size={16} />
            <span>Supabase architecture active</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
