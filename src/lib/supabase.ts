import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Supabase Project Credentials with built-in fallbacks for zero-config production deployment
const DEFAULT_SUPABASE_URL = "https://wmzevbfhziroffoyxkxf.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtemV2YmZoemlyb2Zmb3l4a3hmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjIzMzMsImV4cCI6MjEwNDY5ODMzM30.LyuXzyiUQKWf397A9bAUyoNQehZQbcuAYKoniKAX4Vw";

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
