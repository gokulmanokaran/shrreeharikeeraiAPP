import { createClient, SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://wgcfkijbgnokeoolajwz.supabase.co";
const DEFAULT_SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnY2ZraWpiZ25va2Vvb2xhand6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMxMTk5MiwiZXhwIjoyMTAyODg3OTkyfQ.vODVW6mMX3Ld2ux4SaVmIJVH8meh2BDnXaEubmOiDLk";

let _supabaseServerClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  if (_supabaseServerClient) return _supabaseServerClient;

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_SERVICE_KEY;

  if (url && key) {
    try {
      _supabaseServerClient = createClient(url, key, {
        auth: { persistSession: false },
      });
      return _supabaseServerClient;
    } catch (err) {
      console.warn("[Supabase Server] Initialization error:", err);
    }
  }

  return null;
}
