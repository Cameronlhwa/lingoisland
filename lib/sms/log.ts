const PHONE_LIKE = /\+?\d[\d\s().-]{6,}\d/g;
const SIX_DIGITS = /\b\d{6}\b/g;

/** Removes phone numbers and anything shaped like a verification code. */
export function redactSmsText(value: string) {
  return value.replace(PHONE_LIKE, "[phone]").replace(SIX_DIGITS, "[code]");
}

export function describeSmsError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return redactSmsText(message).slice(0, 500);
}

export function logSmsError(context: string, error: unknown, meta?: Record<string, unknown>) {
  console.error(`[sms] ${context}: ${describeSmsError(error)}`, meta ?? "");
}
