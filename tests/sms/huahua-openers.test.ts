import assert from "node:assert/strict";
import { before, beforeEach, describe, it } from "node:test";
import { FINAL_PAUSE_MESSAGE, RESUME_OFFER } from "../../lib/sms/messages";
import {
  enqueueJourneyOpener,
  evaluateGates,
  pickOpenerVocab,
  planScheduledOpeners,
  runDueJobs,
  seededRandom,
} from "../../lib/sms/huahua/openers";
import { HUAHUA_PLANS } from "../../lib/sms/huahua/plans";
import { DEFAULT_PREFERENCES, type HuahuaContext } from "../../lib/sms/huahua/context";
import { localParts, zonedTimeToUtc } from "../../lib/sms/huahua/schedule";
import { SmsSendError } from "../../lib/sms/types";
import { connectLearner, createSmsTestContext, deliverWebhook, inboundText, sentTo } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createSmsTestContext>>;
let ctx: Ctx;
const TZ = "America/Toronto";

/** Local wall-clock time in Toronto, `weeks` weeks after the next Wednesday. */
function wednesday(weeks: number, minutes: number, dayOffset = 0) {
  const today = localParts(new Date(), TZ);
  const base = new Date(Date.UTC(today.year, today.month - 1, today.day));
  const untilWed = ((3 - today.weekday + 7) % 7) || 7;
  base.setUTCDate(base.getUTCDate() + untilWed + weeks * 7 + dayOffset);
  return zonedTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), minutes, TZ);
}

const at = (h: number, m = 0) => h * 60 + m;

before(async () => {
  ctx = await createSmsTestContext();
});

beforeEach(async () => {
  ctx.setNow(null);
  // Tests share one database; keep earlier tests' jobs out of this test's runs.
  await ctx.db.query("update sms_jobs set status = 'cancelled' where status in ('pending', 'processing')");
});

async function learnerWithJourney(options: { subscribed?: boolean } = {}) {
  const learner = await connectLearner(ctx, { cefr: "A2", timezone: TZ, subscribed: options.subscribed });
  const { rows: journey } = await ctx.db.query<{ id: string }>(
    "insert into journeys (user_id, topic) values ($1, 'Coffee shop') returning id",
    [learner.userId],
  );
  return { ...learner, journeyId: journey[0].id };
}

async function completeStep(learner: { journeyId: string; userId: string }, completedAt: Date, name = "Ordering coffee") {
  const { rows } = await ctx.db.query<{ id: string; island_id: string }>(
    `insert into journey_islands (journey_id, name, zh, island_id, completed_at)
     values ($1, $2, '点咖啡', gen_random_uuid(), $3) returning id, island_id`,
    [learner.journeyId, name, completedAt.toISOString()],
  );
  await ctx.db.query(
    `insert into island_words (island_id, hanzi, pinyin, english, position) values
     ($1, '咖啡', 'kāfēi', 'coffee', 0), ($1, '一杯', 'yì bēi', 'a cup', 1), ($1, '拿铁', 'nátiě', 'latte', 2)`,
    [rows[0].island_id],
  );
  return rows[0].id;
}

async function job(key: string) {
  const { rows } = await ctx.db.query<{ status: string; outcome: string | null; not_before: Date; attempts: number }>(
    "select status, outcome, not_before, attempts from sms_jobs where idempotency_key = $1",
    [key],
  );
  return rows[0];
}

function openersTo(phone: string) {
  return sentTo(ctx, phone).filter((message) => !message.body.includes("Huahua"));
}

async function runAt(when: Date) {
  ctx.setNow(when);
  return runDueJobs(ctx.deps);
}

describe("Journey completion trigger", () => {
  it("sends a truthful opener the same evening when completed inside the window", async () => {
    const learner = await learnerWithJourney();
    const now = wednesday(0, at(18, 30));
    ctx.setNow(now);
    const stepId = await completeStep(learner, now);
    const queued = await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    assert.equal(queued.created, true);
    assert.equal(openersTo(learner.phone).length, 0, "never sent synchronously");

    const result = await runAt(now);
    assert.equal(result.outcomes.opener_sent, 1);
    assert.equal(openersTo(learner.phone).length, 1);

    const input = ctx.replies.at(-1)!;
    assert.equal(input.mode, "opener");
    assert.deepEqual(input.facts, ['The learner completed the Journey lesson "Ordering coffee" today.']);
    assert.ok(input.targetVocab.length > 0);
    assert.ok(input.targetVocab.every((word) => ["咖啡", "一杯", "拿铁"].includes(word.hanzi)));

    const { rows } = await ctx.db.query<{ origin: string; journey_island_id: string }>(
      "select origin, journey_island_id from sms_threads where contact_id = $1 and status = 'open'",
      [learner.contactId],
    );
    assert.deepEqual(rows[0], { origin: "opener", journey_island_id: stepId });
  });

  it("waits for the evening window when completed in the morning", async () => {
    const learner = await learnerWithJourney();
    const morning = wednesday(0, at(10));
    ctx.setNow(morning);
    const stepId = await completeStep(learner, morning);
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });

    await runAt(morning);
    const pending = await job(`journey:${stepId}`);
    assert.equal(pending.status, "pending");
    assert.equal(pending.outcome, "outside_window");
    assert.equal(pending.not_before.toISOString(), wednesday(0, at(18)).toISOString());
    assert.equal(openersTo(learner.phone).length, 0);

    await runAt(wednesday(0, at(18, 5)));
    assert.equal((await job(`journey:${stepId}`)).status, "sent");
    assert.equal(ctx.replies.at(-1)!.facts[0], 'The learner completed the Journey lesson "Ordering coffee" today.');
  });

  it("moves to the next day's window when completed late, and says 'recently'", async () => {
    const learner = await learnerWithJourney();
    const late = wednesday(0, at(22, 30));
    ctx.setNow(late);
    const stepId = await completeStep(learner, late);
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    await runAt(late);
    assert.equal((await job(`journey:${stepId}`)).not_before.toISOString(), wednesday(0, at(18), 1).toISOString());

    await runAt(wednesday(0, at(18, 1), 1));
    assert.equal((await job(`journey:${stepId}`)).status, "sent");
    assert.match(ctx.replies.at(-1)!.facts[0], /recently\.$/);
  });

  it("is idempotent: completing the same step twice sends one opener", async () => {
    const learner = await learnerWithJourney();
    const now = wednesday(1, at(19));
    ctx.setNow(now);
    const stepId = await completeStep(learner, now);
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    const again = await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    assert.equal(again.created, false);
    await Promise.all([runAt(now), runDueJobs(ctx.deps)]);
    await runAt(now);
    assert.equal(openersTo(learner.phone).length, 1);
  });

  it("sends at most one opener per day; a newer Journey step supersedes the older job", async () => {
    const learner = await learnerWithJourney();
    const morning = wednesday(2, at(9));
    ctx.setNow(morning);
    const first = await completeStep(learner, morning, "Step one");
    const second = await completeStep(learner, morning, "Step two");
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: first });
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: second });
    assert.equal((await job(`journey:${first}`)).outcome, "superseded");
    await runAt(wednesday(2, at(19)));
    assert.equal(openersTo(learner.phone).length, 1);
    assert.match(ctx.replies.at(-1)!.facts[0], /Step two/);

    const third = await completeStep(learner, wednesday(2, at(19, 30)), "Step three");
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: third });
    await runAt(wednesday(2, at(19, 31)));
    assert.equal(openersTo(learner.phone).length, 1, "one per day");
    assert.equal((await job(`journey:${third}`)).status, "pending");
  });

  it("skips learners without a subscription", async () => {
    const learner = await learnerWithJourney({ subscribed: false });
    const now = wednesday(0, at(19));
    ctx.setNow(now);
    const stepId = await completeStep(learner, now);
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    await runAt(now);
    assert.equal((await job(`journey:${stepId}`)).outcome, "not_subscribed");
    assert.equal(openersTo(learner.phone).length, 0);
  });

  it("skips paused learners and does not queue for opted-out learners", async () => {
    const paused = await learnerWithJourney();
    const now = wednesday(0, at(19));
    ctx.setNow(now);
    await ctx.rpc("sms_set_paused", { p_user_id: paused.userId, p_paused: true });
    const stepId = await completeStep(paused, now);
    await enqueueJourneyOpener(ctx.deps, { userId: paused.userId, journeyIslandId: stepId });
    await runAt(now);
    assert.equal((await job(`journey:${stepId}`)).outcome, "contact_paused");

    const optedOut = await learnerWithJourney();
    await deliverWebhook(ctx, inboundText(optedOut.phone, "STOP"));
    const other = await completeStep(optedOut, now);
    const queued = await enqueueJourneyOpener(ctx.deps, { userId: optedOut.userId, journeyIslandId: other });
    assert.equal(queued.created, false);
    assert.equal(queued.status, "no_contact");
  });

  it("skips when the allowance is used up", async () => {
    const learner = await learnerWithJourney();
    const now = wednesday(0, at(19));
    ctx.setNow(now);
    const stepId = await completeStep(learner, now);
    const { loadHuahuaContext } = await import("../../lib/sms/huahua/context");
    const context = await loadHuahuaContext(ctx.deps, learner.userId, now);
    await ctx.db.query(
      `insert into sms_usage_periods (user_id, period_start, period_end, plan_key, allowance_segments, used_segments)
       values ($1, $2, $3, 'subscriber', $4, $4)`,
      [learner.userId, context.period.start.toISOString(), context.period.end.toISOString(), HUAHUA_PLANS.subscriber.allowanceSegments],
    );
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    await runAt(now);
    assert.equal((await job(`journey:${stepId}`)).outcome, "allowance_exhausted");
    assert.equal(openersTo(learner.phone).length, 0);
  });

  it("waits while the learner is mid-conversation", async () => {
    const learner = await learnerWithJourney();
    const now = wednesday(0, at(18));
    ctx.setNow(new Date(now.getTime() - 60 * 60_000));
    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    ctx.setNow(now);
    const stepId = await completeStep(learner, now);
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    await runAt(now);
    const pending = await job(`journey:${stepId}`);
    assert.equal(pending.outcome, "active_conversation");
    assert.equal(pending.not_before.toISOString(), wednesday(0, at(20)).toISOString(), "3 hours after their last text");
  });

  it("retries a failed send with backoff", async () => {
    const learner = await learnerWithJourney();
    const now = wednesday(3, at(19));
    ctx.setNow(now);
    const stepId = await completeStep(learner, now);
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    ctx.provider.failNextSend(new SmsSendError("Telnyx send failed (503)", { notSent: true, retryable: false }));
    const result = await runAt(now);
    assert.equal(result.outcomes.retry_scheduled, 1);
    const retry = await job(`journey:${stepId}`);
    assert.equal(retry.status, "pending");
    assert.ok(retry.not_before > now);
    assert.equal(openersTo(learner.phone).length, 0);
  });
});

describe("non-response rules", () => {
  it("reduces frequency after 2 unanswered, sends one final message after 3 and pauses, and a reply reactivates", async () => {
    const learner = await learnerWithJourney();
    const send = async (week: number) => {
      const now = wednesday(week, at(19));
      ctx.setNow(now);
      await ctx.rpc("sms_enqueue_job", {
        p_user_id: learner.userId,
        p_kind: "scheduled_opener",
        p_idempotency_key: `test:${learner.userId}:${week}`,
        p_not_before: now.toISOString(),
        p_journey_island_id: null,
      });
      const result = await runDueJobs(ctx.deps);
      return Object.keys(result.outcomes)[0];
    };
    const prefs = async () =>
      (
        await ctx.db.query<{ unanswered_openers: number; openers_per_week: number | null; control_sent_at: Date | null }>(
          "select unanswered_openers, openers_per_week, control_sent_at from sms_preferences where user_id = $1",
          [learner.userId],
        )
      ).rows[0];

    assert.equal(await send(0), "opener_sent");
    assert.equal(await send(1), "opener_sent");
    assert.equal((await prefs()).unanswered_openers, 1);
    assert.equal(await send(2), "opener_sent");
    assert.equal((await prefs()).openers_per_week, 2, "3/week → 2/week");
    assert.equal(await send(3), "final_message_sent");
    assert.equal(sentTo(ctx, learner.phone).at(-1)!.body, FINAL_PAUSE_MESSAGE);
    assert.equal(
      FINAL_PAUSE_MESSAGE,
      "Hi, it\u2019s Huahua from LingoIsland. I haven\u2019t heard from you, so I\u2019ll pause your Mandarin practice messages after this. If you want to continue, just reply anytime.",
    );

    const status = async () =>
      (
        await ctx.db.query<{ status: string; paused_reason: string | null }>(
          "select status, paused_reason from sms_contacts where id = $1",
          [learner.contactId],
        )
      ).rows[0];
    assert.deepEqual(await status(), { status: "paused", paused_reason: "no_response" });
    assert.equal(await send(4), "contact_paused");
    const sentBefore = sentTo(ctx, learner.phone).length;

    const reply = await deliverWebhook(ctx, inboundText(learner.phone, "我回来了"));
    assert.equal(reply.outcome, "replied");
    assert.equal((await status()).status, "active");
    assert.equal(sentTo(ctx, learner.phone).length, sentBefore + 1);
    assert.ok(!sentTo(ctx, learner.phone).at(-1)!.body.includes(RESUME_OFFER));
    const after = await prefs();
    assert.equal(after.unanswered_openers, 0);
    assert.equal(after.control_sent_at, null);
    assert.ok(!/miss|sad|disappoint/i.test(FINAL_PAUSE_MESSAGE), "no guilt");
  });

  it("still asks paused-by-choice learners before resuming", async () => {
    const learner = await learnerWithJourney();
    await ctx.rpc("sms_set_paused", { p_user_id: learner.userId, p_paused: true });
    const reply = await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    assert.equal(reply.outcome, "replied");
    assert.ok(sentTo(ctx, learner.phone).at(-1)!.body.includes(RESUME_OFFER));
    const { rows } = await ctx.db.query<{ status: string }>("select status from sms_contacts where id = $1", [learner.contactId]);
    assert.equal(rows[0].status, "paused");
  });

  it("only sends one opener per thread and resets the count when the learner replies", async () => {
    const learner = await learnerWithJourney();
    const now = wednesday(0, at(19));
    ctx.setNow(now);
    const stepId = await completeStep(learner, now);
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: stepId });
    await runAt(now);

    ctx.setNow(wednesday(0, at(19), 1));
    const next = await completeStep(learner, wednesday(0, at(19), 1), "Next step");
    await enqueueJourneyOpener(ctx.deps, { userId: learner.userId, journeyIslandId: next });
    await runAt(wednesday(0, at(19), 1));
    assert.equal((await job(`journey:${next}`)).outcome, "recent_unanswered");

    ctx.setNow(wednesday(0, at(20), 1));
    await deliverWebhook(ctx, inboundText(learner.phone, "我喝了拿铁"));
    const { rows } = await ctx.db.query<{ outcome: string | null }>(
      "select outcome from sms_threads where contact_id = $1 and origin = 'opener'",
      [learner.contactId],
    );
    assert.equal(rows[0].outcome, "answered");
  });

  it("keeps texts coming when the learner answers the final message", async () => {
    const learner = await learnerWithJourney();
    await ctx.db.query(
      "update sms_preferences set unanswered_openers = 3 where user_id = $1",
      [learner.userId],
    );
    const now = wednesday(5, at(19));
    ctx.setNow(now);
    await ctx.rpc("sms_enqueue_job", {
      p_user_id: learner.userId,
      p_kind: "scheduled_opener",
      p_idempotency_key: `control:${learner.userId}`,
      p_not_before: now.toISOString(),
      p_journey_island_id: null,
    });
    const result = await runDueJobs(ctx.deps);
    assert.equal(result.outcomes.final_message_sent, 1);
    const keep = await deliverWebhook(ctx, inboundText(learner.phone, "keep"));
    assert.equal(keep.outcome, "kept_texts");
    const { rows } = await ctx.db.query<{ unanswered_openers: number; control_sent_at: Date | null }>(
      "select unanswered_openers, control_sent_at from sms_preferences where user_id = $1",
      [learner.userId],
    );
    assert.deepEqual(rows[0], { unanswered_openers: 0, control_sent_at: null });
    const contact = await ctx.db.query<{ status: string }>("select status from sms_contacts where id = $1", [learner.contactId]);
    assert.equal(contact.rows[0].status, "active");
  });
});

describe("scheduled openers", () => {
  it("queues one opener on a preferred day, inside the window, and none on other days", async () => {
    const learner = await learnerWithJourney();
    await ctx.rpc("sms_update_preferences", {
      p_user_id: learner.userId,
      p_patch: { preferred_days: [3], delivery_windows: [{ start: at(12), end: at(14) }] },
    });
    ctx.setNow(wednesday(6, at(8)));
    await planScheduledOpeners(ctx.deps);
    await planScheduledOpeners(ctx.deps);
    const { rows } = await ctx.db.query<{ not_before: Date; idempotency_key: string }>(
      "select not_before, idempotency_key from sms_jobs where user_id = $1 and kind = 'scheduled_opener'",
      [learner.userId],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].not_before.toISOString(), wednesday(6, at(12)).toISOString());

    ctx.setNow(wednesday(6, at(8), 1));
    await planScheduledOpeners(ctx.deps);
    const { rows: after } = await ctx.db.query(
      "select 1 from sms_jobs where user_id = $1 and kind = 'scheduled_opener'",
      [learner.userId],
    );
    assert.equal(after.length, 1, "Thursday is not a preferred day");
  });
});

describe("gates and content selection (pure)", () => {
  const baseCtx = (): HuahuaContext => ({
    userId: "u",
    contact: {
      id: "c",
      user_id: "u",
      phone_number: "+14165550123",
      status: "active",
      display_name: null,
      language_level: null,
      verified_at: "2026-01-01T00:00:00Z",
      consent_at: "2026-01-01T00:00:00Z",
      paused_reason: null,
    },
    preferences: { ...DEFAULT_PREFERENCES },
    hasPreferencesRow: true,
    subscribed: true,
    plan: HUAHUA_PLANS.subscriber,
    period: { start: new Date(0), end: new Date(8.64e15) },
    level: 3,
    countryCode: "CA",
    timezone: TZ,
    profileTimezone: null,
  });
  const stats = { week_count: 0, day_count: 0, last: null, open_jobs: 0, last_inbound_at: null };
  const evening = wednesday(0, at(19));

  it("requires consent, an enabled country, and quiet hours", () => {
    assert.deepEqual(evaluateGates({ ctx: baseCtx(), job: { kind: "journey_opener" }, stats, now: evening }), { action: "send" });

    const noConsent = baseCtx();
    noConsent.contact!.consent_at = null;
    assert.deepEqual(evaluateGates({ ctx: noConsent, job: { kind: "journey_opener" }, stats, now: evening }), {
      action: "skip",
      reason: "no_consent",
    });

    const uk = baseCtx();
    uk.countryCode = "GB";
    assert.equal((evaluateGates({ ctx: uk, job: { kind: "journey_opener" }, stats, now: evening }) as { reason: string }).reason, "country_disabled");

    const night = evaluateGates({ ctx: baseCtx(), job: { kind: "journey_opener" }, stats, now: wednesday(0, at(23)) });
    assert.equal(night.action, "reschedule");
  });

  it("respects the weekly cap", () => {
    const capped = evaluateGates({ ctx: baseCtx(), job: { kind: "scheduled_opener" }, stats: { ...stats, week_count: 3 }, now: evening });
    assert.deepEqual(capped, { action: "skip", reason: "weekly_cap" });
  });

  it("weights content 70/20/10 toward recent Journey words", () => {
    const material = {
      recent: [{ hanzi: "近" }],
      needs_practice: [{ hanzi: "练" }],
      maintenance: [{ hanzi: "稳" }],
    };
    const counts: Record<string, number> = { 近: 0, 练: 0, 稳: 0 };
    for (let i = 0; i < 2000; i += 1) {
      const [first] = pickOpenerVocab(material, seededRandom(`seed-${i}`), 1);
      counts[first.hanzi] += 1;
    }
    assert.ok(Math.abs(counts["近"] / 2000 - 0.7) < 0.05, JSON.stringify(counts));
    assert.ok(Math.abs(counts["练"] / 2000 - 0.2) < 0.05, JSON.stringify(counts));
    assert.ok(Math.abs(counts["稳"] / 2000 - 0.1) < 0.04, JSON.stringify(counts));
  });

  it("picks the same words on retry for the same job", () => {
    const material = { recent: [{ hanzi: "a" }, { hanzi: "b" }, { hanzi: "c" }], needs_practice: [], maintenance: [] };
    assert.deepEqual(pickOpenerVocab(material, seededRandom("job-1")), pickOpenerVocab(material, seededRandom("job-1")));
  });
});
