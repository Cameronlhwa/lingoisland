import { isTemplatePronunciationTarget } from "./templates";
// Authored onboarding content. Independent of Journey and Topic Island.
import type { AuthoredLesson, BuildPrompt, LessonPhrase, MatchPair } from "./types";

type Word = [id: string, hanzi: string, pinyin: string, meaning: string];
type Recipe = {
  id: string; route: AuthoredLesson["route"]; band: AuthoredLesson["band"];
  words: [Word, Word]; starter: Word; explanation: string;
  result: [string, string, string]; transfer: [string, string, string];
  question: [string, string, string]; response: [string, string, string];
  mission: string; outcome: string; situation: string; completion: string;
  transferWords?: Word[];
  suffix?: Word; coach?: { hanzi: string; pinyin: string; tip: string };
};
const phrase = (id: string, value: [string, string, string]): LessonPhrase => ({ id, hanzi: value[0], pinyin: value[1], meaning: value[2] });
const WORD_PARTS: Record<string, Word[]> = {
  "我需要": [["wo", "我", "wǒ", "I"], ["xuyao", "需要", "xūyào", "need"]],
  "我要": [["wo", "我", "wǒ", "I"], ["yao", "要", "yào", "want"]],
  "我喜欢": [["wo", "我", "wǒ", "I"], ["xihuan", "喜欢", "xǐhuan", "like"]],
  "请给我": [["qing", "请", "qǐng", "please"], ["gei", "给", "gěi", "give"], ["wo", "我", "wǒ", "me"]],
  "我们一起": [["women", "我们", "wǒmen", "we"], ["yiqi", "一起", "yìqǐ", "together"]],
  "可以把时间": [["keyi", "可以", "kěyǐ", "could you"], ["ba", "把", "bǎ", "marks what changes"], ["shijian", "时间", "shíjiān", "time"]],
  "一点吗": [["yidian", "一点", "yìdiǎn", "a little"], ["ma", "吗", "ma", "question ending"]],
  "我想确认一下": [["wo", "我", "wǒ", "I"], ["xiang", "想", "xiǎng", "would like to"], ["queren", "确认", "quèrèn", "confirm"], ["yixia", "一下", "yíxià", "softens the request"]],
  "我更喜欢": [["wo", "我", "wǒ", "I"], ["geng", "更", "gèng", "more"], ["xihuan", "喜欢", "xǐhuan", "like"]],
  "的地方": [["de", "的", "de", "links the description"], ["difang", "地方", "dìfang", "places"]],
  "有没有更": [["youmeiyou", "有没有", "yǒu méiyǒu", "are there any"], ["geng", "更", "gèng", "more"]],
  "的安排": [["de", "的", "de", "links the description"], ["anpai", "安排", "ānpái", "arrangements"]],
  "我有些顾虑，主要是": [["wo", "我", "wǒ", "I"], ["youxie", "有些", "yǒuxiē", "have some"], ["gulu", "顾虑", "gùlǜ", "concerns"], ["zhuyao", "主要", "zhǔyào", "mainly"], ["shi", "是", "shì", "about, here"]],
  "来看": [["laikan", "来看", "lái kàn", "viewed this way"]],
};
const QUESTION_PARTS: Record<string, Word[]> = {
  "你需要什么？": [["ni", "你", "nǐ", "you"], ["xuyao", "需要", "xūyào", "need"], ["shenme", "什么", "shénme", "what"]],
  "你要喝什么？": [["ni", "你", "nǐ", "you"], ["yao", "要", "yào", "want"], ["he", "喝", "hē", "drink"], ["shenme", "什么", "shénme", "what"]],
  "文件发给你了。": [["wenjian", "文件", "wénjiàn", "file"], ["fa", "发", "fā", "send"], ["gei", "给", "gěi", "to"], ["ni", "你", "nǐ", "you"], ["le", "了", "le", "marks completion"]],
  "你喜欢什么？": [["ni", "你", "nǐ", "you"], ["xihuan", "喜欢", "xǐhuan", "like"], ["shenme", "什么", "shénme", "what"]],
  "你想喝什么？": [["ni", "你", "nǐ", "you"], ["xiang", "想", "xiǎng", "would like to"], ["he", "喝", "hē", "drink"], ["shenme", "什么", "shénme", "what"]],
  "你什么时候回复？": [["ni", "你", "nǐ", "you"], ["shenmeshihou", "什么时候", "shénme shíhou", "when"], ["huifu", "回复", "huífù", "reply"]],
  "我们做什么？": [["women", "我们", "wǒmen", "we"], ["zuo", "做", "zuò", "do"], ["shenme", "什么", "shénme", "what"]],
  "你想怎么调整时间？": [["ni", "你", "nǐ", "you"], ["xiang", "想", "xiǎng", "would like to"], ["zenme", "怎么", "zěnme", "how"], ["tiaozheng", "调整", "tiáozhěng", "adjust"], ["shijian", "时间", "shíjiān", "time"]],
  "你想确认什么？": [["ni", "你", "nǐ", "you"], ["xiang", "想", "xiǎng", "would like to"], ["queren", "确认", "quèrèn", "confirm"], ["shenme", "什么", "shénme", "what"]],
  "你喜欢什么样的地方？": [["ni", "你", "nǐ", "you"], ["xihuan", "喜欢", "xǐhuan", "like"], ["shenmeyang", "什么样", "shénme yàng", "what kind"], ["de", "的", "de", "links the description"], ["difang", "地方", "dìfang", "places"]],
  "你更在意价格还是灵活性？": [["ni", "你", "nǐ", "you"], ["geng", "更", "gèng", "more"], ["zaiyi", "在意", "zàiyì", "care about"], ["jiage", "价格", "jiàgé", "price"], ["haishi", "还是", "háishi", "or"], ["linghuoxing", "灵活性", "línghuóxìng", "flexibility"]],
  "你对这个方案有什么看法？": [["ni", "你", "nǐ", "you"], ["dui", "对", "duì", "about"], ["zhege", "这个", "zhège", "this"], ["fangan", "方案", "fāng’àn", "proposal"], ["you", "有", "yǒu", "have"], ["shenme", "什么", "shénme", "what"], ["kanfa", "看法", "kànfǎ", "opinion"]],
  "我们应该从什么角度考虑？": [["women", "我们", "wǒmen", "we"], ["yinggai", "应该", "yīnggāi", "should"], ["cong", "从", "cóng", "from"], ["shenme", "什么", "shénme", "what"], ["jiaodu", "角度", "jiǎodù", "perspective"], ["kaolv", "考虑", "kǎolǜ", "consider"]],
};

function author(r: Recipe): AuthoredLesson {
  const first = phrase(r.words[0][0], r.result);
  const second = phrase(r.words[1][0], r.transfer);
  const chunks = [r.starter, r.words[0], ...(r.suffix ? [r.suffix] : [])];
  const transferChunks = r.transferWords ?? [r.starter, r.words[1], ...(r.suffix ? [r.suffix] : [])];
  const build = (items: Word[], result: LessonPhrase): BuildPrompt => ({
    prompt: `Build: ${result.meaning}`, chunks: items.map(([id, label, pinyin, meaning]) => ({ id, label, pinyin, meaning })), order: items.map(([id]) => id), result,
  });
  const match: MatchPair[] = r.words.map(([id, hanzi, pinyin, label]) => ({ id, hanzi, pinyin, label, visual: r.route }));
  return {
    id: r.id, route: r.route, band: r.band, outcome: r.outcome, situation: r.situation,
    huahuaPose: "coaching", targets: [first, second].map((p, i) => ({ ...p, vocabIds: [r.words[i][0]] })),
    skill: r.explanation, match, build: build(chunks, first), transferBuild: build(transferChunks, second),
    questionWords: QUESTION_PARTS[r.question[0]].map(([id, hanzi, pinyin, meaning]) => ({ id, hanzi, pinyin, meaning })),
    sentenceWords: transferChunks.flatMap(word => WORD_PARTS[word[1]] ?? [word]).map(([id, hanzi, pinyin, meaning]) => ({ id, hanzi, pinyin, meaning })),
    starter: { id: r.starter[0], hanzi: r.starter[1], pinyin: r.starter[2], meaning: r.starter[3] },
    suffix: r.suffix ? { id: r.suffix[0], hanzi: r.suffix[1], pinyin: r.suffix[2], meaning: r.suffix[3] } : undefined,
    mission: r.mission, coach: r.coach, speakTargetId: first.id,
    chat: { huahua: phrase(`${r.id}-question`, r.question), choices: [first, second], expectedChoiceId: second.id,
      responses: { [second.id]: phrase(`${r.id}-response`, r.response) }, outcomeVisual: { [second.id]: r.route } },
    completionLine: r.completion,
  };
}
const recipes: Recipe[] = [
  { id: "travel-beginner-order-drink", route: "travel", band: "beginner",
    words: [["kafei", "咖啡", "kāfēi", "coffee"], ["cha", "茶", "chá", "tea"]], starter: ["woyao", "我要", "wǒ yào", "I want"],
    explanation: "我 means ‘I’. 要 means ‘want’. Add a drink after 我要. ‘I’d like…’ is a natural English translation for this order.",
    result: ["我要咖啡。", "Wǒ yào kāfēi.", "I’d like coffee."], transfer: ["我要茶。", "Wǒ yào chá.", "I’d like tea."],
    question: ["你要喝什么？", "Nǐ yào hē shénme?", "What would you like to drink?"], response: ["好的！", "Hǎo de!", "Okay!"],
    mission: "Order tea", outcome: "Order your first drink.", situation: "A little practice. Then order tea with Huahua.", completion: "You ordered tea in Mandarin.",
    coach: { hanzi: "要", pinyin: "yào", tip: "Start high and let your voice fall on 要." } },
  { id: "work-beginner-basic-requests", route: "work", band: "beginner",
    words: [["bangzhu", "帮助", "bāngzhù", "help"], ["shijian", "时间", "shíjiān", "time"]], starter: ["woxuyao", "我需要", "wǒ xūyào", "I need"],
    explanation: "我 means ‘I’. 需要 means ‘need’. Add what you need after 我需要: help or time.",
    result: ["我需要帮助。", "Wǒ xūyào bāngzhù.", "I need help."], transfer: ["我需要时间。", "Wǒ xūyào shíjiān.", "I need time."],
    question: ["你需要什么？", "Nǐ xūyào shénme?", "What do you need?"], response: ["好的，没问题。", "Hǎo de, méi wèntí.", "Okay, no problem."],
    mission: "Tell Huahua you need time", outcome: "Say what you need in Mandarin.", situation: "Learn a short sentence you can use at work and in everyday life.", completion: "You used a Mandarin sentence to say what you need." },
  { id: "social-beginner-share-interest", route: "social", band: "beginner",
    words: [["yinyue", "音乐", "yīnyuè", "music"], ["dianying", "电影", "diànyǐng", "movies"]], starter: ["woxihuan", "我喜欢", "wǒ xǐhuan", "I like"],
    explanation: "我 means ‘I’. 喜欢 means ‘like’. Add your interest after 我喜欢.",
    result: ["我喜欢音乐。", "Wǒ xǐhuan yīnyuè.", "I like music."], transfer: ["我喜欢电影。", "Wǒ xǐhuan diànyǐng.", "I like movies."],
    question: ["你喜欢什么？", "Nǐ xǐhuan shénme?", "What do you like?"], response: ["我也喜欢电影！", "Wǒ yě xǐhuan diànyǐng!", "I like movies too!"],
    mission: "Tell Huahua you like movies", outcome: "Share an interest in Mandarin.", situation: "Learn a small pattern for talking about what you like.", completion: "You told Huahua you like movies." },
  { id: "travel-elementary-order", route: "travel", band: "elementary",
    words: [["reshui", "热水", "rè shuǐ", "hot water"], ["bingshui", "冰水", "bīng shuǐ", "iced water"]], starter: ["qinggeiwo", "请给我", "qǐng gěi wǒ", "please give me"],
    explanation: "请 adds ‘please’. 给我 means ‘give me’. Put what you want after 请给我.",
    result: ["请给我热水。", "Qǐng gěi wǒ rè shuǐ.", "Please give me hot water."], transfer: ["请给我冰水。", "Qǐng gěi wǒ bīng shuǐ.", "Please give me iced water."],
    question: ["你想喝什么？", "Nǐ xiǎng hē shénme?", "What would you like to drink?"], response: ["好的，马上来。", "Hǎo de, mǎshàng lái.", "Okay, coming right up."],
    mission: "Ask for iced water", outcome: "Make a polite request.", situation: "Ask for the drink you want while traveling.", completion: "You asked for iced water in Mandarin." },
  { id: "work-elementary-reply-tomorrow", route: "work", band: "elementary",
    words: [["huifu", "回复", "huífù", "reply"], ["mingtian", "明天", "míngtiān", "tomorrow"]], starter: ["wo", "我", "wǒ", "I"], suffix: ["ni", "你", "nǐ", "you"],
    transferWords: [["wo", "我", "wǒ", "I"], ["mingtian", "明天", "míngtiān", "tomorrow"], ["huifu", "回复", "huífù", "reply"], ["ni", "你", "nǐ", "you"]],
    explanation: "我 means ‘I’. 回复 means ‘reply’ and 你 means ‘you’. Add 明天 (‘tomorrow’) after 我 to say when you’ll reply.",
    result: ["我回复你。", "Wǒ huífù nǐ.", "I’ll reply to you."], transfer: ["我明天回复你。", "Wǒ míngtiān huífù nǐ.", "I’ll reply tomorrow."],
    question: ["你什么时候回复？", "Nǐ shénme shíhou huífù?", "When will you reply?"], response: ["好的，谢谢！", "Hǎo de, xièxie!", "Okay, thank you!"],
    mission: "Say you’ll reply tomorrow", outcome: "Set a clear next step at work.", situation: "Learn to tell a colleague when you will reply.", completion: "You told a colleague you’ll reply tomorrow." },
  { id: "social-elementary-invite", route: "social", band: "elementary",
    words: [["hecha", "喝茶", "hē chá", "drink tea"], ["chifan", "吃饭", "chī fàn", "have a meal"]], starter: ["womenyiqi", "我们一起", "wǒmen yìqǐ", "let’s … together"], suffix: ["ba", "吧", "ba", "suggestion ending"],
    explanation: "我们 means ‘we’; 一起 means ‘together’. Adding 吧 makes this a friendly suggestion: ‘Let’s…’.",
    result: ["我们一起喝茶吧。", "Wǒmen yìqǐ hē chá ba.", "Let’s have tea together."], transfer: ["我们一起吃饭吧。", "Wǒmen yìqǐ chī fàn ba.", "Let’s have a meal together."],
    question: ["我们做什么？", "Wǒmen zuò shénme?", "What shall we do?"], response: ["好啊！", "Hǎo a!", "Sounds good!"],
    mission: "Invite Huahua for a meal", outcome: "Make a friendly invitation.", situation: "Turn an activity into a natural invitation.", completion: "You invited Huahua for a meal." },
  { id: "travel-intermediate-request", route: "travel", band: "intermediate",
    words: [["tuihou", "推后", "tuīhòu", "move later"], ["tiqian", "提前", "tíqián", "move earlier"]], starter: ["keyiba", "可以把时间", "kěyǐ bǎ shíjiān", "could you take the scheduled time and…"], suffix: ["yidianma", "一点吗", "yìdiǎn ma", "a little?"],
    explanation: "可以…吗 makes a request. 把时间 introduces the scheduled time you want to change. Put 推后 or 提前 before 一点 (‘a little’).",
    result: ["可以把时间推后一点吗？", "Kěyǐ bǎ shíjiān tuīhòu yìdiǎn ma?", "Could you move the time a little later?"], transfer: ["可以把时间提前一点吗？", "Kěyǐ bǎ shíjiān tíqián yìdiǎn ma?", "Could you move the time a little earlier?"],
    question: ["你想怎么调整时间？", "Nǐ xiǎng zěnme tiáozhěng shíjiān?", "How would you like to adjust the time?"], response: ["可以，我帮你调整。", "Kěyǐ, wǒ bāng nǐ tiáozhěng.", "Sure, I’ll adjust it for you."],
    mission: "Ask for an earlier time", outcome: "Adjust a reservation politely.", situation: "Make a clear request when your travel plans change.", completion: "You requested an earlier reservation." },
  { id: "work-intermediate-meeting-check", route: "work", band: "intermediate",
    words: [["yaoqiu", "要求", "yāoqiú", "requirements"], ["shijian", "时间", "shíjiān", "time"]], starter: ["xiangqueren", "我想确认一下", "wǒ xiǎng quèrèn yíxià", "I’d like to confirm"],
    explanation: "我想确认 means ‘I’d like to confirm’. 一下 makes this short request sound softer. Add what you want to confirm.",
    result: ["我想确认一下要求。", "Wǒ xiǎng quèrèn yíxià yāoqiú.", "I’d like to confirm the requirements."], transfer: ["我想确认一下时间。", "Wǒ xiǎng quèrèn yíxià shíjiān.", "I’d like to confirm the time."],
    question: ["你想确认什么？", "Nǐ xiǎng quèrèn shénme?", "What would you like to confirm?"], response: ["时间是下午三点。", "Shíjiān shì xiàwǔ sān diǎn.", "The time is three in the afternoon."],
    mission: "Confirm the meeting time", outcome: "Clarify a detail at work.", situation: "Use a softer request to check a meeting detail.", completion: "You clarified the meeting time." },
  { id: "social-intermediate-preference", route: "social", band: "intermediate",
    words: [["qingjing", "清静", "qīngjìng", "peaceful / quiet"], ["renao", "热闹", "rènao", "lively / bustling"]], starter: ["gengxihuan", "我更喜欢", "wǒ gèng xǐhuan", "I prefer"], suffix: ["dedifang", "的地方", "de dìfang", "places that are…"],
    explanation: "更 means ‘more’. 我更喜欢 expresses a preference. Put the description before 的地方 (‘places’).",
    result: ["我更喜欢清静的地方。", "Wǒ gèng xǐhuan qīngjìng de dìfang.", "I prefer quiet places."], transfer: ["我更喜欢热闹的地方。", "Wǒ gèng xǐhuan rènao de dìfang.", "I prefer lively places."],
    question: ["你喜欢什么样的地方？", "Nǐ xǐhuan shénme yàng de dìfang?", "What kind of places do you like?"], response: ["那我们去夜市吧。", "Nà wǒmen qù yèshì ba.", "Then let’s go to the night market."],
    mission: "Say you prefer lively places", outcome: "Express a more precise preference.", situation: "Help a friend choose a place you’ll enjoy.", completion: "You expressed a preference for lively places." },
  { id: "travel-advanced-options", route: "travel", band: "advanced",
    words: [["linghuo", "灵活", "línghuó", "flexible"], ["huasuan", "划算", "huásuàn", "good value"]], starter: ["youmeiyou", "有没有更", "yǒu méiyǒu gèng", "are there any more…"], suffix: ["deanpai", "的安排", "de ānpái", "arrangements / options"],
    explanation: "有没有 asks whether an option exists, rather than demanding a change. 更 adds a comparison. 灵活 concerns flexibility; 划算 concerns value for money.",
    result: ["有没有更灵活的安排？", "Yǒu méiyǒu gèng línghuó de ānpái?", "Are there any more flexible arrangements?"], transfer: ["有没有更划算的安排？", "Yǒu méiyǒu gèng huásuàn de ānpái?", "Are there any better-value options?"],
    question: ["你更在意价格还是灵活性？", "Nǐ gèng zàiyì jiàgé háishi línghuóxìng?", "Do you care more about price or flexibility?"], response: ["我帮你找找优惠。", "Wǒ bāng nǐ zhǎozhao yōuhuì.", "I’ll look for a deal for you."],
    mission: "Ask for a better-value option", outcome: "Negotiate an alternative tactfully.", situation: "Distinguish flexibility from value when discussing travel options.", completion: "You asked tactfully for a better-value option." },
  { id: "work-advanced-concern", route: "work", band: "advanced",
    words: [["jin du", "进度", "jìndù", "progress / schedule"], ["yusuan", "预算", "yùsuàn", "budget"]], starter: ["guyou", "我有些顾虑，主要是", "wǒ yǒuxiē gùlǜ, zhǔyào shì", "I have some concerns, mainly about"],
    explanation: "我有些顾虑 raises a concern without blunt rejection. 主要是 narrows the issue, making your feedback more actionable.",
    result: ["我有些顾虑，主要是进度。", "Wǒ yǒuxiē gùlǜ, zhǔyào shì jìndù.", "I have some concerns, mainly about the schedule."], transfer: ["我有些顾虑，主要是预算。", "Wǒ yǒuxiē gùlǜ, zhǔyào shì yùsuàn.", "I have some concerns, mainly about the budget."],
    question: ["你对这个方案有什么看法？", "Nǐ duì zhège fāng’àn yǒu shénme kànfǎ?", "What do you think of this proposal?"], response: ["明白，我们再看看预算。", "Míngbai, wǒmen zài kànkan yùsuàn.", "Understood, let’s review the budget."],
    mission: "Raise a concern about the budget", outcome: "Raise a concern constructively.", situation: "Express disagreement while keeping a work conversation productive.", completion: "You raised a specific budget concern tactfully." },
  { id: "social-advanced-perspective", route: "social", band: "advanced",
    words: [["duanqi", "短期", "duǎnqī", "short term"], ["changyuan", "长远", "chángyuǎn", "long term"]], starter: ["cong", "从", "cóng", "from"], suffix: ["laikan", "来看", "lái kàn", "viewed from this perspective"],
    explanation: "从…来看 frames the perspective you are taking. 短期 focuses on immediate effects; 长远 shifts attention to the longer-term consequences.",
    result: ["从短期来看。", "Cóng duǎnqī lái kàn.", "From a short-term perspective."], transfer: ["从长远来看。", "Cóng chángyuǎn lái kàn.", "From a long-term perspective."],
    question: ["我们应该从什么角度考虑？", "Wǒmen yīnggāi cóng shénme jiǎodù kǎolǜ?", "From what perspective should we consider this?"], response: ["对，不能只看眼前。", "Duì, bù néng zhǐ kàn yǎnqián.", "Right, we shouldn’t only focus on the immediate situation."],
    mission: "Introduce a long-term perspective", outcome: "Frame your perspective precisely.", situation: "Practice a useful bridge into a more thoughtful discussion.", completion: "You introduced a long-term perspective." },
];
export const LESSON_BANK: readonly AuthoredLesson[] = recipes.map(author);
export function getLessonById(id: string) { return LESSON_BANK.find((lesson) => lesson.id === id) ?? null; }
export function isLessonPronunciationTarget(text: unknown): text is string {
  if (typeof text !== "string") return false;
  const clean = (s: string) => s.replace(/[，。！？、]/g, "");
  if (typeof text === "string" && isTemplatePronunciationTarget(text)) return true;
  return LESSON_BANK.some((lesson) => [...lesson.targets, lesson.starter, ...lesson.match].some((p) => clean(p.hanzi) === text) || (lesson.suffix && clean(lesson.suffix.hanzi) === text) || lesson.coach?.hanzi === text);
}
