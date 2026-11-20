import type { CurriculumPractice, GrammarCard } from "./curriculum";
import type { LessonPhrase } from "./types";

type Word = Pick<LessonPhrase, "hanzi" | "pinyin" | "meaning">;
type TeachingInput = { tier: 1 | 2 | 3; person: Word; person2: Word; activity: Word; activity2: Word; place: Word; place2: Word };
const phrase = (hanzi: string, pinyin: string, meaning: string): LessonPhrase => ({ id: hanzi, hanzi, pinyin, meaning });
const choice = (prompt: string, options: LessonPhrase[], correct: string, explanation: string): CurriculumPractice => ({ kind: "choice", prompt, choices: options, correct, explanation });
const example = (label: string, hanzi: string, pinyin: string, meaning: string) => ({ ...phrase(hanzi, pinyin, meaning), label });
const part = (hanzi: string, pinyin: string, meaning: string, variable = false) => ({ hanzi, pinyin, meaning, variable });

/** Authored rules stay fixed; examples and checks reuse the vocabulary for the learner's goal. */
export function teachingCards({ tier, activity, activity2, place, place2 }: TeachingInput): GrammarCard[] {
  if (tier === 1) return [{
    id: "greeting", format: "pattern", title: "Say hello to someone. Or everyone.",
    explanation: "Put the person or group first. Add 好 to greet them.",
    examples: [
      { ...example("One person", "你好！", "nǐ hǎo", "Hello!"), parts: [part("你", "nǐ", "you", true), part("好", "hǎo", "greeting")] },
      { ...example("A whole group", "大家好！", "dàjiā hǎo", "Hello, everyone!"), parts: [part("大家", "dàjiā", "everyone", true), part("好", "hǎo", "greeting")] },
    ],
    takeaway: "Same greeting. Change who you’re saying hello to.",
    check: choice("You’re greeting a whole group. What do you say?", [phrase("你好", "nǐ hǎo", "Hello!"), phrase("大家好", "dàjiā hǎo", "Hello, everyone!")], "大家好", "大家 means everyone. Add 好 to greet the whole group."),
  }];

  if (tier === 2) return [{
    id: "ability", format: "pattern", title: "Say what you know how to do.",
    explanation: "Keep 我会. Change the activity.",
    examples: [
      { ...example("A skill you learned", "我会说中文。", "wǒ huì shuō Zhōngwén", "I can speak Chinese."), parts: [part("我", "wǒ", "I"), part("会", "huì", "know how to"), part("说中文", "shuō Zhōngwén", "speak Chinese", true)] },
      { ...example("Same pattern, your activity", `我会${activity.hanzi}。`, `wǒ huì ${activity.pinyin}`, `I can ${activity.meaning}.`), parts: [part("我", "wǒ", "I"), part("会", "huì", "know how to"), part(activity.hanzi, activity.pinyin, activity.meaning, true)] },
    ],
    takeaway: "我 + 会 + an activity = something I know how to do.",
    check: choice("Which sentence says you know how to speak Chinese?", [phrase("我会说中文", "wǒ huì shuō Zhōngwén", "I can speak Chinese."), phrase("我不会说中文", "wǒ bú huì shuō Zhōngwén", "I can’t speak Chinese.")], "我会说中文", "会 describes a skill you know how to do."),
  }, {
    id: "negative-ability", format: "change", title: "One word changes the meaning.",
    explanation: "Put 不 before 会 to say you don’t know how.", connector: "+ 不",
    examples: [
      example("Know how", "我会说中文。", "wǒ huì shuō Zhōngwén", "I can speak Chinese."),
      { ...example("Don’t know how", "我不会说中文。", "wǒ bú huì shuō Zhōngwén", "I can’t speak Chinese."), highlight: { hanzi: "不", pinyin: "bú" } },
    ],
    takeaway: "会 → 不会: know how → don’t know how.",
    check: choice("You haven’t learned to speak Chinese. Which sentence fits?", [phrase("我会说中文", "wǒ huì shuō Zhōngwén", "I can speak Chinese."), phrase("我不会说中文", "wǒ bú huì shuō Zhōngwén", "I can’t speak Chinese.")], "我不会说中文", "Put 不 before 会: 不会 means you don’t know how."),
  }, {
    id: "ma-question", format: "change", title: "Tell someone. Or ask them.",
    explanation: "One small word makes the difference.", connector: "+ 吗 · ma",
    examples: [
      example("Tell someone", "你会说中文。", "nǐ huì shuō Zhōngwén", "You can speak Chinese."),
      { ...example("Ask someone", "你会说中文吗？", "nǐ huì shuō Zhōngwén ma", "Can you speak Chinese?"), highlight: { hanzi: "吗", pinyin: "ma" } },
    ],
    takeaway: "Add 吗 at the end to ask a yes/no question.", detail: "Everything else stays in the same order.",
    check: choice("Which sentence asks whether someone can speak Chinese?", [phrase("你会说中文", "nǐ huì shuō Zhōngwén", "You can speak Chinese."), phrase("你会说中文吗", "nǐ huì shuō Zhōngwén ma", "Can you speak Chinese?")], "你会说中文吗", "吗 goes at the end. It turns the statement into a yes/no question."),
  }, {
    id: "speaker-reply", format: "exchange", title: "They ask ‘you’. You answer ‘I’.",
    explanation: "Watch how 你 changes to 我.", connector: "你 → 我",
    examples: [
      { ...example("Huahua asks", `你会${activity.hanzi}吗？`, `nǐ huì ${activity.pinyin} ma`, `Can you ${activity.meaning}?`), highlight: { hanzi: "你", pinyin: "nǐ" } },
      { ...example("You answer", "我会。", "wǒ huì", "Yes, I can."), highlight: { hanzi: "我", pinyin: "wǒ" } },
    ],
    takeaway: "你 = you. 我 = I.", detail: "The question is about you, so your reply starts with 我.",
    check: choice(`Huahua asks 你会${activity2.hanzi}吗？ Imagine you know how to ${activity2.meaning}. Which reply is yours?`, [phrase("我会", "wǒ huì", "Yes, I can."), phrase("你会", "nǐ huì", "You can.")], "我会", "Answer about yourself with 我. 我会 is a short way to say ‘Yes, I can’."),
  }];

  return [{
    id: "skill-or-situation", format: "contrast", title: "Two ways to say ‘can’.",
    explanation: "会 is about skill. 能 is about the situation.",
    examples: [
      { ...example("A skill you learned", "我会开车。", "wǒ huì kāi chē", "I know how to drive."), context: "You learned how to drive.", highlight: { hanzi: "会", pinyin: "huì" } },
      { ...example("What’s possible today", "我今天不能开车。", "wǒ jīntiān bù néng kāi chē", "I can’t drive today."), context: "You know how, but you’re too busy today.", highlight: { hanzi: "不能", pinyin: "bù néng" } },
    ],
    takeaway: "The skill hasn’t changed. The situation has.", detail: "会 = know how. 能 = circumstances allow.",
    check: choice("You know how to drive, but you’re too busy today. Which sentence fits?", [phrase("我今天不能开车", "wǒ jīntiān bù néng kāi chē", "I can’t drive today."), phrase("我不会开车", "wǒ bú huì kāi chē", "I don’t know how to drive.")], "我今天不能开车", "The obstacle is today’s situation, not a missing skill. Use 不能."),
  }, {
    id: "possible-action", format: "pattern", title: "Say what’s possible right now.",
    explanation: "Put 能 before the action when the situation allows it.",
    examples: [
      { ...example("You have time to go", "我能去。", "wǒ néng qù", "I can go."), parts: [part("我", "wǒ", "I"), part("能", "néng", "am able to"), part("去", "qù", "go", true)] },
      { ...example("Same pattern, your plans", `我能${place.hanzi}。`, `wǒ néng ${place.pinyin}`, `I can ${place.meaning}.`), parts: [part("我", "wǒ", "I"), part("能", "néng", "am able to"), part(place.hanzi, place.pinyin, place.meaning, true)] },
    ],
    takeaway: "我 + 能 + an action = something the situation allows me to do.",
    check: choice("Your schedule is clear. How do you say ‘I can go’?", [phrase("我能去", "wǒ néng qù", "I can go."), phrase("我不能去", "wǒ bù néng qù", "I can’t go.")], "我能去", "能 goes before 去. The situation allows you to go."),
  }, {
    id: "negative-possibility", format: "change", title: "When the situation stops you.",
    explanation: "Put 不 before 能 to say you can’t do it.", connector: "+ 不",
    examples: [
      example("The situation allows it", "我能去。", "wǒ néng qù", "I can go."),
      { ...example("The situation stops you", "我不能去。", "wǒ bù néng qù", "I can’t go."), highlight: { hanzi: "不", pinyin: "bù" } },
    ],
    takeaway: "能 → 不能: can → can’t under these conditions.",
    check: choice(`You have a scheduling conflict. You can’t ${place2.meaning}. Which sentence fits?`, [phrase(`我能${place2.hanzi}`, `wǒ néng ${place2.pinyin}`, `I can ${place2.meaning}.`), phrase(`我不能${place2.hanzi}`, `wǒ bù néng ${place2.pinyin}`, `I can’t ${place2.meaning}.`)], `我不能${place2.hanzi}`, "Put 不 before 能 when the situation prevents the action."),
  }, {
    id: "possible-question", format: "change", title: "Ask whether someone can go.",
    explanation: "Add 吗 at the end. The same question pattern works with 能.", connector: "+ 吗 · ma",
    examples: [
      example("Tell someone", "你能去。", "nǐ néng qù", "You can go."),
      { ...example("Ask someone", "你能去吗？", "nǐ néng qù ma", "Can you go?"), highlight: { hanzi: "吗", pinyin: "ma" } },
    ],
    takeaway: "Add 吗 at the end to ask a yes/no question.", detail: "The word order stays the same.",
    check: choice("Which sentence asks whether someone can go?", [phrase("你能去", "nǐ néng qù", "You can go."), phrase("你能去吗", "nǐ néng qù ma", "Can you go?")], "你能去吗", "The final 吗 makes this a yes/no question."),
  }, {
    id: "time-position", format: "pattern", title: "Say when it’s possible.",
    explanation: "Put 现在 before 能 to say ‘now’.",
    examples: [
      { ...example("Without a time", `我能${place.hanzi}。`, `wǒ néng ${place.pinyin}`, `I can ${place.meaning}.`), parts: [part("我", "wǒ", "I"), part("能", "néng", "can"), part(place.hanzi, place.pinyin, place.meaning)] },
      { ...example("Add ‘now’", `我现在能${place.hanzi}。`, `wǒ xiànzài néng ${place.pinyin}`, `I can ${place.meaning} now.`), parts: [part("我", "wǒ", "I"), part("现在", "xiànzài", "now", true), part("能", "néng", "can"), part(place.hanzi, place.pinyin, place.meaning)] },
    ],
    takeaway: "我 + 现在 + 能 + the action.", detail: "今天 (‘today’) can go in the same place.",
    check: choice("Which order says ‘I can go now’?", [phrase("我现在能去", "wǒ xiànzài néng qù", "I can go now."), phrase("我能去现在", "wǒ néng qù xiànzài", "Check the word order.")], "我现在能去", "For the pattern we’re practising, put 现在 after 我 and before 能."),
  }];
}
