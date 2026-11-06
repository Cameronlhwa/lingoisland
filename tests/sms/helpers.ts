import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { getSmsConfig } from "../../lib/sms/config";
import type { HuahuaTurnInput } from "../../lib/sms/huahua/ai";
import type { SmsProcessorDeps } from "../../lib/sms/processor";
import type { SmsRpc } from "../../lib/sms/rpc";
import { TelnyxSmsProvider } from "../../lib/sms/telnyx";
import type { SendSmsInput, SendSmsResult } from "../../lib/sms/types";

const MIGRATIONS = [
  "20261103_000001_sms_prototype.sql",
  "20261104_000001_sms_phone_verification.sql",
  "20261106_000001_sms_huahua_phase2.sql",
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

    -- Minimal shapes of the app tables the SMS functions read.
    create table public.user_profiles (
      user_id uuid primary key references auth.users(id),
      cefr_level text,
      hsk_current_level int,
      timezone text
    );
    create table public.profiles (
      id uuid primary key references auth.users(id),
      plan text not null default 'free',
      current_period_end timestamptz
    );
    create table public.product_subscriptions (
      user_id uuid not null references auth.users(id),
      product text not null,
      status text not null default 'active',
      current_period_end timestamptz,
      primary key (user_id, product)
    );
    create table public.journeys (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id),
      topic text not null default 'Work',
      completed_at timestamptz
    );
    create table public.journey_islands (
      id uuid primary key default gen_random_uuid(),
      journey_id uuid not null references public.journeys(id),
      name text,
      zh text,
      island_id uuid,
      node_type text not null default 'island',
      seed_words jsonb,
      completed_at timestamptz
    );
    create table public.island_words (
      id uuid primary key default gen_random_uuid(),
      island_id uuid not null,
      hanzi text not null,
      pinyin text,
      english text,
      position int not null default 0
    );
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

export type TurnResponder = (input: HuahuaTurnInput, index: number) => unknown;

export function defaultTurn(input: HuahuaTurnInput, index: number) {
  return {
    message: input.mode === "opener" ? `今天想聊聊吗？opener ${index}` : `你好！reply ${index}`,
    pinyin: null,
    translation: input.mode === "opener" ? "Want to chat today?" : "Hi!",
    target_vocab: [],
    word_comfort_updates: [],
    conversation_state: "practicing",
    safety: "safe",
  };
}

export async function createSmsTestContext(options: { now?: Date } = {}) {
  const database = await createSmsTestDb();
  const provider = new FakeSmsProvider();
  const replies: HuahuaTurnInput[] = [];
  const replyFailures: Error[] = [];
  const clockState = { now: options.now ?? null as Date | null };
  let responder: TurnResponder = defaultTurn;

  const deps: SmsProcessorDeps = {
    rpc: database.rpc,
    provider,
    config: testConfig(),
    now: () => clockState.now ?? new Date(),
    turnTimeoutMs: 2000,
    generateTurn: async (input) => {
      replies.push(input);
      const failure = replyFailures.shift();
      if (failure) throw failure;
      return responder(input, replies.length);
    },
  };

  /** Gives the user an active subscription (via product_subscriptions). */
  async function subscribe(userId: string, periodEnd = new Date(Date.now() + 200 * 86400_000)) {
    await database.db.query(
      `insert into public.product_subscriptions (user_id, product, status, current_period_end)
       values ($1, 'core', 'active', $2)
       on conflict (user_id, product) do update set status = 'active', current_period_end = excluded.current_period_end`,
      [userId, periodEnd.toISOString()],
    );
  }

  async function setProfile(userId: string, profile: { cefr?: string | null; hsk?: number | null; timezone?: string | null }) {
    await database.db.query(
      `insert into public.user_profiles (user_id, cefr_level, hsk_current_level, timezone) values ($1, $2, $3, $4)
       on conflict (user_id) do update set cefr_level = excluded.cefr_level,
         hsk_current_level = excluded.hsk_current_level, timezone = excluded.timezone`,
      [userId, profile.cefr ?? null, profile.hsk ?? null, profile.timezone ?? null],
    );
  }

  return {
    ...database,
    provider,
    deps,
    replies,
    subscribe,
    setProfile,
    setNow(now: Date | null) {
      clockState.now = now;
    },
    respondWith(next: TurnResponder) {
      responder = next;
    },
    failNextReply(error: Error, times = 1) {
      for (let i = 0; i < times; i += 1) replyFailures.push(error);
    },
  };
}

type TestCtx = Awaited<ReturnType<typeof createSmsTestContext>>;
let phoneCounter = 0;

export function uniquePhone(prefix = "+1437") {
  phoneCounter += 1;
  return `${prefix}${String(5000000 + phoneCounter)}`;
}

/** A verified, consented learner. Subscribed unless `subscribed: false`. */
export async function connectLearner(
  ctx: TestCtx,
  options: { subscribed?: boolean; cefr?: string | null; hsk?: number | null; timezone?: string | null; level?: string } = {},
) {
  const { startVerification, verifyPhoneCode } = await import("../../lib/sms/phoneService");
  const { SMS_CONSENT_VERSION } = await import("../../lib/sms/consent");
  const userId = await ctx.createUser();
  if (options.subscribed !== false) await ctx.subscribe(userId);
  if (options.cefr !== undefined || options.hsk !== undefined || options.timezone !== undefined) {
    await ctx.setProfile(userId, { cefr: options.cefr ?? null, hsk: options.hsk ?? null, timezone: options.timezone ?? null });
  }
  const phone = uniquePhone();
  await startVerification(ctx.deps, {
    userId,
    ip: null,
    country: "CA",
    phoneNumber: phone,
    consent: true,
    consentVersion: SMS_CONSENT_VERSION,
    source: "onboarding",
  });
  await verifyPhoneCode(ctx.deps, {
    userId,
    code: ctx.provider.lastCode(),
    confirmTransfer: false,
    displayName: "Mei",
    languageLevel: options.level ?? "A2",
  });
  const { rows } = await ctx.db.query<{ id: string }>(
    "select id from sms_contacts where user_id = $1 and status = 'active'",
    [userId],
  );
  return { userId, phone, contactId: rows[0].id };
}

export function sentTo(ctx: TestCtx, phone: string) {
  return ctx.provider.sent.filter((message) => message.to === phone && !/code: \d{6}/.test(message.body));
}

export function inboundText(from: string, text: string, extra: Partial<Parameters<typeof telnyxEvent>[1]> = {}) {
  return telnyxEvent("message.received", {
    messageId: `in_${randomUUID()}`,
    from,
    to: LINGO_NUMBER,
    text,
    ...extra,
  });
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
