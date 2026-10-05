import { getAdminSupabaseClient } from "../lib/supabase";
import { getStoredToken } from "./api";

export interface GradientConfig {
  id: string;
  tag: string;
  title: string;
  subtitle: string;
  gradient: string;
  accent: string;
  targetCategory: string;
  chips: string[];
  previewCss: string;
}

export interface HeroBanner {
  id: string;
  name: string;
  bannerType: "image" | "gradient";
  imageUrl: string;
  gradientConfig?: GradientConfig;
  linkUrl: string;
  active: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

function mapRowToBanner(row: any): HeroBanner {
  return {
    id: row.id,
    name: row.name || "Banner",
    bannerType: row.banner_type === "gradient" ? "gradient" : "image",
    imageUrl: row.image_url || "",
    gradientConfig: row.gradient_config || undefined,
    linkUrl: row.link_url || "/products",
    active: row.active !== false,
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchBanners(): Promise<HeroBanner[]> {
  const supabase = getAdminSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("hero_banners")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    if (error.code === "42P01") {
      // Table doesn't exist yet
      console.warn("[BannerApi] hero_banners table not created yet. Run supabase/hero-banners.sql first.");
      return [];
    }
    throw new Error(`Failed to fetch banners: ${error.message}`);
  }

  return (data || []).map(mapRowToBanner);
}

export async function saveBanner(banner: Partial<HeroBanner>): Promise<HeroBanner> {
  const supabase = getAdminSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const id = banner.id || `banner_${Date.now().toString(36)}`;
  const payload: any = {
    id,
    name: banner.name || "New Banner",
    banner_type: banner.bannerType || "image",
    image_url: banner.imageUrl || "",
    link_url: banner.linkUrl || "/products",
    active: banner.active !== false,
    sort_order: banner.sortOrder ?? 0,
    updated_at: new Date().toISOString(),
  };

  // Only write gradient_config for gradient banners
  if (banner.bannerType === "gradient" && banner.gradientConfig) {
    payload.gradient_config = banner.gradientConfig;
  }

  const { data, error } = await supabase
    .from("hero_banners")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();

  if (error) throw new Error(`Failed to save banner: ${error.message}`);
  return data ? mapRowToBanner(data) : ({ ...banner, id } as HeroBanner);
}

export async function deleteBanner(id: string): Promise<void> {
  const supabase = getAdminSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { error } = await supabase
    .from("hero_banners")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Failed to delete banner: ${error.message}`);
}

export async function toggleBannerActive(id: string, active: boolean): Promise<HeroBanner> {
  const supabase = getAdminSupabaseClient();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase
    .from("hero_banners")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to toggle banner: ${error.message}`);
  return mapRowToBanner(data);
}

export async function updateBannerOrder(id: string, sortOrder: number): Promise<void> {
  const supabase = getAdminSupabaseClient();
  if (!supabase) return;
  await supabase
    .from("hero_banners")
    .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function uploadBannerImage(
  base64OrUrl: string,
  bannerId?: string
): Promise<string> {
  if (base64OrUrl.startsWith("http://") || base64OrUrl.startsWith("https://")) {
    return base64OrUrl;
  }

  try {
    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getStoredToken() || "shreehari_admin_secure_2026"}`,
        "x-admin-key": "shreehari_admin_secure_2026",
      },
      body: JSON.stringify({
        image: base64OrUrl,
        imageName: `banner_${bannerId || Date.now()}`,
        productId: bannerId,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.imageUrl) return data.imageUrl;
    }
  } catch (e) {
    console.warn("[BannerApi] Upload endpoint unavailable, using data URI:", e);
  }

  if (base64OrUrl.startsWith("data:image/")) return base64OrUrl;
  throw new Error("Invalid image format. Please provide an image file or valid URL.");
}
