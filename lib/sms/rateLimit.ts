import { hashIdentifier } from "./codes";
import type { SmsRpc } from "./rpc";

export type SmsLimitSpec = {
  /** e.g. "send:user:hour" */
  name: string;
  /** Raw identifier (user id, phone, IP). Hashed before it is stored. */
  identifier: string;
  max: number;
  windowSeconds: number;
};

export type SmsRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Atomically checks every limit and records one hit in each, or records
 * nothing. Fails closed: database errors propagate to the caller.
 */
export async function consumeSmsRateLimits(
  rpc: SmsRpc,
  secret: string,
  limits: SmsLimitSpec[],
): Promise<SmsRateLimitResult> {
  if (limits.length === 0) return { allowed: true };
  const result = await rpc<{ allowed: boolean; retry_after_seconds?: number }>(
    "sms_rate_limit_consume",
    {
      p_limits: limits.map((limit) => ({
        bucket: `${limit.name}:${hashIdentifier(secret, limit.name, limit.identifier)}`,
        max: limit.max,
        window_seconds: limit.windowSeconds,
      })),
    },
  );
  if (result?.allowed) return { allowed: true };
  return { allowed: false, retryAfterSeconds: Math.max(1, result?.retry_after_seconds ?? 60) };
}
