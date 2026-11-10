import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyAnswers, planFor, type OnboardingAnswers } from "../../lib/onboarding/personalized/flow";
import { fixesFor } from "../../lib/onboarding/personalized/fixes";
import { paywallLevelChip } from "../../lib/onboarding/personalized/paywallCopy";
import { answerSummary } from "../../lib/onboarding/personalized/reflection";
import { buildRoadmap, roadmapWeeks } from "../../lib/onboarding/personalized/roadmap";

function answers(extra: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    ...emptyAnswers(),
    goal: { primary: "work", secondary: null, otherText: null },
    interests: { keys: ["clients", "meetings"], custom: null },
    level: { selfReport: "new" },
    usingPain: { keys: ["stay_quiet"], timing: "ongoing", upcomingText: null, customText: null },
    learningPain: { keys: [], hesitations: ["seems_too_hard"] },
    availability: { minutes: "10", days: "3", session: null },
    ...extra,
  };
}

describe("roadmap", () => {
  it("spreads four stages from week 1 to the end of the plan's own milestone range", () => {
    assert.deepEqual(roadmapWeeks(15), [1, 5, 10, 15]);
    assert.deepEqual(roadmapWeeks(4), [1, 2, 3, 4]);
    const plan = planFor(answers());
    const roadmap = buildRoadmap(answers(), plan);
    assert.equal(roadmap.stages.length, 4);
    assert.equal(roadmap.finalWeek, plan.milestone.weeks[1]);
    assert.equal(roadmap.stages[3].when, `By week ${plan.milestone.weeks[1]}`);
  });

  it("ends a work beginner on a real client conversation, not on hello", () => {
    const roadmap = buildRoadmap(answers(), planFor(answers()));
    assert.match(roadmap.stages[0].title, /Introduce yourself/);
    assert.match(roadmap.finalTitle, /Chat with clients in Mandarin/);
  });

  it("doesn't start someone who can already make sentences at introductions", () => {
    const builder = answers({ level: { selfReport: "simple_sentences" }, experience: { key: "over_2_years" }, learningPain: { keys: ["plateau"], hesitations: [] } });
    const roadmap = buildRoadmap(builder, planFor(builder));
    assert.doesNotMatch(roadmap.stages[0].title, /introduce yourself/i);
    assert.match(roadmap.finalTitle, /client conversation in Mandarin/);
  });

  it("fills in their topic and names an upcoming event", () => {
    const everyday = answers({
      goal: { primary: "everyday", secondary: null, otherText: null },
      interests: { keys: ["food"], custom: null },
      usingPain: { keys: ["stay_quiet"], timing: "upcoming_event", upcomingText: "a trip to Taipei", customText: null },
    });
    const roadmap = buildRoadmap(everyday, planFor(everyday));
    assert.match(roadmap.finalTitle, /food/);
    assert.doesNotMatch(roadmap.stages.map((stage) => stage.title).join(" "), /\{topic\}/);
    assert.match(roadmap.note, /a trip to Taipei/);
  });
});

describe("fixes", () => {
  it("leads with what fixes their own struggle and avoids jargon a beginner won't know", () => {
    const list = fixesFor(answers(), planFor(answers()));
    assert.equal(list.length, 3);
    assert.equal(list[0].id, "hear");
    for (const fix of list) assert.doesNotMatch(`${fix.title} ${fix.detail}`, /pinyin|HSK|Huahua|Journey/i);
  });

  it("never repeats a fix", () => {
    const mixed = answers({
      level: { selfReport: "few_words" },
      experience: { key: "on_and_off" },
      learningPain: { keys: ["freeze_speaking", "no_practice"], hesitations: [] },
    });
    const ids = fixesFor(mixed, planFor(mixed)).map((fix) => fix.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids[0], "practice");
  });
});

describe("plain-language extras", () => {
  it("tells beginners where they start in words, and leaves learners' level chip alone", () => {
    assert.equal(paywallLevelChip(answers()), "Starting from scratch");
    assert.equal(paywallLevelChip(answers({ level: { selfReport: "simple_sentences" }, experience: { key: "over_2_years" } })), undefined);
  });

  it("explains the plan with their own answers", () => {
    const rows = answerSummary(answers(), planFor(answers()));
    const text = rows.map((row) => `${row.label}: ${row.value}`).join("\n");
    assert.match(text, /Why you\u2019re learning: Work or business/);
    assert.match(text, /What happens now: I stay quiet when colleagues speak Mandarin/);
    assert.match(text, /What held you back: It seems too hard/);
    assert.match(text, /Your time: 10 minutes a day, 3 days a week/);
  });
});

describe("gap and short copy", () => {
  it("keeps every roadmap line short enough to read at a glance", async () => {
    for (const level of ["new", "few_words", "simple_sentences", "basic_conversations", "familiar_topics", "complex_topics"] as const) {
      for (const goal of ["work", "school", "heritage", "travel", "everyday"] as const) {
        const a = answers({ goal: { primary: goal, secondary: null, otherText: null }, interests: { keys: [], custom: null }, level: { selfReport: level } });
        for (const stage of buildRoadmap(a, planFor(a)).stages) {
          assert.ok(stage.title.split(" ").length <= 9, `${goal}/${level}: ${stage.title}`);
          assert.doesNotMatch(stage.title, /\d+-minute/, `${goal}/${level}: ${stage.title}`);
        }
      }
    }
  });

  it("draws today, the missing piece, and where they'll be", async () => {
    const { buildGap, shortMissing } = await import("../../lib/onboarding/personalized/gap");
    const { templateInsight } = await import("../../lib/onboarding/personalized/insight");
    const a = answers();
    const plan = planFor(a);
    const gap = buildGap(a, templateInsight(a, plan), buildRoadmap(a, plan));
    assert.equal(gap.from, "Quiet when colleagues speak Mandarin");
    assert.equal(gap.toLabel, `By week ${plan.milestone.weeks[1]}`);
    assert.equal(gap.to, "Chat with clients in Mandarin, no English needed");
    assert.equal(shortMissing({ missing: "Sounds like X. What's been missing is speaking practice built around your family." }), "Speaking practice built around your family");
  });

  it("uses their own words for 'something else'", async () => {
    const { shortNow } = await import("../../lib/onboarding/personalized/gap");
    assert.equal(shortNow(answers({ usingPain: { keys: ["something_else"], timing: "ongoing", upcomingText: null, customText: "I freeze on calls" } })), "I freeze on calls");
  });

  it("gives every fix a short plain-English label", () => {
    for (const hesitations of [["no_time"], ["seems_too_hard"], ["dont_know_where_start"], ["apps_felt_like_games"], ["worried_quit"]] as const) {
      const a = answers({ learningPain: { keys: [], hesitations: [...hesitations] } });
      for (const fix of fixesFor(a, planFor(a))) assert.ok(fix.short.split(" ").length <= 8, fix.short);
    }
  });
});
