// Onboarding analytics. Every property passes an allow-list so phone numbers,
// message text, custom interests, names, and assessment questions or answers
// can never reach analytics, even if a caller passes them by mistake.

export const ONBOARDING_EVENTS = {
  started: "onboarding_started",
  goalSelected: "onboarding_goal_selected",
  interestsSelected: "onboarding_interests_selected",
  levelSelected: "onboarding_level_selected",
  calibrationStarted: "onboarding_calibration_started",
  calibrationAnswered: "onboarding_calibration_answered",
  calibrationCompleted: "onboarding_calibration_completed",
  pronunciationAccepted: "onboarding_pronunciation_accepted",
  pronunciationSkipped: "onboarding_pronunciation_skipped",
  pronunciationDenied: "onboarding_pronunciation_denied",
  pronunciationFailed: "onboarding_pronunciation_failed",
  pronunciationCompleted: "onboarding_pronunciation_completed",
  availabilitySelected: "onboarding_availability_selected",
  planGenerated: "onboarding_plan_generated",
  planViewed: "onboarding_plan_viewed",
  huahuaIntroViewed: "onboarding_huahua_intro_viewed",
  messagingStarted: "onboarding_messaging_started",
  messagingSkipped: "onboarding_messaging_skipped",
  channelSelected: "onboarding_channel_selected",
  verificationStarted: "onboarding_verification_started",
  verificationCompleted: "onboarding_verification_completed",
  consentGranted: "onboarding_consent_granted",
  consentDeclined: "onboarding_consent_declined",
  huahuaPreferencesCompleted: "onboarding_huahua_preferences_completed",
  previewStarted: "onboarding_preview_started",
  previewCompleted: "onboarding_preview_completed",
  commitmentViewed: "onboarding_commitment_viewed",
  commitmentCompleted: "onboarding_commitment_completed",
  paywallViewed: "onboarding_paywall_viewed",
  purchaseStarted: "onboarding_purchase_started",
  purchaseCompleted: "onboarding_purchase_completed",
  abandoned: "onboarding_abandoned",
  stepViewed: "onboarding_step_viewed",
} as const;

export type OnboardingEventName = (typeof ONBOARDING_EVENTS)[keyof typeof ONBOARDING_EVENTS];

const ALLOWED_KEYS = new Set([
  "version",
  "surface",
  "step",
  "last_completed_step",
  "goal",
  "secondary_goal",
  "interests",
  "interest_count",
  "has_custom_interest",
  "has_goal_other_text",
  "self_report",
  "claimed_level",
  "provisional_level",
  "position",
  "role",
  "answered_count",
  "minutes",
  "days",
  "session",
  "channel",
  "sms_supported",
  "whatsapp_available",
  "consent_scheduled",
  "consent_journey",
  "support",
  "correction",
  "writing_system",
  "frequency",
  "quiet_hours_default",
  "mode",
  "status",
  "outcome",
  "reason",
  "plan",
  "milestone_key",
  "journeys_count",
  "duration_ms",
  "reduced_motion",
  "resumed",
  "replaced",
  "transferred",
  "has_messaging",
  "simulated",
]);

const SAFE_STRING = /^[A-Za-z0-9_:.-]{1,40}$/;

function safeString(value: string) {
  // Seven or more digits could be part of a phone number or code.
  return SAFE_STRING.test(value) && !/\d{7,}/.test(value) ? value : null;
}

export function sanitizeOnboardingProps(input: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input) return out;
  Object.keys(input).forEach((key) => {
    if (!ALLOWED_KEYS.has(key)) return;
    const value = input[key];
    if (typeof value === "boolean") out[key] = value;
    else if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) < 1e7) out[key] = value;
    else if (typeof value === "string") {
      const safe = safeString(value);
      if (safe !== null) out[key] = safe;
    } else if (Array.isArray(value)) {
      const items = value
        .filter((item): item is string => typeof item === "string")
        .map(safeString)
        .filter((item): item is string => item !== null)
        .slice(0, 10);
      out[key] = items;
    } else if (value === null) {
      out[key] = null;
    }
  });
  return out;
}

type CaptureFn = (event: string, properties?: Record<string, unknown>) => void;

declare global {
  interface Window {
    /** Test hook: when true, sanitized onboarding events are also recorded here. */
    __lingoAnalyticsSpy?: boolean;
    __lingoAnalyticsEvents?: Array<{ event: string; properties: Record<string, unknown> }>;
  }
}

export function trackOnboarding(capture: CaptureFn, event: OnboardingEventName, properties?: Record<string, unknown>) {
  const safe = sanitizeOnboardingProps(properties);
  if (typeof window !== "undefined" && window.__lingoAnalyticsSpy) {
    window.__lingoAnalyticsEvents = window.__lingoAnalyticsEvents ?? [];
    window.__lingoAnalyticsEvents.push({ event, properties: safe });
  }
  capture(event, safe);
}
