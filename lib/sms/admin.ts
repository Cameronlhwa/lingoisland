import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

export function getSmsSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are not configured");
  }

  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdmin;
}
