// Shapes returned by /api/sms/huahua. Safe to import from client components.

import type { SmsPhoneState } from "../phoneState";
import type { CorrectionMode } from "./correction";
import type { PersonaKey } from "./personas";
import type { ScaffoldingPreference } from "./scaffolding";

export type HuahuaWord = {
  word: string;
  pinyin: string | null;
  english: string | null;
  comfort_score: number;
  last_practiced_at: string | null;
};

export type HuahuaThreadSummary = {
  id: string;
  origin: "welcome" | "opener" | "control" | "inbound";
  started_at: string;
  status: "open" | "closed";
  messages: Array<{ direction: "inbound" | "outbound"; body: string; at: string }>;
};

export type HuahuaPreferencesPublic = {
  persona: PersonaKey;
  correctionMode: CorrectionMode;
  scaffolding: ScaffoldingPreference;
  daysPerWeek: number;
  preferredDays: number[];
  openersPerWeek: number;
  openersPerWeekIsCustom: boolean;
  autoAdjust: boolean;
  deliveryWindows: Array<{ start: number; end: number }>;
  timezone: string;
};

export type HuahuaUsagePublic = {
  used: number;
  allowance: number;
  ratio: number;
  state: "ok" | "warning" | "exhausted";
  resetsAt: string | null;
  showUpgrade: boolean;
};

export type HuahuaOverview = {
  phone: SmsPhoneState;
  plan: {
    key: "free" | "subscriber";
    subscribed: boolean;
    personas: PersonaKey[];
    proactiveOpeners: boolean;
  };
  preferences: HuahuaPreferencesPublic;
  usage: HuahuaUsagePublic;
  threads: HuahuaThreadSummary[];
  words: {
    needsPractice: HuahuaWord[];
    gettingComfortable: HuahuaWord[];
    recent: HuahuaWord[];
  };
  countries: {
    enabled: string[];
    interest: Array<{ code: string; name: string }>;
  };
};

export type HuahuaPreferencesPatch = Partial<{
  persona: PersonaKey;
  correctionMode: CorrectionMode;
  scaffolding: ScaffoldingPreference;
  daysPerWeek: number;
  preferredDays: number[];
  openersPerWeek: number | null;
  autoAdjust: boolean;
  deliveryWindows: Array<{ start: number; end: number }>;
  timezone: string;
}>;

/** GET /api/sms/huahua when texting isn't set up on this deployment. */
export type HuahuaUnavailable = { unavailable: true; phone: SmsPhoneState };

export type HuahuaOverviewResponse = HuahuaOverview | HuahuaUnavailable;
