import { compileJourneyLesson, selectObjective } from "../../lib/journey/teaching/curriculum";
import type { GrammarPoint } from "../../lib/deepseek/generate-grammar-focus";
export const point: GrammarPoint = { hanzi: "想要", pinyin: "xiǎng yào", english: "would like", pattern: "Subject + 想要 + item", whenToUse: "Ask for something you want.", examples: [
  { tier: "warmup", hanzi: "我想要咖啡。", pinyin: "wǒ xiǎng yào kā fēi", english: "I would like coffee." },
  { tier: "target", hanzi: "我想要一杯美式。", pinyin: "wǒ xiǎng yào yì bēi měi shì", english: "I would like an Americano." },
] };
export const words = [{ id: "coffee", hanzi: "咖啡", pinyin: "kā fēi", english: "coffee", position: 1 }, { id: "americano", hanzi: "美式", pinyin: "měi shì", english: "Americano", position: 2 }];
export const lesson = compileJourneyLesson("island", "Ordering coffee", selectObjective("A0", 3), point, words);
