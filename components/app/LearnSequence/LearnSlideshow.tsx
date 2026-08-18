"use client";

import { useEffect, useState } from "react";
import ChineseTooltipText from "@/components/app/ChineseTooltipText";
import SpeakerWithSpeed from "@/components/app/SpeakerWithSpeed";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import {
  buildSentenceBreakdown,
  type BreakdownToken,
} from "@/lib/chineseTokenizer";
import { getSentenceForLevel, isBeginnerLearnLevel } from "./levels";
import type { LearnIsland, LearnWord } from "./types";

interface LearnSlideshowProps {
  words: LearnWord[];
  island: LearnIsland;
  learnLevel?: string;
  onComplete: () => void;
  onSkip?: () => void;
}

const PARTICLE_GLOSSES: Record<string, string> = {
  吧: "particle",
  了: "(done)",
  呢: "particle",
  吗: "particle",
  啊: "particle",
  嘛: "particle",
  哦: "particle",
  哇: "particle",
};

function processBreakdownTokens(tokens: BreakdownToken[]): BreakdownToken[] {
  return tokens
    .filter((token) => token.isChinese)
    .map((token) => {
      if (token.isTarget) return token;

      const particleGloss = PARTICLE_GLOSSES[token.hanzi];
      if (particleGloss) {
        return { ...token, english: particleGloss };
      }

      return token;
    });
}

function HighlightedSentence({
  sentenceHanzi,
  targetHanzi,
  className = "",
}: {
  sentenceHanzi: string;
  targetHanzi: string;
  className?: string;
}) {
  const { convertText } = useCharacterSet();
  const displaySentence = convertText(sentenceHanzi);
  const displayTarget = convertText(targetHanzi);
  const idx = displaySentence.indexOf(displayTarget);

  if (idx === -1) {
    return (
      <ChineseTooltipText
        text={displaySentence}
        className={`text-xl font-medium text-[#071E2E] md:text-[26px] ${className}`}
      />
    );
  }

  const before = displaySentence.slice(0, idx);
  const target = displaySentence.slice(idx, idx + displayTarget.length);
  const after = displaySentence.slice(idx + displayTarget.length);

  return (
    <span
      className={`text-xl font-medium text-[#071E2E] md:text-[26px] ${className}`}
      style={{ fontFamily: "'Lora', Georgia, serif" }}
    >
      {before ? (
        <ChineseTooltipText text={before} className="inline" />
      ) : null}
      <span className="font-medium text-[#2176AE]">
        <ChineseTooltipText text={target} className="inline" />
      </span>
      {after ? <ChineseTooltipText text={after} className="inline" /> : null}
    </span>
  );
}

function HighlightedPinyin({
  sentencePinyin,
  targetPinyin,
  isA0 = false,
}: {
  sentencePinyin: string;
  targetPinyin: string;
  isA0?: boolean;
}) {
  const normalizedTarget = targetPinyin.trim();
  const idx = sentencePinyin.indexOf(normalizedTarget);
  const sizeClass = isA0
    ? "text-center text-xl font-semibold text-[#2176AE] md:text-[22px]"
    : "text-center text-sm text-[#5A7A90] md:text-sm";

  if (idx === -1) {
    return (
      <p
        className={sizeClass}
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {sentencePinyin}
      </p>
    );
  }

  const before = sentencePinyin.slice(0, idx);
  const target = sentencePinyin.slice(idx, idx + normalizedTarget.length);
  const after = sentencePinyin.slice(idx + normalizedTarget.length);

  return (
    <p
      className={
        isA0
          ? "text-center text-xl font-semibold text-[#5A7A90] md:text-[22px]"
          : "text-center text-sm text-[#5A7A90]"
      }
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {before}
      <span className="font-semibold text-[#2176AE]">{target}</span>
      {after}
    </p>
  );
}

function BreakdownTable({
  sentenceHanzi,
  target,
  compact,
  isA0 = false,
}: {
  sentenceHanzi: string;
  target: { hanzi: string; pinyin: string; english: string };
  compact?: boolean;
  /** A0: pinyin is the primary reading surface (equal/larger than Hanzi). */
  isA0?: boolean;
}) {
  const { convertText } = useCharacterSet();
  const [tokens, setTokens] = useState<BreakdownToken[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void buildSentenceBreakdown(sentenceHanzi, target).then((rows) => {
      if (!cancelled) setTokens(processBreakdownTokens(rows));
    });
    return () => {
      cancelled = true;
    };
  }, [sentenceHanzi, target]);

  if (!tokens) {
    return (
      <p
        className="text-center text-sm text-[#8AABBF]"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        Loading breakdown…
      </p>
    );
  }

  const cellPadX = compact ? "6px" : "10px";
  const hanziSize = compact ? "18px" : "20px";
  // A0: pinyin ≥ Hanzi; A1+: keep small caption under characters.
  const pinyinSize = isA0
    ? compact
      ? "18px"
      : "20px"
    : compact
      ? "11px"
      : "12px";
  const englishSize = compact ? "10px" : "11px";

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            {tokens.map((token, i) => (
              <td
                key={`hanzi-${token.hanzi}-${i}`}
                style={{
                  textAlign: "center",
                  padding: compact ? "4px 6px 3px" : "6px 10px 4px",
                  verticalAlign: "top",
                  borderRight:
                    i < tokens.length - 1 ? "0.5px solid #E8F3FA" : "none",
                  fontSize: hanziSize,
                  color: token.isTarget ? "#2176AE" : "#071E2E",
                  fontWeight: token.isTarget ? 500 : 400,
                  fontFamily: "'Lora', Georgia, serif",
                }}
              >
                {convertText(token.hanzi)}
              </td>
            ))}
          </tr>
          <tr>
            {tokens.map((token, i) => (
              <td
                key={`pinyin-${token.hanzi}-${i}`}
                style={{
                  textAlign: "center",
                  padding: `0 ${cellPadX} 3px`,
                  borderRight:
                    i < tokens.length - 1 ? "0.5px solid #E8F3FA" : "none",
                  fontSize: pinyinSize,
                  color: token.isTarget ? "#2176AE" : "#5A7A90",
                  fontWeight: token.isTarget ? 500 : 400,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {token.pinyin || "—"}
              </td>
            ))}
          </tr>
          <tr>
            {tokens.map((token, i) => (
              <td
                key={`english-${token.hanzi}-${i}`}
                style={{
                  textAlign: "center",
                  padding: compact ? "0 6px 4px" : "0 10px 6px",
                  borderRight:
                    i < tokens.length - 1 ? "0.5px solid #E8F3FA" : "none",
                  fontSize: englishSize,
                  color: token.isTarget ? "#2176AE" : "#8AABBF",
                  fontWeight: token.isTarget ? 500 : 400,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {token.english || "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function WordSlideContent({
  word,
  beginner,
  compact,
  isA0 = false,
}: {
  word: LearnWord;
  beginner: boolean;
  compact?: boolean;
  isA0?: boolean;
}) {
  const { convertText } = useCharacterSet();
  const hanziSize = compact ? "36px" : "48px";
  // A0: pinyin is primary — equal to Hanzi size; A1+ keep caption hierarchy.
  const pinyinSize = isA0 ? hanziSize : undefined;

  return (
    <div className="text-center">
      {isA0 ? (
        <>
          <div
            className="mb-2 font-semibold text-[#2176AE] md:mb-3"
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: pinyinSize,
            }}
          >
            {word.pinyin}
          </div>
          <div
            className="font-bold text-[#071E2E]"
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: compact ? "28px" : "36px",
              marginBottom: compact ? "12px" : "16px",
            }}
          >
            {convertText(word.hanzi)}
          </div>
        </>
      ) : (
        <>
          <div
            className="font-bold text-[#071E2E]"
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: hanziSize,
              marginBottom: compact ? "12px" : "16px",
            }}
          >
            {convertText(word.hanzi)}
          </div>
          <div
            className={`mb-2 md:mb-3 ${
              beginner
                ? "text-xl font-semibold text-[#2176AE] md:text-[22px]"
                : "text-lg text-[#5A7A90] md:text-lg"
            }`}
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            {word.pinyin}
          </div>
        </>
      )}
      <div
        className="mb-6 text-[15px] text-[#5A7A90] md:mb-8"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {word.english}
      </div>
      <div className="flex justify-center">
        <SpeakerWithSpeed text={word.hanzi} type="word" size="md" />
      </div>
    </div>
  );
}

function BeginnerSentenceContent({
  word,
  sentence,
  compact,
  isA0 = false,
}: {
  word: LearnWord;
  sentence: { hanzi: string; pinyin: string; english: string };
  compact?: boolean;
  isA0?: boolean;
}) {
  return (
    <div className="text-center">
      {isA0 ? (
        <>
          <div className="mt-0">
            <HighlightedPinyin
              sentencePinyin={sentence.pinyin}
              targetPinyin={word.pinyin}
              isA0
            />
          </div>
          <div className="mt-2 flex justify-center">
            <HighlightedSentence
              sentenceHanzi={sentence.hanzi}
              targetHanzi={word.hanzi}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-center">
            <HighlightedSentence
              sentenceHanzi={sentence.hanzi}
              targetHanzi={word.hanzi}
            />
          </div>
          <div className="mt-2">
            <HighlightedPinyin
              sentencePinyin={sentence.pinyin}
              targetPinyin={word.pinyin}
            />
          </div>
        </>
      )}
      <p
        className="mt-1 text-sm text-[#5A7A90]"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {sentence.english}
      </p>
      <div className="mt-4 flex justify-center">
        <SpeakerWithSpeed text={sentence.hanzi} type="sentence" size="md" />
      </div>
      <div
        className="my-5 border-t border-[#E8F3FA] md:my-5"
        style={{ borderTopWidth: "0.5px" }}
      />
      <p
        className="mb-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[#8AABBF]"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        Word by word
      </p>
      <BreakdownTable
        sentenceHanzi={sentence.hanzi}
        target={word}
        compact={compact}
        isA0={isA0}
      />
    </div>
  );
}

function StandardSentenceContent({
  word,
  sentence,
}: {
  word: LearnWord;
  sentence: { hanzi: string; pinyin: string; english: string };
}) {
  return (
    <div className="text-center">
      <div className="flex justify-center">
        <HighlightedSentence
          sentenceHanzi={sentence.hanzi}
          targetHanzi={word.hanzi}
          className="!text-xl md:!text-[20px]"
        />
      </div>
      <p
        className="mt-2 text-[13px] text-[#5A7A90]"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {sentence.pinyin}
      </p>
      <p
        className="mt-1 text-[13px] text-[#5A7A90]"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {sentence.english}
      </p>
      <div className="mt-4 flex justify-center">
        <SpeakerWithSpeed text={sentence.hanzi} type="sentence" size="md" />
      </div>
    </div>
  );
}

function useIsCompact() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return compact;
}

export default function LearnSlideshow({
  words,
  island,
  learnLevel,
  onComplete,
  onSkip,
}: LearnSlideshowProps) {
  const level = learnLevel ?? island.level;
  const isBeginnerLevel = isBeginnerLearnLevel(level);
  const isA0 = level.trim().toUpperCase().startsWith("A0");
  const compact = useIsCompact();
  const [cardIndex, setCardIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);

  const wordIndex = isBeginnerLevel ? Math.floor(slideIndex / 2) : cardIndex;
  const isSentenceSlide = isBeginnerLevel && slideIndex % 2 === 1;
  const slideType = isSentenceSlide ? "sentence" : "word";
  const word = words[wordIndex];
  const sentence = word
    ? getSentenceForLevel(word.sentences, level)
    : undefined;

  const isLastSlide = isBeginnerLevel
    ? slideIndex >= words.length * 2 - 1
    : cardIndex >= words.length - 1;

  const isFirstSlide = isBeginnerLevel ? slideIndex === 0 : cardIndex === 0;

  const handleNext = () => {
    if (isLastSlide) {
      onComplete();
      return;
    }
    if (isBeginnerLevel) {
      setSlideIndex((i) => i + 1);
    } else {
      setCardIndex((i) => i + 1);
    }
  };

  const handleBack = () => {
    if (isFirstSlide) return;
    if (isBeginnerLevel) {
      setSlideIndex((i) => i - 1);
    } else {
      setCardIndex((i) => i - 1);
    }
  };

  if (!word) return null;

  const slideLabel = isBeginnerLevel
    ? `Word ${wordIndex + 1} of ${words.length} — ${slideType === "word" ? "Introduction" : "Sentence"}`
    : `Word ${wordIndex + 1} of ${words.length}`;

  const renderSlideContent = () => {
    if (isBeginnerLevel) {
      if (isSentenceSlide) {
        if (!sentence) {
          return (
            <p
              className="text-center text-sm text-[#8AABBF]"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              Example sentence loading…
            </p>
          );
        }
        return (
          <BeginnerSentenceContent
            word={word}
            sentence={sentence}
            compact={compact}
            isA0={isA0}
          />
        );
      }
      return (
        <WordSlideContent
          word={word}
          beginner
          compact={compact}
          isA0={isA0}
        />
      );
    }

    return (
      <div>
        <WordSlideContent word={word} beginner={false} compact={compact} />
        {sentence ? (
          <div className="mt-8 border-t border-[#E8F3FA] pt-8">
            <StandardSentenceContent word={word} sentence={sentence} />
          </div>
        ) : (
          <p
            className="mt-6 text-center text-sm text-[#8AABBF]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Example sentence loading…
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: "#D6EEF8" }}
    >
      <div
        className="flex items-start justify-between"
        style={{ padding: compact ? "16px 20px 0" : "20px 32px 0" }}
      >
        <div>
          <div
            style={{
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: "11px",
              letterSpacing: "0.08em",
              color: "#2176AE",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Getting started
          </div>
          <div
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontSize: "18px",
              color: "#071E2E",
              marginTop: "2px",
            }}
          >
            Step 1 of 3 — Learn
          </div>
        </div>
        <button
          type="button"
          onClick={onSkip ?? onComplete}
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: "13px",
            color: "#2176AE",
            background: "none",
            border: "none",
            cursor: "pointer",
            paddingTop: "4px",
          }}
        >
          Skip for now
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: compact ? "10px 20px 0" : "12px 32px 0",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: "3px",
              borderRadius: "2px",
              flex: 1,
              background: i === 0 ? "#2176AE" : "#B8D8EC",
            }}
          />
        ))}
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: compact ? "20px 20px 20px" : "24px 32px 32px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            border: "0.5px solid #C2DCF0",
            padding: compact ? "20px" : "32px 36px 28px",
            width: "100%",
            maxWidth: "600px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "6px",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            {words.map((_, i) => (
              <div
                key={i}
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background:
                    i <= wordIndex ? "#2176AE" : "#B8D8EC",
                }}
              />
            ))}
          </div>

          <div
            style={{
              textAlign: "center",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: "12px",
              color: "#2176AE",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "20px",
              fontWeight: 500,
            }}
          >
            {slideLabel}
          </div>

          {renderSlideContent()}

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              marginTop: "24px",
            }}
          >
            {!isFirstSlide ? (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: "#fff",
                  color: "#2176AE",
                  border: "1.5px solid #2176AE",
                  borderRadius: "10px",
                  padding: "12px 32px",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: "15px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                ← Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleNext}
              style={{
                background: "#2176AE",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "12px 40px",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: "15px",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {isLastSlide ? "Start matching →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
