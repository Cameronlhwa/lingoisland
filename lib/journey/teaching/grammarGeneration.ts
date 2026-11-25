import { LessonError } from "./errors";
import { generateGrammarFocus, type GrammarPoint } from "../../deepseek/generate-grammar-focus";
import { assertVocabulary, vocabularyInstructions, type VocabularyPolicy } from "./vocabularyPolicy";
import type { TeachingObjective } from "./curriculum";

export function validGrammarVocabulary(point: GrammarPoint, policy: VocabularyPolicy): boolean {
  try { assertVocabulary(point.examples.map(example => example.hanzi), policy); return true; } catch { return false; }
}
export async function generateJourneyGrammar(topic: string, objective: TeachingObjective, policy: VocabularyPolicy): Promise<GrammarPoint> {
  let feedback = "";
  const deadline = Date.now() + 40000;
  for (let attempt = 0; attempt < 3 && Date.now() < deadline; attempt++) {
    const result = await generateGrammarFocus({ topic, level: objective.level === "A0" ? "A1" : objective.level, detailedLevel: objective.level,
      grammarCount: 1, requiredPattern: objective.pattern, supportingWords: policy.targetWords,
      requestTimeoutMs: Math.max(1, Math.min(25000, deadline - Date.now())),
      vocabularyInstruction: `${vocabularyInstructions(policy)}\n${feedback}` });
    const point = result.points[0];
    if (!point) { feedback = "The previous response was unusable. Return the assigned grammar and two complete examples."; continue; }
    try { assertVocabulary(point.examples.map(example => example.hanzi), policy); return point; }
    catch (error) { feedback = (error as Error).message; }
  }
  throw new LessonError("We couldn’t prepare examples at your level. Please try again.", 503);
}
