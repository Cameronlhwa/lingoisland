"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pinyin as toPinyin } from "pinyin-pro";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import HuahuaAvatar from "@/components/app/HuahuaAvatar";
import PrimaryButton from "@/components/landing/PrimaryButton";
import SecondaryButton from "@/components/landing/SecondaryButton";
import {
  HSK_CARD_SHADOW,
  LINGO_ACCENT_BORDER,
  LINGO_ACCENT_GRADIENT_GLOSSY,
} from "@/lib/glossy-theme";
import { LEARN_CARD_CLASS, LEARN_CARD_STYLE } from "./shell";
import type { LearnIsland, LearnWord } from "./types";

interface ExerciseChatProps {
  words: LearnWord[];
  island: LearnIsland;
  onComplete: () => void;
  onBack?: () => void;
  fillContainer?: boolean;
}

interface ExchangeData {
  huahuaHanzi: string;
  huahuaPinyin: string;
  replyHanzi: string;
  replyPinyin: string;
  correctHanzi: string;
  correctPinyin: string;
  practiceEnglish: string;
  options: { hanzi: string; pinyin: string }[];
}

interface CompletedTurn {
  huahuaHanzi: string;
  huahuaPinyin: string;
  userHanzi: string;
  userPinyin: string;
  feedbackText: string;
}

type Phase = "loading" | "exercise" | "feedback" | "done";

function fillReplyTemplate(template: string, word: string): string {
  return template.replace("___", word);
}

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function DisplayToggles({
  showPinyin,
  showEnglish,
  onTogglePinyin,
  onToggleEnglish,
}: {
  showPinyin: boolean;
  showEnglish: boolean;
  onTogglePinyin: () => void;
  onToggleEnglish: () => void;
}) {
  const pill = (active: boolean) =>
    ({
      padding: "6px 14px",
      borderRadius: 999,
      border: `1px solid ${active ? "transparent" : LINGO_ACCENT_BORDER}`,
      background: active ? LINGO_ACCENT_GRADIENT_GLOSSY : "#fff",
      color: active ? "#fff" : "var(--lingo-navy)",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      boxShadow: active ? HSK_CARD_SHADOW : undefined,
    }) as const;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 8,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <button type="button" onClick={onTogglePinyin} style={pill(showPinyin)}>
        {showPinyin ? "Hide" : "Show"} Pinyin
      </button>
      <button type="button" onClick={onToggleEnglish} style={pill(showEnglish)}>
        {showEnglish ? "Hide" : "Show"} English
      </button>
    </div>
  );
}

function EnglishLine({
  english,
  loading,
}: {
  english?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <p
        style={{
          marginTop: 6,
          fontSize: 12,
          fontStyle: "italic",
          color: "#8AABBF",
          lineHeight: 1.5,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        Translating…
      </p>
    );
  }
  if (!english) return null;
  return (
    <p
      style={{
        marginTop: 6,
        fontSize: 12,
        fontStyle: "italic",
        color: "#8AABBF",
        lineHeight: 1.5,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {english}
    </p>
  );
}

const WORKSHEET_PATTERNS = ["选一个字", "完成下面", "填空", "选词", "完成句子"];

function isValidExchange(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const ex = raw as Record<string, unknown>;
  const huahuaHanzi = ex.huahuaHanzi;
  const replyHanzi = ex.replyHanzi;
  const correctHanzi = ex.correctHanzi;
  if (
    typeof huahuaHanzi !== "string" ||
    typeof replyHanzi !== "string" ||
    typeof correctHanzi !== "string" ||
    !Array.isArray(ex.options)
  ) {
    return false;
  }
  if (!replyHanzi.includes("___")) return false;
  if (WORKSHEET_PATTERNS.some((p) => huahuaHanzi.includes(p))) return false;
  return true;
}

/** Matches LearnSlideshow / onboarding glossy card. */
const LEARN_SEQUENCE_CARD_STYLE: React.CSSProperties = {
  ...LEARN_CARD_STYLE,
  width: "100%",
  maxWidth: "600px",
};

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkWidth = () => setIsDesktop(window.innerWidth >= 768);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  return isDesktop;
}

function ExerciseChatShell({
  isDesktop,
  fillContainer,
  children,
}: {
  isDesktop: boolean;
  fillContainer: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: fillContainer ? "100%" : "calc(100vh - 8rem)",
        alignItems: isDesktop ? "center" : "stretch",
        justifyContent: isDesktop ? "center" : "flex-start",
        padding: isDesktop ? "24px 32px" : "0 16px",
        maxWidth: isDesktop ? undefined : 672,
        margin: isDesktop ? undefined : "0 auto",
        width: "100%",
      }}
    >
      <div
        className={isDesktop ? LEARN_CARD_CLASS : undefined}
        style={
          isDesktop
            ? {
                ...LEARN_SEQUENCE_CARD_STYLE,
                maxHeight: "100%",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
              }
            : {
                flex: 1,
                overflowY: "auto",
                paddingTop: 16,
                paddingBottom: 8,
                width: "100%",
              }
        }
      >
        {children}
      </div>
    </div>
  );
}

function shuffleOptions<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function pinyinLine(text: string): string {
  return toPinyin(text, {
    toneType: "symbol",
    separator: " ",
    nonZh: "removed",
  }).trim();
}

function normalizeExchange(
  raw: unknown,
  wordByHanzi: Map<string, LearnWord>,
): ExchangeData | null {
  if (!raw || typeof raw !== "object") return null;
  const ex = raw as Record<string, unknown>;

  const huahuaHanzi =
    typeof ex.huahuaHanzi === "string" ? ex.huahuaHanzi.trim() : "";
  const huahuaPinyin =
    typeof ex.huahuaPinyin === "string" ? ex.huahuaPinyin.trim() : "";
  const replyHanzi =
    typeof ex.replyHanzi === "string" ? ex.replyHanzi.trim() : "";
  const replyPinyin =
    typeof ex.replyPinyin === "string" ? ex.replyPinyin.trim() : "";
  const correctHanzi =
    typeof ex.correctHanzi === "string" ? ex.correctHanzi.trim() : "";
  const correctPinyin =
    typeof ex.correctPinyin === "string" ? ex.correctPinyin.trim() : "";

  if (!huahuaHanzi || !replyHanzi.includes("___") || !correctHanzi) return null;
  if (WORKSHEET_PATTERNS.some((p) => huahuaHanzi.includes(p))) return null;

  const optionsRaw = Array.isArray(ex.options) ? ex.options : [];
  const options = optionsRaw
    .map((opt) => {
      if (!opt || typeof opt !== "object") return null;
      const o = opt as Record<string, unknown>;
      const hanzi = typeof o.hanzi === "string" ? o.hanzi.trim() : "";
      const pinyin = typeof o.pinyin === "string" ? o.pinyin.trim() : "";
      return hanzi ? { hanzi, pinyin } : null;
    })
    .filter((o): o is { hanzi: string; pinyin: string } => o !== null);

  if (options.length < 4) return null;

  const finalHuahuaPinyin =
    huahuaPinyin ||
    (/[\u4e00-\u9fff]/.test(huahuaHanzi) ? pinyinLine(huahuaHanzi) : "");

  const practiceEnglish =
    typeof ex.practiceEnglish === "string"
      ? ex.practiceEnglish.trim()
      : wordByHanzi.get(correctHanzi)?.english ?? "";

  return {
    huahuaHanzi,
    huahuaPinyin: finalHuahuaPinyin,
    replyHanzi,
    replyPinyin,
    correctHanzi,
    correctPinyin,
    practiceEnglish,
    options: shuffleOptions(options.slice(0, 4)),
  };
}

/**
 * Fixed A0 practice avoids a per-session AI request. It reviews the same
 * introductory vocabulary seeded for the fixed A0 island.
 */
function getFixedA0Exercises(words: LearnWord[]): ExchangeData[] {
  const pinyinFor = (hanzi: string) =>
    words.find((word) => word.hanzi === hanzi)?.pinyin ?? "";
  const options = ["你好", "我", "叫", "名字"].map((hanzi) => ({
    hanzi,
    pinyin: pinyinFor(hanzi),
  }));

  return [
    {
      huahuaHanzi: "你好！你好吗？",
      huahuaPinyin: "Nǐ hǎo! Nǐ hǎo ma?",
      replyHanzi: "___！",
      replyPinyin: "___!",
      correctHanzi: "你好",
      correctPinyin: pinyinFor("你好"),
      practiceEnglish: "hello",
      options: shuffleOptions(options),
    },
    {
      huahuaHanzi: "你叫什么名字？",
      huahuaPinyin: "Nǐ jiào shénme míngzi?",
      replyHanzi: "我___[Name]。",
      replyPinyin: "Wǒ ___ [Name].",
      correctHanzi: "叫",
      correctPinyin: pinyinFor("叫"),
      practiceEnglish: "to be called",
      options: shuffleOptions(options),
    },
    {
      huahuaHanzi: "你的名字是什么？",
      huahuaPinyin: "Nǐ de míngzi shì shénme?",
      replyHanzi: "我的___是[Name]。",
      replyPinyin: "Wǒ de ___ shì [Name].",
      correctHanzi: "名字",
      correctPinyin: pinyinFor("名字"),
      practiceEnglish: "name",
      options: shuffleOptions(options),
    },
  ];
}

/**
 * Used only when a non-A0 AI exercise request is slow or malformed. It keeps
 * the learner moving without another long request; a successful AI response
 * still uses the existing conversational exercise flow.
 */
function getQuickFallbackExercises(words: LearnWord[]): ExchangeData[] {
  const options = words.slice(0, 4).map((word) => ({
    hanzi: word.hanzi,
    pinyin: word.pinyin,
  }));

  return words.slice(0, 3).map((word) => ({
    huahuaHanzi: `Find the Mandarin word for “${word.english}”.`,
    huahuaPinyin: "",
    replyHanzi: "___",
    replyPinyin: "___",
    correctHanzi: word.hanzi,
    correctPinyin: word.pinyin,
    practiceEnglish: word.english,
    options: shuffleOptions(options),
  }));
}

const A0_FIXED_ENGLISH: Record<string, string> = {
  "你好！你好吗？": "Hello! How are you?",
  "你好！": "Hello!",
  "你叫什么名字？": "What's your name?",
  "我叫[Name]。": "My name is [Name].",
  "你的名字是什么？": "What is your name?",
  "我的名字是[Name]。": "My name is [Name].",
};

function Avatar() {
  return (
    <div style={{ width: 36, height: 36, flexShrink: 0 }}>
      <HuahuaAvatar className="h-9 w-9" />
    </div>
  );
}

function HuahuaBubble({
  hanzi,
  pinyin,
  showPinyin,
  showEnglish,
  english,
  englishLoading,
  convertText,
  isA0 = false,
}: {
  hanzi: string;
  pinyin?: string;
  showPinyin: boolean;
  showEnglish: boolean;
  english?: string;
  englishLoading?: boolean;
  convertText: (text: string) => string;
  isA0?: boolean;
}) {
  const isChinese = hasChinese(hanzi);
  const displayPinyin = (isA0 || showPinyin) && pinyin;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        marginBottom: 12,
      }}
    >
      <Avatar />
      <div
        style={{
          background: "#fff",
          border: "0.5px solid #C2DCF0",
          borderRadius: "0 12px 12px 12px",
          padding: "12px 16px",
          maxWidth: "75%",
        }}
      >
        {isA0 && isChinese && displayPinyin ? (
          <>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#2176AE",
                lineHeight: 1.5,
                marginBottom: 4,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {pinyin}
            </div>
            <div
              style={{
                fontSize: 16,
                color: "#071E2E",
                lineHeight: 1.6,
                marginBottom: showEnglish ? 4 : 0,
                fontFamily: "'Lora', Georgia, serif",
              }}
            >
              {convertText(hanzi)}
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontSize: 17,
                color: "#071E2E",
                lineHeight: 1.6,
                marginBottom:
                  displayPinyin || (showEnglish && isChinese) ? 4 : 0,
                fontFamily: isChinese
                  ? "'Lora', Georgia, serif"
                  : "'DM Sans', system-ui, sans-serif",
                whiteSpace: isChinese ? undefined : "pre-wrap",
              }}
            >
              {isChinese ? convertText(hanzi) : hanzi}
            </div>
            {displayPinyin ? (
              <div style={{ fontSize: 12, color: "#8AABBF", lineHeight: 1.5 }}>
                {pinyin}
              </div>
            ) : null}
          </>
        )}
        {showEnglish && isChinese ? (
          <EnglishLine english={english} loading={englishLoading} />
        ) : null}
      </div>
    </div>
  );
}

function UserReplyBubble({
  replyHanzi,
  replyPinyin,
  filledHanzi,
  filledPinyin,
  showPinyin,
  showEnglish,
  english,
  englishLoading,
  convertText,
  isA0 = false,
}: {
  replyHanzi: string;
  replyPinyin: string;
  filledHanzi?: string | null;
  filledPinyin?: string | null;
  showPinyin: boolean;
  showEnglish: boolean;
  english?: string;
  englishLoading?: boolean;
  convertText: (text: string) => string;
  isA0?: boolean;
}) {
  const isTemplate = replyHanzi.includes("___");
  const replyHanziParts = isTemplate ? replyHanzi.split("___") : null;
  const replyPinyinParts = isTemplate ? replyPinyin.split("___") : null;
  const showFill = isTemplate ? !!filledHanzi : true;
  const displayPinyin = isA0 || showPinyin;

  const pinyinBlock = displayPinyin ? (
    <div
      style={{
        fontSize: isA0 ? 16 : 12,
        fontWeight: isA0 ? 600 : 400,
        color: isA0 ? "#2176AE" : "#5A7A90",
        lineHeight: 1.5,
        marginBottom: isA0 ? 4 : 0,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      {isTemplate ? (
        <>
          {replyPinyinParts![0]}
          {showFill ? (
            <span style={{ color: "#2176AE" }}>{filledPinyin}</span>
          ) : (
            <span
              style={{
                display: "inline-block",
                minWidth: 72,
                borderBottom: "1.5px solid #C2DCF0",
                margin: "0 3px",
                textAlign: "center",
                color: "#2176AE",
                verticalAlign: "bottom",
              }}
            >
              {"\u00a0\u00a0\u00a0"}
            </span>
          )}
          {replyPinyinParts![1] ?? ""}
        </>
      ) : (
        replyPinyin
      )}
    </div>
  ) : null;

  const hanziBlock = (
    <div
      style={{
        fontSize: isA0 ? 15 : 17,
        color: "#071E2E",
        lineHeight: 1.6,
        marginBottom: (!isA0 && (displayPinyin || showEnglish)) || (isA0 && showEnglish) ? 4 : 0,
        fontFamily: "'Lora', Georgia, serif",
      }}
    >
      {isTemplate ? (
        <>
          {convertText(replyHanziParts![0])}
          {showFill ? (
            <span style={{ color: "#2176AE", fontWeight: 500 }}>
              {convertText(filledHanzi!)}
            </span>
          ) : (
            <span
              style={{
                display: "inline-block",
                minWidth: 72,
                borderBottom: "2px solid #B8D8EC",
                margin: "0 3px",
                textAlign: "center",
                color: "#2176AE",
                fontWeight: 500,
                verticalAlign: "bottom",
                paddingBottom: 1,
              }}
            >
              {"\u00a0\u00a0\u00a0"}
            </span>
          )}
          {convertText(replyHanziParts![1] ?? "")}
        </>
      ) : (
        convertText(replyHanzi)
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          background: "#EAF4FB",
          border: "0.5px solid #B8D8EC",
          borderRadius: "12px 0 12px 12px",
          padding: "12px 16px",
          maxWidth: "75%",
        }}
      >
        {isA0 ? (
          <>
            {pinyinBlock}
            {hanziBlock}
          </>
        ) : (
          <>
            {hanziBlock}
            {pinyinBlock}
          </>
        )}
        {showEnglish ? (
          <EnglishLine english={english} loading={englishLoading} />
        ) : null}
      </div>
    </div>
  );
}

function CompletedTurnBlock({
  turn,
  showPinyin,
  showEnglish,
  getEnglishEntry,
  convertText,
  isA0 = false,
}: {
  turn: CompletedTurn;
  showPinyin: boolean;
  showEnglish: boolean;
  getEnglishEntry: (text: string) => { english?: string; loading?: boolean };
  convertText: (text: string) => string;
  isA0?: boolean;
}) {
  return (
    <>
      <HuahuaBubble
        hanzi={turn.huahuaHanzi}
        pinyin={turn.huahuaPinyin}
        showPinyin={showPinyin}
        showEnglish={showEnglish}
        english={getEnglishEntry(turn.huahuaHanzi).english}
        englishLoading={getEnglishEntry(turn.huahuaHanzi).loading}
        convertText={convertText}
        isA0={isA0}
      />
      <UserReplyBubble
        replyHanzi={turn.userHanzi}
        replyPinyin={turn.userPinyin}
        showPinyin={showPinyin}
        showEnglish={showEnglish}
        english={getEnglishEntry(turn.userHanzi).english}
        englishLoading={getEnglishEntry(turn.userHanzi).loading}
        convertText={convertText}
        isA0={isA0}
      />
      <HuahuaBubble
        hanzi={turn.feedbackText}
        showPinyin={showPinyin}
        showEnglish={showEnglish}
        english={getEnglishEntry(turn.feedbackText).english}
        englishLoading={getEnglishEntry(turn.feedbackText).loading}
        convertText={convertText}
        isA0={isA0}
      />
    </>
  );
}

export default function ExerciseChat({
  words,
  island,
  onComplete,
  onBack,
  fillContainer = false,
}: ExerciseChatProps) {
  const { convertText } = useCharacterSet();
  const isA0 = island.level.trim().toUpperCase().startsWith("A0");
  const isDesktop = useIsDesktop();
  const [phase, setPhase] = useState<Phase>("loading");
  const [openerText, setOpenerText] = useState("");
  const [exchanges, setExchanges] = useState<ExchangeData[]>([]);
  const [completedTurns, setCompletedTurns] = useState<CompletedTurn[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<{
    hanzi: string;
    pinyin: string;
  } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [score, setScore] = useState(0);
  const [showPinyin, setShowPinyin] = useState(isA0);
  const [showEnglish, setShowEnglish] = useState(isA0);
  const [englishCache, setEnglishCache] = useState<
    Record<string, { english?: string; loading?: boolean }>
  >({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const wordsRef = useRef(words);
  wordsRef.current = words;

  const fetchSessionKey = useMemo(
    () =>
      [
        island.id,
        island.topic,
        island.level,
        words.map((w) => w.id).join(","),
      ].join("\0"),
    [island.id, island.topic, island.level, words],
  );

  const fetchExercises = useCallback(async () => {
    setPhase("loading");
    setOpenerText("");
    setExchanges([]);
    setCompletedTurns([]);
    setCurrentIndex(0);
    setSelected(null);
    setFeedbackText("");
    setScore(0);

    const activeWords = wordsRef.current;
    const isA0 = island.level.trim().toUpperCase().startsWith("A0");
    if (isA0) {
      setOpenerText(
        "You already know your first Mandarin words. Let's practice them!",
      );
      setExchanges(getFixedA0Exercises(activeWords));
      setPhase("exercise");
      return;
    }

    try {
      const response = await fetch("/api/learn-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(4_000),
        body: JSON.stringify({
          messages: [{ role: "user", content: "Generate the exercises." }],
          mode: "exercise",
          islandLevel: island.level,
          islandTopic: island.topic,
          words: activeWords.map((w) => ({
            hanzi: w.hanzi,
            pinyin: w.pinyin,
            english: w.english,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load conversation");
      }

      const data = await response.json();
      const text = (data.message as string) ?? "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean) as {
        opener?: string;
        exchanges?: unknown[];
      };

      const wordByHanzi = new Map(
        activeWords.map((w) => [w.hanzi, w] as const),
      );

      const rawExchanges = parsed.exchanges ?? [];
      const validRaw = rawExchanges.filter(isValidExchange);

      if (validRaw.length < rawExchanges.length) {
        console.warn("Some exchanges failed validation and were filtered out");
      }

      const normalized = validRaw
        .map((ex) => normalizeExchange(ex, wordByHanzi))
        .filter((ex): ex is ExchangeData => ex !== null);

      if (normalized.length === 0) {
        console.warn("AI exercises were invalid; using local fallback.");
        setOpenerText("Let's practice your new words!");
        setExchanges(getQuickFallbackExercises(activeWords));
        setPhase("exercise");
        return;
      }

      setOpenerText(parsed.opener ?? "");
      setExchanges(normalized.slice(0, 3));
      setPhase("exercise");
    } catch (e) {
      console.error("ExerciseChat fetch error:", e);
      setOpenerText("Let's practice your new words!");
      setExchanges(getQuickFallbackExercises(activeWords));
      setPhase("exercise");
    }
  }, [island.id, island.topic, island.level, fetchSessionKey]);

  const loadedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedSessionRef.current === fetchSessionKey) return;
    loadedSessionRef.current = fetchSessionKey;
    void fetchExercises();
  }, [fetchSessionKey, fetchExercises]);

  const fetchEnglish = useCallback(async (text: string) => {
    if (!hasChinese(text)) return;

    setEnglishCache((prev) => {
      if (prev[text]?.english || prev[text]?.loading) return prev;
      return { ...prev, [text]: { loading: true } };
    });

    try {
      const res = await fetch("/api/story/english", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed to translate");
      const data = await res.json();
      setEnglishCache((prev) => ({
        ...prev,
        [text]: { english: data.english || "", loading: false },
      }));
    } catch (err) {
      console.error(err);
      setEnglishCache((prev) => ({
        ...prev,
        [text]: { english: "Translation unavailable", loading: false },
      }));
    }
  }, []);

  const getReplyDisplayHanzi = useCallback(
    (exchange: ExchangeData) => {
      if (selected) {
        return fillReplyTemplate(exchange.replyHanzi, selected.hanzi);
      }
      return exchange.replyHanzi.replace("___", "…");
    },
    [selected],
  );

  const visibleChineseTexts = useMemo(() => {
    const texts: string[] = [];
    if (openerText && hasChinese(openerText)) texts.push(openerText);

    for (const turn of completedTurns) {
      if (hasChinese(turn.huahuaHanzi)) texts.push(turn.huahuaHanzi);
      if (hasChinese(turn.userHanzi)) texts.push(turn.userHanzi);
      if (hasChinese(turn.feedbackText)) texts.push(turn.feedbackText);
    }

    const exchange = exchanges[currentIndex];
    if (exchange && phase !== "done") {
      if (hasChinese(exchange.huahuaHanzi)) texts.push(exchange.huahuaHanzi);
      const replyHanzi = getReplyDisplayHanzi(exchange);
      if (hasChinese(replyHanzi)) texts.push(replyHanzi);
      if (phase === "feedback" && feedbackText && hasChinese(feedbackText)) {
        texts.push(feedbackText);
      }
    }

    return Array.from(new Set(texts));
  }, [
    openerText,
    completedTurns,
    exchanges,
    currentIndex,
    phase,
    feedbackText,
    getReplyDisplayHanzi,
  ]);

  useEffect(() => {
    // Fixed A0 copy has local translations, so never make translation API calls.
    if (!showEnglish || isA0) return;
    for (const text of visibleChineseTexts) {
      void fetchEnglish(text);
    }
  }, [showEnglish, isA0, visibleChineseTexts, fetchEnglish]);

  const getEnglishEntry = useCallback(
    (text: string) =>
      isA0 && A0_FIXED_ENGLISH[text]
        ? { english: A0_FIXED_ENGLISH[text] }
        : englishCache[text] ?? {},
    [englishCache, isA0],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [phase, currentIndex, selected, feedbackText, completedTurns.length, showPinyin, showEnglish]);

  const buildCompletedTurn = (): CompletedTurn | null => {
    const exchange = exchanges[currentIndex];
    if (!exchange || !selected || !feedbackText) return null;
    return {
      huahuaHanzi: exchange.huahuaHanzi,
      huahuaPinyin: exchange.huahuaPinyin,
      userHanzi: fillReplyTemplate(exchange.replyHanzi, selected.hanzi),
      userPinyin: fillReplyTemplate(exchange.replyPinyin, selected.pinyin),
      feedbackText,
    };
  };

  const handleCheck = () => {
    if (!selected || phase !== "exercise" || !exchanges[currentIndex]) return;
    const isCorrect = selected.hanzi === exchanges[currentIndex].correctHanzi;
    if (isCorrect) setScore((s) => s + 1);
    const encouragements = ["Great job!", "Well done!", "You got it!", "Keep it up!"];
    const rand = encouragements[Math.floor(Math.random() * encouragements.length)];
    setFeedbackText(
      isCorrect
        ? `正确！(Correct!) 🎉 ${rand}`
        : `不对。(Not quite!) The answer is ${exchanges[currentIndex].correctHanzi} (${exchanges[currentIndex].correctPinyin}). Keep going!`,
    );
    setPhase("feedback");
  };

  const handleNext = () => {
    const turn = buildCompletedTurn();
    if (turn) {
      setCompletedTurns((prev) => [...prev, turn]);
    }

    if (currentIndex < exchanges.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelected(null);
      setFeedbackText("");
      setPhase("exercise");
    } else {
      setPhase("done");
    }
  };

  if (phase === "loading") {
    return (
      <ExerciseChatShell isDesktop={isDesktop} fillContainer={fillContainer}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: isDesktop ? 0 : 32,
            minHeight: isDesktop ? 120 : undefined,
          }}
        >
          <Avatar />
          <span style={{ fontSize: 14, color: "#5A7A90" }}>
            华华 is getting ready...
          </span>
        </div>
      </ExerciseChatShell>
    );
  }

  const currentExchange = exchanges[currentIndex];
  const showCurrentExchange = !!currentExchange && phase !== "done";

  return (
    <ExerciseChatShell isDesktop={isDesktop} fillContainer={fillContainer}>
        {onBack ? (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <SecondaryButton size="compact" onClick={onBack}>
              ← Back
            </SecondaryButton>
          </div>
        ) : null}
        {isA0 ? null : (
          <DisplayToggles
            showPinyin={showPinyin}
            showEnglish={showEnglish}
            onTogglePinyin={() => setShowPinyin((v) => !v)}
            onToggleEnglish={() => setShowEnglish((v) => !v)}
          />
        )}

        {openerText ? (
          <HuahuaBubble
            hanzi={openerText}
            showPinyin={showPinyin}
            showEnglish={isA0 ? true : showEnglish}
            english={getEnglishEntry(openerText).english}
            englishLoading={getEnglishEntry(openerText).loading}
            convertText={convertText}
            isA0={isA0}
          />
        ) : null}

        {completedTurns.map((turn, i) => (
          <CompletedTurnBlock
            key={`turn-${i}`}
            turn={turn}
            showPinyin={showPinyin}
            showEnglish={isA0 ? true : showEnglish}
            getEnglishEntry={getEnglishEntry}
            convertText={convertText}
            isA0={isA0}
          />
        ))}

        {showCurrentExchange ? (
          <HuahuaBubble
            hanzi={currentExchange.huahuaHanzi}
            pinyin={currentExchange.huahuaPinyin}
            showPinyin={showPinyin}
            showEnglish={isA0 ? true : showEnglish}
            english={getEnglishEntry(currentExchange.huahuaHanzi).english}
            englishLoading={
              getEnglishEntry(currentExchange.huahuaHanzi).loading
            }
            convertText={convertText}
            isA0={isA0}
          />
        ) : null}

        {showCurrentExchange ? (
          <UserReplyBubble
            replyHanzi={currentExchange.replyHanzi}
            replyPinyin={currentExchange.replyPinyin}
            filledHanzi={selected?.hanzi}
            filledPinyin={selected?.pinyin}
            showPinyin={showPinyin}
            showEnglish={isA0 ? true : showEnglish}
            english={
              getEnglishEntry(getReplyDisplayHanzi(currentExchange)).english
            }
            englishLoading={
              getEnglishEntry(getReplyDisplayHanzi(currentExchange)).loading
            }
            convertText={convertText}
            isA0={isA0}
          />
        ) : null}

        {showCurrentExchange && phase === "exercise" ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            {currentExchange.options.map((opt) => {
              const isSelected = selected?.hanzi === opt.hanzi;
              const optEnglish =
                words.find((w) => w.hanzi === opt.hanzi)?.english ?? "";
              return (
                <button
                  key={opt.hanzi}
                  type="button"
                  onClick={() => setSelected(opt)}
                  style={{
                    padding: isA0 ? "8px 12px" : "8px 16px",
                    borderRadius: 20,
                    border: `1px solid ${isSelected ? "transparent" : LINGO_ACCENT_BORDER}`,
                    background: isSelected
                      ? LINGO_ACCENT_GRADIENT_GLOSSY
                      : "#fff",
                    color: isSelected ? "#fff" : "var(--lingo-navy)",
                    fontSize: 14,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    boxShadow: isSelected ? HSK_CARD_SHADOW : undefined,
                    display: isA0 ? "flex" : undefined,
                    flexDirection: isA0 ? "column" : undefined,
                    alignItems: isA0 ? "center" : undefined,
                    gap: isA0 ? 2 : undefined,
                  }}
                >
                  {isA0 ? (
                    <>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 16,
                          color: isSelected ? "#fff" : "#2176AE",
                          fontFamily: "'DM Sans', system-ui, sans-serif",
                        }}
                      >
                        {opt.pinyin}
                      </span>
                      <span
                        style={{
                          fontWeight: 500,
                          fontSize: 14,
                          fontFamily: "'Lora', Georgia, serif",
                        }}
                      >
                        {convertText(opt.hanzi)}
                      </span>
                      {optEnglish ? (
                        <span
                          style={{
                            color: isSelected
                              ? "rgba(255,255,255,0.8)"
                              : "#8AABBF",
                            fontSize: 11,
                          }}
                        >
                          {optEnglish}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span
                        style={{
                          fontWeight: 500,
                          fontFamily: "'Lora', Georgia, serif",
                        }}
                      >
                        {convertText(opt.hanzi)}
                      </span>
                      {showPinyin ? (
                        <span
                          style={{
                            color: isSelected
                              ? "rgba(255,255,255,0.8)"
                              : "#5A7A90",
                            fontSize: 12,
                            marginLeft: 6,
                          }}
                        >
                          {opt.pinyin}
                        </span>
                      ) : null}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}

        {selected && phase === "exercise" ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <PrimaryButton size="compact" onClick={handleCheck}>
              Check →
            </PrimaryButton>
          </div>
        ) : null}

        {showCurrentExchange && phase === "feedback" && feedbackText ? (
          <HuahuaBubble
            hanzi={feedbackText}
            showPinyin={showPinyin}
            showEnglish={isA0 ? true : showEnglish}
            english={getEnglishEntry(feedbackText).english}
            englishLoading={getEnglishEntry(feedbackText).loading}
            convertText={convertText}
            isA0={isA0}
          />
        ) : null}

        {showCurrentExchange && phase === "feedback" ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <SecondaryButton size="compact" onClick={handleNext}>
              {currentIndex < exchanges.length - 1 ? "Next →" : "See results →"}
            </SecondaryButton>
          </div>
        ) : null}

        {phase === "done" ? (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              marginBottom: 16,
            }}
          >
            <Avatar />
            <div
              style={{
                background: "#fff",
                border: "0.5px solid #C2DCF0",
                borderRadius: "0 12px 12px 12px",
                padding: "16px 20px",
                maxWidth: "75%",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>🦫</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#071E2E",
                  marginBottom: 4,
                }}
              >
                好极了！(Amazing!)
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#5A7A90",
                  marginBottom: 16,
                }}
              >
                You got {score} out of {exchanges.length} correct. 华华 is proud
                of you!
              </div>
              <PrimaryButton className="w-full" onClick={onComplete}>
                Finish practice →
              </PrimaryButton>
            </div>
          </div>
        ) : null}

        <div ref={chatEndRef} />
    </ExerciseChatShell>
  );
}
