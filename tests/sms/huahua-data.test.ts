import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { before, describe, it } from "node:test";
import { SMS_CONSENT_VERSION } from "../../lib/sms/consent";
import { HUAHUA_PLANS } from "../../lib/sms/huahua/plans";
import { startVerification, verifyPhoneCode } from "../../lib/sms/phoneService";
import { connectLearner, createSmsTestContext, deliverWebhook, inboundText, sentTo } from "./helpers";

type Ctx = Awaited<ReturnType<typeof createSmsTestContext>>;
let ctx: Ctx;

before(async () => {
  ctx = await createSmsTestContext();
});

async function outboundMessage(contactId: string, key: string) {
  const { rows } = await ctx.db.query<{ id: string }>(
    `insert into sms_messages (provider, contact_id, user_id, direction, kind, body, status, idempotency_key)
     select 'telnyx', id, user_id, 'outbound', 'reply', 'x', 'queued', $2 from sms_contacts where id = $1
     returning id`,
    [contactId, key],
  );
  return rows[0].id;
}

describe("usage allowance", () => {
  it("meters free practice texts and stops at the allowance with one clear notice", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    const outcomes: string[] = [];
    for (let i = 0; i < HUAHUA_PLANS.free.allowanceSegments + 2; i += 1) {
      outcomes.push((await deliverWebhook(ctx, inboundText(learner.phone, `第${i}条`))).outcome);
    }
    assert.ok(outcomes.includes("allowance_exhausted"));
    const exhaustedAt = outcomes.indexOf("allowance_exhausted");
    assert.ok(outcomes.slice(exhaustedAt).every((outcome) => outcome === "allowance_exhausted"));

    const { rows } = await ctx.db.query<{ used_segments: number; allowance_segments: number }>(
      "select used_segments, allowance_segments from sms_usage_periods where user_id = $1",
      [learner.userId],
    );
    assert.ok(rows[0].used_segments >= rows[0].allowance_segments);
    assert.ok(rows[0].used_segments <= rows[0].allowance_segments + 3, "overshoot is at most one message");

    const notices = sentTo(ctx, learner.phone).filter((message) => /used all|free practice/i.test(message.body));
    assert.equal(notices.length, 1, "one exhausted notice");
    assert.doesNotMatch(notices[0].body, /upgrade|\$/i, "no upsell to non-subscribers");

    const help = await deliverWebhook(ctx, inboundText(learner.phone, "HELP"));
    assert.equal(help.outcome, "help_sent", "HELP is never blocked");
    const stop = await deliverWebhook(ctx, inboundText(learner.phone, "STOP"));
    assert.equal(stop.outcome, "opted_out", "STOP is never blocked");
  });

  it("sends the 80% warning once to subscribers", async () => {
    const learner = await connectLearner(ctx);
    const { loadHuahuaContext } = await import("../../lib/sms/huahua/context");
    const context = await loadHuahuaContext(ctx.deps, learner.userId, new Date());
    const allowance = HUAHUA_PLANS.subscriber.allowanceSegments;
    await ctx.db.query(
      `insert into sms_usage_periods (user_id, period_start, period_end, plan_key, allowance_segments, used_segments)
       values ($1, $2, $3, 'subscriber', $4, $5)`,
      [learner.userId, context.period.start.toISOString(), context.period.end.toISOString(), allowance, Math.ceil(allowance * 0.8) - 1],
    );
    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    await deliverWebhook(ctx, inboundText(learner.phone, "你好吗"));
    const warnings = sentTo(ctx, learner.phone).filter((message) => /80%/.test(message.body));
    assert.equal(warnings.length, 1);
  });

  it("charges atomically under concurrency and never double-charges a message", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    const ids = await Promise.all(Array.from({ length: 12 }, (_, i) => outboundMessage(learner.contactId, `t:${learner.userId}:${i}`)));
    const charge = (id: string) =>
      ctx.rpc<{ allowed: boolean }>("sms_usage_charge", {
        p_user_id: learner.userId,
        p_message_id: id,
        p_period_start: "2000-01-01T00:00:00Z",
        p_period_end: "9999-01-01T00:00:00Z",
        p_plan_key: "free",
        p_allowance: 8,
        p_segments: 1,
        p_enforce: true,
      });
    const results = await Promise.all([...ids, ids[0], ids[1]].map(charge));
    const { rows } = await ctx.db.query<{ used_segments: number }>(
      "select used_segments from sms_usage_periods where user_id = $1",
      [learner.userId],
    );
    assert.equal(rows[0].used_segments, 8);
    assert.equal(results.slice(0, 12).filter((result) => result.allowed).length, 8);

    await ctx.rpc("sms_usage_refund", { p_message_id: ids[0] });
    await ctx.rpc("sms_usage_refund", { p_message_id: ids[0] });
    const { rows: after } = await ctx.db.query<{ used_segments: number }>(
      "select used_segments from sms_usage_periods where user_id = $1",
      [learner.userId],
    );
    assert.equal(after[0].used_segments, 7, "refund is idempotent");
  });
});

describe("duplicate phone transfer", () => {
  it("records an audit row and never tells the new account about the old one", async () => {
    const owner = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(owner.phone, "我的秘密"));
    const other = await ctx.createUser();
    await startVerification(ctx.deps, {
      userId: other,
      ip: null,
      country: "CA",
      phoneNumber: owner.phone,
      consent: true,
      consentVersion: SMS_CONSENT_VERSION,
      source: "account_settings",
    });
    const result = await verifyPhoneCode(ctx.deps, {
      userId: other,
      code: ctx.provider.lastCode(),
      confirmTransfer: true,
      displayName: null,
      languageLevel: null,
    });
    assert.equal(result.transferred, true);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(owner.userId));

    const { rows } = await ctx.db.query<{ from_user_id: string; to_user_id: string }>(
      "select from_user_id, to_user_id from sms_transfer_audit where phone_number = $1",
      [owner.phone],
    );
    assert.deepEqual(rows, [{ from_user_id: owner.userId, to_user_id: other }]);

    const overview = await ctx.rpc<{ threads: Array<{ messages: Array<{ body: string }> }> }>("sms_get_huahua_overview", {
      p_user_id: other,
      p_thread_limit: 10,
      p_message_limit: 10,
      p_word_limit: 10,
    });
    assert.doesNotMatch(JSON.stringify(overview), /我的秘密/, "old account's messages stay with it");

    const { rows: jobs } = await ctx.db.query<{ count: number }>(
      "select count(*)::int as count from sms_threads where user_id = $1 and status = 'open'",
      [owner.userId],
    );
    assert.equal(jobs[0].count, 0, "old account's open threads are closed");
  });

  it("lets only one of two concurrent transfers win", async () => {
    const owner = await connectLearner(ctx);
    const a = await ctx.createUser();
    const b = await ctx.createUser();
    const codes: Record<string, string | null> = {};
    for (const userId of [a, b]) {
      await startVerification(ctx.deps, {
        userId,
        ip: null,
        country: "CA",
        phoneNumber: owner.phone,
        consent: true,
        consentVersion: SMS_CONSENT_VERSION,
        source: "account_settings",
      });
      codes[userId] = ctx.provider.lastCode();
    }
    const results = await Promise.allSettled(
      [a, b].map((userId) =>
        verifyPhoneCode(ctx.deps, {
          userId,
          code: codes[userId],
          confirmTransfer: true,
          displayName: null,
          languageLevel: null,
        }),
      ),
    );
    const { rows } = await ctx.db.query<{ user_id: string }>(
      "select user_id from sms_contacts where phone_number = $1 and status not in ('released')",
      [owner.phone],
    );
    assert.equal(rows.length, 1, "exactly one active owner");
    assert.ok(rows[0].user_id === a || rows[0].user_id === b);
    assert.ok(results.some((result) => result.status === "fulfilled"));
  });
});

describe("privacy and retention", () => {
  it("deletes a learner's history but keeps consent and delivery audit", async () => {
    const learner = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(learner.phone, "我今天很开心"));
    await ctx.rpc("sms_apply_word_signals", {
      p_user_id: learner.userId,
      p_signals: [{ word: "开心", signal: "used_successfully", delta: 0.12, source: "conversation" }],
      p_now: new Date().toISOString(),
    });

    await ctx.rpc("sms_delete_history", { p_user_id: learner.userId, p_include_words: false });
    const { rows } = await ctx.db.query<{ body: string; status: string; redacted_at: Date | null }>(
      "select body, status, redacted_at from sms_messages where user_id = $1",
      [learner.userId],
    );
    assert.ok(rows.length > 0, "delivery records are kept");
    assert.ok(rows.every((row) => row.body === "" && row.redacted_at));
    const { rows: consent } = await ctx.db.query<{ consent_at: Date | null }>(
      "select consent_at from sms_contacts where id = $1",
      [learner.contactId],
    );
    assert.ok(consent[0].consent_at);
    const { rows: events } = await ctx.db.query(
      "select 1 from sms_consent_events where user_id = $1",
      [learner.userId],
    );
    assert.ok(events.length > 0, "consent audit survives deletion");
    const { rows: words } = await ctx.db.query("select 1 from sms_word_comfort where user_id = $1", [learner.userId]);
    assert.equal(words.length, 1, "word comfort kept unless requested");

    await ctx.rpc("sms_delete_history", { p_user_id: learner.userId, p_include_words: true });
    const { rows: none } = await ctx.db.query("select 1 from sms_word_comfort where user_id = $1", [learner.userId]);
    assert.equal(none.length, 0);
  });

  it("redacts message text after 90 days, idempotently", async () => {
    const learner = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(learner.phone, "旧消息"));
    await ctx.db.query(
      "update sms_messages set occurred_at = now() - interval '91 days', created_at = now() - interval '91 days' where user_id = $1",
      [learner.userId],
    );
    const first = await ctx.rpc<{ messages_redacted: number }>("sms_retention_cleanup", { p_message_days: 90, p_job_days: 30 });
    assert.ok(first.messages_redacted > 0);
    const second = await ctx.rpc<{ messages_redacted: number }>("sms_retention_cleanup", { p_message_days: 90, p_job_days: 30 });
    assert.equal(second.messages_redacted, 0);
    const { rows } = await ctx.db.query<{ body: string }>("select body from sms_messages where user_id = $1", [learner.userId]);
    assert.ok(rows.every((row) => row.body === ""));
  });

  it("keeps Huahua tables and functions closed to browser roles", async () => {
    const tables = [
      "sms_preferences",
      "sms_jobs",
      "sms_threads",
      "sms_usage_periods",
      "sms_word_comfort",
      "sms_country_interest",
      "sms_transfer_audit",
      "sms_consent_events",
    ];
    for (const role of ["anon", "authenticated"]) {
      await ctx.db.exec(`set role ${role}`);
      try {
        for (const table of tables) {
          await assert.rejects(ctx.db.query(`select * from public.${table} limit 1`), /permission denied/, `${role} ${table}`);
        }
        for (const fn of [
          "select public.sms_get_huahua_overview(gen_random_uuid(), 1, 1, 1)",
          "select public.sms_update_preferences(gen_random_uuid(), '{}'::jsonb)",
          "select public.sms_delete_history(gen_random_uuid(), true)",
        ]) {
          await assert.rejects(ctx.db.query(fn), /permission denied/, `${role}: ${fn}`);
        }
      } finally {
        await ctx.db.exec("reset role");
      }
    }
  });

  it("never shows another learner's number or messages to a signed-in user", async () => {
    const me = await connectLearner(ctx);
    const other = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(other.phone, "别人的秘密"));
    await ctx.db.exec(`set request.jwt.claim.sub = '${me.userId}'`);
    await ctx.db.exec("set role authenticated");
    try {
      const contacts = await ctx.db.query<{ user_id: string }>("select user_id from public.sms_contacts");
      assert.ok(contacts.rows.length > 0, "own contact is visible");
      assert.ok(contacts.rows.every((row) => row.user_id === me.userId));
      const messages = await ctx.db.query<{ body: string; user_id: string }>("select body, user_id from public.sms_messages");
      assert.ok(messages.rows.every((row) => row.user_id === me.userId));
      assert.ok(!messages.rows.some((row) => row.body.includes("别人的秘密")));
      await assert.rejects(
        ctx.db.query("update public.sms_contacts set status = 'active' where user_id = $1", [other.userId]).then((result) => {
          if ((result.affectedRows ?? 0) === 0) throw new Error("permission denied (no rows)");
        }),
        /permission denied|no rows/,
      );
    } finally {
      await ctx.db.exec("reset role");
      await ctx.db.exec("reset request.jwt.claim.sub");
    }
  });

  it("stores country interest without enabling texting there", async () => {
    const userId = await ctx.createUser();
    await ctx.rpc("sms_record_country_interest", { p_user_id: userId, p_country_code: "GB" });
    await ctx.rpc("sms_record_country_interest", { p_user_id: userId, p_country_code: "GB" });
    const { rows } = await ctx.db.query("select country_code from sms_country_interest where user_id = $1", [userId]);
    assert.deepEqual(rows, [{ country_code: "GB" }]);
  });
});

describe("separation from quiz mastery", () => {
  const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20261106_000001_sms_huahua_phase2.sql"), "utf8");

  it("never writes to vocabulary, SRS, streak, or quiz tables", () => {
    const writes = sql.match(/\b(insert\s+into|update|delete\s+from)\s+(public\.)?([a-z_]+)/gi) ?? [];
    // "do update set", "for update skip locked", and trigger "insert or update on" are not table writes.
    const notTables = new Set(["set", "skip", "nowait", "of", "on", "or"]);
    const targets = new Set(
      writes
        .map((write) => write.split(/\s+/).pop()!.replace("public.", "").toLowerCase())
        .filter((target) => !notTables.has(target)),
    );
    assert.ok(targets.size > 5);
    targets.forEach((table) => {
      assert.ok(table.startsWith("sms_"), `Huahua migration writes to ${table}`);
    });
  });

  it("keeps word comfort scores in their own table and range", async () => {
    const learner = await connectLearner(ctx);
    const signals = Array.from({ length: 30 }, () => ({ word: "学习", signal: "used_successfully", delta: 0.12, source: "conversation" }));
    await ctx.rpc("sms_apply_word_signals", { p_user_id: learner.userId, p_signals: signals, p_now: new Date().toISOString() });
    const { rows } = await ctx.db.query<{ comfort_score: string }>(
      "select comfort_score from sms_word_comfort where user_id = $1",
      [learner.userId],
    );
    assert.ok(Number(rows[0].comfort_score) <= 1);
  });
});
