import React, { useState, useRef } from "react";
import { X, Plus, Save, AlertCircle, Trash2, ImageIcon, Edit3, Check, Upload, RefreshCw } from "lucide-react";
import { Category } from "../types";
import { saveCategory, deleteCategory } from "../services/api";

interface CategoryModalProps {
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function CategoryModal({
  categories: initialCategories,
  isOpen,
  onClose,
  onRefresh,
}: CategoryModalProps) {
  if (!isOpen) return null;

  // Local state for categories so updates reflect instantly in modal
  const [categories, setCategories] = useState<Category[]>(initialCategories);

  // Sync if parent updates
  React.useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("🌿");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#EAF8F0");
  const [newImage, setNewImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit image for existing category
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState("");

  const newFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Helper to read local file as data URL
  const handleFileSelect = (file: File, callback: (dataUrl: string) => void) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP, SVG).");
      return;
    }
    // Max 4MB
    if (file.size > 4 * 1024 * 1024) {
      setError("Image file is too large (max 4MB). Please select a smaller image.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        callback(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newName.trim()) {
      setError("Category ID and Name are required.");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const categoryPayload: Partial<Category> = {
      id: newId.trim().toLowerCase().replace(/\s+/g, "-"),
      name: newName.trim(),
      emoji: newEmoji.trim() || "🌿",
      description: newDesc.trim(),
      color: newColor.trim() || "#EAF8F0",
      image: newImage.trim(),
      active: true,
      sortOrder: categories.length + 1,
    };

    try {
      const saved = await saveCategory(categoryPayload);

      setSuccess(`Category "${newName}" added successfully!`);
      setCategories((prev) => [...prev, saved]);
      setNewId("");
      setNewName("");
      setNewDesc("");
      setNewImage("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add category.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const ok = window.confirm(
      `"${cat.name}" category-ஐ delete பண்ணவா?\n\nஇந்த category-ல் உள்ள products இந்த category-ஐ reference பண்றதால் delete ஆகாது — முதலில் அந்த products-ஐ வேற category-க்கு மாத்துங்க.`
    );
    if (!ok) return;

    setDeletingId(cat.id);
    setError(null);
    setSuccess(null);

    try {
      await deleteCategory(cat.id);
      setSuccess(`Category "${cat.name}" deleted successfully.`);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      onRefresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete category. Make sure no products are using this category."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveImage = async (cat: Category) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const updatedCategory: Category = {
      ...cat,
      image: editingImageUrl.trim(),
    };

    try {
      const saved = await saveCategory(updatedCategory);
      setSuccess(`Image updated for "${cat.name}".`);
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, image: saved.image || editingImageUrl.trim() } : c))
      );
      setEditingImageId(null);
      setEditingImageUrl("");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update image.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">Manage Categories</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Categories dynamically organize the storefront and mobile app.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              ✓ {success}
            </div>
          )}

          {/* Add New Category Form */}
          <form onSubmit={handleAddCategory} className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
            <h3 className="text-xs font-bold text-[#00A651] uppercase tracking-wider flex items-center gap-1.5">
              <Plus size={14} /> Add New Category
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Category ID
                </label>
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="e.g. herbal-teas"
                  required
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Herbal Teas"
                  required
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Emoji Icon
                </label>
                <input
                  type="text"
                  value={newEmoji}
                  onChange={(e) => setNewEmoji(e.target.value)}
                  placeholder="🍵"
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-base text-center"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                  Badge Color
                </label>
                <div className="flex items-center gap-2 h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl">
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-full bg-transparent text-white text-xs font-mono outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Image URL / Upload field */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <ImageIcon size={11} /> Category Image / Icon
                </span>
                <span className="text-slate-500 normal-case font-normal text-[10px]">
                  (Optional — overrides emoji on website)
                </span>
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={newImage}
                  onChange={(e) => setNewImage(e.target.value)}
                  placeholder="Paste Image URL (e.g. Cloudinary, WebP, PNG) or upload file..."
                  className="flex-1 h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-[#00A651]"
                />

                <input
                  type="file"
                  ref={newFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file, (dataUrl) => setNewImage(dataUrl));
                  }}
                />

                <button
                  type="button"
                  onClick={() => newFileInputRef.current?.click()}
                  className="h-10 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Choose image file from computer"
                >
                  <Upload size={13} />
                  <span>Upload</span>
                </button>

                {newImage && (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-lg overflow-hidden border border-slate-700 flex-shrink-0"
                    style={{ background: newColor || "#EAF8F0" }}
                  >
                    <img
                      src={newImage}
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Short description (optional)..."
                className="flex-1 mr-3 h-10 px-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
              />
              <button
                type="submit"
                disabled={loading || !newId || !newName}
                className="h-10 px-4 bg-[#00A651] hover:bg-[#008f45] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save size={14} />
                <span>Save</span>
              </button>
            </div>
          </form>

          {/* Current Categories List */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Existing Categories ({categories.length})</span>
              <button
                onClick={onRefresh}
                className="text-[11px] text-[#00A651] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    {/* Category icon/image with Layered Fallback */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-xs flex-shrink-0 overflow-hidden relative"
                      style={{ background: c.color || "#EAF8F0" }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center select-none text-xl">
                        {c.emoji}
                      </span>
                      {c.image ? (
                        <img
                          src={c.image}
                          alt={c.name}
                          className="w-full h-full object-cover relative z-1"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white truncate">{c.name}</p>
                        {c.image ? (
                          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-medium">
                            Has Image
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono truncate">ID: {c.id}</p>
                      {c.image && (
                        <p className="text-[10px] text-blue-400 truncate mt-0.5 max-w-sm">
                          🖼 {c.image}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Edit image button */}
                      <button
                        onClick={() => {
                          setEditingImageId(c.id);
                          setEditingImageUrl(c.image || "");
                        }}
                        title="Set or change category image / icon"
                        className="h-8 px-2.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 hover:bg-blue-500/25 flex items-center gap-1.5 cursor-pointer transition-colors text-xs font-semibold"
                      >
                        <ImageIcon size={14} />
                        <span>{c.image ? "Change Image" : "Add Image"}</span>
                      </button>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteCategory(c)}
                        disabled={deletingId === c.id}
                        title="Delete category"
                        className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
                      >
                        {deletingId === c.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin inline-block" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Inline image editor */}
                  {editingImageId === c.id && (
                    <div className="mt-3 pt-3 border-t border-slate-700/60 bg-slate-900/60 p-3 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-bold text-slate-300 uppercase flex items-center gap-1">
                          <Edit3 size={11} /> Image for "{c.name}"
                        </label>
                        {c.image && (
                          <button
                            type="button"
                            onClick={() => setEditingImageUrl("")}
                            className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                          >
                            Remove Image (Use {c.emoji} Emoji)
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={editingImageUrl}
                          onChange={(e) => setEditingImageUrl(e.target.value)}
                          placeholder="Paste image URL (https://...) or click Upload"
                          className="flex-1 h-9 px-3 bg-slate-900 border border-blue-500/40 rounded-xl text-white text-xs focus:outline-none focus:border-blue-400"
                          autoFocus
                        />

                        <input
                          type="file"
                          ref={editFileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file, (dataUrl) => setEditingImageUrl(dataUrl));
                          }}
                        />

                        <button
                          type="button"
                          onClick={() => editFileInputRef.current?.click()}
                          className="h-9 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          title="Pick image from computer"
                        >
                          <Upload size={13} />
                          <span>Browse</span>
                        </button>

                        <button
                          onClick={() => handleSaveImage(c)}
                          disabled={loading}
                          className="h-9 px-3.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          <Check size={13} />
                          Save
                        </button>

                        <button
                          onClick={() => setEditingImageId(null)}
                          className="h-9 px-3 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-xl cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Live Preview */}
                      {editingImageUrl ? (
                        <div className="mt-2.5 flex items-center gap-3 p-2 bg-slate-950/40 rounded-lg border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-semibold">Preview:</span>
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden relative border border-slate-700"
                            style={{ background: c.color || "#EAF8F0" }}
                          >
                            <span className="absolute text-sm">{c.emoji}</span>
                            <img
                              src={editingImageUrl}
                              alt="preview"
                              className="w-full h-full object-cover relative z-1"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 truncate flex-1">
                            {editingImageUrl.startsWith("data:") ? "Local image file loaded" : editingImageUrl}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex justify-end">
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
