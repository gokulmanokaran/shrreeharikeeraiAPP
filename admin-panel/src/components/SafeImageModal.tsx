import React, { useState } from "react";
import { X, Upload, CheckCircle2, AlertCircle, Image as ImageIcon, ArrowRight, ShieldCheck } from "lucide-react";
import { Product } from "../types";
import { uploadProductImage, updateProduct } from "../services/api";

interface SafeImageModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedProduct: Product) => void;
}

export function SafeImageModal({
  product,
  isOpen,
  onClose,
  onSuccess,
}: SafeImageModalProps) {
  if (!isOpen || !product) return null;

  const [mode, setMode] = useState<"file" | "url">("file");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [step, setStep] = useState<"idle" | "uploading" | "linking" | "success" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const oldImageUrl = product.image || "/favicon.svg";

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (PNG, JPG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("File size must be under 5MB.");
      return;
    }

    setFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteSafeReplacement = async () => {
    const candidateImage = mode === "file" ? fileData : customUrl.trim();

    if (!candidateImage) {
      setErrorMsg("Please select an image file or enter an image URL.");
      return;
    }

    setErrorMsg(null);
    setStep("uploading");
    setStatusMsg("Step 1/3: Uploading & verifying new image payload...");

    try {
      // 1. Upload & verify new image
      const uploadRes = await uploadProductImage(candidateImage, fileName, product.id);
      if (!uploadRes.imageUrl) {
        throw new Error("Upload verification failed: No valid image URL returned.");
      }

      setStep("linking");
      setStatusMsg("Step 2/3: Linking new verified image to product catalog...");

      // 2. Update product record with new verified image
      const updated = await updateProduct({
        id: product.id,
        image: uploadRes.imageUrl,
        updatedAt: new Date().toISOString(),
      });

      setStep("success");
      setStatusMsg("Step 3/3: Replacement confirmed! Old image unlinked safely.");

      setTimeout(() => {
        onSuccess(updated);
        onClose();
      }, 1400);
    } catch (err) {
      setStep("error");
      setErrorMsg(
        err instanceof Error
          ? `Safe replacement aborted: ${err.message}. (Old image preserved safely)`
          : "Image upload failed. Old image was kept intact."
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl my-8">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00A651]/20 border border-[#00A651]/30 text-[#00A651] flex items-center justify-center">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Safe Image Replacement</h2>
              <p className="text-xs text-slate-400">
                Product: <strong className="text-slate-200">{product.name}</strong>
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

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Safety Rule Note */}
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-start gap-3 text-xs text-emerald-300">
            <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>
              <strong>Safe Replacement Protocol:</strong> The new image is uploaded and verified
              first before updating the product. The old image is preserved if any step fails.
            </p>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs">
              <AlertCircle size={18} className="flex-shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Comparison Preview */}
          <div className="grid grid-cols-2 gap-4">
            {/* Old Current Image */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                Current Image
              </span>
              <div className="w-full h-32 rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center border border-slate-800 mb-2">
                <img
                  src={oldImageUrl}
                  alt="Current"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/favicon.svg";
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-500 font-mono truncate">
                {product.image || "No image"}
              </p>
            </div>

            {/* New Candidate Image */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#00A651] block mb-2">
                New Preview
              </span>
              <div className="w-full h-32 rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center border border-dashed border-[#00A651]/40 mb-2">
                {fileData || customUrl ? (
                  <img
                    src={fileData || customUrl}
                    alt="New Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-slate-600 flex flex-col items-center gap-1">
                    <ImageIcon size={24} />
                    <span className="text-[10px]">Select image below</span>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {fileName || (customUrl ? "Custom URL" : "None chosen")}
              </p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="flex gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === "file"
                  ? "bg-[#00A651] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Upload Local File (WebP / JPG / PNG)
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === "url"
                  ? "bg-[#00A651] text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Enter External / Cloud URL
            </button>
          </div>

          {/* Upload Input */}
          {mode === "file" ? (
            <div className="border-2 border-dashed border-slate-700 hover:border-[#00A651] rounded-2xl p-6 text-center transition-colors">
              <input
                type="file"
                id="file-upload"
                accept="image/png, image/jpeg, image/webp, image/jpg"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center">
                  <Upload size={20} />
                </div>
                <span className="text-xs font-bold text-white">
                  {fileName ? "Click to change file" : "Click to select new image"}
                </span>
                <span className="text-[11px] text-slate-500">
                  Supports WebP, PNG, JPG up to 5MB
                </span>
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Paste Image URL
              </label>
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://images.example.com/product.webp or /product-images/..."
                className="w-full h-11 px-3.5 bg-slate-800/80 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-[#00A651]"
              />
            </div>
          )}

          {/* Progress / Status display */}
          {step !== "idle" && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
                step === "success"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : step === "error"
                  ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  : "bg-blue-500/10 text-blue-300 border-blue-500/30"
              }`}
            >
              {step === "success" ? (
                <CheckCircle2 size={16} />
              ) : step === "error" ? (
                <AlertCircle size={16} />
              ) : (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              <span>{statusMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExecuteSafeReplacement}
            disabled={(!fileData && !customUrl) || step === "uploading" || step === "linking"}
            className="px-6 py-2.5 rounded-xl bg-[#00A651] hover:bg-[#008f45] text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#00A651]/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {step === "uploading" || step === "linking" ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Execute Safe Replacement</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
