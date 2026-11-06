import { getSmsCountry, interestSmsCountries } from "../countries";
import { getPhoneState, SmsPhoneError, type SmsPhoneDeps } from "../phoneService";
import { clock, loadHuahuaContext } from "./context";
import { isCorrectionMode } from "./correction";
import { isPersonaKey } from "./personas";
import { summarizeUsage } from "./plans";
import type {
  HuahuaOverview,
  HuahuaPreferencesPatch,
  HuahuaThreadSummary,
  HuahuaWord,
} from "./publicTypes";
import { effectiveOpenersPerWeek, isValidTimeZone, normalizeWindows } from "./schedule";

const THREAD_LIMIT = 10;
const MESSAGE_LIMIT = 12;
const WORD_LIMIT = 20;

type RawOverview = {
  threads: HuahuaThreadSummary[];
  recent_words: HuahuaWord[];
  needs_practice: HuahuaWord[];
  getting_comfortable: HuahuaWord[];
};

function words(list: HuahuaWord[] | null | undefined) {
  return (list ?? []).map((word) => ({ ...word, comfort_score: Number(word.comfort_score) }));
}

/** Everything the Huahua page shows, for the signed-in learner only. */
export async function getHuahuaOverview(deps: SmsPhoneDeps, userId: string): Promise<HuahuaOverview> {
  const now = clock(deps);
  const [phone, ctx, raw] = await Promise.all([
    getPhoneState(deps, userId),
    loadHuahuaContext(deps, userId, now),
    deps.rpc<RawOverview>("sms_get_huahua_overview", {
      p_user_id: userId,
      p_thread_limit: THREAD_LIMIT,
      p_message_limit: MESSAGE_LIMIT,
      p_word_limit: WORD_LIMIT,
    }),
  ]);
  const usageRow = await deps.rpc<{ used_segments: number } | null>("sms_get_usage", {
    p_user_id: userId,
    p_period_start: ctx.period.start.toISOString(),
  });
  const prefs = ctx.preferences;
  const enabled = deps.config.supportedCountries;

  return {
    phone,
    plan: {
      key: ctx.plan.key,
      subscribed: ctx.subscribed,
      personas: [...ctx.plan.personas],
      proactiveOpeners: ctx.plan.proactiveOpeners,
    },
    preferences: {
      persona: ctx.plan.personas.includes(prefs.persona) ? prefs.persona : "friendly_friend",
      correctionMode: prefs.correction_mode,
      scaffolding: prefs.scaffolding,
      daysPerWeek: prefs.days_per_week,
      preferredDays: prefs.preferred_days,
      openersPerWeek: effectiveOpenersPerWeek(prefs),
      openersPerWeekIsCustom: prefs.openers_per_week !== null,
      autoAdjust: prefs.auto_adjust,
      deliveryWindows: prefs.delivery_windows,
      timezone: ctx.timezone,
    },
    usage: summarizeUsage(ctx.plan, usageRow?.used_segments ?? 0, ctx.period.end),
    threads: raw?.threads ?? [],
    words: {
      needsPractice: words(raw?.needs_practice),
      gettingComfortable: words(raw?.getting_comfortable),
      recent: words(raw?.recent_words),
    },
    countries: { enabled: [...enabled], interest: interestSmsCountries(enabled) },
  };
}

function bad(message: string): never {
  throw new SmsPhoneError("bad_request", 400, message);
}

/** Validates a settings patch from the website and maps it to the DB shape. */
export function validatePreferencesPatch(input: Record<string, unknown>, allowedPersonas: readonly string[]) {
  const patch: Record<string, unknown> = {};
  const body = input as HuahuaPreferencesPatch & Record<string, unknown>;

  if ("persona" in body) {
    if (!isPersonaKey(body.persona)) bad("Unknown texting style.");
    if (!allowedPersonas.includes(body.persona)) {
      throw new SmsPhoneError("forbidden", 403, "That style is part of a LingoIsland subscription.");
    }
    patch.persona = body.persona;
  }
  if ("correctionMode" in body) {
    if (!isCorrectionMode(body.correctionMode)) bad("Unknown correction style.");
    patch.correction_mode = body.correctionMode;
  }
  if ("scaffolding" in body) {
    if (body.scaffolding !== "auto" && body.scaffolding !== "more" && body.scaffolding !== "less") bad("Invalid support level.");
    patch.scaffolding = body.scaffolding;
  }
  if ("daysPerWeek" in body) {
    const days = Number(body.daysPerWeek);
    if (!Number.isInteger(days) || days < 1 || days > 7) bad("Pick 1 to 7 days a week.");
    patch.days_per_week = days;
  }
  if ("preferredDays" in body) {
    const days = body.preferredDays;
    if (!Array.isArray(days) || days.length > 7 || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      bad("Invalid days.");
    }
    patch.preferred_days = Array.from(new Set(days as number[])).sort((a, b) => a - b);
  }
  if ("openersPerWeek" in body) {
    const value = body.openersPerWeek;
    if (value !== null && (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 7)) {
      bad("Pick 1 to 7 texts a week.");
    }
    patch.openers_per_week = value;
  }
  if ("autoAdjust" in body) {
    if (typeof body.autoAdjust !== "boolean") bad("Invalid setting.");
    patch.auto_adjust = body.autoAdjust;
  }
  if ("deliveryWindows" in body) {
    const windows = normalizeWindows(body.deliveryWindows);
    if (!windows) bad("Pick a time window between 8am and 9pm, at least 30 minutes long.");
    patch.delivery_windows = windows;
  }
  if ("timezone" in body) {
    if (!isValidTimeZone(body.timezone)) bad("Unknown time zone.");
    patch.timezone = body.timezone;
  }
  if (Object.keys(patch).length === 0) bad("Nothing to update.");
  return patch;
}

export async function updateHuahuaPreferences(deps: SmsPhoneDeps, userId: string, input: Record<string, unknown>) {
  const ctx = await loadHuahuaContext(deps, userId, clock(deps));
  const patch = validatePreferencesPatch(input, ctx.plan.personas);
  await deps.rpc("sms_update_preferences", { p_user_id: userId, p_patch: patch });
  return getHuahuaOverview(deps, userId);
}

export async function deleteHuahuaHistory(deps: SmsPhoneDeps, userId: string, includeWords: boolean) {
  await deps.rpc("sms_delete_history", { p_user_id: userId, p_include_words: includeWords });
  return getHuahuaOverview(deps, userId);
}

export async function recordCountryInterest(deps: SmsPhoneDeps, userId: string, countryCode: unknown) {
  const code = typeof countryCode === "string" ? countryCode.toUpperCase() : "";
  const country = getSmsCountry(code);
  if (!country || deps.config.supportedCountries.includes(code)) bad("Unknown country.");
  await deps.rpc("sms_record_country_interest", { p_user_id: userId, p_country_code: code });
  return { ok: true as const, country: { code: country.code, name: country.name } };
}
