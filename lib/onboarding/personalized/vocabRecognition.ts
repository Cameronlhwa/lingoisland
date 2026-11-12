// Vocabulary recognition for personalized onboarding.
// Word levels follow HSK 2.0 (see data/hsk-vocabulary-2.0.json). This bank is a
// curated subset for onboarding screens — not a full official list dump.

import type { GoalKey } from "./goals";
import { clampLevel, levelForSelfReport, type InternalLevel, type SelfReportKey } from "./levels";

export type VocabBand = "basic" | "advanced";

export type VocabWord = {
  id: string;
  hanzi: string;
  pinyin: string;
  /** HSK 2.0 level 1–6. */
  hsk: 1 | 2 | 3 | 4 | 5 | 6;
  /** Broad vocabulary used to sample proficiency independently of the topic. */
  diagnostic?: boolean;
  /** Optional interest keys that pull this word into a personalized spread. */
  interests?: readonly string[];
  goals?: readonly GoalKey[];
};

export type VocabScreenAnswer = {
  /** Words shown on this visit; unseen words must never count as unknown. */
  shownIds: string[];
  selectedIds: string[];
  noneKnown: boolean;
  /** Advanced screen only: learner skipped as completely new. */
  skipped?: boolean;
};

export const EMPTY_VOCAB_SCREEN: VocabScreenAnswer = {
  shownIds: [],
  selectedIds: [],
  noneKnown: false,
};

/**
 * Curated HSK 2.0 bank for recognition screens.
 * Source standard: HSK 2.0 (`data/hsk-vocabulary-2.0.json`).
 */
export const VOCAB_BANK: readonly VocabWord[] = [
  // Broad diagnostic words, checked against the bundled HSK 2.0 source.
  { id: "core-1-138", hanzi: "想", pinyin: "xiǎng", hsk: 1, diagnostic: true },
  { id: "core-1-123", hanzi: "去", pinyin: "qù", hsk: 1, diagnostic: true },
  { id: "core-1-121", hanzi: "来", pinyin: "lái", hsk: 1, diagnostic: true },
  { id: "core-1-114", hanzi: "看", pinyin: "kàn", hsk: 1, diagnostic: true },
  { id: "core-1-124", hanzi: "吃", pinyin: "chī", hsk: 1, diagnostic: true },
  { id: "core-1-116", hanzi: "说", pinyin: "shuō", hsk: 1, diagnostic: true },
  { id: "core-1-126", hanzi: "睡觉", pinyin: "shuìjiào", hsk: 1, diagnostic: true },
  { id: "core-1-141", hanzi: "能", pinyin: "néng", hsk: 1, diagnostic: true },
  { id: "core-1-11", hanzi: "什么", pinyin: "shénme", hsk: 1, diagnostic: true },
  { id: "core-1-139", hanzi: "认识", pinyin: "rènshi", hsk: 1, diagnostic: true },
  { id: "core-2-20", hanzi: "已经", pinyin: "yǐjīng", hsk: 2, diagnostic: true },
  { id: "core-2-124", hanzi: "觉得", pinyin: "juédé", hsk: 2, diagnostic: true },
  { id: "core-2-129", hanzi: "可能", pinyin: "kěnéng", hsk: 2, diagnostic: true },
  { id: "core-2-4", hanzi: "每", pinyin: "měi", hsk: 2, diagnostic: true },
  { id: "core-2-22", hanzi: "再", pinyin: "zài", hsk: 2, diagnostic: true },
  { id: "core-2-125", hanzi: "知道", pinyin: "zhīdao", hsk: 2, diagnostic: true },
  { id: "core-2-105", hanzi: "开始", pinyin: "kāishǐ", hsk: 2, diagnostic: true },
  { id: "core-2-104", hanzi: "准备", pinyin: "zhǔnbèi", hsk: 2, diagnostic: true },
  { id: "core-3-193", hanzi: "认为", pinyin: "rènwéi", hsk: 3, diagnostic: true },
  { id: "core-3-65", hanzi: "发现", pinyin: "fāxiàn", hsk: 3, diagnostic: true },
  { id: "core-3-196", hanzi: "如果", pinyin: "rúguǒ", hsk: 3, diagnostic: true },
  { id: "core-3-191", hanzi: "然后", pinyin: "ránhòu", hsk: 3, diagnostic: true },
  { id: "core-3-288", hanzi: "终于", pinyin: "zhōngyú", hsk: 3, diagnostic: true },
  { id: "core-3-21", hanzi: "必须", pinyin: "bìxū", hsk: 3, diagnostic: true },
  { id: "core-3-251", hanzi: "选择", pinyin: "xuǎnzé", hsk: 3, diagnostic: true },
  { id: "core-3-250", hanzi: "需要", pinyin: "xūyào", hsk: 3, diagnostic: true },
  { id: "core-3-154", hanzi: "了解", pinyin: "liǎojiě", hsk: 3, diagnostic: true },
  { id: "core-3-18", hanzi: "比较", pinyin: "bǐjiào", hsk: 3, diagnostic: true },
  { id: "core-3-91", hanzi: "还是", pinyin: "háishì", hsk: 3, diagnostic: true },
  { id: "core-3-261", hanzi: "一直", pinyin: "yìzhí", hsk: 3, diagnostic: true },
  { id: "core-4-361", hanzi: "仍然", pinyin: "réngrán", hsk: 4, diagnostic: true },
  { id: "core-4-374", hanzi: "甚至", pinyin: "shènzhì", hsk: 4, diagnostic: true },
  { id: "core-4-225", hanzi: "尽管", pinyin: "jǐnguǎn", hsk: 4, diagnostic: true },
  { id: "core-4-527", hanzi: "由于", pinyin: "yóuyú", hsk: 4, diagnostic: true },
  { id: "core-4-438", hanzi: "通过", pinyin: "tōngguò", hsk: 4, diagnostic: true },
  { id: "core-4-389", hanzi: "适合", pinyin: "shìhé", hsk: 4, diagnostic: true },
  { id: "core-4-323", hanzi: "判断", pinyin: "pànduàn", hsk: 4, diagnostic: true },
  { id: "core-4-542", hanzi: "原因", pinyin: "yuányīn", hsk: 4, diagnostic: true },
  { id: "core-4-163", hanzi: "过程", pinyin: "guòchéng", hsk: 4, diagnostic: true },
  { id: "core-5-845", hanzi: "何况", pinyin: "hékuàng", hsk: 5, diagnostic: true },
  { id: "core-5-660", hanzi: "毕竟", pinyin: "bìjìng", hsk: 5, diagnostic: true },
  { id: "core-5-491", hanzi: "未必", pinyin: "wèibì", hsk: 5, diagnostic: true },
  { id: "core-5-610", hanzi: "逐步", pinyin: "zhúbù", hsk: 5, diagnostic: true },
  { id: "core-5-45", hanzi: "产生", pinyin: "chǎnshēng", hsk: 5, diagnostic: true },
  { id: "core-5-743", hanzi: "导致", pinyin: "dǎozhì", hsk: 5, diagnostic: true },
  { id: "core-5-39", hanzi: "采取", pinyin: "cǎiqǔ", hsk: 5, diagnostic: true },
  { id: "core-5-263", hanzi: "具备", pinyin: "jùbèi", hsk: 5, diagnostic: true },
  { id: "core-5-695", hanzi: "程度", pinyin: "chéngdù", hsk: 5, diagnostic: true },
  { id: "core-5-1108", hanzi: "体现", pinyin: "tǐxiàn", hsk: 5, diagnostic: true },
  { id: "core-6-911", hanzi: "鉴于", pinyin: "jiànyú", hsk: 6, diagnostic: true },
  { id: "core-6-1753", hanzi: "倘若", pinyin: "tǎngruò", hsk: 6, diagnostic: true },
  { id: "core-6-1884", hanzi: "未免", pinyin: "wèimiǎn", hsk: 6, diagnostic: true },
  { id: "core-6-2230", hanzi: "约束", pinyin: "yuēshù", hsk: 6, diagnostic: true },
  { id: "core-6-1019", hanzi: "局限", pinyin: "júxiàn", hsk: 6, diagnostic: true },
  { id: "core-6-1833", hanzi: "推论", pinyin: "tuīlùn", hsk: 6, diagnostic: true },
  { id: "core-6-212", hanzi: "层次", pinyin: "céngcì", hsk: 6, diagnostic: true },
  { id: "core-6-2128", hanzi: "依据", pinyin: "yījù", hsk: 6, diagnostic: true },
  { id: "core-6-615", hanzi: "干预", pinyin: "gānyù", hsk: 6, diagnostic: true },
  { id: "core-6-1957", hanzi: "显著", pinyin: "xiǎnzhù", hsk: 6, diagnostic: true },

  // HSK 1–3 core
  { id: "wo", hanzi: "我", pinyin: "wǒ", hsk: 1 },
  { id: "ni", hanzi: "你", pinyin: "nǐ", hsk: 1 },
  { id: "hao", hanzi: "好", pinyin: "hǎo", hsk: 1 },
  { id: "shi", hanzi: "是", pinyin: "shì", hsk: 1 },
  { id: "bu", hanzi: "不", pinyin: "bù", hsk: 1 },
  { id: "you", hanzi: "有", pinyin: "yǒu", hsk: 1 },
  { id: "he", hanzi: "喝", pinyin: "hē", hsk: 1, interests: ["restaurants", "food"], goals: ["travel", "everyday"] },
  { id: "shui", hanzi: "水", pinyin: "shuǐ", hsk: 1, interests: ["restaurants", "hotels"] },
  { id: "cha", hanzi: "茶", pinyin: "chá", hsk: 1, interests: ["restaurants", "food"], goals: ["travel", "everyday"] },
  { id: "kafei", hanzi: "咖啡", pinyin: "kāfēi", hsk: 2, interests: ["restaurants", "meetings"], goals: ["travel", "work"] },
  { id: "fan", hanzi: "饭", pinyin: "fàn", hsk: 1, interests: ["restaurants", "food"] },
  { id: "mai", hanzi: "买", pinyin: "mǎi", hsk: 1, interests: ["shopping"] },
  { id: "qian", hanzi: "钱", pinyin: "qián", hsk: 1, interests: ["shopping", "finance"] },
  { id: "che", hanzi: "车", pinyin: "chē", hsk: 1, interests: ["transportation"] },
  { id: "feiji", hanzi: "飞机", pinyin: "fēijī", hsk: 1, interests: ["transportation", "hotels"], goals: ["travel"] },
  { id: "jiudian", hanzi: "酒店", pinyin: "jiǔdiàn", hsk: 2, interests: ["hotels"], goals: ["travel"] },
  { id: "xihuan", hanzi: "喜欢", pinyin: "xǐhuan", hsk: 1, interests: ["friends", "hobbies", "entertainment"], goals: ["everyday", "heritage"] },
  { id: "pengyou", hanzi: "朋友", pinyin: "péngyou", hsk: 1, interests: ["friends", "relationships"], goals: ["everyday"] },
  { id: "jia", hanzi: "家", pinyin: "jiā", hsk: 1, interests: ["family_conversations"], goals: ["heritage"] },
  { id: "baba", hanzi: "爸爸", pinyin: "bàba", hsk: 1, interests: ["family_conversations"], goals: ["heritage"] },
  { id: "mama", hanzi: "妈妈", pinyin: "māma", hsk: 1, interests: ["family_conversations"], goals: ["heritage"] },
  { id: "gongzuo", hanzi: "工作", pinyin: "gōngzuò", hsk: 1, interests: ["meetings", "clients"], goals: ["work"] },
  { id: "laoshi", hanzi: "老师", pinyin: "lǎoshī", hsk: 1, interests: ["school_life", "presentations"], goals: ["school"] },
  { id: "xuesheng", hanzi: "学生", pinyin: "xuésheng", hsk: 1, interests: ["school_life"], goals: ["school"] },
  { id: "huiyi", hanzi: "会议", pinyin: "huìyì", hsk: 3, interests: ["meetings"], goals: ["work"] },
  { id: "dianhua", hanzi: "电话", pinyin: "diànhuà", hsk: 1, interests: ["clients", "sales"] },
  { id: "mingtian", hanzi: "明天", pinyin: "míngtiān", hsk: 1 },
  { id: "jintian", hanzi: "今天", pinyin: "jīntiān", hsk: 1 },
  { id: "xianzai", hanzi: "现在", pinyin: "xiànzài", hsk: 1, diagnostic: true },
  { id: "keyi", hanzi: "可以", pinyin: "kěyǐ", hsk: 2 },
  { id: "zenme", hanzi: "怎么", pinyin: "zěnme", hsk: 1 },
  { id: "duoshao", hanzi: "多少", pinyin: "duōshao", hsk: 1, interests: ["shopping", "restaurants"] },
  { id: "yizhi", hanzi: "一起", pinyin: "yìqǐ", hsk: 2, interests: ["friends", "meeting_locals"] },
  { id: "bangzhu", hanzi: "帮助", pinyin: "bāngzhù", hsk: 2 },
  { id: "wendu", hanzi: "问题", pinyin: "wèntí", hsk: 2 },
  { id: "jieshao", hanzi: "介绍", pinyin: "jièshào", hsk: 2, interests: ["networking", "meetings"], goals: ["work"] },
  { id: "lvyou", hanzi: "旅游", pinyin: "lǚyóu", hsk: 2, interests: ["sightseeing"], goals: ["travel"] },
  { id: "canguan", hanzi: "参观", pinyin: "cānguān", hsk: 2, interests: ["sightseeing"] },
  { id: "yiyuan", hanzi: "医院", pinyin: "yīyuàn", hsk: 2, interests: ["medicine"] },
  { id: "yisheng", hanzi: "医生", pinyin: "yīshēng", hsk: 1, interests: ["medicine"] },
  { id: "yinyue", hanzi: "音乐", pinyin: "yīnyuè", hsk: 2, interests: ["hobbies", "entertainment"] },
  { id: "dianying", hanzi: "电影", pinyin: "diànyǐng", hsk: 1, interests: ["entertainment"] },
  { id: "yundong", hanzi: "运动", pinyin: "yùndòng", hsk: 2, interests: ["hobbies"] },
  { id: "kaihui", hanzi: "开会", pinyin: "kāihuì", hsk: 3, interests: ["meetings"], goals: ["work"] },
  { id: "kehu", hanzi: "客户", pinyin: "kèhù", hsk: 3, interests: ["clients", "sales"], goals: ["work"] },
  { id: "jingli", hanzi: "经理", pinyin: "jīnglǐ", hsk: 3, interests: ["meetings", "networking"], goals: ["work"] },
  { id: "baogao", hanzi: "报告", pinyin: "bàogào", hsk: 3, interests: ["presentations"], goals: ["school", "work"] },
  { id: "kaoshi", hanzi: "考试", pinyin: "kǎoshì", hsk: 2, interests: ["hsk_certification", "school_life"], goals: ["school", "work"] },

  // HSK 4–6
  { id: "taolun", hanzi: "讨论", pinyin: "tǎolùn", hsk: 4, interests: ["meetings", "presentations"], goals: ["work", "school"] },
  { id: "hezuo", hanzi: "合作", pinyin: "hézuò", hsk: 4, interests: ["clients", "networking"], goals: ["work"] },
  { id: "chenggong", hanzi: "成功", pinyin: "chénggōng", hsk: 4 },
  { id: "jingyan", hanzi: "经验", pinyin: "jīngyàn", hsk: 4, interests: ["networking", "sales"], goals: ["work"] },
  { id: "jihui", hanzi: "机会", pinyin: "jīhuì", hsk: 4, interests: ["networking", "sales"] },
  { id: "fuwu", hanzi: "服务", pinyin: "fúwù", hsk: 4, interests: ["hotels", "clients", "restaurants"], goals: ["travel", "work"] },
  { id: "dinggou", hanzi: "订购", pinyin: "dìnggòu", hsk: 5, interests: ["shopping", "restaurants"] },
  { id: "yuding", hanzi: "预订", pinyin: "yùdìng", hsk: 4, interests: ["hotels", "restaurants"], goals: ["travel"] },
  { id: "jiaotong", hanzi: "交通", pinyin: "jiāotōng", hsk: 4, interests: ["transportation"], goals: ["travel"] },
  { id: "jingdian", hanzi: "景点", pinyin: "jǐngdiǎn", hsk: 4, interests: ["sightseeing"], goals: ["travel"] },
  { id: "wenhua", hanzi: "文化", pinyin: "wénhuà", hsk: 4, interests: ["traditions", "sightseeing"], goals: ["heritage", "travel"] },
  { id: "chuantong", hanzi: "传统", pinyin: "chuántǒng", hsk: 4, interests: ["traditions"], goals: ["heritage"] },
  { id: "qingxu", hanzi: "情绪", pinyin: "qíngxù", hsk: 5, interests: ["relationships"] },
  { id: "guanxi", hanzi: "关系", pinyin: "guānxi", hsk: 4, interests: ["relationships", "networking"], goals: ["everyday", "work"] },
  { id: "xingqu", hanzi: "兴趣", pinyin: "xìngqù", hsk: 4, interests: ["hobbies", "friends"], goals: ["everyday"] },
  { id: "yule", hanzi: "娱乐", pinyin: "yúlè", hsk: 4, interests: ["entertainment"] },
  { id: "yanjiang", hanzi: "演讲", pinyin: "yǎnjiǎng", hsk: 5, interests: ["presentations"], goals: ["school", "work"] },
  { id: "yanjiu", hanzi: "研究", pinyin: "yánjiū", hsk: 4, interests: ["science", "engineering", "medicine"], goals: ["school"] },
  { id: "jishu", hanzi: "技术", pinyin: "jìshù", hsk: 4, interests: ["technology", "engineering"], goals: ["work", "school"] },
  { id: "shuju", hanzi: "数据", pinyin: "shùjù", hsk: 5, interests: ["finance", "technology", "science"] },
  { id: "touzi", hanzi: "投资", pinyin: "tóuzī", hsk: 5, interests: ["finance"], goals: ["work"] },
  { id: "hetong", hanzi: "合同", pinyin: "hétong", hsk: 5, interests: ["clients", "sales", "finance"], goals: ["work"] },
  { id: "tanpan", hanzi: "谈判", pinyin: "tánpàn", hsk: 5, interests: ["clients", "sales"], goals: ["work"] },
  { id: "biaoda", hanzi: "表达", pinyin: "biǎodá", hsk: 5, interests: ["presentations"] },
  { id: "goutong", hanzi: "沟通", pinyin: "gōutōng", hsk: 5, interests: ["meetings", "clients", "relationships"], goals: ["work", "everyday"] },
  { id: "guandian", hanzi: "观点", pinyin: "guāndiǎn", hsk: 5, interests: ["current_events", "presentations"] },
  { id: "yingxiang", hanzi: "影响", pinyin: "yǐngxiǎng", hsk: 4, interests: ["current_events"] },
  { id: "zhanlue", hanzi: "战略", pinyin: "zhànlüè", hsk: 6, interests: ["meetings", "finance"], goals: ["work"] },
  { id: "chuangxin", hanzi: "创新", pinyin: "chuàngxīn", hsk: 5, interests: ["technology"], goals: ["work"] },
  { id: "zeren", hanzi: "责任", pinyin: "zérèn", hsk: 4 },
  { id: "tiaozhan", hanzi: "挑战", pinyin: "tiǎozhàn", hsk: 5 },
  { id: "jiazhi", hanzi: "价值", pinyin: "jiàzhí", hsk: 5, interests: ["finance", "sales"] },
  { id: "xintai", hanzi: "心态", pinyin: "xīntài", hsk: 6, interests: ["relationships"] },
  { id: "youhui", hanzi: "优惠", pinyin: "yōuhuì", hsk: 4, interests: ["shopping", "sales"] },
  { id: "tuijian", hanzi: "推荐", pinyin: "tuījiàn", hsk: 4, interests: ["restaurants", "sightseeing", "sales"] },
  { id: "anpai", hanzi: "安排", pinyin: "ānpái", hsk: 4, interests: ["meetings", "hotels"], goals: ["work", "travel"] },
  { id: "queren", hanzi: "确认", pinyin: "quèrèn", hsk: 4, interests: ["hotels", "meetings", "clients"] },
];

const BY_ID = new Map(VOCAB_BANK.map((word) => [word.id, word]));

export function getVocabWord(id: string): VocabWord | undefined {
  return BY_ID.get(id);
}

function relevant(word: VocabWord, goal: GoalKey | null, interests: readonly string[]) {
  if (goal && word.goals?.includes(goal)) return true;
  return word.interests?.some((key) => interests.includes(key)) ?? false;
}

function stableShuffle<T>(items: T[], seed: string): T[] {
  const out = [...items];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  for (let i = out.length - 1; i > 0; i -= 1) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Desktop grid (3 columns): 15. Mobile grid (2 columns): 14. */
export const VOCAB_COUNT_DESKTOP = 15;
export const VOCAB_COUNT_MOBILE = 14;

/** About one quarter topic vocabulary; the remainder samples broad proficiency. */
export function wordsForScreen(
  band: VocabBand,
  goal: GoalKey | null,
  interests: readonly string[],
  seed: string,
  count: number = VOCAB_COUNT_DESKTOP,
): VocabWord[] {
  const target = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : VOCAB_COUNT_DESKTOP;
  const levels: Array<VocabWord["hsk"]> = band === "basic" ? [1, 2, 3] : [4, 5, 6];
  const pool = VOCAB_BANK.filter(word => levels.includes(word.hsk));
  // Round-robin across levels avoids filling the screen from the lowest tier.
  const spread = (candidates: VocabWord[], limit: number, key: string) => {
    const buckets = levels.map(level => stableShuffle(candidates.filter(word => word.hsk === level), `${seed}:${key}:${level}`));
    const result: VocabWord[] = [];
    while (result.length < limit && buckets.some(bucket => bucket.length)) {
      for (const bucket of buckets) {
        const word = bucket.shift();
        if (word) result.push(word);
        if (result.length === limit) break;
      }
    }
    return result;
  };
  const topicBudget = Math.round(target / 4);
  const topicWords = spread(pool.filter(word => relevant(word, goal, interests)), topicBudget, "topic");
  // Exclude relevant words here too: random general sampling must not leak more
  // topic vocabulary back into the remaining three quarters.
  const generalWords = spread(pool.filter(word => word.diagnostic && !relevant(word, goal, interests)), target - topicWords.length, "general");
  return stableShuffle([...topicWords, ...generalWords], `${seed}:all`);
}

export function parseVocabScreen(raw: unknown): VocabScreenAnswer {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const shownIds = Array.isArray(value.shownIds)
    ? value.shownIds.filter((id): id is string => typeof id === "string" && BY_ID.has(id)).slice(0, 24)
    : [];
  const selectedIds = Array.isArray(value.selectedIds)
    ? value.selectedIds.filter((id): id is string => typeof id === "string" && shownIds.includes(id)).slice(0, 24)
    : [];
  const skipped = value.skipped === true;
  const noneKnown = value.noneKnown === true;
  return {
    shownIds,
    selectedIds: noneKnown || skipped ? [] : selectedIds,
    noneKnown,
    skipped,
  };
}

/** Recognition rate among words that were actually shown. */
export function recognitionRate(screen: VocabScreenAnswer): number | null {
  if (screen.skipped) return 0;
  if (screen.shownIds.length === 0) return null;
  if (screen.noneKnown) return 0;
  return screen.selectedIds.length / screen.shownIds.length;
}

/**
 * Conservative placement from self-report + recognition.
 * Advanced recognition never upgrades past a cautious band; conflicts prefer
 * a supported (lower) lesson band.
 */
export function estimateLevelFromVocab(input: {
  selfReport: SelfReportKey | null;
  basic: VocabScreenAnswer;
  advanced: VocabScreenAnswer;
}): InternalLevel {
  const claimed = levelForSelfReport(input.selfReport) ?? 0;
  const basicRate = recognitionRate(input.basic);
  const advancedRate = recognitionRate(input.advanced);

  let fromVocab: InternalLevel = 0;
  if (basicRate !== null) {
    if (basicRate >= 0.75) fromVocab = 3;
    else if (basicRate >= 0.45) fromVocab = 2;
    else if (basicRate >= 0.2) fromVocab = 1;
    else fromVocab = 0;
  }
  if (advancedRate !== null && !input.advanced.skipped) {
    if (advancedRate >= 0.55) fromVocab = clampLevel(Math.max(fromVocab, 5));
    else if (advancedRate >= 0.3) fromVocab = clampLevel(Math.max(fromVocab, 4));
    else if (advancedRate >= 0.15) fromVocab = clampLevel(Math.max(fromVocab, 3));
  }

  // Conservative blend: never jump more than one level above the lower signal.
  if (input.selfReport === "new") return 0;
  const measured = basicRate === null && advancedRate === null ? claimed : fromVocab;
  const lower = Math.min(claimed, measured);
  const upper = Math.max(claimed, measured);
  if (upper - lower >= 2) return clampLevel(lower + 1);
  return clampLevel(Math.round((claimed + measured) / 2));
}

export type LessonBand = "beginner" | "elementary" | "intermediate" | "advanced";

export function lessonBandFor(level: InternalLevel): LessonBand {
  if (level <= 1) return "beginner";
  if (level === 2) return "elementary";
  if (level === 3) return "intermediate";
  return "advanced";
}

/** Unselected-but-shown word ids (candidates for "likely new" teaching targets). */
export function unseenSelectedGap(basic: VocabScreenAnswer, advanced: VocabScreenAnswer): string[] {
  const gap: string[] = [];
  for (const screen of [basic, advanced]) {
    if (screen.skipped) continue;
    const selected = new Set(screen.selectedIds);
    for (const id of screen.shownIds) {
      if (!selected.has(id) && !screen.noneKnown) gap.push(id);
      if (screen.noneKnown) gap.push(id);
    }
  }
  return Array.from(new Set(gap));
}
