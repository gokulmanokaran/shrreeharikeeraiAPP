import { createClient, SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://wmzevbfhziroffoyxkxf.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtemV2YmZoemlyb2Zmb3l4a3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjIzMzMsImV4cCI6MjEwNDY5ODMzM30.LyuXzyiUQKWf397A9bAUyoNQehZQbcuAYKoniKAX4Vw";
const DEFAULT_SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtemV2YmZoemlyb2Zmb3l4a3hmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTEyMjMzMywiZXhwIjoyMTA0Njk4MzMzfQ.pLslXyHLL9tSX9ox3sNHgyaCh50S5jjT0y1EDoxBggU";

const CUSTOM_URL_KEY = "shk_custom_supabase_url";
const CUSTOM_KEY_KEY = "shk_custom_supabase_key";

let _adminSupabaseClient: SupabaseClient | null = null;

export function getAdminSupabaseConfig(): { url: string; key: string } {
  let url = "";
  let key = "";

  try {
    url = localStorage.getItem(CUSTOM_URL_KEY) || "";
    key = localStorage.getItem(CUSTOM_KEY_KEY) || "";
    // Clean up any stale old Supabase project URL from local cache
    if (url && url.includes("wgcfkijbgnokeoolajwz")) {
      localStorage.removeItem(CUSTOM_URL_KEY);
      localStorage.removeItem(CUSTOM_KEY_KEY);
      url = "";
      key = "";
    }
  } catch {
    // ignore
  }

  if (!url) {
    url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  }
  if (!key) {
    key =
      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      import.meta.env.VITE_SUPABASE_ANON_KEY ||
      DEFAULT_SUPABASE_SERVICE_KEY ||
      DEFAULT_SUPABASE_ANON_KEY;
  }

  return { url: url.trim(), key: key.trim() };
}

export function setCustomAdminSupabaseConfig(url: string | null, key: string | null): void {
  try {
    if (url && url.trim()) {
      localStorage.setItem(CUSTOM_URL_KEY, url.trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem(CUSTOM_URL_KEY);
    }

    if (key && key.trim()) {
      localStorage.setItem(CUSTOM_KEY_KEY, key.trim());
    } else {
      localStorage.removeItem(CUSTOM_KEY_KEY);
    }
  } catch {
    // ignore
  }
  _adminSupabaseClient = null; // force re-initialization
}

export function getAdminSupabaseClient(): SupabaseClient | null {
  if (_adminSupabaseClient) return _adminSupabaseClient;

  const { url, key } = getAdminSupabaseConfig();

  if (url && key) {
    try {
      _adminSupabaseClient = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
      return _adminSupabaseClient;
    } catch (err) {
      console.warn("[AdminSupabase] Failed to initialize Supabase client:", err);
    }
  }

  return null;
}
