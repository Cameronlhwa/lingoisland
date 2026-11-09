import { enabledSmsCountryCodes } from "./countries";
import { isE164 } from "./phone";

export type SmsRateLimit = { bucket: string; max: number; windowSeconds: number };

export type WhatsAppConfig = {
  /** WhatsApp is switched on and has a sender plus the templates it needs. */
  enabled: boolean;
  fromNumber: string | null;
  /** Meta-approved templates (names), required outside the 24-hour window. */
  templates: {
    verification: string | null;
    previewIntro: string | null;
    practiceInvite: string | null;
  };
  templateLanguage: string;
  /** Empty means every country libphonenumber recognizes. */
  supportedCountries: string[];
};

export type SmsConfig = {
  /** All provider credentials and secrets are present. */
  enabled: boolean;
  whatsapp: WhatsAppConfig;
  /** HMAC secret for verification codes and rate-limit bucket keys. */
  secret: string;
  supportedCountries: string[];
  /** Numbers LingoIsland sends from; inbound texts from these are ignored. */
  ownNumbers: Set<string>;
  fromNumber: string | null;
  codeTtlMinutes: number;
  maxVerifyAttempts: number;
  maxSendsPerVerification: number;
  resendCooldownSeconds: number;
  disableAfterFailures: number;
};

const MIN_SECRET_LENGTH = 32;

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/** Sliding-window limits. Bucket names are prefixes; callers append hashed ids. */
export const SMS_LIMITS = {
  sendPerUserHour: { max: 5, windowSeconds: HOUR },
  sendPerUserDay: { max: 10, windowSeconds: DAY },
  sendPerPhoneHour: { max: 5, windowSeconds: HOUR },
  sendPerPhoneDay: { max: 10, windowSeconds: DAY },
  sendPerIpHour: { max: 20, windowSeconds: HOUR },
  verifyPerUserHour: { max: 20, windowSeconds: HOUR },
  replacePerUserDay: { max: 3, windowSeconds: DAY },
  welcomePerUserDay: { max: 3, windowSeconds: DAY },
  aiRepliesPerContactHour: { max: 40, windowSeconds: HOUR },
  aiRepliesPerContactDay: { max: 200, windowSeconds: DAY },
  fallbackPerContactHour: { max: 1, windowSeconds: HOUR },
  helpPerPhoneDay: { max: 3, windowSeconds: DAY },
} as const;

function parseList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getSmsConfig(env: NodeJS.ProcessEnv = process.env): SmsConfig {
  const secret = env.SMS_VERIFICATION_SECRET?.trim() || "";
  const fromNumber = env.TELNYX_FROM_NUMBER?.trim() || null;
  const ownNumbers = new Set(
    [fromNumber, ...parseList(env.SMS_OWN_NUMBERS)].filter(
      (value): value is string => Boolean(value && isE164(value)),
    ),
  );
  const countries = parseList(env.SMS_SUPPORTED_COUNTRIES).map((code) => code.toUpperCase());

  const providerConfigured =
    (env.SMS_PROVIDER || "telnyx").toLowerCase() === "telnyx"
      ? Boolean(env.TELNYX_API_KEY?.trim() && env.TELNYX_PUBLIC_KEY?.trim() && fromNumber)
      : false;

  const enabled = providerConfigured && secret.length >= MIN_SECRET_LENGTH;
  const whatsappFrom = env.TELNYX_WHATSAPP_FROM_NUMBER?.trim() || null;
  const verificationTemplate = env.TELNYX_WHATSAPP_VERIFICATION_TEMPLATE?.trim() || null;
  const whatsapp: WhatsAppConfig = {
    enabled:
      enabled &&
      env.WHATSAPP_ENABLED === "true" &&
      Boolean(whatsappFrom && isE164(whatsappFrom)) &&
      Boolean(verificationTemplate),
    fromNumber: whatsappFrom && isE164(whatsappFrom) ? whatsappFrom : null,
    templates: {
      verification: verificationTemplate,
      previewIntro: env.TELNYX_WHATSAPP_PREVIEW_TEMPLATE?.trim() || null,
      practiceInvite: env.TELNYX_WHATSAPP_INVITE_TEMPLATE?.trim() || null,
    },
    templateLanguage: env.TELNYX_WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en",
    supportedCountries: parseList(env.WHATSAPP_SUPPORTED_COUNTRIES).map((code) => code.toUpperCase()),
  };
  if (whatsapp.fromNumber) ownNumbers.add(whatsapp.fromNumber);

  return {
    enabled,
    whatsapp,
    secret,
    supportedCountries: enabledSmsCountryCodes(countries),
    ownNumbers,
    fromNumber,
    codeTtlMinutes: 10,
    maxVerifyAttempts: 5,
    maxSendsPerVerification: 5,
    resendCooldownSeconds: 30,
    disableAfterFailures: 3,
  };
}
