import vocabulary from "../../../data/hsk-vocabulary-2.0.json";

export type VocabularyPolicy = { version: "journey-hsk20-v1"; hskLevel: number; targetWords: string[]; learnedWords: string[] };
const bands = ["A0", "A1", "A2", "B1", "B2", "C1"];
const levels = new Map<string, number>();
for (const word of vocabulary.words) if (word.level) {
  // The imported syllabus includes forms such as 这(这儿), 花(动词),
  // and 虽然......但是...... rather than plain dictionary keys.
  const base = word.hanzi.replace(/[（(][^）)]*[）)]/g, "");
  const forms = [base, ...base.split(/[.…。/、]+/).filter(Boolean)];
  if (word.hanzi === "这(这儿)") forms.push("这儿");
  if (word.hanzi === "那(那儿)") forms.push("那儿");
  if (base.endsWith("儿") && base.length > 1) forms.push(base.slice(0, -1));
  for (const form of forms) levels.set(form, Math.min(levels.get(form) ?? 99, word.level));
}
// Common productive forms share the level of their dictionary headword.
for (const [form, headword] of Object.entries({ 杯: "杯子", 店: "商店", 这样: "怎么样", 那样: "怎么样", 急: "着急", 聊: "聊天", 事: "事情", 样: "样子", 算: "计算", 帮: "帮助", 睡: "睡觉", 说: "说话" })) {
  const level = levels.get(headword);
  if (level && !levels.has(form)) levels.set(form, level);
}
const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
const HAN = /[\u3400-\u9fff]/;
// Productive combinations such as 我也、一杯、找到 are not separate dictionary entries.
const FUNCTION = /[个本张条杯碗件次好太挺真有是我你他她它们这那的地得了着过吗呢吧啊呀和跟与也都不没很更最就才还又再先能会可要想让把被在从到往向给对为以一二三四五六七八九十百千万几每]/;
const PRODUCTIVE_VERB = /^(?:开|吃|喝|看|听|读|写|买|卖|找|用|坐|学|做|玩|睡|等|走|跑|带|拿|穿|帮)/;
const unique = (words: string[]) => Array.from(new Set(words.map(word => word.trim()).filter(Boolean)));
export function createVocabularyPolicy(level: string, targetWords: string[], learnedWords: string[] = [], pattern = ""): VocabularyPolicy {
  const band = level.toUpperCase().match(/^(A0|A1|A2|B1|B2|C1)/)?.[1];
  if (!band) throw new Error("Unknown journey vocabulary level");
  return { version: "journey-hsk20-v1", hskLevel: bands.indexOf(band) + 1,
    targetWords: unique([...targetWords, ...pattern.split(/[\s…./]+/).filter(Boolean), "华华"]), learnedWords: unique(learnedWords) };
}

export function vocabularyViolations(text: string, policy: VocabularyPolicy): string[] {
  const exceptions = new Set([...policy.targetWords, ...policy.learnedWords]);
  const allowed = (word: string) => exceptions.has(word) || (levels.has(word) && levels.get(word)! <= policy.hskLevel);
  const parts = Array.from(segmenter.segment(text)).map(part => part.segment);
  const violations: string[] = [];
  for (let index = 0; index < parts.length; index++) {
    const word = parts[index];
    // An exact taught phrase can span several segmenter tokens. Do not exempt
    // substrings inside an otherwise advanced word (e.g. 人 inside 合伙人).
    let end = index, combined = word;
    let match = exceptions.has(word) ? index : -1;
    let matchedWord = word;
    while (end + 1 < parts.length && combined.length < 40) {
      combined += parts[++end];
      if (exceptions.has(combined) || levels.has(combined)) { match = end; matchedWord = combined; }
    }
    if (match >= index) { if (!allowed(matchedWord)) violations.push(matchedWord); index = match; continue; }
    if (!HAN.test(word)) continue;
    if (levels.has(word)) { if (!allowed(word)) violations.push(word); continue; }
    // Compose only unlisted productive phrases. A listed advanced compound is
    // checked above as a whole, even if each of its characters is familiar.
    let containsKnownWord = false;
    for (let start = 0; start < word.length && !containsKnownWord; start++) {
      for (let end = start + 2; end <= word.length; end++) if (allowed(word.slice(start, end))) { containsKnownWord = true; break; }
    }
    const reachable = new Set<number>([0]);
    for (let start = 0; start < word.length; start++) if (reachable.has(start)) {
      for (let finish = start + 1; finish <= word.length; finish++) {
        const piece = word.slice(start, finish);
        if (allowed(piece) && (containsKnownWord || FUNCTION.test(word) || PRODUCTIVE_VERB.test(word) || piece.length > 1 || exceptions.has(piece))) reachable.add(finish);
      }
    }
    if (!reachable.has(word.length)) violations.push(word);
  }
  return unique(violations);
}

export class VocabularyPolicyError extends Error {
  constructor(public words: string[]) { super(`Simplify these unapproved supporting words: ${words.join("、")}. Keep the lesson targets unchanged.`); }
}
export function assertVocabulary(texts: string[], policy: VocabularyPolicy): void {
  const words = unique(texts.flatMap(text => vocabularyViolations(text, policy)));
  if (words.length) { const error = new VocabularyPolicyError(words); error.message += ` Rewrite the complete sentences naturally instead of deleting individual characters: ${JSON.stringify(texts)}.`; throw error; }
}
export function vocabularyInstructions(policy: VocabularyPolicy): string {
  const basic = Array.from(levels.entries()).filter(([word, level]) => level <= policy.hskLevel && !/[.()（）]/.test(word)).map(([word]) => word);
  return `VOCABULARY RULE (takes priority over topic detail, style and sentence tiers):
Use HSK 2.0 words at or below HSK ${policy.hskLevel} for all surrounding Mandarin vocabulary. The approved list below is authoritative; do not rely on your own HSK estimates or use unlisted slang. If unsure, choose a simpler word from the list.
The only advanced-word exceptions are the exact lesson targets ${JSON.stringify(policy.targetWords)} and already-learned journey words ${JSON.stringify(policy.learnedWords.slice(0, 16))}.
Use older journey words sparingly. Do not invent other advanced topic words, or assume that parts of a taught word exempt a different compound. Keep the surrounding grammar simple and familiar. All tiers, including hard, must obey this vocabulary ceiling. Pinyin is not a substitute for simplifying.
Approved supporting vocabulary (use these exact words; combine them with ordinary function words): ${basic.join("、")}. Short, simple wording is preferred; do not force topic detail into every sentence.`;
}
