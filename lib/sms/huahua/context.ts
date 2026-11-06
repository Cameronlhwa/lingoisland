import type { SmsConfig } from "../config";
import { parsePhoneNumberFromString } from "../phone";
import type { SmsRpc } from "../rpc";
import type { SmsProvider } from "../types";
import type { TurnGenerator } from "./ai";
import { DEFAULT_CORRECTION_MODE, isCorrectionMode, type CorrectionMode } from "./correction";
import { DEFAULT_PERSONA, isPersonaKey, type PersonaKey } from "./personas";
import {
  planFor,
  resolveSubscription,
  usagePeriod,
  type BillingRow,
  type HuahuaPlan,
  type SubscriptionRow,
} from "./plans";
import { hskLevelFrom, type HskLevel, type ScaffoldingPreference } from "./scaffolding";
import { defaultTimeZoneForCountry, resolveTimeZone, windowsOrDefault, type DeliveryWindow } from "./schedule";

export type HuahuaDeps = {
  rpc: SmsRpc;
  provider: SmsProvider;
  config: SmsConfig;
  generateTurn: TurnGenerator;
  /** Injected clock (tests). */
  now?: () => Date;
  turnTimeoutMs?: number;
};

export function clock(deps: { now?: () => Date }) {
  return deps.now ? deps.now() : new Date();
}

export type RawContact = {
  id: string;
  user_id: string;
  phone_number: string;
  status: string;
  display_name: string | null;
  language_level: string | null;
  verified_at: string | null;
  consent_at: string | null;
  paused_reason: string | null;
};

export type HuahuaPreferences = {
  persona: PersonaKey;
  correction_mode: CorrectionMode;
  scaffolding: ScaffoldingPreference;
  days_per_week: number;
  preferred_days: number[];
  openers_per_week: number | null;
  auto_adjust: boolean;
  delivery_windows: DeliveryWindow[];
  timezone: string | null;
  unanswered_openers: number;
  frequency_reduced_at: string | null;
  control_sent_at: string | null;
};

export const DEFAULT_PREFERENCES: HuahuaPreferences = {
  persona: DEFAULT_PERSONA,
  correction_mode: DEFAULT_CORRECTION_MODE,
  scaffolding: "auto",
  days_per_week: 3,
  preferred_days: [],
  openers_per_week: null,
  auto_adjust: true,
  delivery_windows: [{ start: 18 * 60, end: 21 * 60 }],
  timezone: null,
  unanswered_openers: 0,
  frequency_reduced_at: null,
  control_sent_at: null,
};

type RawContext = {
  contact: RawContact | null;
  preferences: Partial<HuahuaPreferences> | null;
  profile: { cefr_level: string | null; hsk_current_level: unknown; timezone: string | null } | null;
  billing: BillingRow;
  subscriptions: SubscriptionRow[] | null;
};

export type HuahuaContext = {
  userId: string;
  contact: RawContact | null;
  preferences: HuahuaPreferences;
  hasPreferencesRow: boolean;
  subscribed: boolean;
  plan: HuahuaPlan;
  period: { start: Date; end: Date };
  level: HskLevel;
  countryCode: string | null;
  timezone: string;
  profileTimezone: string | null;
};

export function normalizePreferences(raw: Partial<HuahuaPreferences> | null): HuahuaPreferences {
  const prefs = { ...DEFAULT_PREFERENCES, ...(raw ?? {}) };
  return {
    ...prefs,
    persona: isPersonaKey(prefs.persona) ? prefs.persona : DEFAULT_PERSONA,
    correction_mode: isCorrectionMode(prefs.correction_mode) ? prefs.correction_mode : DEFAULT_CORRECTION_MODE,
    scaffolding: prefs.scaffolding === "more" || prefs.scaffolding === "less" ? prefs.scaffolding : "auto",
    preferred_days: Array.isArray(prefs.preferred_days) ? prefs.preferred_days.map(Number) : [],
    delivery_windows: windowsOrDefault(prefs.delivery_windows),
    unanswered_openers: Number(prefs.unanswered_openers) || 0,
  };
}

export async function loadHuahuaContext(deps: { rpc: SmsRpc }, userId: string, now: Date): Promise<HuahuaContext> {
  const raw = await deps.rpc<RawContext>("sms_get_user_context", { p_user_id: userId });
  const { subscribed, periodAnchor } = resolveSubscription(raw.subscriptions ?? null, raw.billing ?? null, now);
  const plan = planFor(subscribed);
  const preferences = normalizePreferences(raw.preferences);
  const countryCode = raw.contact
    ? parsePhoneNumberFromString(raw.contact.phone_number)?.country ?? null
    : null;
  return {
    userId,
    contact: raw.contact,
    preferences,
    hasPreferencesRow: Boolean(raw.preferences),
    subscribed,
    plan,
    period: usagePeriod(plan, periodAnchor, now),
    level: hskLevelFrom({
      hskCurrentLevel: raw.profile?.hsk_current_level,
      cefrLevel: raw.profile?.cefr_level,
      contactLevel: raw.contact?.language_level,
    }),
    countryCode,
    timezone: resolveTimeZone(preferences.timezone, raw.profile?.timezone, defaultTimeZoneForCountry(countryCode)),
    profileTimezone: raw.profile?.timezone ?? null,
  };
}

export function meterFor(ctx: HuahuaContext) {
  return {
    userId: ctx.userId,
    periodStart: ctx.period.start,
    periodEnd: ctx.period.end,
    planKey: ctx.plan.key,
    allowance: ctx.plan.allowanceSegments,
  };
}
