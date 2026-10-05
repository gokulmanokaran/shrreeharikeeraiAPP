import { useState, useEffect } from "react";
import { getSupabaseClient } from "../lib/supabase";

export interface GradientBannerConfig {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  gradient: string;   // Tailwind class string e.g. "from-[#00A651] via-[#087A43] to-[#065A31]"
  accent: string;
  targetCategory: string;
  chips: string[];
  previewCss: string; // CSS linear-gradient for admin preview
}

export interface HeroBannerData {
  id: string;
  name: string;
  bannerType: "image" | "gradient";
  imageUrl: string;
  gradientConfig?: GradientBannerConfig;
  linkUrl: string;
  sortOrder: number;
}

/**
 * Fetches active hero banners from Supabase (both gradient and image types).
 * Returns empty array if the table doesn't exist yet — PromoCarousel then shows
 * the local DEFAULT_BANNERS hardcoded fallback.
 */
export function useHeroBanners() {
  const [banners, setBanners] = useState<HeroBannerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) { setLoading(false); return; }

        const { data, error } = await supabase
          .from("hero_banners")
          .select("id, name, banner_type, image_url, gradient_config, link_url, sort_order")
          .eq("active", true)
          .order("sort_order", { ascending: true });

        if (cancelled) return;

        if (error) {
          // Table doesn't exist yet — PromoCarousel falls back to hardcoded banners
          console.warn("[useHeroBanners] hero_banners table not available:", error.message);
          setBanners([]);
        } else {
          const mapped: HeroBannerData[] = (data || []).map((row: any) => ({
            id: row.id,
            name: row.name || "Banner",
            bannerType: row.banner_type === "gradient" ? "gradient" : "image",
            imageUrl: row.image_url || "",
            gradientConfig: row.gradient_config || undefined,
            linkUrl: row.link_url || "/products",
            sortOrder: Number(row.sort_order) || 0,
          }));
          setBanners(mapped);
        }
      } catch {
        if (!cancelled) setBanners([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { banners, loading };
}
