import type { AuthoredLesson, FirstLessonProgress } from "./types";
import { grammarStepIndex, grammarSteps } from "./grammarSequence";
import { VOCABULARY_BATCH_SIZE } from "./vocabulary";

/** Count the activities inside each phase, rather than giving a whole grammar course
 * the same weight as one closing screen. Wrap-up leaves only a small final gap. */
export function curriculumProgress(lesson: AuthoredLesson, progress: FirstLessonProgress): number {
 const curriculum = lesson.curriculum;
 if (!curriculum || progress.phase === "intro") return 0;
 if (progress.phase === "complete") return 100;
 const known = new Set(progress.vocabularyKnownIds ?? []);
 const groups = curriculum.vocabularyGroups.map(group => lesson.match.filter(word => group.wordIds.includes(word.id) && !known.has(word.id)));
 const wordCount = groups.reduce((count, words) => count + words.length, 0);
 const matchCount = groups.reduce((count, words) => count + Math.ceil(words.length / VOCABULARY_BATCH_SIZE), 0);
 const steps = grammarSteps(curriculum);
 const phases = [
  { id: "intro", weight: 1 },
  { id: "vocabulary", weight: 1 + wordCount + matchCount },
  { id: "frame", weight: steps.length },
  ...(curriculum.pronunciation === false ? [] : [{ id: "baseline", weight: 1 }]),
  { id: "prepare", weight: 1 },
  { id: "chat", weight: 1 },
  ...(curriculum.discussion ? [{ id: "discussion", weight: 1 }] : []),
  { id: "note", weight: 0.25 },
 ];
 const phase = progress.phase === "revisit" ? (curriculum.discussion && !progress.discussionReplyId ? "discussion" : "note") : progress.phase;
 const index = phases.findIndex(item => item.id === phase);
 if (index < 0) return 0;
 let within = 0;
 if (phase === "vocabulary" && progress.vocabularyChecked) {
  const taught = Math.min(progress.vocabularyIndex ?? 0, Math.max(0, wordCount - 1));
  let offset = 0, completedMatches = 0;
  for (const words of groups) {
   const covered = Math.min(Math.max(0, taught - offset), words.length);
   completedMatches += covered === words.length ? Math.ceil(words.length / VOCABULARY_BATCH_SIZE) : Math.floor(covered / VOCABULARY_BATCH_SIZE);
   offset += words.length;
  }
  within = (1 + taught + completedMatches + (progress.vocabularyTesting ? 1 : 0)) / phases[index].weight;
 }
 if (phase === "frame") within = grammarStepIndex(steps, progress.grammarStepId) / Math.max(1, steps.length);
 if (phase === "baseline" && progress.baseline) within = 0.8;
 if (phase === "chat" && progress.selectedDrinkId) within = 1;
 if (phase === "discussion" && progress.discussionReplyId) within = 1;
 const completed = phases.slice(0, index).reduce((sum, item) => sum + item.weight, 0) + within * phases[index].weight;
 const total = phases.reduce((sum, item) => sum + item.weight, 0);
 return Math.max(0, Math.min(99, Math.round(completed / total * 100)));
}
