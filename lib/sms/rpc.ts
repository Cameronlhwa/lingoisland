import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * All SMS data access goes through `sms_*` Postgres functions that return
 * jsonb. Keeping the surface to one call shape lets tests run the real SQL
 * against an in-process Postgres instead of mocking Supabase.
 */
export type SmsRpc = <T = Record<string, unknown>>(
  fn: string,
  args: Record<string, unknown>,
) => Promise<T>;

export function createSupabaseSmsRpc(client: SupabaseClient): SmsRpc {
  return async <T,>(fn: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      throw new Error(`SMS database call ${fn} failed: ${error.message}`);
    }
    return data as T;
  };
}
