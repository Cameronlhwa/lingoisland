import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { awardLessonXp, lessonXpTotal } from "../../lib/onboarding/personalized/flow";
import { selectFirstLesson, lessonRouteFor } from "../../lib/onboarding/personalized/firstLesson/select";
import { EMPTY_FIRST_LESSON, type FirstLessonProgress } from "../../lib/onboarding/personalized/firstLesson/types";
import {
  estimateLevelFromVocab,
  recognitionRate,
  wordsForScreen,
  type VocabScreenAnswer,
} from "../../lib/onboarding/personalized/vocabRecognition";

const emptyScreen = (shownIds: string[], selectedIds: string[] = [], noneKnown = false): VocabScreenAnswer => ({
  shownIds,
  selectedIds,
  noneKnown,
});

describe("vocab recognition", () => {
  it("builds fixed-size basic and advanced screens", () => {
    const basic = wordsForScreen("basic", "travel", ["restaurants"], "seed-a", 15);
    const advanced = wordsForScreen("advanced", "work", ["meetings"], "seed-b", 14);
    assert.equal(basic.length, 15);
    assert.equal(advanced.length, 14);
    assert.ok(basic.every((word) => word.hsk <= 3));
    assert.ok(advanced.every((word) => word.hsk >= 4));
  });

  it("does not treat unseen words as unknown", () => {
    const screen = emptyScreen(["cha", "kafei"], ["cha"]);
    assert.equal(recognitionRate(screen), 0.5);
    assert.equal(recognitionRate(emptyScreen([])), null);
  });

  it("estimates level conservatively when signals conflict", () => {
    const level = estimateLevelFromVocab({
      selfReport: "new",
      basic: emptyScreen(["wo", "ni", "hao", "shi"], [], true),
      advanced: { shownIds: ["taolun", "hezuo"], selectedIds: ["taolun", "hezuo"], noneKnown: false },
    });
    assert.ok(level <= 2);
  });
});

describe("first lesson selection", () => {
  it("maps goals to travel, work, and social routes", () => {
    assert.equal(lessonRouteFor("travel", ["restaurants"]), "travel");
    assert.equal(lessonRouteFor("work", ["meetings"]), "work");
    assert.equal(lessonRouteFor("everyday", ["hobbies"]), "social");
  });

  it("returns an authored beginner travel lesson by default", () => {
    const lesson = selectFirstLesson({
      goal: "travel",
      interestKeys: ["restaurants"],
      selfReport: "new",
      basic: emptyScreen(["cha", "kafei", "shui"], [], true),
      advanced: { shownIds: ["taolun"], selectedIds: [], noneKnown: true, skipped: true },
    });
    assert.equal(lesson.route, "travel");
    assert.equal(lesson.band, "beginner");
    assert.ok(lesson.targets.length >= 2);
    assert.ok(lesson.match.length >= 2);
  });

  it("awards lesson XP only once per milestone", () => {
    let progress: FirstLessonProgress = { ...EMPTY_FIRST_LESSON, lessonId: "travel-beginner-order-drink" };
    progress = awardLessonXp(progress, "meaning");
    progress = awardLessonXp(progress, "meaning");
    progress = awardLessonXp(progress, "exchange");
    assert.deepEqual(progress.xpAwarded, ["meaning", "exchange"]);
    assert.equal(lessonXpTotal(progress), 30);
  });
});
