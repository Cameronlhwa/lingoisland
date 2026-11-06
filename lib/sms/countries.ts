// Server-side SMS country capabilities. A country is offered to learners only
// when `enabled` is true here (a reviewed code change) and, if
// SMS_SUPPORTED_COUNTRIES is set, it is also listed there. The env variable
// can narrow the list but can never enable a country on its own.

export type SmsSenderType = "long_code" | "toll_free" | "short_code" | "alphanumeric";
export type SmsRolloutStatus = "live" | "pilot" | "planned" | "prepared" | "blocked";

export type SmsCountryCapability = {
  code: string;
  name: string;
  enabled: boolean;
  twoWay: boolean;
  outbound: boolean;
  inbound: boolean;
  senderType: SmsSenderType;
  registrationRequired: boolean;
  complianceNotes: string;
  /** Maximum segments for one AI-generated practice text. */
  segmentLimit: number;
  provider: "telnyx";
  rolloutStatus: SmsRolloutStatus;
};

export const SMS_COUNTRIES: readonly SmsCountryCapability[] = [
  {
    code: "CA",
    name: "Canada",
    enabled: true,
    twoWay: true,
    outbound: true,
    inbound: true,
    senderType: "long_code",
    registrationRequired: false,
    complianceNotes:
      "CASL: express consent recorded with version and source. Toll-free verification recommended for deliverability.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "live",
  },
  {
    code: "US",
    name: "United States",
    enabled: true,
    twoWay: true,
    outbound: true,
    inbound: true,
    senderType: "long_code",
    registrationRequired: true,
    complianceNotes:
      "TCPA/CTIA: 10DLC brand + campaign (or toll-free verification) must be approved before sending. Quiet hours 8am–9pm local.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "live",
  },
  {
    code: "GB",
    name: "United Kingdom",
    enabled: false,
    twoWay: true,
    outbound: true,
    inbound: true,
    senderType: "long_code",
    registrationRequired: false,
    complianceNotes: "PECR consent rules. Requires a UK long code for two-way.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "planned",
  },
  {
    code: "AU",
    name: "Australia",
    enabled: false,
    twoWay: true,
    outbound: true,
    inbound: true,
    senderType: "long_code",
    registrationRequired: false,
    complianceNotes: "Spam Act 2003 consent and unsubscribe rules. Requires an AU number for two-way.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "planned",
  },
  {
    code: "SG",
    name: "Singapore",
    enabled: false,
    twoWay: false,
    outbound: true,
    inbound: false,
    senderType: "alphanumeric",
    registrationRequired: true,
    complianceNotes: "SSIR sender ID registration required; unregistered senders are labelled 'Likely-SCAM'.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "planned",
  },
  {
    code: "DE",
    name: "Germany",
    enabled: false,
    twoWay: true,
    outbound: true,
    inbound: true,
    senderType: "long_code",
    registrationRequired: false,
    complianceNotes: "GDPR/UWG double opt-in expected. Two-way needs a German mobile long code.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "planned",
  },
  {
    code: "IN",
    name: "India",
    enabled: false,
    twoWay: false,
    outbound: true,
    inbound: false,
    senderType: "alphanumeric",
    registrationRequired: true,
    complianceNotes: "TRAI DLT entity, header, and template registration required. Two-way generally unavailable.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "planned",
  },
  {
    code: "ID",
    name: "Indonesia",
    enabled: false,
    twoWay: false,
    outbound: true,
    inbound: false,
    senderType: "alphanumeric",
    registrationRequired: true,
    complianceNotes: "Sender ID pre-registration required. Two-way on long codes is not reliably supported.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "planned",
  },
  {
    code: "VN",
    name: "Vietnam",
    enabled: false,
    twoWay: false,
    outbound: true,
    inbound: false,
    senderType: "alphanumeric",
    registrationRequired: true,
    complianceNotes: "Brand name and template registration required. Two-way not supported.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "planned",
  },
  {
    code: "TW",
    name: "Taiwan",
    enabled: false,
    twoWay: false,
    outbound: true,
    inbound: false,
    senderType: "long_code",
    registrationRequired: true,
    complianceNotes: "Carrier filtering of international senders; two-way availability to be confirmed with provider.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "planned",
  },
  {
    code: "MY",
    name: "Malaysia",
    enabled: false,
    twoWay: false,
    outbound: true,
    inbound: false,
    senderType: "short_code",
    registrationRequired: true,
    complianceNotes: "MCMC rules: messages must start with 'RM0'. Registration required.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "prepared",
  },
  {
    code: "NZ",
    name: "New Zealand",
    enabled: false,
    twoWay: true,
    outbound: true,
    inbound: true,
    senderType: "long_code",
    registrationRequired: false,
    complianceNotes: "Unsolicited Electronic Messages Act consent and unsubscribe rules.",
    segmentLimit: 3,
    provider: "telnyx",
    rolloutStatus: "prepared",
  },
];

const BY_CODE = new Map(SMS_COUNTRIES.map((country) => [country.code, country]));

export function getSmsCountry(code: string | null | undefined) {
  return code ? BY_CODE.get(code.toUpperCase()) ?? null : null;
}

/**
 * Countries learners can verify a number in: enabled, two-way capable, and
 * (when the env list is set) listed in SMS_SUPPORTED_COUNTRIES.
 */
export function enabledSmsCountryCodes(envList: readonly string[] = []) {
  const allow = new Set(envList.map((code) => code.toUpperCase()));
  return SMS_COUNTRIES.filter(
    (country) =>
      country.enabled &&
      country.twoWay &&
      country.inbound &&
      country.outbound &&
      (allow.size === 0 || allow.has(country.code)),
  ).map((country) => country.code);
}

/** Countries a learner may register interest in (not offered yet). */
export function interestSmsCountries(enabledCodes: readonly string[]) {
  const enabled = new Set(enabledCodes);
  return SMS_COUNTRIES.filter((country) => !enabled.has(country.code) && country.rolloutStatus !== "blocked").map(
    (country) => ({ code: country.code, name: country.name }),
  );
}

export function segmentLimitForCountry(code: string | null | undefined, fallback = 3) {
  return getSmsCountry(code)?.segmentLimit ?? fallback;
}
