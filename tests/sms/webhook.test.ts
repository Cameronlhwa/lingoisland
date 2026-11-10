import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { SMS_CONSENT_VERSION } from "../../lib/sms/consent";
import { fallbackReply } from "../../lib/sms/huahua/fallbacks";
import { RESUME_OFFER, SMS_HELP_MESSAGE, SMS_RESUBSCRIBED_MESSAGE } from "../../lib/sms/messages";
import { startVerification, verifyPhoneCode } from "../../lib/sms/phoneService";
import { processSmsWebhookEvent } from "../../lib/sms/processor";
import { SmsSendError } from "../../lib/sms/types";
import { createSmsTestContext, deliverWebhook, LINGO_NUMBER, telnyxEvent } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createSmsTestContext>>;

let ctx: Ctx;
let phoneCounter = 0;

function nextPhone() {
  phoneCounter += 1;
  return `+1647${String(3000000 + phoneCounter)}`;
}

async function activeLearner() {
  const userId = await ctx.createUser();
  await ctx.subscribe(userId);
  const phone = nextPhone();
  await startVerification(ctx.deps, {
    userId,
    ip: null,
    country: "CA",
    phoneNumber: phone,
    consent: true,
    consentVersion: SMS_CONSENT_VERSION,
    source: "account_settings",
  });
  await verifyPhoneCode(ctx.deps, {
    userId,
    code: ctx.provider.lastCode(),
    confirmTransfer: false,
    displayName: "Cam",
    languageLevel: "A2",
  });
  const { rows } = await ctx.db.query<{ id: string }>(
    "select id from sms_contacts where user_id = $1 and status = 'active'",
    [userId],
  );
  return { userId, phone, contactId: rows[0].id };
}

function inbound(from: string, text: string, extra: Partial<Parameters<typeof telnyxEvent>[1]> = {}) {
  return telnyxEvent("message.received", {
    messageId: `in_${randomUUID()}`,
    from,
    to: LINGO_NUMBER,
    text,
    ...extra,
  });
}

/** Outbound texts other than verification codes and the welcome. */
function conversationTo(phone: string) {
  return ctx.provider.sent.filter(
    (message) => message.to === phone && !message.body.includes("Huahua") && !/code: \d{6}/.test(message.body),
  );
}

async function contactStatus(contactId: string) {
  const { rows } = await ctx.db.query<{ status: string }>("select status from sms_contacts where id = $1", [contactId]);
  return rows[0].status;
}

before(async () => {
  ctx = await createSmsTestContext();
});

describe("inbound texts", () => {
  it("replies with AI to an active, verified learner", async () => {
    const learner = await activeLearner();
    const result = await deliverWebhook(ctx, inbound(learner.phone, "你好！我今天很累。"));

    assert.equal(result.outcome, "replied");
    const replies = conversationTo(learner.phone);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].from, LINGO_NUMBER);

    const call = ctx.replies[ctx.replies.length - 1];
    assert.equal(call.learnerName, "Cam");
    assert.equal(call.level, 3, "A2 maps to HSK 3");
    assert.deepEqual(call.history[call.history.length - 1], { direction: "inbound", body: "你好！我今天很累。" });
  });

  it("includes earlier conversation in the AI context", async () => {
    const learner = await activeLearner();
    await deliverWebhook(ctx, inbound(learner.phone, "第一条"));
    await deliverWebhook(ctx, inbound(learner.phone, "第二条"));
    const call = ctx.replies[ctx.replies.length - 1];
    const bodies = call.history.map((message) => message.body);
    assert.ok(bodies.includes("第一条"));
    assert.equal(bodies[bodies.length - 1], "第二条");
  });

  it("ignores unknown numbers without replying", async () => {
    const before = ctx.provider.sent.length;
    const stranger = nextPhone();
    const result = await deliverWebhook(ctx, inbound(stranger, "hi"));
    assert.equal(result.outcome, "ignored_unknown_number");
    assert.equal(ctx.provider.sent.length, before);
  });

  it("does not reply to pending (unverified) numbers", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    await startVerification(ctx.deps, {
      userId,
      ip: null,
      country: "CA",
      phoneNumber: phone,
      consent: true,
      consentVersion: SMS_CONSENT_VERSION,
      source: "onboarding",
    });
    const result = await deliverWebhook(ctx, inbound(phone, "你好"));
    assert.equal(result.outcome, "ignored_unknown_number");
    assert.equal(conversationTo(phone).length, 0);
  });

  it("does not reply to legacy prototype contacts that were never verified", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    await ctx.db.query("insert into sms_contacts (user_id, phone_number) values ($1, $2)", [userId, phone]);
    const result = await deliverWebhook(ctx, inbound(phone, "你好"));
    assert.equal(result.outcome, "ignored_unverified");
    assert.equal(conversationTo(phone).length, 0);
  });

  it("still replies while proactive texts are paused, and offers to resume", async () => {
    const learner = await activeLearner();
    await ctx.db.query("update sms_contacts set status = 'paused', paused_at = now() where id = $1", [learner.contactId]);
    const result = await deliverWebhook(ctx, inbound(learner.phone, "你好"));
    assert.equal(result.outcome, "replied");
    const replies = conversationTo(learner.phone);
    assert.equal(replies.length, 1);
    assert.ok(replies[0].body.includes(RESUME_OFFER));
    assert.equal(await contactStatus(learner.contactId), "paused");
  });

  it("ignores texts from LingoIsland's own number", async () => {
    const before = ctx.provider.sent.length;
    const result = await deliverWebhook(ctx, inbound(LINGO_NUMBER, "echo"));
    assert.equal(result.outcome, "ignored_own_number");
    assert.equal(ctx.provider.sent.length, before);
  });
});

describe("duplicate and retried webhooks", () => {
  it("processes a redelivered event only once", async () => {
    const learner = await activeLearner();
    const envelope = inbound(learner.phone, "重复");
    const first = await deliverWebhook(ctx, envelope);
    const second = await deliverWebhook(ctx, envelope);

    assert.equal(first.outcome, "replied");
    assert.equal(second.recorded.duplicate, true);
    assert.equal(second.outcome, "not_pending");
    assert.equal(conversationTo(learner.phone).length, 1);
  });

  it("does not reply twice to the same message under a different event id", async () => {
    const learner = await activeLearner();
    const messageId = `in_${randomUUID()}`;
    await deliverWebhook(ctx, inbound(learner.phone, "同一条", { messageId }));
    const again = await deliverWebhook(ctx, inbound(learner.phone, "同一条", { messageId }));
    assert.equal(again.outcome, "reply_skipped_duplicate");
    assert.equal(conversationTo(learner.phone).length, 1);
  });

  it("cannot be claimed by two workers at once", async () => {
    const learner = await activeLearner();
    const envelope = inbound(learner.phone, "并发");
    const recorded = await ctx.rpc<{ id: string }>("sms_record_webhook_event", {
      p_provider: "telnyx",
      p_event_id: envelope.data.id,
      p_event_type: "message.received",
      p_occurred_at: envelope.data.occurred_at,
      p_payload: envelope,
    });
    const [a, b] = await Promise.all([
      processSmsWebhookEvent(ctx.deps, recorded.id),
      processSmsWebhookEvent(ctx.deps, recorded.id),
    ]);
    assert.deepEqual([a.outcome, b.outcome].sort(), ["not_claimed", "replied"]);
    assert.equal(conversationTo(learner.phone).length, 1);
  });

  it("schedules a retry when processing throws, and succeeds later", async () => {
    const learner = await activeLearner();
    const envelope = inbound(learner.phone, "重试");
    const recorded = await ctx.rpc<{ id: string }>("sms_record_webhook_event", {
      p_provider: "telnyx",
      p_event_id: envelope.data.id,
      p_event_type: "message.received",
      p_occurred_at: envelope.data.occurred_at,
      p_payload: envelope,
    });

    const failingDeps = {
      ...ctx.deps,
      rpc: (async (fn: string, args: Record<string, unknown>) => {
        if (fn === "sms_handle_inbound") throw new Error("database unavailable");
        return ctx.rpc(fn, args);
      }) as typeof ctx.rpc,
    };
    const failed = await processSmsWebhookEvent(failingDeps, recorded.id);
    assert.equal(failed.outcome, "error");

    const { rows } = await ctx.db.query<{ error: string; processed_at: Date | null; next_attempt_at: Date }>(
      "select error, processed_at, next_attempt_at from sms_webhook_events where id = $1",
      [recorded.id],
    );
    assert.equal(rows[0].processed_at, null);
    assert.match(rows[0].error, /database unavailable/);
    assert.ok(rows[0].next_attempt_at.getTime() > Date.now());

    await ctx.db.query(
      "update sms_webhook_events set next_attempt_at = now() - interval '1 second', created_at = now() - interval '5 minutes' where id = $1",
      [recorded.id],
    );
    const retryable = await ctx.rpc<string[]>("sms_list_retryable_webhook_events", {
      p_limit: 50,
      p_min_age_seconds: 60,
      p_lease_seconds: 90,
      p_max_attempts: 5,
    });
    assert.ok(retryable.includes(recorded.id));

    const retried = await processSmsWebhookEvent(ctx.deps, recorded.id);
    assert.equal(retried.outcome, "replied");
    assert.equal(conversationTo(learner.phone).length, 1);
  });
});

describe("STOP, START, and HELP", () => {
  it("opts out on STOP and stops all AI replies", async () => {
    const learner = await activeLearner();
    const stop = await deliverWebhook(ctx, inbound(learner.phone, "STOP"));
    assert.equal(stop.outcome, "opted_out");
    assert.equal(await contactStatus(learner.contactId), "opted_out");

    const after = await deliverWebhook(ctx, inbound(learner.phone, "你好？"));
    assert.equal(after.outcome, "ignored_opted_out");
    assert.equal(conversationTo(learner.phone).length, 0);

    const { rows } = await ctx.db.query<{ opted_out_at: Date | null; consent_at: Date | null }>(
      "select opted_out_at, consent_at from sms_contacts where id = $1",
      [learner.contactId],
    );
    assert.ok(rows[0].opted_out_at);
    assert.ok(rows[0].consent_at, "consent audit is preserved");
  });

  it("resubscribes on START with a fixed confirmation", async () => {
    const learner = await activeLearner();
    await deliverWebhook(ctx, inbound(learner.phone, "stop"));
    const start = await deliverWebhook(ctx, inbound(learner.phone, "Start"));
    assert.equal(start.outcome, "resubscribed_sent");
    assert.equal(await contactStatus(learner.contactId), "active");
    assert.deepEqual(conversationTo(learner.phone).map((m) => m.body), [SMS_RESUBSCRIBED_MESSAGE]);

    const chat = await deliverWebhook(ctx, inbound(learner.phone, "我回来了"));
    assert.equal(chat.outcome, "replied");
  });

  it("ignores a STOP that arrives after a newer START", async () => {
    const learner = await activeLearner();
    const t0 = Date.now() - 60_000;
    await deliverWebhook(ctx, inbound(learner.phone, "STOP", { occurredAt: new Date(t0).toISOString() }));
    await deliverWebhook(ctx, inbound(learner.phone, "START", { occurredAt: new Date(t0 + 20_000).toISOString() }));
    const late = await deliverWebhook(
      ctx,
      inbound(learner.phone, "STOP", { occurredAt: new Date(t0 + 10_000).toISOString() }),
    );
    assert.equal(late.outcome, "already_opted_out");
    assert.equal(await contactStatus(learner.contactId), "active");
  });

  it("does not let START activate a number that was never verified", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    await ctx.db.query(
      "insert into sms_contacts (user_id, phone_number, status) values ($1, $2, 'opted_out')",
      [userId, phone],
    );
    const start = await deliverWebhook(ctx, inbound(phone, "START"));
    assert.equal(start.outcome, "start_unverified");
    const { rows } = await ctx.db.query<{ status: string }>(
      "select status from sms_contacts where phone_number = $1",
      [phone],
    );
    assert.equal(rows[0].status, "opted_out");
  });

  it("answers HELP with fixed copy, even for unknown numbers", async () => {
    const learner = await activeLearner();
    const help = await deliverWebhook(ctx, inbound(learner.phone, "HELP"));
    assert.equal(help.outcome, "help_sent");
    assert.deepEqual(
      ctx.provider.sent.filter((m) => m.to === learner.phone && m.body.startsWith("LingoIsland Mandarin practice")).map((m) => m.body),
      [SMS_HELP_MESSAGE],
    );
    assert.doesNotMatch(SMS_HELP_MESSAGE, /\bAI\b|artificial intelligence/i);
    assert.match(SMS_HELP_MESSAGE, /ourlingoisland@gmail\.com/);

    const stranger = nextPhone();
    const unknown = await deliverWebhook(ctx, inbound(stranger, "help"));
    assert.equal(unknown.outcome, "help_sent_unknown");
  });
});

describe("AI and provider failures", () => {
  it("sends one short fallback when DeepSeek fails, then stays quiet", async () => {
    const learner = await activeLearner();
    ctx.failNextReply(new Error("DeepSeek reply failed (503)"), 2);
    const first = await deliverWebhook(ctx, inbound(learner.phone, "第一"));
    assert.equal(first.outcome, "replied");
    const sent = conversationTo(learner.phone);
    assert.equal(sent.length, 1);
    assert.ok(sent[0].body.startsWith(fallbackReply(3).message));

    ctx.failNextReply(new Error("DeepSeek reply failed (503)"), 2);
    const second = await deliverWebhook(ctx, inbound(learner.phone, "第二"));
    assert.equal(second.outcome, "reply_failed");
    assert.equal(conversationTo(learner.phone).length, 1, "no repeated apologies");
  });

  it("retries DeepSeek once before falling back", async () => {
    const learner = await activeLearner();
    ctx.failNextReply(new Error("timeout"), 1);
    const result = await deliverWebhook(ctx, inbound(learner.phone, "再试"));
    assert.equal(result.outcome, "replied");
    assert.ok(!conversationTo(learner.phone)[0].body.startsWith(fallbackReply(3).message));
  });

  it("records provider failures and never resends an ambiguous message", async () => {
    const learner = await activeLearner();
    const envelope = inbound(learner.phone, "发送失败");
    ctx.provider.failNextSend(new SmsSendError("Telnyx send request failed: TimeoutError", { notSent: false }));
    const first = await deliverWebhook(ctx, envelope);
    assert.equal(first.outcome, "reply_failed");

    const { rows } = await ctx.db.query<{ status: string; retryable: boolean; error: string }>(
      "select status, retryable, error from sms_messages where contact_id = $1 and kind = 'reply'",
      [learner.contactId],
    );
    assert.deepEqual(
      rows.map(({ status, retryable }) => ({ status, retryable })),
      [{ status: "failed", retryable: false }],
    );

    // Reprocessing the same inbound message (e.g. a provider retry with a new event id) must not resend.
    const again = await deliverWebhook(
      ctx,
      inbound(learner.phone, "发送失败", { messageId: envelope.data.payload.id }),
    );
    assert.equal(again.outcome, "reply_skipped_duplicate");
    assert.equal(conversationTo(learner.phone).length, 0);
  });

  it("marks the contact opted out when the provider reports a STOP block", async () => {
    const learner = await activeLearner();
    ctx.provider.failNextSend(
      new SmsSendError("Telnyx send failed (400, code 40300)", { notSent: true, code: "40300", recipientOptedOut: true }),
    );
    await deliverWebhook(ctx, inbound(learner.phone, "你好"));
    assert.equal(await contactStatus(learner.contactId), "opted_out");
  });
});

describe("delivery receipts", () => {
  async function sentReply() {
    const learner = await activeLearner();
    await deliverWebhook(ctx, inbound(learner.phone, "你好"));
    const reply = conversationTo(learner.phone)[0];
    return { ...learner, providerMessageId: reply.id };
  }

  function receipt(phone: string, messageId: string, status: string, errors?: Array<{ code: string; title: string }>) {
    return telnyxEvent("message.finalized", { messageId, from: LINGO_NUMBER, to: phone, status, errors });
  }

  async function messageStatus(providerMessageId: string) {
    const { rows } = await ctx.db.query<{ status: string }>(
      "select status from sms_messages where provider_message_id = $1",
      [providerMessageId],
    );
    return rows[0].status;
  }

  it("does not regress a final status when receipts arrive out of order", async () => {
    const { phone, providerMessageId } = await sentReply();
    await deliverWebhook(ctx, receipt(phone, providerMessageId, "delivered"));
    const late = await deliverWebhook(
      ctx,
      telnyxEvent("message.sent", { messageId: providerMessageId, from: LINGO_NUMBER, to: phone, status: "sent" }),
    );
    assert.equal(late.outcome, "stale_status");
    assert.equal(await messageStatus(providerMessageId), "delivered");
  });

  it("disables a number after repeated permanent delivery failures", async () => {
    const learner = await activeLearner();
    for (let i = 0; i < 3; i += 1) {
      await deliverWebhook(ctx, inbound(learner.phone, `消息 ${i}`));
      const latest = conversationTo(learner.phone).at(-1)!;
      await deliverWebhook(
        ctx,
        receipt(learner.phone, latest.id, "delivery_failed", [{ code: "40008", title: "Undeliverable" }]),
      );
    }
    assert.equal(await contactStatus(learner.contactId), "disabled");
    const { rows } = await ctx.db.query<{ last_delivery_error: string; disabled_at: Date | null }>(
      "select last_delivery_error, disabled_at from sms_contacts where id = $1",
      [learner.contactId],
    );
    assert.match(rows[0].last_delivery_error, /40008/);
    assert.ok(rows[0].disabled_at);

    const after = await deliverWebhook(ctx, inbound(learner.phone, "还在吗"));
    assert.equal(after.outcome, "ignored_disabled");
  });

  it("counts a duplicated failure receipt once", async () => {
    const { phone, providerMessageId, contactId } = await sentReply();
    const failure = receipt(phone, providerMessageId, "delivery_failed", [{ code: "40008", title: "Undeliverable" }]);
    await deliverWebhook(ctx, failure);
    await deliverWebhook(ctx, receipt(phone, providerMessageId, "delivery_failed", [{ code: "40008", title: "Undeliverable" }]));
    const { rows } = await ctx.db.query<{ delivery_failure_count: number }>(
      "select delivery_failure_count from sms_contacts where id = $1",
      [contactId],
    );
    assert.equal(rows[0].delivery_failure_count, 1);
  });

  it("opts the contact out when the carrier reports a STOP block", async () => {
    const { phone, providerMessageId, contactId } = await sentReply();
    const result = await deliverWebhook(
      ctx,
      receipt(phone, providerMessageId, "delivery_failed", [{ code: "40300", title: "Blocked due to STOP" }]),
    );
    assert.equal(result.outcome, "recipient_opted_out");
    assert.equal(await contactStatus(contactId), "opted_out");
  });

  it("tracks delivery of verification codes without storing them as messages", async () => {
    const userId = await ctx.createUser();
    const phone = nextPhone();
    await startVerification(ctx.deps, {
      userId,
      ip: null,
      country: "CA",
      phoneNumber: phone,
      consent: true,
      consentVersion: SMS_CONSENT_VERSION,
      source: "account_settings",
    });
    const codeMessage = ctx.provider.sent.at(-1)!;
    const result = await deliverWebhook(
      ctx,
      receipt(phone, codeMessage.id, "delivery_failed", [{ code: "40008", title: "Undeliverable" }]),
    );
    assert.equal(result.outcome, "verification_status");
    const { rows } = await ctx.db.query<{ count: number }>(
      "select count(*)::int as count from sms_messages where provider_message_id = $1",
      [codeMessage.id],
    );
    assert.equal(rows[0].count, 0);
  });
});
