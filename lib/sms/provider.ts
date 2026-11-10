import "server-only";
import type { SmsProvider } from "./types";
import { TelnyxSmsProvider } from "./telnyx";

let provider: SmsProvider | null = null;

export function getSmsProvider() {
  if (provider) return provider;

  const providerName = (process.env.SMS_PROVIDER || "telnyx").toLowerCase();
  if (providerName === "telnyx") {
    provider = new TelnyxSmsProvider();
    return provider;
  }

  throw new Error(`Unsupported SMS provider: ${providerName}`);
}
