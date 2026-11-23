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
 const wordCount = lesson.match.filter(word=>!known.has(word.id)).length;
 const matchCount = curriculum.vocabularyMatching===false?0:Math.ceil(wordCount / VOCABULARY_BATCH_SIZE);
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
  const batchIndex = Math.floor(taught / VOCABULARY_BATCH_SIZE);
  const completedMatches = curriculum.vocabularyMatching===false?0:batchIndex;
  const batchEnd = Math.min((batchIndex+1)*VOCABULARY_BATCH_SIZE,wordCount)-1;
  const testing = curriculum.vocabularyMatching!==false && progress.vocabularyTesting && taught===batchEnd;
  within = (1 + taught + completedMatches + (testing ? 1 : 0)) / phases[index].weight;
 }
 if (phase === "frame") within = grammarStepIndex(steps, progress.grammarStepId) / Math.max(1, steps.length);
 if (phase === "baseline" && progress.baseline) within = 0.8;
 if (phase === "chat" && progress.selectedDrinkId) within = 1;
 if (phase === "discussion" && progress.discussionReplyId) within = 1;
 const completed = phases.slice(0, index).reduce((sum, item) => sum + item.weight, 0) + within * phases[index].weight;
 const total = phases.reduce((sum, item) => sum + item.weight, 0);
 return Math.max(0, Math.min(99, Math.round(completed / total * 100)));
}
