import { pinyin } from "pinyin-pro";
import type { AuthoredLesson, LessonPhrase } from "./types";
import type { CurriculumPractice } from "./curriculum";

type Probe = Extract<CurriculumPractice, { kind: "choice" }> & { correct: string };
const sentence = (hanzi: string, meaning: string): LessonPhrase => ({
  id: hanzi, hanzi: /[。！？]$/.test(hanzi) ? hanzi : `${hanzi}。`, pinyin: pinyin(hanzi), meaning,
});

/** Placement always asks for a complete sentence matching one explicit English meaning. */
export function placementSentenceProbes(lesson: AuthoredLesson, tier: number): Probe[] {
  const build = lesson.build.result, transfer = lesson.transferBuild.result;
  let pairs: [LessonPhrase, LessonPhrase][];
  if (tier === 1) {
    pairs = [[build, transfer], [sentence("大家好！", "Hello, everyone!"), sentence("你好！", "Hello!")]];
  } else if (tier === 2 || tier === 3) {
    const modal = tier === 2 ? "会" : "能";
    pairs = [
      [build, sentence(build.hanzi.replace(modal, `不${modal}`), "The negative statement")],
      [transfer, sentence(transfer.hanzi.replace(`不${modal}`, modal), "The positive statement")],
    ];
  } else {
    const cards = lesson.curriculum!.cards;
    if (tier === 4) {
      pairs = [[cards[0].examples[0], cards[0].examples[1]], [cards[1].examples[1], cards[1].examples[0]]];
    } else if (tier === 5) {
      pairs = [[cards[0].examples[1], cards[0].examples[0]], [cards[1].examples[1], cards[1].examples[0]]];
    } else {
      // Check the advanced frames directly, without a long topic-specific reading task.
      pairs = [
        [sentence("在我看来，这很重要。", "In my view, this is important."), sentence("在小林看来，这很重要。", "In Xiaolin’s view, this is important.")],
        [sentence("一方面，这很方便；另一方面，这也很贵。", "On one hand, this is convenient; on the other, it is expensive."), sentence("在我看来，这很方便。", "In my view, this is convenient.")],
      ];
    }
  }
  return pairs.map(([right, wrong], index) => {
    const correct = { ...sentence(right.hanzi, right.meaning), id: `probe-${index}-correct` };
    const distractor = { ...sentence(wrong.hanzi, wrong.meaning), id: `probe-${index}-other` };
    return {
      kind: "choice", prompt: right.meaning,
      choices: index % 2 ? [distractor, correct] : [correct, distractor],
      correct: correct.id, explanation: `This sentence means “${right.meaning}”`,
    };
  });
}
