"use client";

import { useState } from "react";
import ChineseTooltipText from "@/components/app/ChineseTooltipText";
import SpeakerButton from "@/components/app/SpeakerButton";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import type { LearnIsland, LearnWord } from "./types";
import { pickExampleSentence } from "./types";

interface LearnSlideshowProps {
  words: LearnWord[];
  island: LearnIsland;
  onComplete: () => void;
}

function HighlightedSentence({
  sentenceHanzi,
  targetHanzi,
}: {
  sentenceHanzi: string;
  targetHanzi: string;
}) {
  const { convertText } = useCharacterSet();
  const displaySentence = convertText(sentenceHanzi);
  const displayTarget = convertText(targetHanzi);
  const idx = displaySentence.indexOf(displayTarget);

  if (idx === -1) {
    return (
      <ChineseTooltipText
        text={displaySentence}
        className="text-lg font-medium text-[#071E2E]"
      />
    );
  }

  const before = displaySentence.slice(0, idx);
  const target = displaySentence.slice(idx, idx + displayTarget.length);
  const after = displaySentence.slice(idx + displayTarget.length);

  return (
    <span className="text-lg font-medium text-[#071E2E]">
      {before ? (
        <ChineseTooltipText text={before} className="inline" />
      ) : null}
      <span className="font-bold text-[#2176AE] underline decoration-[#2176AE]/40 underline-offset-2">
        <ChineseTooltipText text={target} className="inline" />
      </span>
      {after ? <ChineseTooltipText text={after} className="inline" /> : null}
    </span>
  );
}

export default function LearnSlideshow({
  words,
  onComplete,
}: LearnSlideshowProps) {
  const { convertText } = useCharacterSet();
  const [cardIndex, setCardIndex] = useState(0);

  const word = words[cardIndex];
  const sentence = word ? pickExampleSentence(word) : null;
  const isLast = cardIndex === words.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCardIndex((i) => i + 1);
    }
  };

  if (!word) return null;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-8">
      <div className="mb-8 flex gap-2">
        {words.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-2 rounded-full transition-colors ${
              i === cardIndex ? "bg-[#2176AE]" : "bg-[#2176AE]/25"
            }`}
          />
        ))}
      </div>

      <p
        className="mb-10 text-sm text-[#071E2E]/60"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        Word {cardIndex + 1} of {words.length}
      </p>

      <div className="w-full max-w-lg text-center">
        <div
          className="mb-4 text-5xl font-bold text-[#071E2E]"
          style={{ fontFamily: "'Lora', Georgia, serif" }}
        >
          {convertText(word.hanzi)}
        </div>
        <div
          className="mb-2 text-lg text-[#071E2E]/70"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          {word.pinyin}
        </div>
        <div
          className="mb-10 text-base font-medium text-[#2176AE]"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          {word.english}
        </div>

        {sentence ? (
          <div className="rounded-xl border border-[#2176AE]/20 bg-white/60 p-6 text-left">
            <div className="mb-3 flex items-center gap-2">
              <HighlightedSentence
                sentenceHanzi={sentence.hanzi}
                targetHanzi={word.hanzi}
              />
              <SpeakerButton text={sentence.hanzi} type="sentence" size="sm" />
            </div>
            <p
              className="mb-1 text-sm text-[#071E2E]/60"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              {sentence.pinyin}
            </p>
            <p
              className="text-sm text-[#071E2E]/50"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              {sentence.english}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#071E2E]/50">Example sentence loading…</p>
        )}
      </div>

      <button
        type="button"
        onClick={handleNext}
        className="mt-12 rounded-lg bg-[#2176AE] px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {isLast ? "Start Matching →" : "Next →"}
      </button>
    </div>
  );
}
