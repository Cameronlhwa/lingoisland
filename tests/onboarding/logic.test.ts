import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ONBOARDING_EVENTS, sanitizeOnboardingProps } from "../../lib/onboarding/personalized/analytics";
import {
  ASSESSMENT_LENGTH,
  ROLE_WEIGHTS,
  assessmentSlots,
  feedbackFor,
  scoreAssessment,
  selectAssessment,
  type AssessmentItem,
} from "../../lib/onboarding/personalized/assessment";
import { BUILD_MIN_MS, BUILD_MIN_MS_REDUCED, BUILD_STAGES, LAST_STAGE_EXTRA_MS, buildingState } from "../../lib/onboarding/personalized/building";
import {
  emptyAnswers,
  canVisit,
  initialState,
  isStepComplete,
  markCompleted,
  mergeStates,
  nextStep,
  parseAnswers,
  parseState,
  planFor,
  previousStep,
  progressFor,
  resumeStep,
  stepsFor,
  updateAnswers,
  type OnboardingAnswers,
  type OnboardingState,
} from "../../lib/onboarding/personalized/flow";
import { normalizeCustomText } from "../../lib/onboarding/personalized/goals";
import { defaultHuahuaPrefs, parseHuahuaPrefs, toSmsPreferencePatch } from "../../lib/onboarding/personalized/huahua";
import { SELF_REPORT_OPTIONS, cefrForLevel, hskForLevel, levelForSelfReport } from "../../lib/onboarding/personalized/levels";
import {
  buildPlan,
  defaultSupportStyle,
  formatRange,
  milestoneKeyFor,
  scaleWeeks,
  supportRecommendation,
} from "../../lib/onboarding/personalized/plan";
import { presentQuestion } from "../../lib/onboarding/personalized/presentation";
import { isPronunciationWord, needsToneSupport, pronunciationWords, toneSupportFrom } from "../../lib/onboarding/personalized/pronunciation";
import { getQuestion, QUESTION_BANK } from "../../lib/onboarding/personalized/questionBank";
import { matchReviews, SITE_RATING, socialProofTitle } from "../../lib/onboarding/personalized/socialProof";
import { LEARNER_TESTIMONIALS } from "../../lib/landing-content";
import { MESSAGING_CONSENT_VERSION, SMS_CONSENT_VERSION, messagingDisclosure, resolveConsent } from "../../lib/sms/consent";
import { channelEligibility } from "../../lib/onboarding/personalized/messaging";

const NOW = new Date("2026-11-07T12:00:00Z");

function answerAll(items: AssessmentItem[], correct: (item: AssessmentItem) => boolean) {
  return items.map((item) => {
    const question = getQuestion(item.questionId)!;
    const wrong = question.choices.find((choice) => choice.id !== question.answer)!.id;
    return { position: item.position, questionId: item.questionId, choiceId: correct(item) ? question.answer : wrong };
  });
}

function completedAnswers(overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  const base = emptyAnswers();
  const items = selectAssessment({ claimedLevel: 3, topic: "work", seed: "6f1c2b9e-4a7d-4c1e-9b2a-0d3e5f7a9b1c" });
  const answers = answerAll(items, () => true);
  return {
    ...base,
    goal: { primary: "work", secondary: null, otherText: null },
    interests: { keys: ["meetings", "clients"], custom: null },
    level: { selfReport: "basic_conversations" },
    experience: { key: "6_to_24_months" },
    usingPain: { keys: ["stay_quiet"], timing: "ongoing", upcomingText: null },
    learningPain: { keys: ["not_relevant"], hesitations: [] },
    calibration: {
      attemptId: "6f1c2b9e-4a7d-4c1e-9b2a-0d3e5f7a9b1c",
      claimedLevel: 3,
      items,
      answers,
      placement: scoreAssessment({ claimedLevel: 3, items, answers }),
      writingSystem: "simplified",
    },
    pronunciation: { status: "skipped", toneSupport: null },
    availability: { minutes: "10", days: "5", session: null },
    ...overrides,
  };
}

/** Every answer filled in and the reviews screen seen: the plan is next to build. */
function answeredState(overrides: Partial<OnboardingAnswers> = {}): OnboardingState {
  return markCompleted({ ...initialState(NOW), answers: completedAnswers(overrides) }, "reviews", NOW);
}

describe("level mapping", () => {
  it("maps the six self-report descriptions onto Pre-HSK through HSK 5/6", () => {
    assert.equal(SELF_REPORT_OPTIONS.length, 6);
    assert.deepEqual(
      SELF_REPORT_OPTIONS.map((option) => [option.key, levelForSelfReport(option.key), option.internalLabel]),
      [
        ["new", 0, "Pre-HSK"],
        ["few_words", 1, "HSK 1"],
        ["simple_sentences", 2, "HSK 2"],
        ["basic_conversations", 3, "HSK 3"],
        ["familiar_topics", 4, "HSK 4"],
        ["complex_topics", 5, "HSK 5 or 6"],
      ],
    );
  });

  it("converts internal levels to CEFR and HSK for content generation", () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(cefrForLevel), ["A0", "A0", "A1", "A2", "B1", "B2", "C1"]);
    assert.deepEqual([0, 1, 2, 6, 9, -3].map(hskForLevel), [1, 1, 2, 6, 6, 1]);
  });

  it("never mentions verification in learner-facing level copy", () => {
    const copy = SELF_REPORT_OPTIONS.map((option) => `${option.label} ${option.description}`).join(" ");
    assert.doesNotMatch(copy, /verif|test|check/i);
  });
});

describe("reviews before calibration", () => {
  const learner = (goal: OnboardingAnswers["goal"]["primary"], interests: string[], selfReport: OnboardingAnswers["level"]["selfReport"]) => ({
    ...emptyAnswers(),
    goal: { primary: goal, secondary: null, otherText: null },
    interests: { keys: interests, custom: null },
    level: { selfReport },
  });

  it("puts the closest review first and explains why it was picked", () => {
    const work = matchReviews(learner("work", ["finance"], "few_words"));
    assert.deepEqual(work.map((review) => review.testimonial.role), ["Finance professional", "Business and heritage learner", "Medical professional"]);
    assert.equal(work[0].reason, "Also learning for work");

    const travel = matchReviews(learner("travel", ["restaurants"], "new"));
    assert.equal(travel[0].testimonial.role, "Traveler");
    assert.equal(travel[0].reason, "Also learning for travel");

    const heritage = matchReviews(learner("heritage", ["family_conversations"], "simple_sentences"));
    assert.equal(heritage[0].testimonial.role, "Business and heritage learner");
  });

  it("falls back to a shared interest, and to no reason when nothing matches", () => {
    const medicine = matchReviews(learner("everyday", ["medicine"], "new"));
    assert.equal(medicine[0].testimonial.role, "Medical professional");
    assert.equal(medicine[0].reason, "Also interested in medicine");
    const other = matchReviews(learner("other", [], "new"));
    assert.equal(other.length, 3);
    assert.ok(other.every((review) => review.reason === null));
  });

  it("only shows real website reviews and the 4.7 rating", () => {
    assert.equal(SITE_RATING, 4.7);
    const quotes = new Set(LEARNER_TESTIMONIALS.map((testimonial) => testimonial.quote));
    for (const goal of ["work", "school", "heritage", "travel", "everyday", "other"] as const) {
      for (const review of matchReviews(learner(goal, [], "basic_conversations"))) assert.ok(quotes.has(review.testimonial.quote));
    }
    assert.equal(socialProofTitle("work"), "Professionals like you learn with LingoIsland");
    assert.equal(socialProofTitle("school"), "Learners like you learn with LingoIsland");
  });
});

describe("question selection", () => {
  it("selects exactly five unique questions in the required order", () => {
    for (let claimed = 0; claimed <= 6; claimed += 1) {
      const items = selectAssessment({ claimedLevel: claimed as 0, topic: "travel", seed: `seed-${claimed}` });
      assert.equal(items.length, ASSESSMENT_LENGTH);
      assert.deepEqual(items.map((item) => item.role), ["warmup", "representative", "interest", "diagnostic", "confidence"]);
      assert.equal(new Set(items.map((item) => item.questionId)).size, 5);
      assert.deepEqual(items.map((item) => item.position), [1, 2, 3, 4, 5]);
    }
  });

  it("targets two below, one below, one below, at, and one below the claimed level", () => {
    const slots = assessmentSlots(3, "work");
    assert.deepEqual(slots.map((slot) => slot.level), [1, 2, 2, 3, 2]);
  });

  it("never asks a question above the claimed level", () => {
    for (let claimed = 0; claimed <= 6; claimed += 1) {
      const items = selectAssessment({ claimedLevel: claimed as 0, topic: "work", seed: `cap-${claimed}` });
      assert.ok(items.every((item) => getQuestion(item.questionId)!.level <= claimed), `claimed ${claimed}`);
    }
  });

  it("clamps targets at the lowest and highest levels", () => {
    assert.deepEqual(assessmentSlots(0, "work").map((slot) => slot.level), [0, 0, 0, 0, 0]);
    assert.deepEqual(assessmentSlots(6, "work").map((slot) => slot.level), [4, 5, 5, 6, 5]);
    const top = selectAssessment({ claimedLevel: 6, topic: "work", seed: "top" });
    assert.ok(top.every((item) => getQuestion(item.questionId)!.level >= 4));
  });

  it("uses three confidence questions and two diagnostic questions, weighting 2 and 4 double", () => {
    const items = selectAssessment({ claimedLevel: 2, topic: "everyday", seed: "weights" });
    const diagnostic = items.filter((item) => ROLE_WEIGHTS[item.role] === 2).map((item) => item.position);
    const confidence = items.filter((item) => ROLE_WEIGHTS[item.role] === 1).map((item) => item.position);
    assert.deepEqual(diagnostic, [2, 4]);
    assert.deepEqual(confidence, [1, 3, 5]);
  });

  it("chooses the interest question from the learner's topic when one exists", () => {
    for (const topic of ["work", "school", "family", "travel", "everyday"] as const) {
      const items = selectAssessment({ claimedLevel: 3, topic, seed: `topic-${topic}` });
      const interest = getQuestion(items[2].questionId)!;
      const available = QUESTION_BANK.some((question) => question.level === 2 && question.topic === topic);
      if (available) assert.equal(interest.topic, topic, `interest question for ${topic}`);
    }
  });

  it("is deterministic for a seed and shuffles choices", () => {
    const a = selectAssessment({ claimedLevel: 3, topic: "work", seed: "same" });
    const b = selectAssessment({ claimedLevel: 3, topic: "work", seed: "same" });
    assert.deepEqual(a, b);
    const orders = new Set(
      Array.from({ length: 12 }, (_, index) => selectAssessment({ claimedLevel: 3, topic: "work", seed: `s${index}` })[1].choiceOrder.join("")),
    );
    assert.ok(orders.size > 1);
  });
});

describe("placement", () => {
  const items = selectAssessment({ claimedLevel: 3, topic: "work", seed: "place" });

  it("confirms the claim on a perfect score instead of raising it", () => {
    const placement = scoreAssessment({ claimedLevel: 3, items, answers: answerAll(items, () => true) });
    assert.equal(placement.rule, "confirm");
    assert.equal(placement.provisionalLevel, 3);
    assert.equal(placement.weightedScore, 1);
  });

  it("confirms the claim when the weighted score is at least 60%", () => {
    const placement = scoreAssessment({ claimedLevel: 3, items, answers: answerAll(items, (item) => item.role !== "diagnostic") });
    assert.equal(placement.weightedScore, Math.round((5 / 7) * 1000) / 1000);
    assert.equal(placement.rule, "confirm");
    assert.equal(placement.provisionalLevel, 3);
  });

  it("weights the representative and diagnostic answers double", () => {
    const missedHeavy = scoreAssessment({ claimedLevel: 3, items, answers: answerAll(items, (item) => item.position !== 2 && item.position !== 4) });
    const missedLight = scoreAssessment({ claimedLevel: 3, items, answers: answerAll(items, (item) => item.position !== 1 && item.position !== 3) });
    assert.equal(missedHeavy.weightedScore, Math.round((3 / 7) * 1000) / 1000);
    assert.equal(missedLight.weightedScore, Math.round((5 / 7) * 1000) / 1000);
    assert.equal(missedHeavy.rule, "lower_one");
    assert.equal(missedLight.rule, "confirm");
  });

  it("lowers two levels when almost nothing is right", () => {
    const placement = scoreAssessment({ claimedLevel: 3, items, answers: answerAll(items, () => false) });
    assert.equal(placement.rule, "lower_two");
    assert.equal(placement.provisionalLevel, 1);
  });

  it("never places an absolute beginner below Pre-HSK", () => {
    const beginner = selectAssessment({ claimedLevel: 0, topic: "everyday", seed: "new" });
    const placement = scoreAssessment({ claimedLevel: 0, items: beginner, answers: answerAll(beginner, () => false) });
    assert.equal(placement.provisionalLevel, 0);
    assert.equal(placement.adjustment, 0);
  });

  it("caps a strong advanced learner at the top level", () => {
    const top = selectAssessment({ claimedLevel: 6, topic: "work", seed: "high" });
    const placement = scoreAssessment({ claimedLevel: 6, items: top, answers: answerAll(top, () => true) });
    assert.equal(placement.provisionalLevel, 6);
  });

  it("ignores answers that do not match the selected questions", () => {
    const forged = items.map((item) => ({ position: item.position, questionId: "l6-quanheng", choiceId: "a" }));
    const placement = scoreAssessment({ claimedLevel: 3, items, answers: forged });
    assert.equal(placement.rule, "no_answers");
    assert.equal(placement.provisionalLevel, 3);
  });

  it("keeps feedback neutral with no percentages or fail language", () => {
    assert.equal(feedbackFor(true), "Nice!");
    assert.equal(feedbackFor(false), "Got it. We\u2019re adjusting your plan.");
    assert.doesNotMatch(feedbackFor(false), /wrong|incorrect|fail|%/i);
  });
});

describe("question presentation", () => {
  it("shows Simplified or Traditional characters as chosen", () => {
    const item: AssessmentItem = { position: 1, role: "warmup", targetLevel: 6, questionId: "l6-bodajingshen", choiceOrder: ["a", "b", "c"] };
    const simplified = presentQuestion(item, "simplified")!;
    const traditional = presentQuestion(item, "traditional")!;
    assert.match(simplified.zh, /传承/);
    assert.match(traditional.zh, /傳承/);
    assert.equal(traditional.choices[0].text, "博大精深");
  });

  it("adds pinyin under every Chinese prompt and choice at every level", () => {
    for (const question of QUESTION_BANK) {
      const item: AssessmentItem = { position: 1, role: "warmup", targetLevel: question.level, questionId: question.id, choiceOrder: question.choices.map((choice) => choice.id) };
      const presented = presentQuestion(item, "simplified")!;
      if (question.zh) assert.ok(presented.pinyin, `${question.id} prompt`);
      for (const choice of presented.choices) {
        if (choice.lang === "zh") assert.ok(choice.pinyin, `${question.id} choice ${choice.id}`);
        else assert.equal(choice.pinyin, null);
      }
    }
  });

  it("writes pinyin with tone marks and keeps the blank", () => {
    const item: AssessmentItem = { position: 1, role: "warmup", targetLevel: 2, questionId: "l2-yijing", choiceOrder: ["a", "b", "c"] };
    const presented = presentQuestion(item, "simplified")!;
    assert.match(presented.pinyin!, /^wǒ ___ chī fàn le/);
    assert.equal(presented.choices[0].pinyin, "yǐ jīng");
  });

  it("keeps the shuffled choice order", () => {
    const item: AssessmentItem = { position: 2, role: "representative", targetLevel: 6, questionId: "l6-juzu", choiceOrder: ["c", "a", "b"] };
    assert.deepEqual(presentQuestion(item, "simplified")!.choices.map((choice) => choice.id), ["c", "a", "b"]);
  });
});

describe("plan", () => {
  it("picks milestones by goal and level", () => {
    assert.equal(milestoneKeyFor("work", 1), "business");
    assert.equal(milestoneKeyFor("travel", 3), "travel");
    assert.equal(milestoneKeyFor("heritage", 2), "heritage");
    assert.equal(milestoneKeyFor("everyday", 0), "beginner");
    assert.equal(milestoneKeyFor("work", 4), "intermediate");
    assert.equal(milestoneKeyFor("school", 6), "advanced");
  });

  it("stretches the time range for small weekly commitments and formats weeks or months", () => {
    assert.deepEqual(scaleWeeks([8, 12], 15), [12, 18]);
    assert.deepEqual(scaleWeeks([8, 12], 50), [10, 15]);
    assert.deepEqual(scaleWeeks([8, 12], 300), [8, 12]);
    assert.equal(formatRange([8, 12]), "8 to 12 weeks");
    assert.equal(formatRange([17, 26]), "4 to 6 months");
  });

  it("defaults pinyin and translation support by level", () => {
    assert.deepEqual([0, 1].map((level) => supportRecommendation(level).pinyin), ["always", "always"]);
    assert.equal(supportRecommendation(2).translation, "on_request");
    assert.equal(supportRecommendation(3, "extra").pinyin, "always");
    assert.equal(supportRecommendation(5).pinyin, "new_words");
    assert.deepEqual([0, 2, 5].map(defaultSupportStyle), ["full", "on_request", "mostly_chinese"]);
  });

  it("builds two or three first Journeys from the interests", () => {
    const plan = buildPlan({ goal: "work", interestKeys: ["meetings", "clients", "sales", "finance"], provisionalLevel: 3, minutes: "10", days: "5" });
    assert.equal(plan.journeys.length, 3);
    assert.equal(plan.journeys[0].title, "Speaking up in meetings");
    assert.equal(plan.journeysHeading, "Your first lessons");
    assert.equal(plan.journeysNote, null);
    const sparse = buildPlan({ goal: "everyday", interestKeys: [], provisionalLevel: 0, minutes: "5", days: "2" });
    assert.ok(sparse.journeys.length >= 2 && sparse.journeys.length <= 3);
    assert.equal(sparse.benefit, "Start with small, useful steps without feeling overwhelmed.");
  });

  it("keeps first lessons on-goal instead of padding with daily routine", () => {
    const plan = buildPlan({
      goal: "heritage",
      interestKeys: ["family_conversations"],
      provisionalLevel: 2,
      minutes: "10",
      days: "3",
    });
    assert.equal(plan.journeys[0].title, "Catching up with family");
    assert.ok(plan.journeys.every((journey) => journey.key !== "everyday_life"));
    assert.deepEqual(
      plan.journeys.map((journey) => journey.key),
      ["family_conversations", "food"],
    );
    assert.match(plan.journeys[1].title, /food/i);
  });

  it("is honest with absolute beginners who want an advanced topic", () => {
    const plan = buildPlan({
      goal: "work",
      interestKeys: ["finance"],
      provisionalLevel: 0,
      minutes: "10",
      days: "5",
    });
    assert.equal(plan.journeysHeading, "What your lessons will teach you");
    assert.match(plan.journeysNote ?? "", /foundations.*finance/i);
    assert.equal(plan.journeys[0].title, "Greeting people at work");
    assert.equal(plan.journeys[1].title, "Numbers and money words you'll need for finance");
    assert.ok(!plan.journeys.some((journey) => /budgets/i.test(journey.title)));
  });

  it("expands 'You pick for me' into on-goal defaults", async () => {
    const { LET_US_DECIDE_KEY, effectiveInterestKeys } = await import("../../lib/onboarding/personalized/goals");
    assert.deepEqual(effectiveInterestKeys("travel", [LET_US_DECIDE_KEY]), ["restaurants", "transportation", "meeting_locals"]);
    const plan = buildPlan({
      goal: "travel",
      interestKeys: [LET_US_DECIDE_KEY],
      provisionalLevel: 2,
      minutes: "10",
      days: "3",
    });
    assert.ok(plan.journeys.length >= 2);
    assert.equal(plan.journeys[0].key, "restaurants");
    assert.ok(!plan.interests.includes("You pick for me"));
  });

  it("normalizes custom interests", () => {
    assert.equal(normalizeCustomText("   basketball   games  "), "basketball games");
    assert.equal(normalizeCustomText(""), null);
    assert.equal(normalizeCustomText("x".repeat(100))?.length, 40);
  });
});

describe("messaging consent", () => {
  it("requires at least one onboarding consent and the current version", () => {
    assert.deepEqual(resolveConsent({ consentVersion: MESSAGING_CONSENT_VERSION, consentScheduled: true, consentJourney: false }), {
      ok: true,
      version: MESSAGING_CONSENT_VERSION,
      scheduled: true,
      journey: false,
    });
    assert.deepEqual(resolveConsent({ consentVersion: MESSAGING_CONSENT_VERSION, consentScheduled: false, consentJourney: false }), { ok: false });
    assert.deepEqual(resolveConsent({ consentVersion: "2020-01-01", consentScheduled: true }), { ok: false });
    assert.deepEqual(resolveConsent({ consentVersion: MESSAGING_CONSENT_VERSION, consentScheduled: "true" }), { ok: false });
    assert.equal(resolveConsent({ consentVersion: SMS_CONSENT_VERSION, consent: true }).ok, true);
  });

  it("discloses sender, AI, frequency, rates, stopping, and that consent is optional", () => {
    for (const channel of ["sms", "whatsapp"] as const) {
      const text = messagingDisclosure(channel);
      for (const phrase of [/LingoIsland and Huahua/, /Huahua is an AI/, /schedule/, /rates may apply/i, /pause or stop anytime/i, /not required to purchase/i]) {
        assert.match(text, phrase);
      }
      assert.doesNotMatch(text, /\u2014/);
    }
  });
});

describe("Huahua preferences", () => {
  it("defaults to quiet hours from 9 PM to 8 AM and gentle corrections", () => {
    const prefs = defaultHuahuaPrefs(0, "America/New_York");
    assert.equal(prefs.quietStart, 21 * 60);
    assert.equal(prefs.quietEnd, 8 * 60);
    assert.equal(prefs.support, "full");
  });

  it("maps choices onto the existing SMS preference columns", () => {
    const patch = toSmsPreferencePatch({ ...defaultHuahuaPrefs(3, "UTC"), correction: "direct", frequency: "3", writingSystem: "traditional" });
    assert.equal(patch.correction_mode, "coach");
    assert.equal(patch.openers_per_week, 3);
    assert.equal(patch.writing_system, "traditional");
    assert.equal(toSmsPreferencePatch(defaultHuahuaPrefs(3, "UTC")).openers_per_week, null);
  });

  it("rejects invalid input and equal quiet-hour bounds", () => {
    const fallback = defaultHuahuaPrefs(2, "UTC");
    const parsed = parseHuahuaPrefs({ support: "loud", timezone: "Mars/Base", quietStart: 600, quietEnd: 600, frequency: "9" }, fallback);
    assert.equal(parsed.support, fallback.support);
    assert.equal(parsed.timezone, "UTC");
    assert.equal(parsed.frequency, "auto");
    assert.notEqual(parsed.quietStart, parsed.quietEnd);
  });
});

describe("pronunciation", () => {
  it("picks an easier interest word and a level word", () => {
    const [first, second] = pronunciationWords("travel", 0);
    assert.ok(first.hanzi && second.hanzi);
    assert.notEqual(first.hanzi, second.hanzi);
    assert.ok(isPronunciationWord(first.hanzi));
    assert.equal(isPronunciationWord("<script>"), false);
  });

  it("derives tone support without exposing scores", () => {
    assert.equal(needsToneSupport({ overall: 80, tone: 50 }), true);
    assert.equal(needsToneSupport({ overall: 80, tone: 75 }), false);
    assert.equal(toneSupportFrom([]), null);
    assert.equal(toneSupportFrom([{ word: "你好", needsToneSupport: true }]), "extra");
    assert.equal(toneSupportFrom([{ word: "你好", needsToneSupport: false }]), "standard");
  });
});

describe("plan building timing", () => {
  it("checks one stage at a time and finishes after the designed duration", () => {
    const perStage = (BUILD_MIN_MS - LAST_STAGE_EXTRA_MS) / BUILD_STAGES.length;
    assert.equal(buildingState(0, true).completedStages, 0);
    assert.equal(buildingState(perStage + 1, true).completedStages, 1);
    assert.equal(buildingState(perStage * 2 + 1, true).completedStages, 2);
    assert.equal(buildingState(BUILD_MIN_MS - 1, true).completedStages, 2);
    assert.equal(buildingState(BUILD_MIN_MS - 1, true).done, false);
    assert.deepEqual(buildingState(BUILD_MIN_MS, true), { completedStages: 3, done: true, waitingOnServer: false });
  });

  it("holds the last check honestly while the server is still working", () => {
    assert.deepEqual(buildingState(BUILD_MIN_MS * 3, false), { completedStages: 2, done: false, waitingOnServer: true });
  });

  it("finishes sooner with reduced motion", () => {
    assert.equal(buildingState(BUILD_MIN_MS_REDUCED, true, true).done, true);
    assert.ok(BUILD_MIN_MS_REDUCED < BUILD_MIN_MS);
  });
});

describe("flow state and resume", () => {
  it("starts at the goal step and resumes at the first incomplete step", () => {
    const fresh = initialState(NOW);
    assert.equal(resumeStep(fresh), "goal");
    const partial = updateAnswers(fresh, { goal: { primary: "travel", secondary: null, otherText: null }, interests: { keys: ["hotels"], custom: null } }, NOW);
    assert.equal(resumeStep(partial), "level");
  });

  it("shows the building wait before reflection, then Huahua", () => {
    const state = answeredState();
    assert.equal(resumeStep(state), "building");
    assert.equal(resumeStep(markCompleted(state, "building", NOW)), "reflect");
    const built = markCompleted(markCompleted(state, "building", NOW), "reflect", NOW);
    assert.equal(resumeStep(built), "huahua");
  });

  it("skips Huahua preferences and the preview without messaging", () => {
    const answers = completedAnswers({ messaging: { channel: "none", status: "skipped" } });
    assert.ok(stepsFor(answers).includes("huahua"));
    assert.ok(stepsFor(answers).includes("messaging"));
    assert.ok(!stepsFor(answers).includes("huahua_prefs"));
    assert.ok(!stepsFor(answers).includes("preview"));
    assert.equal(nextStep("messaging", answers), "commitment");
    assert.equal(nextStep("reflect", answers), "huahua");
    const verified = completedAnswers({ messaging: { channel: "sms", status: "verified" } });
    assert.equal(nextStep("messaging", verified), "huahua_prefs");
    assert.ok(stepsFor(verified).includes("preview"));
  });

  it("resumes after completed phone steps at preferences or commitment", () => {
    let state = answeredState({ messaging: { channel: "sms", status: "verified" } });
    for (const step of ["building", "reflect", "huahua", "messaging"] as const) {
      state = markCompleted(state, step, NOW);
    }
    assert.equal(resumeStep(state), "huahua_prefs");
    assert.equal(canVisit("messaging", state), true);
  });

  it("rebuilds the plan after an earlier answer changes", () => {
    let state = answeredState();
    state = markCompleted(markCompleted(state, "building", NOW), "reflect", NOW);
    state = updateAnswers(state, { availability: { minutes: "30", days: "5", session: "auto" } }, NOW);
    assert.equal(isStepComplete("reflect", state), false);
    assert.equal(resumeStep(state), "building");
    assert.equal(planFor(state.answers).minutesPerDay, 30);
  });

  it("restarts calibration when the self-reported level changes but keeps the writing system", () => {
    let state: OnboardingState = { ...initialState(NOW), answers: completedAnswers() };
    state = updateAnswers(state, { calibration: { ...state.answers.calibration, writingSystem: "traditional" } }, NOW);
    state = updateAnswers(state, { level: { selfReport: "new" } }, NOW);
    assert.equal(state.answers.calibration.placement, null);
    assert.equal(state.answers.calibration.writingSystem, "traditional");
  });

  it("re-scores the placement from the answers instead of trusting saved results", () => {
    const answers = completedAnswers();
    const tampered = JSON.parse(JSON.stringify(answers));
    tampered.calibration.placement.provisionalLevel = 6;
    tampered.calibration.answers = answerAll(answers.calibration.items, () => false);
    const parsed = parseAnswers(tampered, "UTC");
    assert.equal(parsed.calibration.placement?.provisionalLevel, 1);
  });

  it("drops unknown or malformed fields from saved state", () => {
    const parsed = parseState({ answers: { goal: { primary: "hacking" }, interests: { keys: ["meetings", "<b>"], custom: "  my   topic " }, messaging: { status: "verified", channel: "fax" } } }, "UTC");
    assert.ok(parsed);
    assert.equal(parsed!.answers.goal.primary, null);
    assert.deepEqual(parsed!.answers.interests.keys, ["meetings"]);
    assert.equal(parsed!.answers.interests.custom, "my topic");
    assert.notEqual(parsed!.answers.messaging.channel, "fax");
  });

  it("merges local and saved copies by progress and keeps the saved revision", () => {
    const local: OnboardingState = { ...initialState(NOW), answers: completedAnswers(), revision: null };
    const remote: OnboardingState = { ...initialState(new Date(NOW.getTime() + 1000)), revision: 4 };
    const merged = mergeStates(local, remote)!;
    assert.equal(merged.answers.goal.primary, "work");
    assert.equal(merged.revision, 4);
  });

  it("shows progress without counting the building or paywall screens", () => {
    const answers = completedAnswers({ messaging: { channel: "sms", status: "verified" } });
    const total = progressFor("goal", answers).total;
    assert.equal(total, stepsFor(answers).length - 2);
    assert.equal(progressFor("building", answers).index, progressFor("availability", answers).index);
  });
});

describe("analytics privacy", () => {
  it("only lets allow-listed, non-identifying values through", () => {
    const safe = sanitizeOnboardingProps({
      step: "messaging",
      channel: "sms",
      phone: "+12025550123",
      phoneNumber: "2025550123",
      body: "hello Huahua",
      custom_interest: "Zither duets",
      name: "Cameron",
      reason: "+1 202 555 0123",
      interests: ["meetings", "Zither duets", "12345678"],
      position: 2,
      answer: "b",
    });
    assert.deepEqual(safe, { step: "messaging", channel: "sms", interests: ["meetings"], position: 2 });
  });

  it("uses an onboarding_ event for every step", () => {
    const names = Object.values(ONBOARDING_EVENTS);
    assert.ok(names.every((name) => name.startsWith("onboarding_")));
    for (const required of ["onboarding_started", "onboarding_abandoned", "onboarding_purchase_completed", "onboarding_commitment_completed"]) {
      assert.ok(names.includes(required as (typeof names)[number]));
    }
  });
});

describe("messaging channel eligibility", () => {
  it("offers WhatsApp alongside SMS in every SMS-supported country", () => {
    const eligibility = channelEligibility({
      country: "CA",
      smsEnabled: true,
      smsCountries: ["CA", "US"],
      whatsappEnabled: true,
      // Canada is intentionally absent: SMS support should still make both channels available.
      whatsappCountries: ["US"],
    });

    assert.equal(eligibility.smsSupported, true);
    assert.equal(eligibility.whatsappAvailable, true);
    assert.equal(eligibility.recommendation, "choose");
    assert.deepEqual(eligibility.options.map((option) => option.channel), ["sms", "whatsapp"]);
  });

  it("keeps WhatsApp-only availability restricted outside SMS-supported countries", () => {
    const eligibility = channelEligibility({
      country: "GB",
      smsEnabled: true,
      smsCountries: ["CA", "US"],
      whatsappEnabled: true,
      whatsappCountries: ["US"],
    });

    assert.equal(eligibility.recommendation, "none");
    assert.deepEqual(eligibility.options, []);
  });
});
