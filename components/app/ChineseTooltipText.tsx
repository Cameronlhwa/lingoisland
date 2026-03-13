"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
} from "@floating-ui/react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import type { DictionaryEntry } from "cc-cedict";
import type { SegmentToken } from "segmentit";

// ---------------------------------------------------------------------------
// POS tag bitmasks (from segmentit POSTAG constants)
// ---------------------------------------------------------------------------
const POS_V = 0x00001000; // verb
const POS_N = 0x00100000; // noun
const POS_A = 0x40000000; // adjective
const POS_U = 0x00002000; // particle
const POS_M = 0x00400000; // numeral/measure

function posLabel(p: number): string {
  if ((p & POS_V) > 0) return "verb";
  if ((p & POS_N) > 0) return "noun";
  if ((p & POS_A) > 0) return "adj.";
  if ((p & POS_U) > 0) return "particle";
  if ((p & POS_M) > 0) return "num.";
  return "";
}

// ---------------------------------------------------------------------------
// Pinyin sanitisation + tone-mark conversion
// CC-CEDICT format: "ni3 hao3" → "nǐ hǎo"
// Sanitisation: strip bracket variants like (r5), take first slash-reading
// ---------------------------------------------------------------------------
const TONE: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  v: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"], // CC-CEDICT uses 'v' for ü
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
    if (idx >= 0)
      return (s.slice(0, idx) + mark(v) + s.slice(idx + 1)).replace(
        /v/g,
        "ü",
      );
  }
  return s.replace(/v/g, "ü");
}

function toneMarks(pinyin: string): string {
  // Sanitise first: strip bracket variants, take first slash-reading
  const clean = pinyin
    .replace(/\([^)]*\)/g, "")
    .split("/")[0]
    .trim();

  return clean
    .split(" ")
    .map((syl) => {
      const m = syl.match(/^([a-züA-ZÜ:]+)(\d)$/);
      if (!m) return syl.replace(/v/g, "ü");
      const tone = parseInt(m[2]);
      return tone === 5 ? m[1].replace(/v/g, "ü") : applyTone(m[1], tone);
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Unicode code-point helper for the "not found" fallback
// ---------------------------------------------------------------------------
function toCodePoints(s: string): string {
  return [...s]
    .map(
      (c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
    )
    .join(" ");
}

// ---------------------------------------------------------------------------
// Chinese-character check
// ---------------------------------------------------------------------------
const ZH_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const isChinese = (s: string) => ZH_RE.test(s);

// ---------------------------------------------------------------------------
// Lazy module loader — loads segmentit + cc-cedict once on first use
// ---------------------------------------------------------------------------
// 'not_found' sentinel distinguishes "lookup done, nothing found" from null (loading)
type LookupResult = DictionaryEntry | "not_found";

type Mods = {
  segment: (text: string) => SegmentToken[];
  lookup: (word: string) => LookupResult;
};

let _mods: Mods | null = null;
let _promise: Promise<Mods> | null = null;

// Matches definitions that are purely metadata noise: surname entries,
// cross-references ("see X[y1]"), and "variant of" pointers.
// An entry is surname-only when EVERY definition line matches — mixed entries
// like "capital city; surname Du" are still considered useful.
const SURNAME_RE = /^(surname\b|variant of\b|see [^\s]+\[)/i;

function isSurnameOnly(entry: DictionaryEntry): boolean {
  return entry.english.every((def) => SURNAME_RE.test(def.trim()));
}

// Like the old cedictFirst, but prefers entries with substantive definitions
// over entries whose every definition is a surname / cross-reference.
// Falls back to arr[0] if ALL entries are surname-only (genuine proper nouns).
function cedictBest(
  cedict: { getBySimplified: Function; getByTraditional: Function },
  word: string,
): DictionaryEntry | null {
  const pick = (arr: DictionaryEntry[] | null): DictionaryEntry | null => {
    if (!arr?.length) return null;
    return arr.find((e) => !isSurnameOnly(e)) ?? arr[0];
  };

  const hit = pick(
    cedict.getBySimplified(word, null, { asObject: false }) as DictionaryEntry[] | null,
  );
  if (hit) return hit;

  return pick(
    cedict.getByTraditional(word, null, { asObject: false }) as DictionaryEntry[] | null,
  );
}

// High-frequency compound words injected as a loadDict string (word|POS|freq).
// POS_N = 0x00100000 = 1048576. High frequency biases the segmenter to keep
// these as single tokens rather than splitting into individual characters.
const _CUSTOM_DICT = [
  "新闻", "朋友", "工作", "感觉", "好像", "专门", "学校", "讲座",
  "代表", "现在", "以前", "时候", "地方", "问题", "方法", "公司",
  "东西", "事情", "电话", "电脑", "手机", "网络", "语言", "文化",
  "今天", "明天", "昨天", "每天", "一起", "一样", "不同", "可以",
  "应该", "需要", "认为", "觉得", "知道", "看到", "听到", "告诉",
  "开始", "结束", "继续", "发现", "回来", "出去", "进来", "出来",
  "大学", "中学", "小学", "老师", "学生", "同学", "朋友", "家人",
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
]
  .map((w) => `${w}|1048576|99999`)
  .join("\n");

// Post-segmentation merge pass: if two adjacent single-char Chinese tokens
// form a bigram that exists in CC-CEDICT, merge them into one token.
// This catches compounds that the segmenter still splits despite the loadDict.
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
      // Only merge if the bigram has a substantive definition — don't merge
      // chars just because a surname entry happens to exist for the pair.
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

function loadMods(): Promise<Mods> {
  if (_mods) return Promise.resolve(_mods);
  if (_promise) return _promise;

  _promise = Promise.all([import("segmentit"), import("cc-cedict")]).then(
    ([seg, cedictMod]) => {
      const segmenter = seg.useDefault(new seg.Segment());
      // Inject high-frequency compound words so the segmenter keeps them intact
      segmenter.loadDict(_CUSTOM_DICT);
      const cedict = cedictMod.default;

      _mods = {
        segment: (text) => {
          const raw = segmenter.doSegment(text, {
            simple: false,
          }) as SegmentToken[];
          return mergeKnownWords(raw, cedict);
        },

        lookup: (word): LookupResult => {
          // Step 1 & 2: try the whole word (simplified → traditional),
          // preferring entries with substantive (non-surname) definitions.
          const direct = cedictBest(cedict, word);
          if (direct) return direct;

          // Step 3: multi-char word — try each character individually
          if ([...word].length > 1) {
            for (const char of word) {
              if (!isChinese(char)) continue;
              const charEntry = cedictBest(cedict, char);
              if (charEntry) return charEntry;
            }
          }

          // Step 4: single char — already covered by cedictFirst above.
          // Nothing found: return sentinel so UI can show code-point info.
          return "not_found";
        },
      };
      return _mods;
    },
  );
  return _promise;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ChineseTooltipTextProps {
  text: string;
  className?: string;
}

export default function ChineseTooltipText({
  text,
  className,
}: ChineseTooltipTextProps) {
  const { convertText } = useCharacterSet();
  const [segments, setSegments] = useState<SegmentToken[] | null>(null);
  const [open, setOpen] = useState(false);
  // null = loading, DictionaryEntry = found, 'not_found' = lookup done, nothing found
  const [entry, setEntry] = useState<DictionaryEntry | "not_found" | null>(
    null,
  );
  const [activeWord, setActiveWord] = useState("");
  const [activePOS, setActivePOS] = useState("");
  const lookupIdRef = useRef(0);

  const { refs, floatingStyles } = useFloating({
    placement: "bottom",
    open,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Kick off module + segmentation load immediately on mount
  useEffect(() => {
    let cancelled = false;
    loadMods().then((mods) => {
      if (!cancelled) setSegments(mods.segment(text));
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  const handleEnter = useCallback(
    async (e: React.MouseEvent<HTMLSpanElement>, seg: SegmentToken) => {
      const id = ++lookupIdRef.current;
      refs.setReference(e.currentTarget);
      setActiveWord(seg.w);
      setActivePOS(posLabel(seg.p));
      setEntry(null); // show loading state
      setOpen(true);

      const mods = await loadMods();
      if (lookupIdRef.current !== id) return; // stale hover
      setEntry(mods.lookup(seg.w));
    },
    [refs],
  );

  const handleLeave = useCallback(() => {
    setOpen(false);
    setEntry(null);
  }, []);

  // Unsegmented fallback while modules are loading
  if (!segments) {
    return (
      <span className={className} style={{ display: "inline" }}>
        {convertText(text)}
      </span>
    );
  }

  return (
    <>
      {/* wordSpacing/letterSpacing:0 prevents gaps between inline word spans */}
      <span
        className={className}
        style={{ wordSpacing: 0, letterSpacing: 0, display: "inline" }}
      >
        {segments.map((seg, i) =>
          isChinese(seg.w) ? (
            <span
              key={i}
              data-word={seg.w}
              onMouseEnter={(e) => handleEnter(e, seg)}
              onMouseLeave={handleLeave}
              style={{ display: "inline" }}
              className="cursor-help rounded transition-colors hover:bg-blue-50 hover:text-blue-800"
            >
              {convertText(seg.w)}
            </span>
          ) : (
            <span key={i} style={{ display: "inline" }}>
              {convertText(seg.w)}
            </span>
          ),
        )}
      </span>

      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-50 min-w-[180px] max-w-[260px] rounded-xl border border-gray-200 bg-white px-3.5 py-3 shadow-lg"
          >
            {/* Chinese characters (respects simplified/traditional setting) */}
            <div className="mb-0.5 text-xl font-bold leading-tight text-gray-900">
              {convertText(activeWord)}
            </div>

            {entry === null ? (
              <div className="text-xs text-gray-400">Looking up…</div>
            ) : entry === "not_found" ? (
              /* Step 5: nothing found — show Unicode code points */
              <div className="space-y-1">
                <div className="font-mono text-xs text-gray-500">
                  {toCodePoints(activeWord)}
                </div>
                <div className="text-xs text-gray-400">No definition found</div>
              </div>
            ) : (
              <>
                {/* Pinyin with tone marks (sanitised) */}
                <div className="mb-1.5 text-[0.8125rem] font-medium text-blue-600">
                  {toneMarks(entry.pinyin)}
                </div>

                {/* POS badge */}
                {activePOS && (
                  <span className="mb-1.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    {activePOS}
                  </span>
                )}

                {/* Definitions — up to 3 */}
                <div className="space-y-0.5 text-sm text-gray-700">
                  {entry.english.slice(0, 3).map((def, idx) => (
                    <div key={idx} className={idx > 0 ? "text-gray-500" : ""}>
                      {entry.english.length > 1 ? `${idx + 1}. ${def}` : def}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
