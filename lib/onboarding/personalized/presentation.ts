// Turns a bank question into what the learner sees: characters in their
// writing system, pinyin under all Chinese text, and choices in shuffled order.

import { pinyin } from "pinyin-pro";
import { convertText } from "../../utils/chinese-converter";
import type { AssessmentItem } from "./assessment";
import type { WritingSystem } from "./huahua";
import { getQuestion, QUESTION_TYPE_PROMPTS, type QuestionType } from "./questionBank";

export const BLANK = "___";

export type PresentedChoice = { id: string; text: string; pinyin: string | null; lang: "zh" | "en" };

export type PresentedQuestion = {
  id: string;
  position: number;
  type: QuestionType;
  prompt: string;
  /** Chinese prompt in the chosen writing system ("" for word-choice questions). */
  zh: string;
  pinyin: string | null;
  context: string | null;
  choices: PresentedChoice[];
};

export function pinyinLine(text: string): string {
  if (!text) return "";
  return text
    .split(BLANK)
    .map((part) => (part ? pinyin(part, { toneType: "symbol", nonZh: "consecutive" }).replace(/\s+/g, " ").trim() : ""))
    .join(` ${BLANK} `)
    .trim();
}

export function presentQuestion(item: AssessmentItem, writingSystem: WritingSystem): PresentedQuestion | null {
  const question = getQuestion(item.questionId);
  if (!question) return null;
  const toScript = (text: string) => {
    if (writingSystem !== "traditional") return text;
    if (text === question.zh && question.traditional) return question.traditional;
    return convertText(text, "traditional");
  };
  const choices = item.choiceOrder
    .map((id) => question.choices.find((choice) => choice.id === id))
    .filter((choice): choice is NonNullable<typeof choice> => Boolean(choice))
    .map<PresentedChoice>((choice) =>
      choice.zh
        ? { id: choice.id, text: toScript(choice.zh), pinyin: pinyinLine(choice.zh), lang: "zh" }
        : { id: choice.id, text: choice.en ?? "", pinyin: null, lang: "en" },
    );
  return {
    id: question.id,
    position: item.position,
    type: question.type,
    prompt: QUESTION_TYPE_PROMPTS[question.type],
    zh: question.zh ? toScript(question.zh) : "",
    pinyin: question.zh ? question.pinyin ?? pinyinLine(question.zh) : null,
    context: question.context ?? null,
    choices,
  };
}
