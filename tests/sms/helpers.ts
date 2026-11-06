import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getSmsConfig } from "../../lib/sms/config";
import type { SmsProcessorDeps } from "../../lib/sms/processor";
import type { SmsRpc } from "../../lib/sms/rpc";
import { TelnyxSmsProvider } from "../../lib/sms/telnyx";
import type { SendSmsInput, SendSmsResult } from "../../lib/sms/types";

const MIGRATIONS = [
  "20261103_000001_sms_prototype.sql",
  "20261104_000001_sms_phone_verification.sql",
];

export const LINGO_NUMBER = "+14165550100";

/** Real Postgres (WASM) with the SMS migrations and Supabase auth stubs. */
export async function createSmsTestDb() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  `);
  for (const file of MIGRATIONS) {
    await db.exec(readFileSync(path.join(process.cwd(), "supabase/migrations", file), "utf8"));
  }

  const rpc: SmsRpc = async <T,>(fn: string, args: Record<string, unknown>) => {
    const keys = Object.keys(args);
    const sql = `select public.${fn}(${keys.map((key, i) => `${key} => $${i + 1}`).join(", ")}) as result`;
    const params = keys.map((key) => {
      const value = args[key];
      return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
    });
    const result = await db.query<{ result: T }>(sql, params);
    return result.rows[0]?.result as T;
  };

  async function createUser() {
    const id = randomUUID();
    await db.query("insert into auth.users (id) values ($1)", [id]);
    return id;
  }

  return { db, rpc, createUser };
}

export class FakeSmsProvider extends TelnyxSmsProvider {
  sent: Array<SendSmsInput & { id: string }> = [];
  private failures: Error[] = [];
  private counter = 0;

  failNextSend(error: Error) {
    this.failures.push(error);
  }

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const failure = this.failures.shift();
    if (failure) throw failure;
    this.counter += 1;
    const id = `msg_${this.counter}`;
    this.sent.push({ ...input, id });
    return { id, status: "queued", raw: {} };
  }

  lastCode() {
    const body = this.sent[this.sent.length - 1]?.body ?? "";
    return body.match(/\b(\d{6})\b/)?.[1] ?? null;
  }
}

export function testConfig(overrides: Record<string, string> = {}) {
  return getSmsConfig({
    NODE_ENV: "test",
    SMS_PROVIDER: "telnyx",
    TELNYX_API_KEY: "test-key",
    TELNYX_PUBLIC_KEY: "test-public-key",
    TELNYX_FROM_NUMBER: LINGO_NUMBER,
    SMS_VERIFICATION_SECRET: "x".repeat(48),
    ...overrides,
  } as NodeJS.ProcessEnv);
}

export async function createSmsTestContext() {
  const database = await createSmsTestDb();
  const provider = new FakeSmsProvider();
  const replies: Array<Parameters<SmsProcessorDeps["generateReply"]>[0]> = [];
  const replyFailures: Error[] = [];

  const deps: SmsProcessorDeps = {
    rpc: database.rpc,
    provider,
    config: testConfig(),
    generateReply: async (input) => {
      replies.push(input);
      const failure = replyFailures.shift();
      if (failure) throw failure;
      return `你好！reply ${replies.length}`;
    },
  };

  return {
    ...database,
    provider,
    deps,
    replies,
    failNextReply(error: Error, times = 1) {
      for (let i = 0; i < times; i += 1) replyFailures.push(error);
    },
  };
}

let eventCounter = 0;

export function telnyxEvent(
  type: "message.received" | "message.sent" | "message.finalized",
  payload: {
    messageId: string;
    from: string;
    to: string;
    text?: string;
    status?: string;
    errors?: Array<{ code: string; title: string }>;
    occurredAt?: string;
    eventId?: string;
  },
) {
  eventCounter += 1;
  return {
    data: {
      event_type: type,
      id: payload.eventId ?? `evt_${eventCounter}_${randomUUID()}`,
      occurred_at: payload.occurredAt ?? new Date().toISOString(),
      payload: {
        id: payload.messageId,
        direction: type === "message.received" ? "inbound" : "outbound",
        from: { phone_number: payload.from },
        to: [{ phone_number: payload.to, status: payload.status }],
        text: payload.text ?? "",
        errors: payload.errors ?? [],
      },
    },
  };
}

/** Mirrors the webhook route: record (dedup) then process. */
export async function deliverWebhook(
  ctx: Awaited<ReturnType<typeof createSmsTestContext>>,
  envelope: ReturnType<typeof telnyxEvent>,
) {
  const { processSmsWebhookEvent } = await import("../../lib/sms/processor");
  const event = ctx.provider.parseStoredEvent(envelope);
  const recorded = await ctx.rpc<{ id: string; duplicate: boolean; pending: boolean }>(
    "sms_record_webhook_event",
    {
      p_provider: ctx.provider.name,
      p_event_id: event.id,
      p_event_type: event.type,
      p_occurred_at: event.occurredAt,
      p_payload: event.raw,
    },
  );
  const processed = recorded.pending
    ? await processSmsWebhookEvent(ctx.deps, recorded.id)
    : { outcome: "not_pending" };
  return { recorded, ...processed };
}
