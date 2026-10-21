import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { dateKeyInTimeZone, isValidTimeZone } from "@/lib/utils/date";

export const TIMEZONE_COOKIE = "lingo_timezone";

type TimeZoneLookup =
  | { status: "ready"; timeZone: string | null }
  | { status: "unavailable" };

function normalizeTimeZone(value: unknown) {
  return typeof value === "string" && isValidTimeZone(value) ? value : null;
}

export async function lookupUserTimeZone(
  supabase: SupabaseClient,
  userId: string,
): Promise<TimeZoneLookup> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return { status: "ready", timeZone: null };
    return { status: "unavailable" };
  }

  return { status: "ready", timeZone: normalizeTimeZone(data?.timezone) };
}

async function cookieTimeZone() {
  const cookieStore = await cookies();
  return normalizeTimeZone(cookieStore.get(TIMEZONE_COOKIE)?.value);
}

/** Saved profile zone. A cookie covers the gap before the column is filled in. */
export async function resolveUserTimeZone(
  supabase: SupabaseClient,
  userId: string,
) {
  const lookup = await lookupUserTimeZone(supabase, userId);
  if (lookup.status === "ready" && lookup.timeZone) return lookup.timeZone;
  return cookieTimeZone();
}

export async function resolveStoryDateKey(
  supabase: SupabaseClient,
  userId: string,
) {
  const timeZone = await resolveUserTimeZone(supabase, userId);
  return { dateKey: dateKeyInTimeZone(timeZone), timeZone };
}
