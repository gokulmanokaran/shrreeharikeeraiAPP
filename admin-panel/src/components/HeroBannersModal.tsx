import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Plus, Trash2, Eye, EyeOff, Upload, Image as ImageIcon,
  Pencil, AlertCircle, CheckCircle, Loader2, Layers,
} from "lucide-react";
import {
  HeroBanner,
  GradientConfig,
  fetchBanners,
  saveBanner,
  deleteBanner,
  toggleBannerActive,
  uploadBannerImage,
  updateBannerOrder,
} from "../services/bannerApi";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const RECOMMENDED_W = 1200;
const RECOMMENDED_H = 500;

// ── Gradient Banner Preview Card ─────────────────────────────────────────────
function GradientPreview({ cfg, height = "h-28" }: { cfg: GradientConfig; height?: string }) {
  return (
    <div
      className={`w-full ${height} rounded-xl flex flex-col justify-between px-4 py-2.5 text-white relative overflow-hidden`}
      style={{ background: cfg.previewCss || "linear-gradient(135deg, #00A651, #065A31)" }}
    >
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20 bg-white" />
      <div className="relative z-10">
        <span className="inline-block bg-white/25 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase">
          {cfg.tag}
        </span>
      </div>
      <div className="relative z-10">
        <p className="text-[11px] font-black text-white leading-tight line-clamp-1">{cfg.title}</p>
        <p className="text-[9px] text-white/80 mt-0.5 line-clamp-1">{cfg.subtitle}</p>
      </div>
    </div>
  );
}

// ── Image Banner Add/Edit Form ────────────────────────────────────────────────
function ImageBannerForm({
  initial,
  onSave,
  onCancel,
  isSaving,
  defaultSortOrder,
}: {
  initial?: Partial<HeroBanner>;
  onSave: (data: Partial<HeroBanner>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  defaultSortOrder: number;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || "");
  const [linkUrl, setLinkUrl] = useState(initial?.linkUrl || "/products");
  const [active, setActive] = useState(initial?.active !== false);
  const [preview, setPreview] = useState(initial?.imageUrl || "");
  const [uploading, setUploading] = useState(false);
  const [sizeWarning, setSizeWarning] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [tab, setTab] = useState<"upload" | "url">("upload");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const checkDimensions = (src: string) => {
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (Math.abs(w - RECOMMENDED_W) > 100 || Math.abs(h - RECOMMENDED_H) > 100) {
        setSizeWarning(`Image is ${w}×${h}px. Recommended: ${RECOMMENDED_W}×${RECOMMENDED_H}px — may appear stretched.`);
      } else {
        setSizeWarning("");
      }
    };
    img.src = src;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select a valid image file."); return; }
    setError(""); setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPreview(base64); checkDimensions(base64);
      try {
        const uploaded = await uploadBannerImage(base64, initial?.id || `banner_${Date.now().toString(36)}`);
        setImageUrl(uploaded);
      } catch { setImageUrl(base64); }
      finally { setUploading(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSet = () => {
    const u = urlInput.trim();
    if (!u.startsWith("http://") && !u.startsWith("https://")) {
      setError("Please enter a valid URL starting with http:// or https://"); return;
    }
    setError(""); setImageUrl(u); setPreview(u); checkDimensions(u); setUrlInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) { setError("Please upload or provide an image URL."); return; }
    if (!name.trim()) { setError("Please enter a banner name."); return; }
    setError("");
    await onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      name: name.trim(),
      bannerType: "image",
      imageUrl,
      linkUrl: linkUrl || "/products",
      active,
      sortOrder: initial?.sortOrder ?? defaultSortOrder,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Size notice */}
      <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
        <AlertCircle size={16} className="text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-bold text-blue-300">Recommended Banner Size: {RECOMMENDED_W} × {RECOMMENDED_H} px</p>
          <p className="text-[11px] text-blue-400/80 mt-0.5">For best quality, upload an image in {RECOMMENDED_W} × {RECOMMENDED_H} px format.</p>
        </div>
      </div>

      {/* Image upload */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-2">Banner Image *</label>
        <div className="flex gap-1 mb-3 bg-slate-800 rounded-lg p-1">
          {(["upload", "url"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all cursor-pointer ${tab === t ? "bg-slate-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
              {t === "upload" ? "Upload File" : "Image URL"}
            </button>
          ))}
        </div>

        {tab === "upload" ? (
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-600 hover:border-[#00A651] rounded-xl p-6 text-center cursor-pointer transition-all group">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={24} className="text-[#00A651] animate-spin" />
                <p className="text-xs text-slate-400">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={24} className="text-slate-500 group-hover:text-[#00A651] transition-colors" />
                <p className="text-xs font-bold text-slate-300 group-hover:text-white">Click to upload</p>
                <p className="text-[11px] text-slate-500">JPG, PNG, WebP · Recommended {RECOMMENDED_W}×{RECOMMENDED_H}px</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/banner.jpg"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#00A651]" />
            <button type="button" onClick={handleUrlSet}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all cursor-pointer">Set</button>
          </div>
        )}

        {preview && (
          <div className="mt-3">
            <p className="text-[11px] text-slate-500 mb-1.5">Preview</p>
            <div className="relative w-full aspect-[1200/500] rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
              <img src={preview} alt="Preview" className="w-full h-full object-cover"
                onError={() => { setError("Image URL could not be loaded."); setPreview(""); }} />
            </div>
            {sizeWarning && (
              <p className="mt-1.5 text-[11px] text-amber-400 flex items-center gap-1">
                <AlertCircle size={11} /> {sizeWarning}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Banner Name */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1.5">Banner Name *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Summer Sale, Weekend Offer…"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#00A651]" required />
      </div>

      {/* Link URL */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1.5">Click Link <span className="font-normal text-slate-500">(optional)</span></label>
        <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/products"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-[#00A651]" />
        <p className="text-[11px] text-slate-500 mt-1">Where clicking the banner takes the customer</p>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-200">Active</p>
          <p className="text-[11px] text-slate-500">Show this banner on the Home page</p>
        </div>
        <button type="button" onClick={() => setActive((v) => !v)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${active ? "bg-[#00A651]" : "bg-slate-600"}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${active ? "translate-x-6" : ""}`} />
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-400 flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} /> {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition-all cursor-pointer">Cancel</button>
        <button type="submit" disabled={isSaving || uploading}
          className="flex-1 py-2.5 rounded-xl bg-[#00A651] hover:bg-[#008f45] disabled:opacity-60 text-white text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2">
          {isSaving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : "Save Banner"}
        </button>
      </div>
    </form>
  );
}

// ── Gradient Banner Edit Form (name + active only) ────────────────────────────
function GradientEditForm({
  banner,
  onSave,
  onCancel,
  isSaving,
}: {
  banner: HeroBanner;
  onSave: (data: Partial<HeroBanner>) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(banner.name);
  const [active, setActive] = useState(banner.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ id: banner.id, name: name.trim(), active, bannerType: "gradient", gradientConfig: banner.gradientConfig, sortOrder: banner.sortOrder });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Gradient Preview */}
      {banner.gradientConfig && (
        <div>
          <p className="text-xs font-bold text-slate-300 mb-2">Banner Preview</p>
          <GradientPreview cfg={banner.gradientConfig} />
          <div className="mt-2 flex items-center gap-1.5 bg-slate-800/50 rounded-xl px-3 py-2">
            <Layers size={13} className="text-slate-500" />
            <p className="text-[11px] text-slate-400">This is a built-in gradient banner. Only the name and Active status can be changed.</p>
          </div>
        </div>
      )}

      {/* Name */}
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1.5">Banner Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-[#00A651]" required />
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-200">Active</p>
          <p className="text-[11px] text-slate-500">Show this banner on the Home page</p>
        </div>
        <button type="button" onClick={() => setActive((v) => !v)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${active ? "bg-[#00A651]" : "bg-slate-600"}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${active ? "translate-x-6" : ""}`} />
        </button>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold transition-all cursor-pointer">Cancel</button>
        <button type="submit" disabled={isSaving}
          className="flex-1 py-2.5 rounded-xl bg-[#00A651] hover:bg-[#008f45] disabled:opacity-60 text-white text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2">
          {isSaving ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function HeroBannersModal({ isOpen, onClose }: Props) {
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editingBanner, setEditingBanner] = useState<HeroBanner | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3500); };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const list = await fetchBanners();
      setBanners(list);
    } catch (e: any) {
      setError(e.message || "Failed to load banners.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) { load(); setView("list"); } }, [isOpen, load]);

  const handleSave = async (data: Partial<HeroBanner>) => {
    setIsSaving(true);
    try {
      const saved = await saveBanner(data);
      setBanners((prev) => {
        const idx = prev.findIndex((b) => b.id === saved.id);
        if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
        return [...prev, saved];
      });
      showToast(`✓ Banner "${saved.name}" saved.`);
      setView("list"); setEditingBanner(null);
    } catch (e: any) {
      showToast(`❌ ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (banner: HeroBanner) => {
    if (!window.confirm(`Delete banner "${banner.name}"? This cannot be undone.`)) return;
    setDeletingId(banner.id);
    try {
      await deleteBanner(banner.id);
      setBanners((prev) => prev.filter((b) => b.id !== banner.id));
      showToast(`✓ "${banner.name}" deleted.`);
    } catch (e: any) {
      showToast(`❌ ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggle = async (banner: HeroBanner) => {
    setTogglingId(banner.id);
    try {
      const updated = await toggleBannerActive(banner.id, !banner.active);
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? updated : b)));
      showToast(`✓ "${banner.name}" is now ${updated.active ? "Active" : "Inactive"}.`);
    } catch (e: any) {
      showToast(`❌ ${e.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const moveOrder = async (idx: number, dir: -1 | 1) => {
    const next = [...banners];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    const updated = next.map((b, i) => ({ ...b, sortOrder: i }));
    setBanners(updated);
    try {
      await Promise.all(updated.map((b) => updateBannerOrder(b.id, b.sortOrder)));
    } catch {
      showToast("⚠️ Failed to save order.");
    }
  };

  const activeBanners = banners.filter((b) => b.active).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <ImageIcon size={16} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {view === "add" ? "Add New Banner" : view === "edit" ? "Edit Banner" : "Hero Banners"}
              </h2>
              <p className="text-[11px] text-slate-400">
                {view === "list"
                  ? `${banners.length} banner${banners.length !== 1 ? "s" : ""} · ${activeBanners} active`
                  : "Home page banner slider"}
              </p>
            </div>
          </div>
          <button
            onClick={view === "list" ? onClose : () => { setView("list"); setEditingBanner(null); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ADD form */}
          {view === "add" && (
            <ImageBannerForm
              onSave={handleSave}
              onCancel={() => setView("list")}
              isSaving={isSaving}
              defaultSortOrder={banners.length}
            />
          )}

          {/* EDIT form */}
          {view === "edit" && editingBanner && (
            editingBanner.bannerType === "gradient" ? (
              <GradientEditForm
                banner={editingBanner}
                onSave={handleSave}
                onCancel={() => { setView("list"); setEditingBanner(null); }}
                isSaving={isSaving}
              />
            ) : (
              <ImageBannerForm
                initial={editingBanner}
                onSave={handleSave}
                onCancel={() => { setView("list"); setEditingBanner(null); }}
                isSaving={isSaving}
                defaultSortOrder={editingBanner.sortOrder}
              />
            )
          )}

          {/* LIST */}
          {view === "list" && (
            <>
              {/* Add Banner button */}
              <button
                onClick={() => { setEditingBanner(null); setView("add"); }}
                className="w-full flex items-center justify-center gap-2 py-3 mb-5 rounded-2xl border-2 border-dashed border-[#00A651]/40 hover:border-[#00A651] text-[#00A651] hover:bg-[#00A651]/5 font-bold text-sm transition-all cursor-pointer"
              >
                <Plus size={18} strokeWidth={2.5} />
                Add New Banner
              </button>

              {/* Legend */}
              {banners.length > 0 && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00A651]" />
                    <span className="text-[11px] text-slate-400">Active (shows on Home page)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                    <span className="text-[11px] text-slate-400">Inactive (hidden)</span>
                  </div>
                </div>
              )}

              {loading && (
                <div className="py-16 flex flex-col items-center gap-3">
                  <Loader2 size={28} className="text-[#00A651] animate-spin" />
                  <p className="text-sm text-slate-400">Loading banners…</p>
                </div>
              )}

              {!loading && error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-5 py-4 flex items-start gap-3">
                  <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-rose-300">Could not load banners</p>
                    <p className="text-xs text-rose-400/80 mt-1">{error}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      Have you run <code className="text-amber-400 bg-slate-800 px-1 rounded">supabase/hero-banners.sql</code> in Supabase SQL Editor?
                    </p>
                    <button onClick={load} className="mt-3 text-xs text-[#00A651] font-bold hover:underline cursor-pointer">Retry</button>
                  </div>
                </div>
              )}

              {!loading && !error && banners.length === 0 && (
                <div className="py-16 flex flex-col items-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-1">
                    <ImageIcon size={24} className="text-slate-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-300">No banners yet</p>
                  <p className="text-xs text-slate-500 max-w-xs">
                    Run <code className="text-amber-400 bg-slate-800 px-1 rounded">supabase/hero-banners.sql</code> to set up the table and seed the 3 default banners.
                  </p>
                </div>
              )}

              {!loading && !error && banners.length > 0 && (
                <div className="flex flex-col gap-3">
                  {banners.map((banner, idx) => (
                    <div
                      key={banner.id}
                      className={`bg-slate-800 rounded-2xl border overflow-hidden transition-all ${banner.active ? "border-slate-700" : "border-slate-700/40 opacity-60"}`}
                    >
                      {/* Preview */}
                      <div className="relative w-full aspect-[1200/500]">
                        {banner.bannerType === "gradient" && banner.gradientConfig ? (
                          <div
                            className="w-full h-full flex flex-col justify-between px-4 py-3 text-white relative overflow-hidden"
                            style={{ background: banner.gradientConfig.previewCss }}
                          >
                            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-15 bg-white" />
                            <div className="relative z-10">
                              <span className="inline-block bg-white/25 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full tracking-widest uppercase">
                                {banner.gradientConfig.tag}
                              </span>
                            </div>
                            <div className="relative z-10">
                              <p className="text-xs font-black text-white leading-tight">{banner.gradientConfig.title}</p>
                              <p className="text-[10px] text-white/80 mt-0.5 truncate">{banner.gradientConfig.subtitle}</p>
                              {banner.gradientConfig.chips.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {banner.gradientConfig.chips.slice(0, 3).map((c) => (
                                    <span key={c} className="text-[8px] bg-white/20 text-white px-1.5 py-0.5 rounded-md">{c}</span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Gradient badge */}
                            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full">
                              <Layers size={9} className="text-white/70" />
                              <span className="text-[9px] text-white/70 font-bold">GRADIENT</span>
                            </div>
                          </div>
                        ) : banner.imageUrl ? (
                          <img src={banner.imageUrl} alt={banner.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                            <ImageIcon size={28} className="text-slate-500" />
                          </div>
                        )}

                        {/* Active status badge */}
                        <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${banner.active ? "bg-[#00A651] text-white" : "bg-slate-600 text-slate-300"}`}>
                          {banner.active ? <><CheckCircle size={10} /> Active</> : <><EyeOff size={10} /> Inactive</>}
                        </div>
                        {/* Order number */}
                        <div className="absolute bottom-2 left-2 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center text-[9px] font-black text-white">
                          {idx + 1}
                        </div>
                      </div>

                      {/* Controls row */}
                      <div className="px-4 py-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{banner.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {banner.bannerType === "gradient" ? "Built-in gradient banner" : banner.linkUrl}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Move up */}
                          <button type="button" disabled={idx === 0} onClick={() => moveOrder(idx, -1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 text-xs font-black transition-all cursor-pointer"
                            title="Move up">↑</button>
                          {/* Move down */}
                          <button type="button" disabled={idx === banners.length - 1} onClick={() => moveOrder(idx, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 text-xs font-black transition-all cursor-pointer"
                            title="Move down">↓</button>

                          {/* Toggle active */}
                          <button type="button" disabled={togglingId === banner.id} onClick={() => handleToggle(banner)}
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer ${banner.active ? "bg-[#00A651]/20 hover:bg-rose-500/20 text-[#00A651] hover:text-rose-400" : "bg-slate-700 hover:bg-[#00A651]/20 text-slate-400 hover:text-[#00A651]"}`}
                            title={banner.active ? "Disable" : "Enable"}>
                            {togglingId === banner.id ? <Loader2 size={13} className="animate-spin" /> : banner.active ? <Eye size={13} /> : <EyeOff size={13} />}
                          </button>

                          {/* Edit */}
                          <button type="button" onClick={() => { setEditingBanner(banner); setView("edit"); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all cursor-pointer"
                            title="Edit">
                            <Pencil size={13} />
                          </button>

                          {/* Delete */}
                          <button type="button" disabled={deletingId === banner.id} onClick={() => handleDelete(banner)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer"
                            title="Delete">
                            {deletingId === banner.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-6 left-6 right-6 bg-slate-800 border border-slate-700 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl text-center z-10">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
