import type { Curriculum, CurriculumPractice, GrammarCard } from "./curriculum";
export type GrammarStep =
  | { id: string; kind: "teach"; card: GrammarCard }
  | { id: string; kind: "check"; card: GrammarCard; practice: CurriculumPractice }
  | { id: string; kind: "practice"; practice: CurriculumPractice };
/** A check immediately follows its teaching slide; stable IDs survive content insertion. */
export function grammarSteps(curriculum: Curriculum): GrammarStep[] {
  return [
    ...curriculum.cards.flatMap(card => [
      { id: `${card.id}:teach`, kind: "teach" as const, card },
      ...(curriculum.checksAfterTeaching === false || card.checkAfterTeaching === false ? [] : [{ id: `${card.id}:check`, kind: "check" as const, card, practice: card.check }]),
    ]),
    ...curriculum.practices.map((practice, index) => ({ id: `practice:${index}`, kind: "practice" as const, practice })),
  ];
}
export function grammarStepIndex(steps: GrammarStep[], savedId?: string): number {
  // The old sequence put all explanations before all exercises. Restart its grammar safely.
  return Math.max(0, steps.findIndex(step => step.id === savedId));
}
