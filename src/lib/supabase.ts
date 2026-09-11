import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase Project Credentials with built-in fallbacks for zero-config production deployment
const DEFAULT_SUPABASE_URL = "https://wgcfkijbgnokeoolajwz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnY2ZraWpiZ25va2Vvb2xhand6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMTE5OTIsImV4cCI6MjEwMjg4Nzk5Mn0.TmVXV3GkBIIWkeDRv6ywwfIOu7N5c-UJ8lQfqd_IFGE";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

let _supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      _supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: "shreehari-customer-auth",
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });
      return _supabaseClient;
    } catch (err) {
      console.warn("[Supabase] Failed to initialize client:", err);
    }
  }

  return null;
}

export const supabase = getSupabaseClient();
