import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DEFAULT_DAILY_CAP = 60;

function dailyCap() {
  const configured = Number(process.env.PRONUNCIATION_DAILY_CALL_CAP);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_CAP;
}

/**
 * Atomically increments today's SpeechSuper call count for userId and checks
 * it against the daily cap. Call this before every paid SpeechSuper request.
 * The underlying increment_pronunciation_usage() DB function is a single
 * insert-on-conflict, so concurrent requests from the same user (double-tap,
 * two tabs) can't race past the cap.
 */
export async function checkAndIncrementUsage(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<{ ok: boolean; count: number; cap: number }> {
  const cap = dailyCap();
  const { data, error } = await supabase.rpc("increment_pronunciation_usage", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[pronunciation] rate limit check failed", error);
    // Fail closed: if we can't verify usage, don't let the paid call through.
    return { ok: false, count: cap, cap };
  }

  const count = Number(data ?? 0);
  return { ok: count <= cap, count, cap };
}
