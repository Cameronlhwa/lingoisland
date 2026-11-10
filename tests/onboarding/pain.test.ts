import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeOnboardingProps } from "../../lib/onboarding/personalized/analytics";
import {
  emptyAnswers,
  initialState,
  isBeginnerPath,
  isStepComplete,
  markCompleted,
  parseAnswers,
  previousStep,
  progressFor,
  resumeStep,
  stepsFor,
  updateAnswers,
  type OnboardingAnswers,
} from "../../lib/onboarding/personalized/flow";
import { cleanPicks, isUsingPainKey, togglePick, usingPainOptionsFor, NO_PAIN_KEY } from "../../lib/onboarding/personalized/painPoints";

const NOW = new Date("2026-11-09T12:00:00.000Z");

function withLevel(selfReport: OnboardingAnswers["level"]["selfReport"], extra: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return { ...emptyAnswers(), goal: { primary: "work", secondary: null, otherText: null }, interests: { keys: ["clients"], custom: null }, level: { selfReport }, ...extra };
}

describe("pain-first step order", () => {
  it("asks experience, pains and reviews before the quiz for learners", () => {
    const steps = stepsFor(withLevel("few_words"));
    assert.deepEqual(steps.slice(0, 8), ["goal", "interests", "level", "experience", "using_pain", "learning_pain", "reviews", "calibration"]);
    assert.ok(steps.indexOf("reflect") === steps.indexOf("building") + 1 && steps.indexOf("commitment") === steps.indexOf("reflect") + 1);
  });

  it("skips the experience question and the quiz for complete beginners, but keeps pronunciation", () => {
    const steps = stepsFor(withLevel("new"));
    assert.ok(!steps.includes("experience"));
    assert.ok(!steps.includes("calibration"));
    assert.ok(steps.includes("pronunciation"));
    assert.equal(previousStep("using_pain", withLevel("new")), "level");
  });

  it("keeps the quiz for people who know a few words but haven't really started", () => {
    const answers = withLevel("few_words", { experience: { key: "not_started" } });
    assert.ok(stepsFor(answers).includes("calibration"));
    assert.equal(isBeginnerPath(answers), true);
  });

  it("decides the beginner path from level or experience", () => {
    assert.equal(isBeginnerPath(withLevel("new")), true);
    assert.equal(isBeginnerPath(withLevel("simple_sentences", { experience: { key: "not_started" } })), true);
    assert.equal(isBeginnerPath(withLevel("simple_sentences", { experience: { key: "on_and_off" } })), false);
    assert.equal(isBeginnerPath(withLevel("simple_sentences")), false);
  });

  it("completes the learning-pain step from hesitations on the beginner path", () => {
    const beginner = { ...initialState(NOW), answers: withLevel("new", { learningPain: { keys: [], hesitations: ["no_time"] } }) };
    assert.equal(isStepComplete("learning_pain", beginner), true);
    const learner = { ...initialState(NOW), answers: withLevel("few_words", { learningPain: { keys: [], hesitations: ["no_time"] } }) };
    assert.equal(isStepComplete("learning_pain", learner), false);
  });

  it("needs both a pain and a timing answer", () => {
    const partial = { ...initialState(NOW), answers: withLevel("few_words", { usingPain: { keys: ["stay_quiet"], timing: null, upcomingText: null } }) };
    assert.equal(isStepComplete("using_pain", partial), false);
  });

  it("resumes a saved state from before this change at the first new question", () => {
    const old = { ...initialState(NOW), answers: withLevel("few_words") };
    assert.equal(resumeStep(old), "experience");
    const oldBeginner = { ...initialState(NOW), answers: withLevel("new") };
    assert.equal(resumeStep(oldBeginner), "using_pain");
  });

  it("shows the reviews and reflection steps until they are marked complete", () => {
    const answers = withLevel("new", {
      usingPain: { keys: ["stay_quiet"], timing: "ongoing", upcomingText: null },
      learningPain: { keys: [], hesitations: ["no_time"] },
    });
    const state = { ...initialState(NOW), answers };
    assert.equal(resumeStep(state), "reviews");
    assert.equal(resumeStep(markCompleted(state, "reviews", NOW)), "pronunciation");
  });

  it("clears the experience answer when the learner switches to completely new", () => {
    const state = { ...initialState(NOW), answers: withLevel("few_words", { experience: { key: "over_2_years" } }) };
    const next = updateAnswers(state, { level: { selfReport: "new" } }, NOW);
    assert.equal(next.answers.experience.key, null);
  });

  it("never lets the progress bar go past its total", () => {
    for (const level of ["new", "few_words"] as const) {
      const answers = withLevel(level);
      for (const step of stepsFor(answers)) {
        const { index, total } = progressFor(step, answers);
        assert.ok(index >= 1 && index <= total, `${level} ${step}`);
      }
    }
  });
});

describe("pain answers from untrusted input", () => {
  it("drops unknown keys, caps picks at two, and keeps 'just want to improve' exclusive", () => {
    const parsed = parseAnswers({
      level: { selfReport: "few_words" },
      experience: { key: "forever" },
      usingPain: { keys: ["stay_quiet", "hack", "rely_on_translator", "cant_keep_going"], timing: "soon" },
      learningPain: { keys: ["plateau", "plateau", "tones", "forget_words"], hesitations: ["nope"] },
    });
    assert.equal(parsed.experience.key, null);
    assert.deepEqual(parsed.usingPain.keys, ["stay_quiet", "rely_on_translator"]);
    assert.equal(parsed.usingPain.timing, null);
    assert.deepEqual(parsed.learningPain.keys, ["plateau", "tones"]);
    assert.deepEqual(parsed.learningPain.hesitations, []);
    assert.deepEqual(cleanPicks(["stay_quiet", NO_PAIN_KEY], isUsingPainKey, 2, NO_PAIN_KEY), [NO_PAIN_KEY]);
  });

  it("cleans the upcoming-event text and only keeps it for a dated need", () => {
    const dated = parseAnswers({ usingPain: { keys: ["stay_quiet"], timing: "this_week", upcomingText: "<b>Client dinner</b> https://x.y" } });
    assert.equal(dated.usingPain.upcomingText, "bClient dinner/b");
    const ongoing = parseAnswers({ usingPain: { keys: ["stay_quiet"], timing: "ongoing", upcomingText: "Client dinner" } });
    assert.equal(ongoing.usingPain.upcomingText, null);
  });

  it("ignores an experience answer saved for a complete beginner", () => {
    const parsed = parseAnswers({ level: { selfReport: "new" }, experience: { key: "over_2_years" } });
    assert.equal(parsed.experience.key, null);
  });

  it("parses old saved answers with no pain fields", () => {
    const parsed = parseAnswers({ goal: { primary: "work" } });
    assert.deepEqual(parsed.usingPain, { keys: [], timing: null, upcomingText: null, customText: null });
    assert.deepEqual(parsed.learningPain, { keys: [], hesitations: [] });
  });
});

describe("pain picker helpers", () => {
  it("caps a multi-select at two and makes 'just want to improve' exclusive", () => {
    assert.deepEqual(togglePick(["a"], "b"), ["a", "b"]);
    assert.equal(togglePick(["a", "b"], "c"), null);
    assert.deepEqual(togglePick(["a", "b"], "a"), ["b"]);
    assert.deepEqual(togglePick(["stay_quiet"], NO_PAIN_KEY, 2, NO_PAIN_KEY), [NO_PAIN_KEY]);
    assert.deepEqual(togglePick([NO_PAIN_KEY], "stay_quiet", 2, NO_PAIN_KEY), ["stay_quiet"]);
  });

  it("offers goal-specific pains that always end with 'just want to improve'", () => {
    for (const goal of ["work", "school", "heritage", "travel", "everyday", "other"] as const) {
      const options = usingPainOptionsFor(goal);
      assert.equal(options[options.length - 1].key, NO_PAIN_KEY, goal);
    }
  });
});

describe("pain analytics stay key-only", () => {
  it("drops free text even if it is passed", () => {
    const props = sanitizeOnboardingProps({ pains: ["stay_quiet"], timing: "this_week", upcomingText: "Client dinner in Shanghai", path: "learner" });
    assert.deepEqual(props, { pains: ["stay_quiet"], timing: "this_week", path: "learner" });
  });
});

describe("reviews matched to pain", () => {
  it("ranks a shared learning pain above a shared goal and names it", async () => {
    const { matchReviews, reviewsTitle } = await import("../../lib/onboarding/personalized/socialProof");
    const answers = withLevel("few_words", {
      experience: { key: "on_and_off" },
      usingPain: { keys: ["stay_quiet"], timing: "ongoing", upcomingText: null },
      learningPain: { keys: ["inconsistent"], hesitations: [] },
    });
    const [top] = matchReviews(answers);
    assert.equal(top.testimonial.role, "Finance professional");
    assert.equal(top.reason, "Also short on time");
    assert.equal(reviewsTitle(answers), "Professionals like you learn with LingoIsland");
  });

  it("matches hesitations on the beginner path and uses a beginner headline", async () => {
    const { matchReviews, reviewsTitle } = await import("../../lib/onboarding/personalized/socialProof");
    const answers = withLevel("new", { learningPain: { keys: [], hesitations: ["apps_felt_like_games"] } });
    const [top] = matchReviews(answers);
    assert.equal(top.testimonial.role, "Medical professional");
    assert.equal(top.reason, "Also wanted relevant lessons");
    assert.equal(reviewsTitle(answers), "Others who started from zero");
  });

  it("calls out a plateau in the headline", async () => {
    const { reviewsTitle } = await import("../../lib/onboarding/personalized/socialProof");
    assert.equal(reviewsTitle(withLevel("simple_sentences", { learningPain: { keys: ["plateau"], hesitations: [] } })), "People who felt stuck too");
  });
});

describe("pronunciation feedback", () => {
  it("starts beginners with 你好 and learners with a topic word", async () => {
    const { pronunciationWords } = await import("../../lib/onboarding/personalized/pronunciation");
    assert.equal(pronunciationWords("work", 0, true)[0].hanzi, "你好");
    assert.equal(pronunciationWords("work", 3, false)[0].hanzi, "工作");
  });

  it("turns scores into a band and names the weakest character of the target word only", async () => {
    const { feedbackFor, feedbackLine } = await import("../../lib/onboarding/personalized/pronunciation");
    assert.deepEqual(feedbackFor({ overall: 88, tone: 90 }, [], "你好"), { feedback: "great", weakSyllable: null });
    const close = feedbackFor({ overall: 70, tone: 52 }, [{ hanzi: "你", score: 85 }, { hanzi: "好", score: 45 }], "你好");
    assert.deepEqual(close, { feedback: "close", weakSyllable: "好" });
    const lines = [feedbackLine("great"), feedbackLine(close.feedback, close.weakSyllable), feedbackLine("retry"), feedbackLine(undefined)];
    assert.ok(lines.every((line) => line === lines[0]), "every result shows the same line");
    assert.doesNotMatch(lines[0], /spot on|close|work|好/i);
    assert.equal(feedbackFor({ overall: 20, tone: 15 }, [{ hanzi: "X", score: 5 }], "你好").weakSyllable, null);
    assert.equal(feedbackFor({ overall: 20, tone: 15 }, [], "你好").feedback, "retry");
  });
});

describe("reflection and plan answers", () => {
  it("reflects a learner's pain, experience and goal back in their words", async () => {
    const { reflectionFor, planAnswers } = await import("../../lib/onboarding/personalized/reflection");
    const { planFor } = await import("../../lib/onboarding/personalized/flow");
    const answers = withLevel("few_words", {
      experience: { key: "on_and_off" },
      usingPain: { keys: ["stay_quiet"], timing: "upcoming_event", upcomingText: "client dinner" },
      learningPain: { keys: ["not_relevant", "forget_words"], hesitations: [] },
      availability: { minutes: "10", days: "3", session: null },
    });
    const plan = planFor(answers);
    const reflection = reflectionFor(answers, plan);
    assert.equal(reflection.rightNow, "You stay quiet when colleagues speak Mandarin.");
    assert.match(reflection.struggle, /^You\u2019ve been learning on and off for years\. Lessons weren\u2019t about/);
    assert.match(reflection.goal, /client dinner/);
    assert.deepEqual(planAnswers(answers, plan), [
      "Every lesson uses your situations, not textbook scenarios",
      "Quick reviews bring words back before you forget them",
      "Lessons built around clients",
    ]);
  });

  it("uses hesitations and a dated milestone for beginners", async () => {
    const { reflectionFor, planAnswers } = await import("../../lib/onboarding/personalized/reflection");
    const { planFor } = await import("../../lib/onboarding/personalized/flow");
    const answers = withLevel("new", {
      usingPain: { keys: ["want_to_improve"], timing: "no_date", upcomingText: null },
      learningPain: { keys: [], hesitations: ["no_time"] },
      availability: { minutes: "10", days: "3", session: null },
    });
    const plan = planFor(answers);
    const reflection = reflectionFor(answers, plan);
    assert.equal(reflection.struggleLabel, "What\u2019s held you back");
    assert.equal(reflection.struggle, "You weren\u2019t sure you\u2019d have time.");
    assert.match(reflection.goal, /in about 12 weeks\.$/);
    assert.equal(planAnswers(answers, plan)[0], "10-minute lessons that fit your week");
  });
});

describe("building labels", () => {
  it("names their topics and schedule", async () => {
    const { buildStageLabels, BUILD_STAGES } = await import("../../lib/onboarding/personalized/building");
    assert.deepEqual(buildStageLabels({ interestPhrase: "clients and meetings", minutesPerDay: 10, daysLabel: "3 days", daysVary: false }), [
      "Focusing on clients and meetings",
      "Matching your starting point",
      "Fitting it into 10 minutes, 3 days a week",
    ]);
    assert.deepEqual(buildStageLabels(null), [...BUILD_STAGES]);
  });
});

describe("paywall copy", () => {
  it("leads with the learner's pain and falls back by path", async () => {
    const { paywallHeadline, paywallBenefits, paywallReview, paywallSubline } = await import("../../lib/onboarding/personalized/paywallCopy");
    const { planFor } = await import("../../lib/onboarding/personalized/flow");
    const work = withLevel("few_words", {
      experience: { key: "on_and_off" },
      usingPain: { keys: ["stay_quiet"], timing: "ongoing", upcomingText: null },
      learningPain: { keys: ["inconsistent"], hesitations: [] },
      availability: { minutes: "10", days: "3", session: null },
    });
    const plan = planFor(work);
    assert.equal(paywallHeadline(work, plan), "Stop sitting out of Mandarin conversations at work");
    assert.equal(paywallSubline(plan), "10 minutes a day, 3 days a week. Built around clients.");
    assert.equal(paywallBenefits(work, plan).length, 3);
    assert.equal(paywallReview(work)?.role, "Finance professional");

    const beginner = withLevel("new", {
      usingPain: { keys: ["want_to_improve"], timing: "no_date", upcomingText: null },
      learningPain: { keys: [], hesitations: ["no_time"] },
      availability: { minutes: "10", days: "3", session: null },
    });
    assert.equal(paywallHeadline(beginner, planFor(beginner)), "Your first real Mandarin conversation, in 10 minutes a day");
    const learner = { ...beginner, level: { selfReport: "few_words" as const }, experience: { key: "over_2_years" as const } };
    assert.equal(paywallHeadline(learner, planFor(learner)), "Finally use the Mandarin you\u2019ve studied");
  });

  it("never uses internal jargon in the benefits", async () => {
    const { paywallBenefits } = await import("../../lib/onboarding/personalized/paywallCopy");
    const { planFor } = await import("../../lib/onboarding/personalized/flow");
    for (const keys of [["forget_words", "tones"], ["plateau", "no_practice"], ["not_relevant", "freeze_speaking"]] as const) {
      const answers = withLevel("simple_sentences", { learningPain: { keys: [...keys], hesitations: [] }, availability: { minutes: "15", days: "5", session: null } });
      for (const benefit of paywallBenefits(answers, planFor(answers))) assert.doesNotMatch(`${benefit.title} ${benefit.detail}`, /Huahua|Journey|Island/);
    }
  });
});

describe("typing your own pain", () => {
  it("offers 'Something else' just before 'just want to improve' for every goal", async () => {
    const { usingPainOptionsFor } = await import("../../lib/onboarding/personalized/painPoints");
    for (const goal of ["work", "school", "heritage", "travel", "everyday", "other"] as const) {
      const keys = usingPainOptionsFor(goal).map((option) => option.key);
      assert.equal(keys[keys.length - 2], "something_else", goal);
    }
  });

  it("needs their words before the step is complete, and keeps them only while picked", () => {
    const base = withLevel("few_words", { usingPain: { keys: ["something_else"], timing: "ongoing", upcomingText: null, customText: null } });
    assert.equal(isStepComplete("using_pain", { ...initialState(NOW), answers: base }), false);
    const typed = { ...base, usingPain: { ...base.usingPain, customText: "I freeze on calls" } };
    assert.equal(isStepComplete("using_pain", { ...initialState(NOW), answers: typed }), true);
    assert.equal(parseAnswers({ usingPain: { keys: ["something_else"], timing: "ongoing", customText: "<b>I freeze</b> on calls" } }).usingPain.customText, "bI freeze/b on calls");
    assert.equal(parseAnswers({ usingPain: { keys: ["stay_quiet"], timing: "ongoing", customText: "leftover" } }).usingPain.customText, null);
  });

  it("quotes their words in the playback and the model's facts, never as a label", async () => {
    const { templateInsight, insightFacts } = await import("../../lib/onboarding/personalized/insight");
    const answers = withLevel("few_words", {
      usingPain: { keys: ["stay_quiet", "something_else"], timing: "ongoing", upcomingText: null, customText: "I freeze on calls" },
      learningPain: { keys: ["freeze_speaking"], hesitations: [] },
    });
    assert.equal(templateInsight(answers).now, "You stay quiet when colleagues speak Mandarin. In your words: \u201cI freeze on calls\u201d.");
    const facts = insightFacts(answers).join("\n");
    assert.match(facts, /in their own words: "I freeze on calls"/);
    assert.doesNotMatch(facts, /Something else/);
  });
});
