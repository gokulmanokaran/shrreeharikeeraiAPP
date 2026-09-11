import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, Plus, Trash2 } from "lucide-react";
import { Product, Category, ProductVariant } from "../types";

interface ProductFormModalProps {
  product: Product | null; // null means "create new"
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Partial<Product>) => Promise<void>;
}

export function ProductFormModal({
  product,
  categories,
  isOpen,
  onClose,
  onSave,
}: ProductFormModalProps) {
  const isEdit = Boolean(product);

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [nameTamil, setNameTamil] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [unit, setUnit] = useState("250g");
  const [quantity, setQuantity] = useState("250g");
  const [category, setCategory] = useState("keerai");
  const [secondaryCategory, setSecondaryCategory] = useState("");
  const [image, setImage] = useState("");
  const [inStock, setInStock] = useState(true);
  const [stockQuantity, setStockQuantity] = useState<number | undefined>(undefined);
  const [featured, setFeatured] = useState(false);
  const [active, setActive] = useState(true);
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [note, setNote] = useState("");
  const [variantType, setVariantType] = useState<"weight" | "sugar" | "none">("none");
  const [variants, setVariants] = useState<ProductVariant[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      setId(product.id);
      setName(product.name || "");
      setNameTamil(product.nameTamil || product.tamilName || "");
      setPrice(product.price || 0);
      setMrp(product.mrp || product.price || 0);
      setUnit(product.unit || "250g");
      setQuantity(product.quantity || product.unit || "250g");
      setCategory(product.category || "keerai");
      setSecondaryCategory(product.secondaryCategory || "");
      setImage(product.image || "");
      setInStock(product.inStock !== false);
      setStockQuantity(product.stockQuantity);
      setFeatured(Boolean(product.featured));
      setActive(product.active !== false);
      setDescription(product.description || "");
      setShortDescription(product.shortDescription || "");
      setNote(product.note || "");
      setVariantType(product.variantType || "none");
      setVariants(product.variants ? [...product.variants] : []);
    } else {
      // New product defaults
      setId(`prod_${Date.now().toString(36)}`);
      setName("");
      setNameTamil("");
      setPrice(49);
      setMrp(55);
      setUnit("250g Cleaned Pack");
      setQuantity("250g");
      setCategory(categories[0]?.id || "keerai");
      setSecondaryCategory("");
      setImage("");
      setInStock(true);
      setStockQuantity(25);
      setFeatured(false);
      setActive(true);
      setDescription("");
      setShortDescription("");
      setNote("");
      setVariantType("none");
      setVariants([]);
    }
    setError(null);
  }, [product, categories, isOpen]);

  if (!isOpen) return null;

  const handleAddVariant = () => {
    setVariants([
      ...variants,
      {
        id: `${id || "var"}_${Date.now()}`,
        unit: "500g",
        price: price * 2,
        inStock: true,
      },
    ]);
  };

  const handleRemoveVariant = (idx: number) => {
    setVariants(variants.filter((_, i) => i !== idx));
  };

  const handleVariantChange = (idx: number, field: keyof ProductVariant, val: unknown) => {
    const updated = [...variants];
    updated[idx] = { ...updated[idx], [field]: val };
    setVariants(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Product English Name is required.");
      return;
    }
    if (price <= 0) {
      setError("Price must be greater than 0.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Partial<Product> = {
        id: id.trim(),
        name: name.trim(),
        nameTamil: nameTamil.trim(),
        tamilName: nameTamil.trim(),
        price: Number(price),
        mrp: Number(mrp) || Number(price),
        unit: unit.trim(),
        quantity: quantity.trim() || unit.trim(),
        category,
        secondaryCategory: secondaryCategory.trim() || undefined,
        image: image.trim(),
        inStock,
        stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : undefined,
        featured,
        active,
        description: description.trim(),
        shortDescription: shortDescription.trim(),
        note: note.trim(),
        variantType: variantType === "none" ? undefined : variantType,
        variants: variants.length > 0 ? variants : undefined,
        updatedAt: new Date().toISOString(),
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">
              {isEdit ? `Edit Product: ${product?.name}` : "Create New Product"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Changes will update Central API, Storefront, and future Android app instantly.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product ID */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Product ID (Unique Key)
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                disabled={isEdit}
                required
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00A651] disabled:opacity-50 font-mono"
              />
            </div>

            {/* Categories (Primary & Secondary) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Primary Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00A651]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Secondary Category (2nd பிரிவு)</span>
                  <span className="text-[10px] text-slate-500 font-normal">Optional</span>
                </label>
                <select
                  value={secondaryCategory}
                  onChange={(e) => setSecondaryCategory(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00A651]"
                >
                  <option value="">-- None (எதுவுமில்லை) --</option>
                  {categories
                    .filter((c) => c.id !== category)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Name (English) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Product Name (English) *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Ponnangani Keerai"
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00A651]"
              />
            </div>

            {/* Name (Tamil) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Tamil Name (தமிழ் பெயர்)
              </label>
              <input
                type="text"
                value={nameTamil}
                onChange={(e) => setNameTamil(e.target.value)}
                placeholder="e.g. பொன்னாங்கண்ணி கீரை"
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-[#00A651] font-semibold text-sm focus:outline-none focus:border-[#00A651]"
              />
            </div>
          </div>

          {/* Pricing & Unit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Price */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Selling Price (₹) *
              </label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
                min="0"
                step="1"
                required
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-mono text-base focus:outline-none focus:border-[#00A651]"
              />
              <p className="text-[11px] text-slate-400 mt-1">Actual price charged to customer</p>
            </div>

            {/* MRP */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                MRP (₹) (Optional)
              </label>
              <input
                type="number"
                value={mrp || ""}
                onChange={(e) => setMrp(e.target.value ? Math.max(0, Number(e.target.value)) : 0)}
                min="0"
                step="1"
                placeholder="e.g. 60"
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-slate-200 font-mono text-base focus:outline-none focus:border-[#00A651]"
              />
              {mrp > price ? (
                <p className="text-[11px] text-emerald-400 font-semibold mt-1">
                  Save ₹{mrp - price} ({Math.round(((mrp - price) / mrp) * 100)}% OFF)
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Shown crossed out when &gt; Selling Price</p>
              )}
            </div>

            {/* Unit */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Unit / Quantity Label *
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                required
                placeholder="e.g. 250g Cleaned Pack"
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00A651]"
              />
              <p className="text-[11px] text-slate-400 mt-1">e.g. 250g, 500g, 1 Bundle</p>
            </div>
          </div>

          {/* Image & Stock */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Image URL */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Image Path / URL
              </label>
              <input
                type="text"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="/product-images/Almond.webp"
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00A651]"
              />
            </div>

            {/* Stock Quantity */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Stock Quantity (Units)</span>
                {stockQuantity !== undefined && (
                  <span className={`text-[11px] font-mono font-bold ${stockQuantity > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {stockQuantity > 0 ? `${stockQuantity} in stock` : "0 (Out of stock)"}
                  </span>
                )}
              </label>
              <input
                type="number"
                value={stockQuantity ?? ""}
                onChange={(e) => {
                  if (!e.target.value && e.target.value !== "0") {
                    setStockQuantity(undefined);
                  } else {
                    const val = Math.max(0, Number(e.target.value));
                    setStockQuantity(val);
                    if (val === 0) {
                      setInStock(false);
                    } else if (val > 0) {
                      setInStock(true);
                    }
                  }
                }}
                min="0"
                step="1"
                placeholder="e.g. 20"
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-[#00A651]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Auto-deducted after customer orders. When 0, marked Out of Stock.
              </p>
            </div>
          </div>

          {/* Status Switches */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
            {/* In Stock */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setInStock(checked);
                  if (!checked && stockQuantity && stockQuantity > 0) {
                    setStockQuantity(0);
                  } else if (checked && (stockQuantity === 0 || stockQuantity === undefined)) {
                    setStockQuantity(20);
                  }
                }}
                className="w-5 h-5 rounded text-[#00A651] focus:ring-0 focus:outline-none bg-slate-800 border-slate-700 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200">
                {inStock ? "✓ In Stock" : "✗ Out of Stock"}
              </span>
            </label>

            {/* Featured */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="w-5 h-5 rounded text-amber-500 focus:ring-0 focus:outline-none bg-slate-800 border-slate-700 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200">Featured</span>
            </label>

            {/* Active */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-5 h-5 rounded text-blue-500 focus:ring-0 focus:outline-none bg-slate-800 border-slate-700 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200">Active</span>
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Fresh farm description..."
              className="w-full p-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-[#00A651]"
            />
          </div>

          {/* Variants Section */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Product Variants (Weight / Sugar Options)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Optional sub-sizes (e.g. 500g, 1L, Without Sugar)
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddVariant}
                className="flex items-center gap-1 text-xs font-bold text-[#00A651] hover:underline cursor-pointer"
              >
                <Plus size={14} /> Add Variant
              </button>
            </div>

            {variants.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400">Variant Mode:</span>
                  <select
                    value={variantType}
                    onChange={(e) => setVariantType(e.target.value as "weight" | "sugar" | "none")}
                    className="h-8 px-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  >
                    <option value="weight">Weight Options</option>
                    <option value="sugar">Sugar / Drink Options</option>
                    <option value="none">Custom</option>
                  </select>
                </div>

                {variants.map((v, i) => (
                  <div
                    key={v.id || i}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60"
                  >
                    <input
                      type="text"
                      value={v.unit}
                      onChange={(e) => handleVariantChange(i, "unit", e.target.value)}
                      placeholder="e.g. 500g"
                      className="h-9 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white flex-1"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">₹</span>
                      <input
                        type="number"
                        value={v.price}
                        onChange={(e) => handleVariantChange(i, "price", Number(e.target.value))}
                        placeholder="Price"
                        className="w-20 h-9 px-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono"
                      />
                    </div>
                    <label className="flex items-center gap-1 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={v.inStock !== false}
                        onChange={(e) => handleVariantChange(i, "inStock", e.target.checked)}
                        className="w-4 h-4 rounded text-[#00A651] bg-slate-900 border-slate-700"
                      />
                      <span>In Stock</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariant(i)}
                      className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center cursor-pointer ml-auto"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-[#00A651] hover:bg-[#008f45] text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#00A651]/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={16} />
                  <span>{isEdit ? "Save Changes" : "Create Product"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
