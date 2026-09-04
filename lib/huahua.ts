/**
 * Shared 华华 island progression helpers.
 * Used by every API route that records a card review.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const STAGE_THRESHOLDS = [0, 10, 20, 30, 40] as const
export const STAGE_NAMES = ["Bare Island", "Foundation", "Village", "Town", "Thriving City"] as const
export const STAGE_EMOJIS = ["🏜️", "🏗️", "🏘️", "🏙️", "🌆"] as const

export function stageForDailyReviews(reviews: number): number {
  if (reviews >= 40) return 5
  if (reviews >= 30) return 4
  if (reviews >= 20) return 3
  if (reviews >= 10) return 2
  return 1
}

/** UTC date string for "today", e.g. '2026-04-01' */
export function utcDateString(date = new Date()): string {
  return date.toISOString().split('T')[0]
}

export type HuahuaResult = {
  huahuaReviewsToday: number
  huahuaStage: number
}

/**
 * Increment 华华 progress for a user by `count` reviews.
 * Prefers the daily-reset columns (huahua_reviews_today / huahua_last_review_date) when
 * available. Falls back to the cumulative huahua_total_reviews column if those columns
 * do not exist yet (i.e. the huahua_daily_reset migration has not been applied).
 *
 * Safe to call even if migrations are partially applied — errors are logged,
 * not thrown, so the primary grade/review call still succeeds.
 */
export async function incrementHuahua(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  count = 1,
): Promise<HuahuaResult> {
  const today = utcDateString()

  // Try the full daily-reset query first.
  const { data: profile, error: readErr } = await supabase
    .from('user_profiles')
    .select('huahua_reviews_today, huahua_last_review_date, huahua_total_reviews, huahua_stage')
    .eq('user_id', userId)
    .maybeSingle()

  if (readErr) {
    // Columns may not exist yet — fall back to the pre-daily-reset columns.
    console.warn('[huahua] read error — falling back to huahua_total_reviews:', readErr.message)
    return incrementHuahuaFallback(supabase, userId, count)
  }

  // Reset daily counter when the UTC date has changed.
  const prevReviews =
    profile?.huahua_last_review_date === today
      ? (profile?.huahua_reviews_today ?? 0)
      : 0

  const newReviewsToday = prevReviews + count
  const newTotal = (profile?.huahua_total_reviews ?? 0) + count
  const newStage = stageForDailyReviews(newReviewsToday)

  const { error: writeErr } = await supabase
    .from('user_profiles')
    .upsert(
      {
        user_id: userId,
        huahua_reviews_today: newReviewsToday,
        huahua_last_review_date: today,
        huahua_total_reviews: newTotal,
        huahua_stage: newStage,
      },
      { onConflict: 'user_id' },
    )

  if (writeErr) {
    // If the write still fails (e.g. daily-reset columns missing), try the fallback.
    console.warn('[huahua] write error — falling back to huahua_total_reviews:', writeErr.message)
    return incrementHuahuaFallback(supabase, userId, count)
  }

  return { huahuaReviewsToday: newReviewsToday, huahuaStage: newStage }
}

/**
 * Fallback for when the huahua_daily_reset migration (huahua_reviews_today /
 * huahua_last_review_date columns) has not been applied yet.
 * Uses huahua_total_reviews as the progress counter — stages advance cumulatively
 * rather than resetting each day.
 */
async function incrementHuahuaFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  count: number,
): Promise<HuahuaResult> {
  const { data: profile, error: readErr } = await supabase
    .from('user_profiles')
    .select('huahua_total_reviews, huahua_stage')
    .eq('user_id', userId)
    .maybeSingle()

  if (readErr) {
    console.error('[huahua] fallback read error:', readErr.message)
    return { huahuaReviewsToday: 0, huahuaStage: 1 }
  }

  const prevTotal = profile?.huahua_total_reviews ?? 0
  const newTotal = prevTotal + count
  const newStage = stageForDailyReviews(newTotal)

  const { error: writeErr } = await supabase
    .from('user_profiles')
    .upsert(
      { user_id: userId, huahua_total_reviews: newTotal, huahua_stage: newStage },
      { onConflict: 'user_id' },
    )

  if (writeErr) {
    console.error('[huahua] fallback write error:', writeErr.message)
  }

  return { huahuaReviewsToday: newTotal, huahuaStage: newStage }
}

/**
 * Read today's 华华 progress for a user (client-safe — no writes).
 * Falls back to huahua_total_reviews when the daily-reset columns are missing.
 * Returns { huahuaReviewsToday: 0, huahuaStage: 1 } if the row is missing.
 */
export async function readHuahua(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
): Promise<HuahuaResult> {
  const today = utcDateString()

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('huahua_reviews_today, huahua_last_review_date, huahua_total_reviews, huahua_stage')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    // Try fallback without daily-reset columns.
    const { data: fb } = await supabase
      .from('user_profiles')
      .select('huahua_total_reviews, huahua_stage')
      .eq('user_id', userId)
      .maybeSingle()
    const total = fb?.huahua_total_reviews ?? 0
    const stage = fb?.huahua_stage ?? stageForDailyReviews(total)
    return { huahuaReviewsToday: total, huahuaStage: stage }
  }

  // Prefer daily counter when available; fall back to total reviews.
  const isToday = profile?.huahua_last_review_date === today
  if (profile?.huahua_reviews_today != null) {
    const reviews = isToday ? (profile.huahua_reviews_today ?? 0) : 0
    const stage = isToday ? (profile?.huahua_stage ?? stageForDailyReviews(reviews)) : 1
    return { huahuaReviewsToday: reviews, huahuaStage: stage }
  }

  // Daily columns not in response — use total reviews.
  const total = profile?.huahua_total_reviews ?? 0
  const stage = profile?.huahua_stage ?? stageForDailyReviews(total)
  return { huahuaReviewsToday: total, huahuaStage: stage }
}
