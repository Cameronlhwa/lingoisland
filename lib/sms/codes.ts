import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const VERIFICATION_CODE_LENGTH = 6;
const CODE_PATTERN = /^\d{6}$/;

export function generateVerificationCode() {
  return randomInt(0, 10 ** VERIFICATION_CODE_LENGTH)
    .toString()
    .padStart(VERIFICATION_CODE_LENGTH, "0");
}

export function isWellFormedCode(code: unknown): code is string {
  return typeof code === "string" && CODE_PATTERN.test(code);
}

/** Strips spaces/dashes people type or paste ("123 456", "123-456"). */
export function cleanCodeInput(code: unknown) {
  return typeof code === "string" ? code.replace(/[\s-]/g, "") : "";
}

/**
 * HMAC binds the code to the user and phone number so a hash cannot be
 * replayed for another verification, and a database leak alone does not
 * allow offline guessing of the 6-digit space.
 */
export function hashVerificationCode(
  secret: string,
  input: { userId: string; phoneNumber: string; code: string },
) {
  return createHmac("sha256", secret)
    .update(`sms-verification:v1:${input.userId}:${input.phoneNumber}:${input.code}`)
    .digest("hex");
}

export function verificationCodeMatches(
  secret: string,
  storedHash: string,
  input: { userId: string; phoneNumber: string; code: string },
) {
  const candidate = Buffer.from(hashVerificationCode(secret, input), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (stored.length !== candidate.length) return false;
  return timingSafeEqual(stored, candidate);
}

/** Opaque, non-reversible bucket keys for rate limits (phone numbers, IPs). */
export function hashIdentifier(secret: string, kind: string, value: string) {
  return createHmac("sha256", secret).update(`sms-bucket:${kind}:${value}`).digest("hex").slice(0, 32);
}
