import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  enabledSmsCountryCodes,
  getSmsCountry,
  interestSmsCountries,
  SMS_COUNTRIES,
} from "../../lib/sms/countries";
import { buildSystemPrompt, validateTurn, TurnValidationError, type HuahuaTurnInput } from "../../lib/sms/huahua/ai";
import { parseCommand } from "../../lib/sms/huahua/commands";
import { composeSms, pinyinFor } from "../../lib/sms/huahua/compose";
import { CORRECTION_MODES, getCorrectionMode } from "../../lib/sms/huahua/correction";
import { fallbackOpener, fallbackReply } from "../../lib/sms/huahua/fallbacks";
import { getPersona, PERSONAS, personaByNumber } from "../../lib/sms/huahua/personas";
import { HUAHUA_PLANS, resolveSubscription, summarizeUsage, usagePeriod } from "../../lib/sms/huahua/plans";
import { asksIfHuman, classifyInboundSafety, crisisMessage, ensureAiDisclosure, outboundAsksForCredentials } from "../../lib/sms/huahua/safety";
import { effectiveLevel, hskLevelFrom, SCAFFOLD_RULES, supportFor } from "../../lib/sms/huahua/scaffolding";
import {
  defaultOpenersPerWeek,
  localDateKey,
  localDayStart,
  localParts,
  nextDeliveryTime,
  normalizeWindows,
  plannedOpenerDays,
  reducedFrequency,
  resolveTimeZone,
  zonedTimeToUtc,
} from "../../lib/sms/huahua/schedule";
import { produceTurn } from "../../lib/sms/huahua/turn";
import { buildWordSignals } from "../../lib/sms/huahua/wordComfort";
import { estimateSmsSegments } from "../../lib/sms/segments";

const turnInput = (overrides: Partial<HuahuaTurnInput> = {}): HuahuaTurnInput => ({
  mode: "reply",
  learnerName: "Mei",
  level: 3,
  persona: "friendly_friend",
  correctionMode: "gentle",
  support: { pinyin: false, translation: false },
  language: "balanced",
  history: [{ direction: "inbound", body: "你好" }],
  targetVocab: [],
  facts: [],
  exchangeCount: 0,
  maxChars: 180,
  ...overrides,
});

describe("scheduling", () => {
  const tz = "America/Toronto";

  it("maps days per week to default opener frequency", () => {
    assert.deepEqual([1, 2, 3, 5, 6, 7].map(defaultOpenersPerWeek), [2, 2, 3, 3, 5, 5]);
    assert.deepEqual([5, 3, 2, 1].map(reducedFrequency), [3, 2, 1, 1]);
  });

  it("clamps delivery windows to 8:00–21:00 quiet hours", () => {
    assert.deepEqual(normalizeWindows([{ start: 6 * 60, end: 23 * 60 }]), [{ start: 8 * 60, end: 21 * 60 }]);
    assert.equal(normalizeWindows([{ start: 22 * 60, end: 23 * 60 }]), null);
    assert.deepEqual(
      normalizeWindows([
        { start: 18 * 60, end: 20 * 60 },
        { start: 19 * 60, end: 21 * 60 },
      ]),
      [{ start: 18 * 60, end: 21 * 60 }],
    );
  });

  it("handles the spring-forward DST gap", () => {
    // 2027-03-14 02:30 does not exist in Toronto.
    const gap = zonedTimeToUtc(2027, 3, 14, 2 * 60 + 30, tz);
    assert.equal(localParts(gap, tz).minutes, 3 * 60 + 30);
    const evening = zonedTimeToUtc(2027, 3, 14, 18 * 60, tz);
    assert.equal(evening.toISOString(), "2027-03-14T22:00:00.000Z");
  });

  it("handles the fall-back DST overlap and day boundaries", () => {
    const ambiguous = zonedTimeToUtc(2026, 11, 1, 60 + 30, tz);
    assert.equal(ambiguous.toISOString(), "2026-11-01T05:30:00.000Z", "first occurrence");
    const dayStart = localDayStart(new Date("2026-11-01T20:00:00Z"), tz);
    assert.equal(dayStart.toISOString(), "2026-11-01T04:00:00.000Z");
    assert.equal(localDateKey(new Date("2026-11-02T03:00:00Z"), tz), "2026-11-01");
  });

  it("finds the next delivery time inside the learner's window and allowed days", () => {
    const windows = [{ start: 18 * 60, end: 21 * 60 }];
    const wednesdayNoon = zonedTimeToUtc(2026, 11, 11, 12 * 60, tz);
    assert.equal(
      nextDeliveryTime({ now: wednesdayNoon, tz, windows })!.toISOString(),
      zonedTimeToUtc(2026, 11, 11, 18 * 60, tz).toISOString(),
    );
    assert.equal(
      nextDeliveryTime({ now: wednesdayNoon, tz, windows, allowedDays: [5] })!.toISOString(),
      zonedTimeToUtc(2026, 11, 13, 18 * 60, tz).toISOString(),
    );
    const late = zonedTimeToUtc(2026, 11, 11, 21 * 60 + 30, tz);
    assert.equal(
      nextDeliveryTime({ now: late, tz, windows })!.toISOString(),
      zonedTimeToUtc(2026, 11, 12, 18 * 60, tz).toISOString(),
    );
  });

  it("uses each learner's own timezone", () => {
    const windows = [{ start: 18 * 60, end: 21 * 60 }];
    const now = new Date("2026-11-11T12:00:00Z");
    const toronto = nextDeliveryTime({ now, tz: "America/Toronto", windows })!;
    const vancouver = nextDeliveryTime({ now, tz: "America/Vancouver", windows })!;
    assert.equal(vancouver.getTime() - toronto.getTime(), 3 * 3600_000);
    assert.equal(resolveTimeZone("Not/AZone", null, "America/Chicago"), "America/Chicago");
    assert.equal(resolveTimeZone(null), "UTC");
  });

  it("spreads openers across the week unless the learner picked days", () => {
    assert.deepEqual(plannedOpenerDays({ preferred_days: [], openers_per_week: null, days_per_week: 3 }), [1, 3, 5]);
    assert.deepEqual(plannedOpenerDays({ preferred_days: [6, 2], openers_per_week: null, days_per_week: 3 }), [2, 6]);
  });
});

describe("HSK scaffolding", () => {
  it("maps profile levels to HSK, defaulting to HSK 1", () => {
    assert.equal(hskLevelFrom({ hskCurrentLevel: 4 }), 4);
    assert.equal(hskLevelFrom({ hskCurrentLevel: 7 }), 6);
    assert.equal(hskLevelFrom({ cefrLevel: "B1" }), 4);
    assert.equal(hskLevelFrom({ contactLevel: "A0" }), 1);
    assert.equal(hskLevelFrom({}), 1);
  });

  it("gives beginners pinyin and translation, and advanced learners neither by default", () => {
    assert.deepEqual(supportFor(1, "auto"), { includePinyin: true, includeTranslation: true });
    assert.deepEqual(supportFor(6, "auto"), { includePinyin: false, includeTranslation: false });
    assert.deepEqual(supportFor(6, "auto", { translation: true }).includeTranslation, true);
    assert.deepEqual(supportFor(2, "less"), { includePinyin: false, includeTranslation: false });
    assert.deepEqual(supportFor(1, "auto", { language: "chinese" }), { includePinyin: false, includeTranslation: false });
  });

  it("keeps message length limits rising with level", () => {
    const limits = ([1, 2, 3, 4, 5, 6] as const).map((level) => SCAFFOLD_RULES[level].maxChineseChars);
    assert.deepEqual([...limits].sort((a, b) => a - b), limits);
    assert.equal(effectiveLevel(1, -1), 1);
    assert.equal(effectiveLevel(5, 2), 6);
  });

  it("puts level, persona, and correction rules in the model prompt", () => {
    const prompt = buildSystemPrompt(turnInput({ level: 2, persona: "professional_partner", correctionMode: "hint_first" }));
    assert.match(prompt, new RegExp(getPersona("professional_partner").label, "i"));
    assert.match(prompt, /HSK ?2/);
    assert.match(prompt, /hint/i);
    assert.match(prompt, /JSON/);
  });
});

describe("personas and correction modes", () => {
  it("defines four numbered personas with friendly_friend first", () => {
    assert.deepEqual(PERSONAS.map((persona) => persona.key), [
      "friendly_friend",
      "focused_coach",
      "accountability_partner",
      "professional_partner",
    ]);
    assert.equal(personaByNumber(4)?.key, "professional_partner");
    assert.equal(personaByNumber(5) ?? null, null);
    assert.equal(getPersona("nonsense").key, "friendly_friend");
  });

  it("defines four correction modes with gentle as the default", () => {
    assert.deepEqual(CORRECTION_MODES.map((mode) => mode.key), ["gentle", "coach", "hint_first", "conversation_only"]);
    assert.equal(getCorrectionMode(null).key, "gentle");
  });

  it("only offers extra personas to subscribers", () => {
    assert.deepEqual(HUAHUA_PLANS.free.personas, ["friendly_friend"]);
    assert.equal(HUAHUA_PLANS.subscriber.personas.length, 4);
    assert.equal(HUAHUA_PLANS.free.proactiveOpeners, false);
  });
});

describe("commands", () => {
  it("parses English and Chinese commands", () => {
    assert.deepEqual(parseCommand("pinyin"), { command: { type: "pinyin" }, persistent: false });
    assert.deepEqual(parseCommand("翻译"), { command: { type: "translate" }, persistent: false });
    assert.deepEqual(parseCommand("简单一点！"), { command: { type: "easier" }, persistent: false });
    assert.deepEqual(parseCommand("Hint please"), { command: { type: "hint" }, persistent: false });
    assert.equal(parseCommand("我今天学了拼音"), null, "not a command inside a sentence");
  });

  it("only persists on a clear request for a lasting change", () => {
    assert.equal(parseCommand("always pinyin")?.persistent, true);
    assert.equal(parseCommand("以后都拼音")?.persistent, true);
    assert.equal(parseCommand("pinyin from now on")?.persistent, true);
    assert.equal(parseCommand("english")?.persistent, false);
    assert.equal(parseCommand("always hint"), null, "hints are per message");
  });

  it("only treats numbers as persona picks while the menu is open", () => {
    assert.equal(parseCommand("2"), null);
    assert.deepEqual(parseCommand("2", { personaMenuOpen: true })?.command, { type: "persona", persona: "focused_coach" });
    assert.equal(parseCommand("yes"), null);
    assert.deepEqual(parseCommand("yes", { controlPending: true })?.command, { type: "keep" });
    assert.deepEqual(parseCommand("less", { controlPending: true })?.command, { type: "less" });
  });
});

describe("safety", () => {
  it("detects crisis language but not vocabulary questions", () => {
    assert.equal(classifyInboundSafety("I want to die"), "crisis");
    assert.equal(classifyInboundSafety("我想自杀"), "crisis");
    assert.equal(classifyInboundSafety("what does 死 mean?"), null);
    assert.equal(classifyInboundSafety("我饿死了"), null);
  });

  it("points to local crisis lines", () => {
    assert.match(crisisMessage("US"), /988/);
    assert.match(crisisMessage("CA"), /988/);
    assert.match(crisisMessage("GB"), /emergency/i);
  });

  it("catches credential sharing and requests", () => {
    assert.equal(classifyInboundSafety("my bank PIN is 4821"), "credentials");
    assert.ok(outboundAsksForCredentials("Can you send me your verification code?"));
    assert.ok(!outboundAsksForCredentials("你今天吃什么？"));
  });

  it("always discloses it's an AI when asked", () => {
    assert.ok(asksIfHuman("are you human?"));
    assert.ok(asksIfHuman("你是真人吗"));
    assert.match(ensureAiDisclosure("是的！", "are you a real person?"), /AI/);
    assert.equal(ensureAiDisclosure("你好", "你好"), "你好");
  });
});

describe("structured output", () => {
  it("validates the model's JSON at runtime", () => {
    assert.throws(() => validateTurn("text"), TurnValidationError);
    assert.throws(() => validateTurn({ message: "你好" }), TurnValidationError, "safety is required");
    const turn = validateTurn({
      message: "你好！",
      safety: "safe",
      target_vocab: ["咖啡", { hanzi: "茶", pinyin: "chá" }, null],
      word_comfort_updates: [{ word: "咖啡", signal: "made_up" }, { word: "茶", signal: "understood" }],
      detected_difficulty: 9,
    });
    assert.deepEqual(turn.targetVocab.map((word) => word.hanzi), ["咖啡", "茶"]);
    assert.deepEqual(turn.wordComfortUpdates, [{ word: "茶", signal: "understood" }]);
    assert.equal(turn.detectedDifficulty, null);
  });

  it("retries once, then falls back only if allowed", async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      throw new Error("unavailable");
    };
    const fallback = fallbackReply(1);
    const result = await produceTurn(failing, turnInput(), { fallback, timeoutMs: 50, allowFallback: async () => true });
    assert.equal(calls, 2);
    assert.equal(result.source, "fallback");
    await assert.rejects(produceTurn(failing, turnInput(), { fallback, timeoutMs: 50, allowFallback: async () => false }));
  });

  it("times out slow generations", async () => {
    const slow = () => new Promise((resolve) => setTimeout(() => resolve({ message: "hi", safety: "safe" }), 500));
    const result = await produceTurn(slow, turnInput(), { fallback: fallbackReply(3), timeoutMs: 20, allowFallback: async () => true });
    assert.equal(result.source, "fallback");
  });

  it("only mentions a Journey in a fallback opener when one was completed", () => {
    const vocab = [{ hanzi: "咖啡", pinyin: "kāfēi", english: "coffee" }];
    assert.match(fallbackOpener({ level: 2, vocab, journeyName: "Ordering coffee" }).translation!, /Ordering coffee/);
    assert.doesNotMatch(fallbackOpener({ level: 2, vocab }).translation!, /learned|Journey/i);
  });
});

describe("message composition", () => {
  it("adds pinyin and translation within the segment budget", () => {
    const composed = composeSms({
      message: "你今天喝咖啡了吗？",
      translation: "Did you drink coffee today?",
      includePinyin: true,
      includeTranslation: true,
      maxSegments: 3,
      beginner: true,
    });
    assert.match(composed.body, /kā fēi|kāfēi/);
    assert.match(composed.body, /\(Did you drink coffee today\?\)/);
    assert.ok(composed.segments <= 3);
  });

  it("drops support lines before cutting the message", () => {
    const message = "我们今天聊一聊你的工作吧。你每天几点上班？你喜欢你的同事吗？周末你一般做什么？";
    const composed = composeSms({
      message,
      translation: "Let's talk about your work today. What time do you start work every day? Do you like your coworkers? What do you usually do on weekends?",
      includePinyin: true,
      includeTranslation: true,
      maxSegments: 2,
    });
    assert.ok(composed.body.startsWith(message));
    assert.ok(estimateSmsSegments(composed.body).segments <= 2);
  });

  it("generates tone-marked pinyin", () => {
    assert.equal(pinyinFor("你好"), "nǐ hǎo");
  });
});

describe("word comfort signals", () => {
  it("only accepts target words or words the learner used", () => {
    const signals = buildWordSignals({
      targetVocab: [{ hanzi: "咖啡" }],
      learnerText: "我喜欢喝茶",
      modelUpdates: [
        { word: "咖啡", signal: "understood" },
        { word: "茶", signal: "used_successfully" },
        { word: "飞机", signal: "used_successfully" },
      ],
    });
    assert.deepEqual(signals.map((signal) => signal.word).sort(), ["咖啡", "茶"]);
  });
});

describe("plans and usage", () => {
  it("resolves subscriptions from product_subscriptions, then the legacy plan field", () => {
    const now = new Date("2026-11-06T00:00:00Z");
    assert.equal(resolveSubscription([{ product: "core", status: "active", current_period_end: "2026-12-01T00:00:00Z" }], null, now).subscribed, true);
    assert.equal(resolveSubscription([{ product: "core", status: "canceled", current_period_end: "2026-12-01T00:00:00Z" }], null, now).subscribed, false);
    assert.equal(resolveSubscription([], { plan: "pro", current_period_end: "2026-12-01T00:00:00Z" }, now).subscribed, true);
    assert.equal(resolveSubscription([], { plan: "free", current_period_end: null }, now).subscribed, false);
  });

  it("follows the billing period and shows upgrades only near the limit for subscribers", () => {
    const period = usagePeriod(HUAHUA_PLANS.subscriber, "2026-12-15T10:00:00Z", new Date("2026-11-20T00:00:00Z"));
    assert.equal(period.start.toISOString(), "2026-11-15T10:00:00.000Z");
    assert.equal(period.end.toISOString(), "2026-12-15T10:00:00.000Z");
    const free = summarizeUsage(HUAHUA_PLANS.free, 8, new Date());
    assert.equal(free.state, "exhausted");
    assert.equal(free.showUpgrade, false);
    const sub = summarizeUsage(HUAHUA_PLANS.subscriber, 500, period.end);
    assert.equal(sub.state, "warning");
  });
});

describe("country registry", () => {
  it("covers launch and prepared countries", () => {
    const codes = SMS_COUNTRIES.map((country) => country.code).sort();
    for (const code of ["CA", "US", "ID", "IN", "SG", "VN", "DE", "AU", "TW", "GB", "MY", "NZ"]) {
      assert.ok(codes.includes(code), code);
    }
  });

  it("only exposes manually enabled countries; the env list can narrow but never widen", () => {
    assert.deepEqual(enabledSmsCountryCodes(), ["CA", "US"]);
    assert.deepEqual(enabledSmsCountryCodes(["CA"]), ["CA"]);
    assert.deepEqual(enabledSmsCountryCodes(["GB", "CA"]), ["CA"]);
    assert.equal(getSmsCountry("gb")?.enabled, false);
    const interest = interestSmsCountries(["CA", "US"]).map((country) => country.code);
    assert.ok(interest.includes("GB"));
    assert.ok(!interest.includes("CA"));
  });
});
