"use client";

import type { DictionaryEntry } from "cc-cedict";
import cedict from "cc-cedict";
import { Segment, useDefault, type SegmentToken } from "segmentit";

const ZH_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const isChinese = (s: string) => ZH_RE.test(s);

const SURNAME_RE = /^(surname\b|variant of\b|see [^\s]+\[)/i;

function isLowQualityDefinition(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (SURNAME_RE.test(t)) return true;
  if (/^used in\b/i.test(t)) return true;
  if (/^old variant of\b/i.test(t)) return true;
  if (/^\(loanword\)/i.test(t)) return true;
  return false;
}

function pickSubstantiveDefinition(english: string[]): string | null {
  for (const line of english) {
    const trimmed = line.trim();
    if (trimmed && !isLowQualityDefinition(trimmed)) return trimmed;
  }
  return null;
}

function pickBestDefinition(english: string[]): string | null {
  const substantive = pickSubstantiveDefinition(english);
  if (substantive) return substantive;
  for (const line of english) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function hasSubstantiveDefinition(entry: DictionaryEntry): boolean {
  return pickSubstantiveDefinition(entry.english) !== null;
}

const TONE: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  v: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

function applyTone(syllable: string, tone: number): string {
  const s = syllable.toLowerCase();
  const mark = (v: string) => TONE[v][tone - 1];

  if (s.includes("a")) return s.replace("a", mark("a")).replace(/v/g, "ü");
  if (s.includes("e")) return s.replace("e", mark("e")).replace(/v/g, "ü");
  if (s.includes("ou")) return s.replace("o", mark("o")).replace(/v/g, "ü");
  if (s.includes("v")) return s.replace("v", mark("v"));
  for (const v of ["u", "i", "o"]) {
    const idx = s.lastIndexOf(v);
    if (idx >= 0) {
      return (s.slice(0, idx) + mark(v) + s.slice(idx + 1)).replace(/v/g, "ü");
    }
  }
  return s.replace(/v/g, "ü");
}

export function toneMarks(pinyin: string): string {
  const clean = pinyin
    .replace(/\([^)]*\)/g, "")
    .split("/")[0]
    .trim();

  return clean
    .split(" ")
    .map((syl) => {
      const m = syl.match(/^([a-züA-ZÜ:]+)(\d)$/);
      if (!m) return syl.replace(/v/g, "ü");
      const tone = parseInt(m[2], 10);
      return tone === 5 ? m[1].replace(/v/g, "ü") : applyTone(m[1], tone);
    })
    .join(" ");
}

function isSurnameOnly(entry: DictionaryEntry): boolean {
  return entry.english.every((def) => SURNAME_RE.test(def.trim()));
}

function cedictBest(
  cedict: { getBySimplified: Function; getByTraditional: Function },
  word: string,
): DictionaryEntry | null {
  const pick = (arr: DictionaryEntry[] | null): DictionaryEntry | null => {
    if (!arr?.length) return null;
    const substantive = arr.filter(hasSubstantiveDefinition);
    if (substantive.length > 0) return substantive[0];
    return arr.find((e) => !isSurnameOnly(e)) ?? arr[0];
  };

  const hit = pick(
    cedict.getBySimplified(word, null, {
      asObject: false,
    }) as DictionaryEntry[] | null,
  );
  if (hit) return hit;

  return pick(
    cedict.getByTraditional(word, null, {
      asObject: false,
    }) as DictionaryEntry[] | null,
  );
}

const _CUSTOM_DICT = [
  "新闻", "朋友", "工作", "感觉", "好像", "专门", "学校", "讲座",
  "代表", "现在", "以前", "时候", "地方", "问题", "方法", "公司",
  "东西", "事情", "电话", "电脑", "手机", "网络", "语言", "文化",
  "今天", "明天", "昨天", "每天", "一起", "一样", "不同", "可以",
  "应该", "需要", "认为", "觉得", "知道", "看到", "听到", "告诉",
  "开始", "结束", "继续", "发现", "回来", "出去", "进来", "出来",
  "大学", "中学", "小学", "老师", "学生", "同学", "家人",
  "父母", "孩子", "男朋友", "女朋友", "丈夫", "妻子", "兄弟", "姐妹",
  "餐厅", "咖啡", "咖啡馆", "超市", "医院", "图书馆", "公园", "机场",
  "火车", "飞机", "地铁", "汽车", "自行车", "出租车", "公共汽车",
  "电影", "音乐", "体育", "运动", "足球", "篮球", "游泳", "跑步",
  "旅游", "旅行", "度假", "酒店", "宾馆", "景点", "风景", "照片",
  "天气", "温度", "下雨", "下雪", "刮风", "晴天", "阴天", "季节",
  "春天", "夏天", "秋天", "冬天", "早上", "中午", "下午", "晚上",
  "人们", "大家", "自己", "别人", "他们", "她们", "我们", "你们",
  "因为", "所以", "但是", "虽然", "如果", "就是", "还是", "或者",
  "非常", "特别", "真的", "确实", "已经", "正在", "将要", "曾经",
  "一点", "一些", "一下", "一直", "一定", "一般", "一共", "一边",
  "高兴", "快乐", "幸福", "难过", "担心", "生气", "害怕", "紧张",
  "漂亮", "好看", "帅气", "有趣", "有意思", "重要", "方便", "容易",
  "困难", "危险", "安全", "健康", "干净", "整洁", "热闹", "安静",
  "我家", "你家", "他家", "咱们家", "打游戏", "玩游戏",
]
  .map((w) => `${w}|1048576|99999`)
  .join("\n");

function mergeKnownWords(
  tokens: SegmentToken[],
  cedict: { getBySimplified: Function; getByTraditional: Function },
): SegmentToken[] {
  const out: SegmentToken[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (
      i + 1 < tokens.length &&
      isChinese(tokens[i].w) &&
      isChinese(tokens[i + 1].w)
    ) {
      const bigram = tokens[i].w + tokens[i + 1].w;
      const bigramEntry = cedictBest(cedict, bigram);
      if (bigramEntry && !isSurnameOnly(bigramEntry)) {
        out.push({ w: bigram, p: tokens[i].p });
        i += 2;
        continue;
      }
    }
    out.push(tokens[i]);
    i++;
  }
  return out;
}

type Mods = {
  segment: (text: string) => SegmentToken[];
  lookup: (word: string) => DictionaryEntry | null;
};

let _mods: Mods | null = null;

function getMods(): Mods {
  if (_mods) return _mods;

  const segmenter = useDefault(new Segment());
  segmenter.loadDict(_CUSTOM_DICT);

  _mods = {
    segment: (text) => {
      const raw = segmenter.doSegment(text, {
        simple: false,
      }) as SegmentToken[];
      return mergeKnownWords(raw, cedict);
    },
    lookup: (word) => cedictBest(cedict, word),
  };

  return _mods;
}

export async function segmentChineseText(text: string): Promise<SegmentToken[]> {
  return getMods().segment(text);
}

export async function lookupChineseWord(
  word: string,
): Promise<DictionaryEntry | null> {
  return getMods().lookup(word);
}

export async function lookupChineseWordDetailed(
  word: string,
): Promise<DictionaryEntry | "not_found"> {
  const direct = await lookupChineseWord(word);
  if (direct) return direct;

  const resolved = await resolveTokenGloss(word);
  if (!resolved) return "not_found";

  return {
    simplified: word,
    traditional: word,
    pinyin: resolved.pinyin,
    english: [resolved.english],
  } as DictionaryEntry;
}

/** Short learner-friendly gloss from a CC-CEDICT definition line. */
export function formatCedictGloss(definition: string): string {
  const senses = definition
    .split(/[;；]/)
    .map((s) => s.trim())
    .filter((s) => s && !isLowQualityDefinition(s));

  if (
    senses.length > 1 &&
    senses.every((s) => s.split(/\s+/).filter(Boolean).length === 1)
  ) {
    return senses
      .slice(0, 3)
      .map((s) => s.toLowerCase())
      .join("/");
  }

  let s = (senses[0] ?? definition.trim()).toLowerCase();
  s = s.replace(/^to\s+/, "").replace(/^\(loanword\)\s*/, "");

  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return s;

  const maxWords = 4;
  if (parts.length <= maxWords) return parts.join(" ");

  let slice = parts.slice(0, maxWords);
  const droppable = new Set(["a", "an", "the", "to", "at", "in", "on", "for", "of"]);
  while (slice.length > 2 && droppable.has(slice[slice.length - 1]!)) {
    slice = slice.slice(0, -1);
  }
  return slice.join(" ");
}

export function entryPinyin(entry: DictionaryEntry): string {
  return toneMarks(entry.pinyin || "");
}

export function entryGloss(entry: DictionaryEntry): string {
  const first = pickBestDefinition(entry.english);
  return first ? formatCedictGloss(first) : "—";
}

export type BreakdownToken = {
  hanzi: string;
  pinyin: string;
  english: string;
  isTarget: boolean;
  isChinese: boolean;
};

type GlossResult = { pinyin: string; english: string };

const KNOWN_COMPOUND_GLOSSES: Record<string, GlossResult> = {
  我家: { pinyin: "wǒ jiā", english: "my home" },
  你家: { pinyin: "nǐ jiā", english: "your home" },
  他家: { pinyin: "tā jiā", english: "his/her home" },
  咱们家: { pinyin: "zánmen jiā", english: "our home" },
  我们家: { pinyin: "wǒmen jiā", english: "our home" },
  无聊: { pinyin: "wú liáo", english: "boring" },
};

function knownCompoundGloss(word: string): GlossResult | null {
  return KNOWN_COMPOUND_GLOSSES[word] ?? null;
}

/** Resolve gloss for a segment, splitting unknown compounds (e.g. 很好 → 很 + 好). */
async function resolveTokenGloss(word: string): Promise<GlossResult | null> {
  const known = knownCompoundGloss(word);
  if (known) return known;

  const entry = await lookupChineseWord(word);
  if (entry) {
    return { pinyin: entryPinyin(entry), english: entryGloss(entry) };
  }

  if (word.length <= 1) return null;

  // Prefer the longest left chunk that resolves (e.g. 无聊+的, not 无+聊的).
  for (let i = word.length - 1; i >= 1; i--) {
    const left = await resolveTokenGloss(word.slice(0, i));
    const right = await resolveTokenGloss(word.slice(i));
    if (!left || !right) continue;

    const english = [left.english, right.english]
      .join(" ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join(" ");

    return {
      pinyin: [left.pinyin, right.pinyin].filter(Boolean).join(" "),
      english,
    };
  }

  return null;
}

export async function buildSentenceBreakdown(
  sentenceHanzi: string,
  target: { hanzi: string; pinyin: string; english: string },
): Promise<BreakdownToken[]> {
  const segments = await segmentChineseText(sentenceHanzi);
  const tokens: BreakdownToken[] = [];

  for (const seg of segments) {
    if (!isChinese(seg.w)) {
      tokens.push({
        hanzi: seg.w,
        pinyin: "",
        english: "",
        isTarget: false,
        isChinese: false,
      });
      continue;
    }

    const isTarget = seg.w === target.hanzi;
    if (isTarget) {
      tokens.push({
        hanzi: seg.w,
        pinyin: target.pinyin,
        english: target.english,
        isTarget: true,
        isChinese: true,
      });
      continue;
    }

    const known = knownCompoundGloss(seg.w);
    if (known) {
      tokens.push({
        hanzi: seg.w,
        pinyin: known.pinyin,
        english: known.english,
        isTarget: false,
        isChinese: true,
      });
      continue;
    }

    const entry = await lookupChineseWord(seg.w);
    if (entry) {
      tokens.push({
        hanzi: seg.w,
        pinyin: entryPinyin(entry),
        english: entryGloss(entry),
        isTarget: false,
        isChinese: true,
      });
    } else {
      const resolved = await resolveTokenGloss(seg.w);
      tokens.push({
        hanzi: seg.w,
        pinyin: resolved?.pinyin ?? "",
        english: resolved?.english ?? "—",
        isTarget: false,
        isChinese: true,
      });
    }
  }

  return tokens;
}
