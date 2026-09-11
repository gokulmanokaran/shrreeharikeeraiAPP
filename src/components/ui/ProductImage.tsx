import { Leaf } from "lucide-react";
import { useState, useMemo } from "react";

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  aspectRatio?: "square" | "4/3" | "3/2";
  priority?: boolean;
}

const GRADIENT_PALETTES = [
  { from: "#EAF8F0", to: "#D4F1E4", icon: "#00A651" },
  { from: "#FFF8E7", to: "#FFE9B8", icon: "#D4A017" },
  { from: "#FFF0F0", to: "#FFD9D9", icon: "#E05050" },
  { from: "#F0F8FF", to: "#D6ECFF", icon: "#3B82F6" },
  { from: "#FAF0FF", to: "#EDD6FF", icon: "#9B59B6" },
];

export function ProductImage({
  src,
  alt,
  className = "",
  aspectRatio = "square",
  priority = false,
}: ProductImageProps) {
  const [imgError, setImgError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const aspectClass =
    aspectRatio === "4/3"
      ? "aspect-[4/3]"
      : aspectRatio === "3/2"
      ? "aspect-[3/2]"
      : "aspect-square";

  // Derive WebP alternative path if available and URI-encode for srcset validity
  const safeSrc = useMemo(() => {
    if (!src) return "";
    // If it's already encoded or data URI, keep as is; otherwise encodeURI
    if (src.startsWith("data:") || src.startsWith("blob:")) return src;
    try {
      return encodeURI(decodeURI(src));
    } catch {
      return encodeURI(src);
    }
  }, [src]);

  const safeWebpSrc = useMemo(() => {
    if (!src) return undefined;
    if (src.startsWith("data:") || src.startsWith("blob:")) return undefined;
    const webpPath = src.replace(/\.(png|jpg|jpeg)$/i, ".webp");
    try {
      return encodeURI(decodeURI(webpPath));
    } catch {
      return encodeURI(webpPath);
    }
  }, [src]);

  // Consistent palette fallback
  const paletteIndex =
    alt.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
    GRADIENT_PALETTES.length;
  const palette = GRADIENT_PALETTES[paletteIndex];

  if (src && !imgError) {
    return (
      <div className={`relative ${aspectClass} overflow-hidden bg-[#F4F9F6] ${className}`}>
        {/* Shimmer skeleton while image loads */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-[#F4FAF6] animate-pulse flex items-center justify-center pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-[#EAF8F0] flex items-center justify-center opacity-70">
              <Leaf size={14} className="text-[#00A651]/40" />
            </div>
          </div>
        )}

        <picture className="w-full h-full">
          {safeWebpSrc && <source srcSet={safeWebpSrc} type="image/webp" />}
          <img
            src={safeSrc}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            onLoad={() => setIsLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-opacity duration-200 ${
              isLoaded ? "opacity-100" : "opacity-0"
            }`}
          />
        </picture>
      </div>
    );
  }

  // Premium Fallback Placeholder
  return (
    <div
      className={`${aspectClass} flex items-center justify-center relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
      aria-label={`Image placeholder for ${alt}`}
    >
      <div
        className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full opacity-30"
        style={{ background: palette.icon }}
      />
      <div
        className="absolute -top-3 -left-3 w-12 h-12 rounded-full opacity-20"
        style={{ background: palette.icon }}
      />
      <div className="relative z-10 flex flex-col items-center gap-1">
        <Leaf
          size={28}
          strokeWidth={1.5}
          style={{ color: palette.icon }}
          className="opacity-70"
        />
      </div>
    </div>
  );
}
