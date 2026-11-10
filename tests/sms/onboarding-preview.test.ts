import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { MESSAGING_CONSENT_VERSION } from "../../lib/sms/consent";
import { PREVIEW_MAX_LEARNER_MESSAGES, startHuahuaPreview } from "../../lib/sms/huahua/preview";
import { SmsPhoneError, startVerification, verifyPhoneCode } from "../../lib/sms/phoneService";
import { SmsSendError } from "../../lib/sms/types";
import { connectLearner, createSmsTestContext, deliverWebhook, inboundText, sentTo, testConfig } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createSmsTestContext>>;
let ctx: Ctx;
let phoneCounter = 0;

const WHATSAPP_ENV = {
  WHATSAPP_ENABLED: "true",
  TELNYX_WHATSAPP_FROM_NUMBER: "+14165550199",
  TELNYX_WHATSAPP_VERIFICATION_TEMPLATE: "lingo_verify",
  TELNYX_WHATSAPP_PREVIEW_TEMPLATE: "lingo_preview",
};

function ukMobile() {
  phoneCounter += 1;
  return `+447400${String(100000 + phoneCounter)}`;
}

function startOnboarding(userId: string, input: { country: string; phoneNumber: string; channel: "sms" | "whatsapp"; scheduled?: boolean; journey?: boolean }) {
  return startVerification(ctx.deps, {
    userId,
    ip: null,
    country: input.country,
    phoneNumber: input.phoneNumber,
    channel: input.channel,
    consentVersion: MESSAGING_CONSENT_VERSION,
    consentScheduled: input.scheduled ?? true,
    consentJourney: input.journey ?? true,
    source: "onboarding",
  });
}

async function expectSmsError(promise: Promise<unknown>, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SmsPhoneError, `expected SmsPhoneError, got ${error}`);
    assert.equal(error.code, code);
    return true;
  });
}

async function previewThread(userId: string) {
  return ctx.rpc<{ thread: { session: { preview: { stage: string; learnerMessages: number } } } } | null>("sms_get_preview_thread", {
    p_user_id: userId,
    p_message_limit: 20,
  });
}

before(async () => {
  ctx = await createSmsTestContext();
});

beforeEach(() => {
  ctx.deps.config = testConfig();
  ctx.setNow(null);
});

describe("choosing a channel during onboarding", () => {
  it("never moves an SMS request to WhatsApp when the country only supports WhatsApp", async () => {
    ctx.deps.config = testConfig(WHATSAPP_ENV);
    const userId = await ctx.createUser();
    const before = ctx.provider.sent.length;
    await expectSmsError(startOnboarding(userId, { country: "GB", phoneNumber: ukMobile(), channel: "sms" }), "unsupported_country");
    assert.equal(ctx.provider.sent.length, before, "nothing was sent");
  });

  it("refuses WhatsApp while it is not configured", async () => {
    const userId = await ctx.createUser();
    await expectSmsError(startOnboarding(userId, { country: "GB", phoneNumber: ukMobile(), channel: "whatsapp" }), "whatsapp_unavailable");
  });

  it("verifies over WhatsApp with the approved template and stores the channel", async () => {
    ctx.deps.config = testConfig(WHATSAPP_ENV);
    const userId = await ctx.createUser();
    const phone = ukMobile();
    await startOnboarding(userId, { country: "GB", phoneNumber: phone, channel: "whatsapp" });
    const codeMessage = ctx.provider.sent[ctx.provider.sent.length - 1];
    assert.equal(codeMessage.to, phone);
    assert.equal(codeMessage.channel, "whatsapp");
    assert.equal(codeMessage.template?.name, "lingo_verify");
    await verifyPhoneCode(ctx.deps, { userId, code: ctx.provider.lastCode(), confirmTransfer: false, displayName: "Mei", languageLevel: "A1" });
    const { rows } = await ctx.db.query<{ channel: string; status: string }>("select channel, status from sms_contacts where user_id = $1", [userId]);
    assert.deepEqual(rows, [{ channel: "whatsapp", status: "active" }]);
  });

  it("records the two message consents separately", async () => {
    const userId = await ctx.createUser();
    await startOnboarding(userId, { country: "CA", phoneNumber: "+14165557001", channel: "sms", scheduled: false, journey: true });
    await verifyPhoneCode(ctx.deps, { userId, code: ctx.provider.lastCode(), confirmTransfer: false, displayName: "Mei", languageLevel: "A1" });
    const { rows } = await ctx.db.query<{ consent_scheduled: boolean; consent_journey: boolean }>(
      "select consent_scheduled, consent_journey from sms_preferences where user_id = $1",
      [userId],
    );
    assert.deepEqual(rows, [{ consent_scheduled: false, consent_journey: true }]);
  });

  it("requires at least one consent", async () => {
    const userId = await ctx.createUser();
    await expectSmsError(
      startOnboarding(userId, { country: "CA", phoneNumber: "+14165557002", channel: "sms", scheduled: false, journey: false }),
      "consent_required",
    );
  });
});

describe("free preview chat", () => {
  it("sends the intro once, unmetered, even before the learner subscribes", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    const first = await startHuahuaPreview(ctx.deps, { userId: learner.userId, contactId: learner.contactId, channel: "sms" });
    assert.equal(first.status, "sent");
    const again = await startHuahuaPreview(ctx.deps, { userId: learner.userId, contactId: learner.contactId, channel: "sms" });
    assert.equal(again.status, "already_sent");
    const intros = sentTo(ctx, learner.phone).filter((message) => message.body.includes("Ready to personalize"));
    assert.equal(intros.length, 1);
    assert.match(intros[0].body, /STOP to opt out/);
    assert.doesNotMatch(intros[0].body, /\bAI\b|artificial intelligence/i);
    const usage = await ctx.db.query<{ used: number }>("select coalesce(sum(used_segments), 0)::int as used from sms_usage_periods where user_id = $1", [learner.userId]);
    assert.equal(usage.rows[0].used, 0, "preview is not charged against the allowance");
    assert.equal((await previewThread(learner.userId))?.thread.session.preview.stage, "intro");
  });

  it("walks through topic, support, corrections, and frequency without calling the AI", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    await startHuahuaPreview(ctx.deps, { userId: learner.userId, contactId: learner.contactId, channel: "sms" });
    const aiCalls = ctx.replies.length;
    for (const text of ["yes", "1", "3", "3", "5"]) {
      await deliverWebhook(ctx, inboundText(learner.phone, text));
    }
    assert.equal(ctx.replies.length, aiCalls, "the preview never needs the model");
    const replies = sentTo(ctx, learner.phone).map((message) => message.body);
    assert.ok(replies.some((body) => /how should I correct you\?/.test(body)), "asks about corrections");
    assert.match(replies[replies.length - 1], /^Perfect! I’ll remember/);
    const preview = (await previewThread(learner.userId))?.thread.session.preview as { stage: string; correction?: string } | undefined;
    assert.equal(preview?.stage, "done");
    assert.equal(preview?.correction, "direct");
    const prefs = await ctx.db.query<{ scaffolding: string | null; correction_mode: string | null; openers_per_week: number | null }>(
      "select scaffolding, correction_mode, openers_per_week from sms_preferences where user_id = $1",
      [learner.userId],
    );
    assert.equal(prefs.rows[0]?.scaffolding, "less", "the chosen support level is saved");
    assert.equal(prefs.rows[0]?.correction_mode, "coach", "direct corrections are saved");
    assert.equal(prefs.rows[0]?.openers_per_week, 5, "the chosen frequency is saved");
  });

  it(`finishes within ${PREVIEW_MAX_LEARNER_MESSAGES} learner messages even when answers are unclear`, async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    await startHuahuaPreview(ctx.deps, { userId: learner.userId, contactId: learner.contactId, channel: "sms" });
    let messages = 0;
    for (; messages < PREVIEW_MAX_LEARNER_MESSAGES; messages += 1) {
      const thread = await previewThread(learner.userId);
      if (thread?.thread.session.preview.stage === "done") break;
      await deliverWebhook(ctx, inboundText(learner.phone, "hmm 🤔"));
    }
    assert.ok(messages <= PREVIEW_MAX_LEARNER_MESSAGES);
    assert.equal((await previewThread(learner.userId))?.thread.session.preview.stage, "done");
  });

  it("wraps up after 10 minutes", async () => {
    const start = new Date("2026-11-07T15:00:00Z");
    ctx.setNow(start);
    const learner = await connectLearner(ctx, { subscribed: false });
    await startHuahuaPreview(ctx.deps, { userId: learner.userId, contactId: learner.contactId, channel: "sms" });
    ctx.setNow(new Date(start.getTime() + 11 * 60_000));
    await deliverWebhook(ctx, inboundText(learner.phone, "yes"));
    const replies = sentTo(ctx, learner.phone).map((message) => message.body);
    assert.match(replies[replies.length - 1], /^Perfect!/);
  });

  it("reports a provider failure without opening a preview thread", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    ctx.provider.failNextSend(new SmsSendError("rejected", { notSent: true, retryable: false }));
    const result = await startHuahuaPreview(ctx.deps, { userId: learner.userId, contactId: learner.contactId, channel: "sms" });
    assert.equal(result.status, "failed");
    assert.equal(await previewThread(learner.userId), null);
  });

  it("sends nothing to a number that stopped messages", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    await deliverWebhook(ctx, inboundText(learner.phone, "STOP"));
    const before = ctx.provider.sent.length;
    const result = await startHuahuaPreview(ctx.deps, { userId: learner.userId, contactId: learner.contactId, channel: "sms" });
    assert.equal(result.status, "skipped");
    assert.equal(ctx.provider.sent.length, before);
  });

  it("uses the approved WhatsApp template because the learner has not written yet", async () => {
    ctx.deps.config = testConfig(WHATSAPP_ENV);
    const userId = await ctx.createUser();
    await startOnboarding(userId, { country: "GB", phoneNumber: ukMobile(), channel: "whatsapp" });
    await verifyPhoneCode(ctx.deps, { userId, code: ctx.provider.lastCode(), confirmTransfer: false, displayName: "Mei", languageLevel: "A1" });
    const { rows } = await ctx.db.query<{ id: string }>("select id from sms_contacts where user_id = $1", [userId]);
    const result = await startHuahuaPreview(ctx.deps, { userId, contactId: rows[0].id, channel: "whatsapp" });
    assert.equal(result.status, "sent");
    const last = ctx.provider.sent[ctx.provider.sent.length - 1];
    assert.equal(last.channel, "whatsapp");
    assert.equal(last.template?.name, "lingo_preview");
  });

  it("sends nothing on WhatsApp outside the 24-hour window without a template", async () => {
    ctx.deps.config = testConfig({ ...WHATSAPP_ENV, TELNYX_WHATSAPP_PREVIEW_TEMPLATE: "" });
    const userId = await ctx.createUser();
    await startOnboarding(userId, { country: "GB", phoneNumber: ukMobile(), channel: "whatsapp" });
    await verifyPhoneCode(ctx.deps, { userId, code: ctx.provider.lastCode(), confirmTransfer: false, displayName: "Mei", languageLevel: "A1" });
    const { rows } = await ctx.db.query<{ id: string }>("select id from sms_contacts where user_id = $1", [userId]);
    const before = ctx.provider.sent.length;
    const result = await startHuahuaPreview(ctx.deps, { userId, contactId: rows[0].id, channel: "whatsapp" });
    assert.deepEqual(result, { status: "skipped", reason: "whatsapp_window_closed" });
    assert.equal(ctx.provider.sent.length, before);
  });
});
