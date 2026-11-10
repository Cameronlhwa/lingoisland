import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyAnswers, planFor } from "../../lib/onboarding/personalized/flow";
import { conversationOffer } from "../../lib/onboarding/personalized/conversationOffer";
import { GOALS, DEFAULT_INTERESTS_BY_GOAL } from "../../lib/onboarding/personalized/goals";

test("every goal gets a fitted headline, comparison chart, and two hope benefits", () => {
  for (const goal of GOALS) {
    const answers = emptyAnswers();
    answers.goal.primary = goal.key;
    answers.level.selfReport = "new";
    answers.interests.keys = [...DEFAULT_INTERESTS_BY_GOAL[goal.key]];
    answers.availability.minutes = "10";
    const copy = conversationOffer(answers, planFor(answers));
    assert.equal(copy.benefits.length, 2);
    assert.equal(new Set(copy.benefits.map((b) => b.title)).size, 2);
    assert.match(copy.headline, /Mandarin that fits/);
    assert.match(copy.subline, /^10 minutes a day toward /);
    assert.match(copy.comparison.title, /progress toward/i);
    assert.equal(copy.comparison.weeks, 12);
    assert.equal(copy.cta, "Start my plan");
    assert.doesNotMatch(JSON.stringify(copy), /pinyin|week \d|no English needed|undefined/i);
    if (goal.key !== "work") assert.doesNotMatch(copy.headline, /workday/);
  }
});

test("pain and situation change the hope lines, including HSK", () => {
  const answers = emptyAnswers();
  answers.goal.primary = "work";
  answers.interests.keys = ["meetings"];
  answers.usingPain.keys = ["stay_quiet"];
  assert.match(conversationOffer(answers, planFor(answers)).benefits[0].title, /sitting quiet|joining/i);
  assert.match(conversationOffer(answers, planFor(answers)).comparison.title, /meeting/i);

  answers.usingPain.keys = [];
  answers.interests.keys = ["finance"];
  assert.match(conversationOffer(answers, planFor(answers)).benefits[0].title, /client|numbers|finance|ready/i);

  answers.interests.keys = ["hsk_certification"];
  const hsk = conversationOffer(answers, planFor(answers));
  assert.match(hsk.headline, /HSK/);
  assert.match(hsk.comparison.title, /exam/i);

  answers.interests.keys = ["let_us_decide"];
  assert.match(conversationOffer(answers, planFor(answers)).comparison.title, /progress toward/i);

  answers.interests.custom = "Aviation";
  assert.match(conversationOffer(answers, planFor(answers)).benefits[0].title, /Aviation/);
});

test("learning struggles and pace shape the second benefit and subline", () => {
  const answers = emptyAnswers();
  answers.goal.primary = "work";
  answers.level.selfReport = "new";
  answers.learningPain.hesitations = ["no_time"];
  answers.availability.minutes = "5";
  const beginner = conversationOffer(answers, planFor(answers));
  assert.match(beginner.subline, /^5 minutes a day toward /);
  assert.match(beginner.benefits[1].title, /5 minutes/);

  answers.level.selfReport = "basic_conversations";
  answers.learningPain.keys = ["forget_words"];
  answers.learningPain.hesitations = [];
  const placed = conversationOffer(answers, planFor(answers));
  assert.match(placed.benefits[1].title, /stick/i);
});
