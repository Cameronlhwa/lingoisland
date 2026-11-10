import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAnswers, planFor, type OnboardingAnswers } from "../../lib/onboarding/personalized/flow";
import { buildProgress, progressWeeks } from "../../lib/onboarding/personalized/progress";
import { buildRoadmap } from "../../lib/onboarding/personalized/roadmap";

function answers(extra: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    ...emptyAnswers(),
    goal: { primary: "work", secondary: null, otherText: null },
    interests: { keys: ["clients", "meetings"], custom: null },
    level: { selfReport: "few_words" },
    experience: { key: "on_and_off" },
    usingPain: { keys: ["cant_keep_going"], timing: "ongoing", upcomingText: null, customText: null },
    learningPain: { keys: ["forget_words"], hesitations: [] },
    availability: { minutes: "10", days: "3", session: null },
    ...extra,
  };
}

function progressFor(a: OnboardingAnswers) {
  const plan = planFor(a);
  return buildProgress(a, plan, buildRoadmap(a, plan));
}

describe("your path chart", () => {
  it("headlines their pain, their destination and a fixed 12-week path", () => {
    const p = progressFor(answers());
    assert.deepEqual(p.weeks, [4, 8, 12]);
    assert.equal(p.headline, "From stuck after hello to client chats in 12 weeks");
    assert.equal(p.moment, "Week 12: chat with clients in Mandarin");
  });

  it("moves the word counts with their level", () => {
    assert.deepEqual(progressFor(answers({ level: { selfReport: "new" } })).ticks, ["0", "100", "200", "300"]);
    assert.deepEqual(progressFor(answers({ level: { selfReport: "familiar_topics" } })).ticks, ["1,200", "1,300", "1,400", "1,500"]);
  });

  it("splits the plan into thirds for the week labels", () => {
    assert.deepEqual(progressWeeks(12), [4, 8, 12]);
    assert.deepEqual(progressWeeks(15), [5, 10, 15]);
  });

  it("leads the reasons with what fixes their own struggle", () => {
    const p = progressFor(answers());
    assert.equal(p.reasons[0].id, "remember");
    for (const reason of p.reasons) assert.ok(reason.tagline.length > 0 && !/pinyin|HSK/i.test(reason.tagline));
  });

  it("flags an upcoming event with what they'll have by then, and nothing otherwise", () => {
    assert.equal(progressFor(answers()).event, null);
    const dated = progressFor(answers({ usingPain: { keys: ["stay_quiet"], timing: "this_month", upcomingText: "a client dinner", customText: null } }));
    assert.equal(dated.event?.label, "Week 4: a client dinner");
    assert.equal(dated.event?.detail, "Ready by then: small talk at work: lunch, weekends, times");
    assert.match(dated.event?.detail ?? "", /^Ready by then: /);
    const now = progressFor(answers({ usingPain: { keys: ["stay_quiet"], timing: "this_week", upcomingText: "a client call", customText: null } }));
    assert.equal(now.event?.week, 1);
  });

  it("uses a heritage learner's own destination and moment", () => {
    const p = progressFor(answers({ goal: { primary: "heritage", secondary: null, otherText: null }, interests: { keys: ["family_conversations"], custom: null }, usingPain: { keys: ["limited_with_elders"], timing: "ongoing", upcomingText: null, customText: null } }));
    assert.match(p.headline, /to real family chats in 12 weeks$/);
    assert.match(p.moment, /talk with your family in Mandarin$/);
  });
});

describe("destination matches the milestones", () => {
  it("doesn't headline a non-work topic for a work learner", () => {
    const p = progressFor(answers({ interests: { keys: ["shopping", "clients"], custom: null } }));
    assert.match(p.headline, /to client chats in/);
  });
});

describe("number-graph experiment", () => {
  it("shows word counts only to the test variant", async () => {
    const { showsChartNumbers, sanitizeOnboardingProps } = await import("../../lib/onboarding/personalized/analytics");
    assert.equal(showsChartNumbers("test"), true);
    for (const variant of ["control", undefined, false, true, "other"] as const) assert.equal(showsChartNumbers(variant), false);
    assert.deepEqual(sanitizeOnboardingProps({ chart_variant: "test" }), { chart_variant: "test" });
  });
});
