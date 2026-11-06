import "server-only";
import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/security/sameOrigin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getSmsSupabaseAdmin } from "./admin";
import { getSmsConfig } from "./config";
import { generateSmsReply } from "./generate-reply";
import { logSmsError } from "./log";
import { SmsPhoneError } from "./phoneService";
import type { SmsPhoneErrorBody } from "./phoneState";
import type { SmsProcessorDeps } from "./processor";
import { getSmsProvider } from "./provider";
import { createSupabaseSmsRpc } from "./rpc";

export function getSmsDeps(): SmsProcessorDeps {
  return {
    rpc: createSupabaseSmsRpc(getSmsSupabaseAdmin()),
    provider: getSmsProvider(),
    config: getSmsConfig(),
    generateReply: generateSmsReply,
  };
}

/**
 * Resolves the signed-in user for an SMS phone route. Mutations must also
 * pass the same-origin check.
 */
export async function requireSmsUser(request: Request, { mutation }: { mutation: boolean }) {
  if (mutation && !isSameOriginMutation(request)) {
    const body: SmsPhoneErrorBody = { error: "Invalid request origin.", code: "forbidden" };
    return { user: null, response: NextResponse.json(body, { status: 403 }) };
  }
  const { user } = await getAuthenticatedUser();
  if (!user) {
    const body: SmsPhoneErrorBody = { error: "Please sign in again.", code: "unauthorized" };
    return { user: null, response: NextResponse.json(body, { status: 401 }) };
  }
  return { user, response: null };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  return ip || null;
}

export function smsErrorResponse(error: unknown, context: string) {
  if (error instanceof SmsPhoneError) {
    const body: SmsPhoneErrorBody = { error: error.message, code: error.code, ...error.extra };
    const response = NextResponse.json(body, { status: error.status });
    if (error.extra.retryAfterSeconds) {
      response.headers.set("Retry-After", String(error.extra.retryAfterSeconds));
    }
    return response;
  }
  logSmsError(context, error);
  const body: SmsPhoneErrorBody = {
    error: "Something went wrong. Please try again.",
    code: "server_error",
  };
  return NextResponse.json(body, { status: 500 });
}
