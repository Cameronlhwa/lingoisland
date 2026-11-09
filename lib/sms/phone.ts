import {
  getCountryCallingCode as coreGetCountryCallingCode,
  isSupportedCountry as coreIsSupportedCountry,
  parsePhoneNumberFromString as coreParse,
  type CountryCode,
  type MetadataJson,
} from "libphonenumber-js/core";
import maxMetadataJson from "libphonenumber-js/metadata.max.json";

// "max" metadata is needed for number-type (mobile vs landline) checks.
// Some loaders wrap JSON in a default export, so unwrap defensively.
const metadata = ((maxMetadataJson as unknown as { default?: MetadataJson }).default ??
  maxMetadataJson) as MetadataJson;

export function parsePhoneNumberFromString(value: string, defaultCountry?: CountryCode) {
  return coreParse(value, defaultCountry ? { defaultCountry } : {}, metadata);
}

function isSupportedCountry(country: string) {
  return coreIsSupportedCountry(country as CountryCode, metadata);
}

function getCountryCallingCode(country: CountryCode) {
  return coreGetCountryCallingCode(country, metadata);
}

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneNumber(value: string) {
  const normalized = value.trim().replace(/[\s().-]/g, "");
  if (!E164_PATTERN.test(normalized)) {
    throw new Error("Phone number must use E.164 format, for example +14165550123");
  }
  return normalized;
}

export function isE164(value: string) {
  return E164_PATTERN.test(value);
}

// Number types that can never receive texts.
const NON_SMS_TYPES = new Set([
  "FIXED_LINE",
  "PREMIUM_RATE",
  "TOLL_FREE",
  "SHARED_COST",
  "PAGER",
  "UAN",
  "VOICEMAIL",
]);

export type PhoneParseResult =
  | { ok: true; e164: string; country: CountryCode }
  | { ok: false; reason: "invalid" | "unsupported_country" | "not_mobile" };

/**
 * Parses learner input (national or international format) into E.164 and
 * checks it against the countries we can message ("any" for WhatsApp
 * without a country allow-list).
 */
export function parsePhoneForSms(
  input: string,
  country: string | undefined,
  supportedCountries: readonly string[] | "any",
): PhoneParseResult {
  const trimmed = (input || "").trim();
  if (!trimmed || trimmed.length > 32) return { ok: false, reason: "invalid" };

  const defaultCountry =
    country && isSupportedCountry(country.toUpperCase())
      ? (country.toUpperCase() as CountryCode)
      : undefined;

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid() || !parsed.country) {
    return { ok: false, reason: "invalid" };
  }

  if (supportedCountries !== "any" && !supportedCountries.includes(parsed.country)) {
    return { ok: false, reason: "unsupported_country" };
  }

  const type = parsed.getType();
  if (type && NON_SMS_TYPES.has(type)) {
    return { ok: false, reason: "not_mobile" };
  }

  const e164 = parsed.number;
  if (!E164_PATTERN.test(e164)) return { ok: false, reason: "invalid" };
  return { ok: true, e164, country: parsed.country };
}

export function dialCodeForCountry(country: string) {
  if (!isSupportedCountry(country)) return null;
  return `+${getCountryCallingCode(country as CountryCode)}`;
}

/** "+14165559212" -> "+1 ••• ••• 9212". Safe for UI, logs, and errors. */
export function maskPhoneNumber(value: string | null | undefined) {
  if (!value) return "";
  const parsed = parsePhoneNumberFromString(value);
  const callingCode = parsed?.countryCallingCode;
  const national = parsed?.nationalNumber ?? value.replace(/\D/g, "");

  if (national.length <= 4) return "•••";

  const visible = national.slice(-4);
  const hiddenCount = national.length - 4;
  const groups: number[] = [];
  let remaining = hiddenCount;
  while (remaining > 0) {
    const size = remaining === 4 ? 4 : Math.min(3, remaining);
    groups.push(size);
    remaining -= size;
  }
  const hidden = groups.map((size) => "•".repeat(size)).join(" ");
  return `${callingCode ? `+${callingCode} ` : ""}${hidden} ${visible}`;
}

/** "+14165559212" -> "+1 416 555 9212" for numbers we own and display. */
export function formatPhoneNumber(value: string | null | undefined) {
  if (!value) return "";
  const parsed = parsePhoneNumberFromString(value);
  return parsed ? parsed.formatInternational() : value;
}
