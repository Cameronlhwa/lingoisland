import type { GoalKey } from "../goals";
import {
  estimateLevelFromVocab,
  lessonBandFor,
  unseenSelectedGap,
  type VocabScreenAnswer,
} from "../vocabRecognition";
import { getLessonById, LESSON_BANK } from "./bank";
import type { AuthoredLesson, LessonRoute } from "./types";
import type { SelfReportKey } from "../levels";

export function lessonRouteFor(goal: GoalKey | null, interestKeys: readonly string[]): LessonRoute {
  if (goal === "work" || goal === "school") return "work";
  if (goal === "travel") return "travel";
  if (goal === "heritage" || goal === "everyday" || goal === "other") return "social";
  // Fall back from first interest family cues.
  const first = interestKeys[0] ?? "";
  if (["meetings", "clients", "sales", "networking", "finance", "technology", "presentations", "hsk_certification"].includes(first)) {
    return "work";
  }
  if (["restaurants", "hotels", "transportation", "sightseeing", "shopping", "meeting_locals"].includes(first)) {
    return "travel";
  }
  return "social";
}

function primaryLessonFor(route: LessonRoute, band: ReturnType<typeof lessonBandFor>): AuthoredLesson {
  return (
    LESSON_BANK.find((lesson) => lesson.route === route && lesson.band === band && Boolean(lesson.alternativeId)) ??
    LESSON_BANK.find((lesson) => lesson.route === route && lesson.band === band) ??
    LESSON_BANK.find((lesson) => lesson.route === route && lesson.band === "beginner") ??
    LESSON_BANK[0]
  );
}

/**
 * Prefer a lesson whose targets include a shown-but-unselected vocab id.
 * Falls back to the primary authored lesson for the route/band.
 */
export function selectFirstLesson(input: {
  goal: GoalKey | null;
  interestKeys: readonly string[];
  selfReport: SelfReportKey | null;
  basic: VocabScreenAnswer;
  advanced: VocabScreenAnswer;
  preferAlternative?: boolean;
}): AuthoredLesson {
  const level = estimateLevelFromVocab(input);
  const band = lessonBandFor(level);
  const route = lessonRouteFor(input.goal, input.interestKeys);
  const primary = primaryLessonFor(route, band);

  if (input.preferAlternative && primary.alternativeId) {
    return getLessonById(primary.alternativeId) ?? primary;
  }

  const gap = new Set(unseenSelectedGap(input.basic, input.advanced));
  if (gap.size > 0) {
    const withGap = LESSON_BANK.find(
      (lesson) =>
        lesson.route === route &&
        lesson.band === band &&
        lesson.targets.some((target) => target.vocabIds?.some((id) => gap.has(id))),
    );
    if (withGap) return withGap;
  }

  return primary;
}

export function lessonPhraseById(lesson: AuthoredLesson, id: string) {
  return (
    lesson.targets.find((phrase) => phrase.id === id) ??
    lesson.chat.choices.find((phrase) => phrase.id === id) ??
    (lesson.chat.huahua.id === id ? lesson.chat.huahua : null) ??
    (lesson.build.result.id === id ? lesson.build.result : null)
  );
}
