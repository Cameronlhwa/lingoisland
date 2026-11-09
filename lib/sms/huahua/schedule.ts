// Scheduling for proactive openers. Every function takes `now` explicitly so
// tests can inject a clock; all local-time math goes through Intl, which
// handles DST transitions.

export type DeliveryWindow = { start: number; end: number };

/** Proactive texts only between 8:00 and 21:00 local time. */
export const QUIET_HOURS_END = 8 * 60;
export const QUIET_HOURS_START = 21 * 60;

export const DEFAULT_WINDOWS: DeliveryWindow[] = [{ start: 18 * 60, end: 21 * 60 }];

export const FREQUENCY_TIERS = [5, 3, 2, 1] as const;

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const COUNTRY_TIME_ZONES: Record<string, string> = {
  CA: "America/Toronto",
  US: "America/New_York",
  GB: "Europe/London",
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  SG: "Asia/Singapore",
  MY: "Asia/Kuala_Lumpur",
  DE: "Europe/Berlin",
  IN: "Asia/Kolkata",
  ID: "Asia/Jakarta",
  VN: "Asia/Ho_Chi_Minh",
  TW: "Asia/Taipei",
};

export function resolveTimeZone(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    if (isValidTimeZone(candidate)) return candidate;
  }
  return "UTC";
}

export function defaultTimeZoneForCountry(country: string | null | undefined) {
  return (country && COUNTRY_TIME_ZONES[country.toUpperCase()]) || null;
}

type LocalParts = { year: number; month: number; day: number; minutes: number; weekday: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let cached = formatterCache.get(tz);
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(tz, cached);
  }
  return cached;
}

export function localParts(date: Date, tz: string): LocalParts {
  const parts = Object.fromEntries(formatter(tz).formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
  };
}

function offsetMinutes(date: Date, tz: string) {
  const p = localParts(date, tz);
  const seconds = Number(
    Object.fromEntries(formatter(tz).formatToParts(date).map((part) => [part.type, part.value])).second,
  );
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, Math.floor(p.minutes / 60), p.minutes % 60, seconds);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * UTC instant for a local wall-clock time. Times that don't exist (spring
 * forward) move later by the gap; ambiguous times (fall back) use the first.
 */
export function zonedTimeToUtc(year: number, month: number, day: number, minutes: number, tz: string) {
  const guess = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const first = offsetMinutes(new Date(guess), tz);
  let result = guess - first * 60000;
  const second = offsetMinutes(new Date(result), tz);
  if (second !== first) {
    const alt = guess - second * 60000;
    const altParts = localParts(new Date(alt), tz);
    result = altParts.minutes === minutes ? Math.min(result, alt) : Math.max(result, alt);
  }
  return new Date(result);
}

function addLocalDays(parts: LocalParts, days: number) {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
    weekday: base.getUTCDay(),
  };
}

export function localDateKey(now: Date, tz: string) {
  const p = localParts(now, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function localDayStart(now: Date, tz: string) {
  const p = localParts(now, tz);
  return zonedTimeToUtc(p.year, p.month, p.day, 0, tz);
}

/** Monday 00:00 local of the current week. */
export function localWeekStart(now: Date, tz: string) {
  const p = localParts(now, tz);
  const back = (p.weekday + 6) % 7;
  const monday = addLocalDays(p, -back);
  return zonedTimeToUtc(monday.year, monday.month, monday.day, 0, tz);
}

export function localNextDayStart(now: Date, tz: string) {
  const next = addLocalDays(localParts(now, tz), 1);
  return zonedTimeToUtc(next.year, next.month, next.day, 0, tz);
}

export function localNextWeekStart(now: Date, tz: string) {
  const p = localParts(now, tz);
  const monday = addLocalDays(p, 7 - ((p.weekday + 6) % 7));
  return zonedTimeToUtc(monday.year, monday.month, monday.day, 0, tz);
}

/** Validates, clamps to allowed hours, sorts, and merges windows. */
export function normalizeWindows(input: unknown): DeliveryWindow[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 3) return null;
  const windows: DeliveryWindow[] = [];
  for (const raw of input) {
    const start = Number((raw as DeliveryWindow)?.start);
    const end = Number((raw as DeliveryWindow)?.end);
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
    const clampedStart = Math.max(start, QUIET_HOURS_END);
    const clampedEnd = Math.min(end, QUIET_HOURS_START);
    if (clampedEnd - clampedStart < 30) return null;
    windows.push({ start: clampedStart, end: clampedEnd });
  }
  windows.sort((a, b) => a.start - b.start);
  const merged: DeliveryWindow[] = [];
  for (const window of windows) {
    const last = merged[merged.length - 1];
    if (last && window.start <= last.end) last.end = Math.max(last.end, window.end);
    else merged.push({ ...window });
  }
  return merged;
}

export function windowsOrDefault(input: unknown) {
  return normalizeWindows(input) ?? DEFAULT_WINDOWS;
}

const MIN_WINDOW_MINUTES = 15;

/**
 * Delivery windows with the learner's quiet hours removed. Quiet hours can
 * only narrow the windows (which already sit inside 8:00–21:00); they never
 * widen them. Replies to the learner's own texts are not affected.
 */
export function applyQuietHours(windows: DeliveryWindow[], quietStart: number, quietEnd: number): DeliveryWindow[] {
  if (quietStart === quietEnd) return windows;
  const allowed: DeliveryWindow[] =
    quietStart > quietEnd
      ? [{ start: quietEnd, end: quietStart }]
      : [
          { start: 0, end: quietStart },
          { start: quietEnd, end: 24 * 60 },
        ];
  const result: DeliveryWindow[] = [];
  windows.forEach((window) => {
    allowed.forEach((range) => {
      const start = Math.max(window.start, range.start);
      const end = Math.min(window.end, range.end);
      if (end - start >= MIN_WINDOW_MINUTES) result.push({ start, end });
    });
  });
  return result.sort((a, b) => a.start - b.start);
}

export function effectiveWindows(prefs: { delivery_windows: DeliveryWindow[]; quiet_start?: number; quiet_end?: number }) {
  return applyQuietHours(
    prefs.delivery_windows,
    prefs.quiet_start ?? QUIET_HOURS_START,
    prefs.quiet_end ?? QUIET_HOURS_END,
  );
}
export function isWithinWindow(now: Date, tz: string, windows: DeliveryWindow[]) {
  const { minutes } = localParts(now, tz);
  return windows.some((window) => minutes >= window.start && minutes < window.end);
}

/**
 * Earliest moment at or after `now` inside a delivery window. With
 * `allowedDays`, only those local weekdays (0 = Sunday) are considered.
 */
export function nextDeliveryTime(input: {
  now: Date;
  tz: string;
  windows: DeliveryWindow[];
  allowedDays?: readonly number[] | null;
}): Date | null {
  const { now, tz, windows } = input;
  const today = localParts(now, tz);
  const allowed = input.allowedDays && input.allowedDays.length > 0 ? new Set(input.allowedDays) : null;
  for (let offset = 0; offset <= 8; offset += 1) {
    const day = addLocalDays(today, offset);
    if (allowed && !allowed.has(day.weekday)) continue;
    for (const window of windows) {
      const start = zonedTimeToUtc(day.year, day.month, day.day, window.start, tz);
      const end = zonedTimeToUtc(day.year, day.month, day.day, window.end, tz);
      if (now.getTime() < end.getTime()) {
        return new Date(Math.max(now.getTime(), start.getTime()));
      }
    }
  }
  return null;
}

export function defaultOpenersPerWeek(daysPerWeek: number) {
  if (daysPerWeek <= 2) return 2;
  if (daysPerWeek <= 5) return 3;
  return 5;
}

export function effectiveOpenersPerWeek(prefs: { openers_per_week: number | null; days_per_week: number }) {
  return prefs.openers_per_week ?? defaultOpenersPerWeek(prefs.days_per_week);
}

/** One tier lower (5 → 3 → 2 → 1). */
export function reducedFrequency(current: number) {
  const lower = FREQUENCY_TIERS.find((tier) => tier < current);
  return lower ?? 1;
}

const SPREAD: Record<number, number[]> = {
  1: [3],
  2: [2, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Weekdays for scheduled openers: the learner's preferred days, else spread out. */
export function plannedOpenerDays(prefs: { preferred_days: number[]; openers_per_week: number | null; days_per_week: number }) {
  if (prefs.preferred_days.length > 0) return [...prefs.preferred_days].sort((a, b) => a - b);
  const perWeek = effectiveOpenersPerWeek(prefs);
  return perWeek <= 0 ? [] : SPREAD[Math.min(perWeek, 7)];
}
