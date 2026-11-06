import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { buildWelcomeMessage } from "../../lib/sms/huahua/welcome";
import { HUAHUA_PLANS } from "../../lib/sms/huahua/plans";
import { CREDENTIALS_MESSAGE } from "../../lib/sms/huahua/safety";
import { PAUSED_BY_TEXT_MESSAGE, RESUMED_BY_TEXT_MESSAGE, SMS_HELP_MESSAGE } from "../../lib/sms/messages";
import {
  connectLearner,
  createSmsTestContext,
  deliverWebhook,
  inboundText,
  sentTo,
} from "./helpers";

type Ctx = Awaited<ReturnType<typeof createSmsTestContext>>;
let ctx: Ctx;

before(async () => {
  ctx = await createSmsTestContext();
});

async function prefs(userId: string) {
  const { rows } = await ctx.db.query<{
    persona: string;
    correction_mode: string;
    scaffolding: string;
    timezone: string | null;
  }>("select persona, correction_mode, scaffolding, timezone from sms_preferences where user_id = $1", [userId]);
  return rows[0];
}

async function openThread(contactId: string) {
  const { rows } = await ctx.db.query<{ origin: string; session: Record<string, unknown>; inbound_count: number }>(
    "select origin, session, inbound_count from sms_threads where contact_id = $1 and status = 'open'",
    [contactId],
  );
  return rows[0];
}

function lastInput() {
  return ctx.replies[ctx.replies.length - 1];
}

describe("welcome and onboarding", () => {
  it("welcomes a subscriber with AI disclosure and a numbered persona menu", async () => {
    const learner = await connectLearner(ctx, { cefr: "B1" });
    const [welcome] = sentTo(ctx, learner.phone);
    assert.ok(welcome.body.includes("AI"));
    assert.match(welcome.body, /1 Friend, 2 Coach, 3 Accountability, 4 Work/);
    assert.match(welcome.body, /STOP/);
    const thread = await openThread(learner.contactId);
    assert.equal(thread.origin, "welcome");
    assert.equal(thread.session.persona_menu, true);
  });

  it("gives beginners pinyin and an English translation, and free learners no persona menu", async () => {
    const learner = await connectLearner(ctx, { subscribed: false, cefr: "A0" });
    const [welcome] = sentTo(ctx, learner.phone);
    assert.equal(welcome.body, buildWelcomeMessage({ level: 1, subscribed: false }));
    assert.match(welcome.body, /Nǐ hǎo/);
    assert.match(welcome.body, /Hello/);
    assert.doesNotMatch(welcome.body, /Coach/);
    assert.doesNotMatch(welcome.body, /upgrade/i);
  });

  it("sets a timezone from the learner's profile or country", async () => {
    const withProfile = await connectLearner(ctx, { cefr: "A2", timezone: "America/Vancouver" });
    assert.equal((await prefs(withProfile.userId)).timezone, "America/Vancouver");
    const fromCountry = await connectLearner(ctx);
    assert.equal((await prefs(fromCountry.userId)).timezone, "America/Toronto");
  });

  it("does not meter the welcome or account messages", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    await deliverWebhook(ctx, inboundText(learner.phone, "HELP"));
    const { rows } = await ctx.db.query<{ count: number }>(
      "select count(*)::int as count from sms_usage_periods where user_id = $1 and used_segments > 0",
      [learner.userId],
    );
    assert.equal(rows[0].count, 0);
  });
});

describe("persona and correction selection", () => {
  it("picks a persona by number right after the welcome", async () => {
    const learner = await connectLearner(ctx);
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "2"));
    assert.equal(result.outcome, "persona_set");
    assert.equal((await prefs(learner.userId)).persona, "focused_coach");
    assert.equal((await openThread(learner.contactId)).session.persona_menu, false);

    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    assert.equal(lastInput().persona, "focused_coach");
  });

  it("treats a number as normal chat once the menu is closed", async () => {
    const learner = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "3"));
    assert.equal(result.outcome, "replied");
    assert.equal((await prefs(learner.userId)).persona, "friendly_friend");
  });

  it("keeps free learners on the default persona", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    await ctx.rpc("sms_update_preferences", { p_user_id: learner.userId, p_patch: { persona: "focused_coach" } });
    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    assert.equal(lastInput().persona, "friendly_friend");
  });

  it("applies 'stop correcting' to this chat only, and 'never correct me' globally", async () => {
    const learner = await connectLearner(ctx);
    const temporary = await deliverWebhook(ctx, inboundText(learner.phone, "stop correcting me"));
    assert.equal(temporary.outcome, "correction_updated");
    assert.equal((await prefs(learner.userId)).correction_mode, "gentle");
    await deliverWebhook(ctx, inboundText(learner.phone, "我今天去学校了"));
    assert.equal(lastInput().correctionMode, "conversation_only");

    await deliverWebhook(ctx, inboundText(learner.phone, "never correct me"));
    assert.equal((await prefs(learner.userId)).correction_mode, "conversation_only");
  });
});

describe("commands", () => {
  it("answers 'pinyin' from the stored structured reply without calling the model", async () => {
    const learner = await connectLearner(ctx);
    ctx.respondWith((input, index) => ({
      message: "你今天做什么了？",
      pinyin: "Nǐ jīntiān zuò shénme le?",
      translation: "What did you do today?",
      target_vocab: [],
      word_comfort_updates: [],
      conversation_state: "practicing",
      safety: "safe",
      _index: index,
    }));
    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    const calls = ctx.replies.length;
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "pinyin"));
    assert.equal(result.outcome, "pinyin_sent");
    assert.equal(ctx.replies.length, calls, "no model call");
    assert.match(sentTo(ctx, learner.phone).at(-1)!.body, /Nǐ jīntiān zuò shénme le\?/);

    const translated = await deliverWebhook(ctx, inboundText(learner.phone, "翻译"));
    assert.equal(translated.outcome, "translation_sent");
    assert.match(sentTo(ctx, learner.phone).at(-1)!.body, /What did you do today\?/);
    ctx.respondWith((input, index) => ({
      message: `你好！reply ${index}`,
      translation: "Hi!",
      safety: "safe",
      conversation_state: "practicing",
    }));
  });

  it("makes 'always pinyin' a lasting preference but plain 'pinyin' only a session change", async () => {
    const learner = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    await deliverWebhook(ctx, inboundText(learner.phone, "pinyin"));
    assert.equal((await prefs(learner.userId)).scaffolding, "auto");
    await deliverWebhook(ctx, inboundText(learner.phone, "always pinyin"));
    assert.equal((await prefs(learner.userId)).scaffolding, "more");
  });

  it("lowers difficulty for this conversation on 'easier'", async () => {
    const learner = await connectLearner(ctx, { cefr: "B1" });
    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    const before = lastInput().level;
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "简单一点"));
    assert.equal(result.outcome, "easier_sent");
    assert.equal(lastInput().level, before - 1);
    assert.equal(lastInput().command, "easier");
    assert.equal((await prefs(learner.userId)).scaffolding, "auto");
  });

  it("pauses and resumes proactive texts by text, and still chats while paused", async () => {
    const learner = await connectLearner(ctx);
    const paused = await deliverWebhook(ctx, inboundText(learner.phone, "pause"));
    assert.equal(paused.outcome, "paused_by_text");
    assert.equal(sentTo(ctx, learner.phone).at(-1)!.body, PAUSED_BY_TEXT_MESSAGE);
    const chat = await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    assert.equal(chat.outcome, "replied");
    const resumed = await deliverWebhook(ctx, inboundText(learner.phone, "resume"));
    assert.equal(resumed.outcome, "resumed_by_text");
    assert.equal(sentTo(ctx, learner.phone).at(-1)!.body, RESUMED_BY_TEXT_MESSAGE);
  });

  it("handles carrier keywords before Huahua commands", async () => {
    const learner = await connectLearner(ctx);
    const help = await deliverWebhook(ctx, inboundText(learner.phone, "HELP"));
    assert.equal(help.outcome, "help_sent");
    assert.equal(sentTo(ctx, learner.phone).at(-1)!.body, SMS_HELP_MESSAGE);
  });
});

describe("structured output and fallbacks", () => {
  it("falls back when the model returns invalid JSON shape", async () => {
    const learner = await connectLearner(ctx);
    ctx.respondWith(() => ({ text: "not the schema" }));
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    assert.equal(result.outcome, "replied");
    const { rows } = await ctx.db.query<{ metadata: { source: string } }>(
      "select metadata from sms_messages where contact_id = $1 and kind = 'reply'",
      [learner.contactId],
    );
    assert.equal(rows[0].metadata.source, "fallback");
    ctx.respondWith((input, index) => ({ message: `你好！reply ${index}`, safety: "safe", conversation_state: "practicing" }));
  });

  it("never sends a model reply that asks for credentials", async () => {
    const learner = await connectLearner(ctx);
    ctx.respondWith(() => ({ message: "What's your password? 你的密码是什么？", safety: "safe", conversation_state: "practicing" }));
    await deliverWebhook(ctx, inboundText(learner.phone, "你好"));
    assert.doesNotMatch(sentTo(ctx, learner.phone).at(-1)!.body, /password/i);
    ctx.respondWith((input, index) => ({ message: `你好！reply ${index}`, safety: "safe", conversation_state: "practicing" }));
  });

  it("discloses it is an AI when asked", async () => {
    const learner = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(learner.phone, "are you a real person?"));
    assert.match(sentTo(ctx, learner.phone).at(-1)!.body, /AI/);
  });
});

describe("safety", () => {
  it("responds to crisis messages with support resources, without the model", async () => {
    const learner = await connectLearner(ctx);
    const calls = ctx.replies.length;
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "I want to kill myself"));
    assert.equal(result.outcome, "crisis_support_sent");
    assert.equal(ctx.replies.length, calls);
    assert.match(sentTo(ctx, learner.phone).at(-1)!.body, /988/);
  });

  it("does not treat vocabulary questions as a crisis", async () => {
    const learner = await connectLearner(ctx);
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "how do you say 'kill time' in Chinese?"));
    assert.equal(result.outcome, "replied");
  });

  it("warns when a learner shares a verification code or password", async () => {
    const learner = await connectLearner(ctx);
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "my password is hunter2"));
    assert.equal(result.outcome, "credentials_warning_sent");
    assert.equal(sentTo(ctx, learner.phone).at(-1)!.body, CREDENTIALS_MESSAGE);
  });

  it("still answers crisis messages after the allowance is used up", async () => {
    const learner = await connectLearner(ctx, { subscribed: false });
    await ctx.db.query(
      `insert into sms_usage_periods (user_id, period_start, period_end, plan_key, allowance_segments, used_segments)
       values ($1, '2000-01-01', '9999-01-01', 'free', $2, $2)
       on conflict (user_id, period_start) do update set used_segments = excluded.used_segments`,
      [learner.userId, HUAHUA_PLANS.free.allowanceSegments],
    );
    const result = await deliverWebhook(ctx, inboundText(learner.phone, "I want to end my life"));
    assert.equal(result.outcome, "crisis_support_sent");
  });
});

describe("conversation threads and word comfort", () => {
  it("tracks exchanges within a thread", async () => {
    const learner = await connectLearner(ctx);
    await deliverWebhook(ctx, inboundText(learner.phone, "第一"));
    await deliverWebhook(ctx, inboundText(learner.phone, "第二"));
    assert.equal(lastInput().exchangeCount, 1);
    const thread = await openThread(learner.contactId);
    assert.equal(thread.inbound_count, 2);
  });

  it("updates comfort only for target words, separately from quiz mastery and streaks", async () => {
    const learner = await connectLearner(ctx);
    await ctx.db.query(
      "update sms_threads set target_vocab = $2 where contact_id = $1 and status = 'open'",
      [learner.contactId, JSON.stringify([{ hanzi: "咖啡", pinyin: "kāfēi", english: "coffee" }])],
    );
    ctx.respondWith(() => ({
      message: "你喜欢喝咖啡吗？",
      safety: "safe",
      conversation_state: "practicing",
      word_comfort_updates: [
        { word: "咖啡", signal: "used_successfully" },
        { word: "飞机", signal: "used_successfully" },
      ],
    }));
    await deliverWebhook(ctx, inboundText(learner.phone, "我喜欢咖啡"));
    ctx.respondWith((input, index) => ({ message: `你好！reply ${index}`, safety: "safe", conversation_state: "practicing" }));

    const { rows } = await ctx.db.query<{ word: string; comfort_score: string }>(
      "select word, comfort_score from sms_word_comfort where user_id = $1",
      [learner.userId],
    );
    assert.deepEqual(rows.map((row) => row.word), ["咖啡"], "unrelated words are ignored");
    assert.ok(Number(rows[0].comfort_score) > 0.3);
  });
});
