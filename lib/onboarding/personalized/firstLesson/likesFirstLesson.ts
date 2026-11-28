import { pinyin } from "pinyin-pro";
import type { GoalKey } from "../goals";
import type { AuthoredLesson, BuildPrompt, ChatTurn, LessonPhrase } from "./types";
import type { CurriculumPractice, GrammarCard } from "./curriculum";

export const LIKES_LESSON_REVISION = "likes-v1";
const word = (hanzi: string, meaning: string): LessonPhrase => ({ id: hanzi, hanzi, meaning, pinyin: pinyin(hanzi) });
const ITEMS: Record<GoalKey, readonly [string, string, string, string]> = {
 work: ["茶", "tea", "咖啡", "coffee"],
 school: ["中文", "Chinese", "音乐", "music"],
 heritage: ["米饭", "rice", "面条", "noodles"],
 travel: ["茶", "tea", "咖啡", "coffee"],
 everyday: ["音乐", "music", "电影", "movies"],
 other: ["茶", "tea", "咖啡", "coffee"],
};
const choice = (prompt: string, right: LessonPhrase, wrong: LessonPhrase, explanation: string): Extract<CurriculumPractice, {kind: "choice"}> => ({ kind: "choice", prompt, choices: [right, wrong], correct: right.id, explanation });
const build = (parts: LessonPhrase[], meaning: string, punctuation: string): BuildPrompt => {
 const result = word(parts.map(part => part.hanzi).join("") + punctuation, meaning);
 const chunks = parts.map((part, i) => ({ id: `part-${i}`, label: part.hanzi, pinyin: part.pinyin, meaning: part.meaning }));
 return { prompt: meaning, result, chunks, order: chunks.map(chunk => chunk.id) };
};

/** Course 1 test variant. Its course number is independent of HSK vocabulary levels. */
export function likesFirstLesson(goal: GoalKey, variant = 0): AuthoredLesson {
 const [a, aMeaning, b, bMeaning] = ITEMS[goal];
 const pair = [word(a, aMeaning), word(b, bMeaning)];
 if (variant === 1) pair.reverse();
 const [A, B] = pair;
 const wo = word("我", "I / me"), ni = word("你", "you"), like = word("喜欢", "like"), ma = word("吗", "yes-or-no question particle");
 const all = [like, ma, wo, ni, A, B];
 const statement = build([wo, like, A], `I like ${A.meaning}.`, "。");
 const secondStatement = word(`我喜欢${B.hanzi}。`, `I like ${B.meaning}.`);
 const question = build([ni, like, B, ma], `Do you like ${B.meaning}?`, "？");
 const firstQuestion = word(`你喜欢${A.hanzi}吗？`, `Do you like ${A.meaning}?`);
 const firstClaim = word(`你喜欢${A.hanzi}。`, `You like ${A.meaning}.`);
 const secondClaim = word(`你喜欢${B.hanzi}。`, `You like ${B.meaning}.`);
 const shortQuestion = word("喜欢吗？", "Do you like it?");
 const example = (phrase: LessonPhrase, label: string, keyWords: string[]) => ({...phrase, label, keyWords});
 const questionCheck = choice(`Ask whether Huahua likes ${B.meaning}.`, question.result, secondClaim, "Add 吗 at the end to turn the statement into a yes-or-no question.");
 const cards: GrammarCard[] = [{
  id: "likes-statement", format: "pattern", title: "Say what you like.",
  explanation: "我 means I. 喜欢 means like. Put the thing you like after 喜欢.",
  examples: [example(statement.result, "One thing you like", ["我喜欢"]), example(secondStatement, "Change the thing", ["我喜欢"])],
  takeaway: "我 + 喜欢 + something.", detail: "Keep 我喜欢. Change the thing you like.",
  check: choice(`Choose: “I like ${B.meaning}.”`, secondStatement, statement.result, `Keep 我喜欢 and choose ${B.hanzi}.`),
 }, {
  id: "likes-question", format: "change", title: "Ask what someone else likes.",
  explanation: "Use 你 to ask about the other person. Add 吗 at the end.",
  examples: [example(statement.result, "Talk about yourself", ["我"]), example(firstQuestion, "Ask the other person", ["你", "吗"])],
  takeaway: "你 + 喜欢 + something + 吗？", detail: "Change 我 to 你. Add 吗 at the end.",
  checkAfterTeaching: false, check: questionCheck,
 }, {
  id: "likes-ma", format: "change", title: "What does 吗 do?",
  explanation: "Mandarin doesn’t need a word like English “do” to ask this kind of question. Add 吗 (ma) at the end to turn a statement into a yes-or-no question. 吗 is called a question particle: a small word that signals a question.",
  showExplanation: true,
  examples: [example(firstClaim, "Statement", []), example(firstQuestion, "Yes-or-no question", ["吗"])],
  takeaway: "For these yes-or-no questions, keep the statement and add 吗.", check: questionCheck,
 }];
 const followUp: ChatTurn = {
  mission: {context: `You told Huahua you like ${A.meaning}. Now it’s your turn to ask.`, task: `Ask whether Huahua likes ${B.meaning}.`},
  huahua: statement.result,
  choices: [question.result, secondStatement], expectedChoiceId: question.result.id,
  responses: {[question.result.id]: secondStatement}, outcomeVisual: {[question.result.id]: "check"},
 };
 const shortCard: GrammarCard = {
  id: "likes-short-question", format: "contrast", title: "When the meaning is already clear",
  explanation: `You and Huahua are already talking about ${B.meaning}. You both know what the question is about.`, showExplanation: true,
  examples: [example(question.result, "Full question", ["吗"]), {...example(shortQuestion, "Short question", ["吗"]), context: `You both know you’re talking about ${B.meaning}.`}],
  takeaway: "喜欢吗？ means “Do you like it?” when the person and thing are clear.",
  detail: "You can leave out 你 and the thing when the context makes both clear. 吗 still marks the question.",
  check: choice(`You and Huahua are talking about ${B.meaning}. Ask “Do you like it?”`, shortQuestion, word("喜欢。", "Like it. — a statement"), "With 吗, the short expression asks a question: “Do you like it?”"),
 };
 const id = `${LIKES_LESSON_REVISION}-1-${goal}-${variant === 1 ? 1 : 0}`;
 return {
  id, route: goal === "travel" ? "travel" : goal === "work" || goal === "school" ? "work" : "social", band: "beginner",
  outcome: "Say what you like. Ask someone else.", situation: `Share your likes with Huahua, then ask about ${B.meaning}.`,
  skill: "Say 我喜欢… and ask 你喜欢…吗？", huahuaPose: "coaching",
  targets: [statement.result, question.result], match: all.map(w => ({...w, label: w.meaning, visual: "word"})),
  build: statement, transferBuild: question, sentenceWords: all, questionWords: [ni, like, A, ma], starter: wo,
  mission: `Tell Huahua you like ${A.meaning}, then ask whether Huahua likes ${B.meaning}.`, speakTargetId: question.result.id,
  chat: {mission: {context: `Huahua is asking whether you like ${A.meaning}. For this practice, you do.`, task: `Tell Huahua you like ${A.meaning}.`}, huahua: firstQuestion, choices: [statement.result, secondStatement], expectedChoiceId: statement.result.id, responses: {[statement.result.id]: word(`我喜欢${A.hanzi}。`, `I like ${A.meaning}.`)}, outcomeVisual: {[statement.result.id]: "check"}},
  completionLine: "You shared what you like and asked someone else.",
  curriculum: {cards, practices: [{kind: "build", build: statement}, {kind: "build", build: question}], pronunciation: true,
   vocabularyGroups: [{id: "core", title: "Words for your sentences", wordIds: [like.id, ma.id, wo.id, ni.id]}, {id: "personalized", title: "Things you can like", wordIds: [A.id, B.id]}],
   followUp, afterChat: {cards: [shortCard], practices: []},
   note: {title: "Share a like. Ask a question.", text: `我喜欢${A.hanzi}。 — I like ${A.meaning}.\n你喜欢${B.hanzi}吗？ — Do you like ${B.meaning}?\n喜欢吗？ — Do you like it? Use this when the context is clear.`},
  },
  template: {id, tier: 1, scene: `Talk about ${A.meaning} and ${B.meaning}.`, teaching: all, incomingTeaching: [], construction: "Huahua is asking whether you like it. For this practice, answer with 我喜欢 and the thing you like.", shortRoute: false, quizPairs: all.map(w => ({...w, label: w.meaning, visual: "word"}))},
 };
}
