"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PrimaryButton from "@/components/landing/PrimaryButton";
import SecondaryButton from "@/components/landing/SecondaryButton";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import {
  HSK_CARD_SHADOW,
  LINGO_ACCENT_BORDER,
} from "@/lib/glossy-theme";
import { LearnSequenceCard } from "./shell";
import { recordTopicIslandQuizActivity } from "@/lib/recordTopicIslandQuizActivity";
import type { LearnWord } from "./types";

interface LearnDragDropProps {
  words: LearnWord[];
  onComplete: () => void;
  onBack?: () => void;
  /** Island CEFR level — A0 shows Pinyin targets instead of Hanzi */
  level?: string;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function LearnDragDrop({
  words,
  onComplete,
  onBack,
  level,
}: LearnDragDropProps) {
  const { convertText } = useCharacterSet();
  const isA0 = (level ?? "").trim().toUpperCase().startsWith("A0");
  const [shuffledEnglish, setShuffledEnglish] = useState<LearnWord[]>([]);
  const [dropMatches, setDropMatches] = useState<Record<string, string>>({});
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [selectedEnglishWord, setSelectedEnglishWord] = useState<string | null>(
    null,
  );
  const [useTapMode, setUseTapMode] = useState(false);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const recordedProgressRef = useRef(false);

  useEffect(() => {
    setShuffledEnglish(shuffleArray([...words]));
  }, [words]);

  useEffect(() => {
    const touch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    setUseTapMode(!!(touch || coarse));
  }, []);

  const allMatched = useMemo(
    () => words.every((w) => !!dropMatches[w.hanzi]),
    [words, dropMatches],
  );

  const clearMatchForEnglish = (english: string) => {
    setDropMatches((prev) => {
      const next = { ...prev };
      for (const [hanzi, eng] of Object.entries(next)) {
        if (eng === english) delete next[hanzi];
      }
      return next;
    });
  };

  const assignMatch = (hanzi: string, english: string) => {
    setDropMatches((prev) => {
      const next = { ...prev };
      for (const [h, eng] of Object.entries(next)) {
        if (eng === english) delete next[h];
      }
      next[hanzi] = english;
      return next;
    });
  };

  const handleCheck = () => {
    const newResults: Record<string, boolean> = {};
    let allCorrect = true;

    for (const word of words) {
      const correct = dropMatches[word.hanzi] === word.english;
      newResults[word.hanzi] = correct;
      if (!correct) allCorrect = false;
    }

    setResults(newResults);
    setChecked(true);

    if (allCorrect) {
      if (!recordedProgressRef.current) {
        recordedProgressRef.current = true;
        void recordTopicIslandQuizActivity(words.length);
      }
      setShowSuccess(true);
      setTimeout(() => onComplete(), 1500);
    } else {
      setTimeout(() => {
        setDropMatches((prev) => {
          const next = { ...prev };
          for (const word of words) {
            if (newResults[word.hanzi] === false) {
              delete next[word.hanzi];
            }
          }
          return next;
        });
        setResults({});
        setChecked(false);
      }, 1500);
    }
  };

  if (showSuccess) {
    return (
      <div className="flex justify-center">
        <LearnSequenceCard className="max-w-md text-center">
          <p className="lingo-display text-2xl text-[var(--lingo-navy)]">
            Perfect! 🎉
          </p>
          <PrimaryButton className="mt-8 w-full" onClick={onComplete}>
            Continue →
          </PrimaryButton>
        </LearnSequenceCard>
      </div>
    );
  }

  return (
    <LearnSequenceCard>
      <h2 className="lingo-display mb-2 text-center text-xl text-[var(--lingo-navy)] sm:text-2xl">
        Match the pairs
      </h2>
      <p
        className="mb-8 text-center text-sm"
        style={{ color: "var(--lingo-text-muted)" }}
      >
        {useTapMode
          ? isA0
            ? "Tap an English word, then tap a Pinyin slot. Tap a matched word to undo."
            : "Tap an English word, then tap a Chinese slot. Tap a matched word to undo."
          : isA0
            ? "Drag English words to match their Pinyin. Drag back to change your guess."
            : "Drag English words to match their Chinese translations. Drag back to change your guess."}
      </p>

      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <h3
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            English
          </h3>
          {shuffledEnglish.map((word) => {
            const isUsed = Object.values(dropMatches).includes(word.english);
            const isSelected =
              useTapMode && selectedEnglishWord === word.english;
            const isDragging = !useTapMode && draggedItem === word.english;

            return (
              <div
                key={`en-${word.id}`}
                draggable={!useTapMode && !isUsed && !checked}
                onDragStart={() => !isUsed && setDraggedItem(word.english)}
                onDragEnd={() => setDraggedItem(null)}
                onDragOver={(e) => {
                  if (!useTapMode && isUsed && !checked) e.preventDefault();
                }}
                onDrop={() => {
                  if (!useTapMode && isUsed && draggedItem === word.english) {
                    clearMatchForEnglish(word.english);
                    setDraggedItem(null);
                  }
                }}
                onClick={() => {
                  if (!useTapMode || checked) return;
                  if (isUsed) {
                    clearMatchForEnglish(word.english);
                    return;
                  }
                  setSelectedEnglishWord((prev) =>
                    prev === word.english ? null : word.english,
                  );
                }}
                className={`rounded-2xl border p-4 transition-all ${
                  isUsed
                    ? useTapMode
                      ? "cursor-pointer bg-white/40 opacity-60 hover:opacity-80"
                      : "bg-white/40 opacity-60"
                    : isSelected || isDragging
                      ? "cursor-grabbing text-white"
                      : "cursor-grab bg-white hover:-translate-y-0.5"
                } ${useTapMode && !isUsed ? "cursor-pointer" : ""} ${
                  !useTapMode && isUsed && !checked ? "cursor-default" : ""
                }`}
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  borderColor:
                    isSelected || isDragging
                      ? "transparent"
                      : LINGO_ACCENT_BORDER,
                  background:
                    isSelected || isDragging
                      ? "linear-gradient(180deg, #163F55 0%, #0B2B3C 100%)"
                      : undefined,
                  boxShadow:
                    isSelected || isDragging
                      ? HSK_CARD_SHADOW
                      : isUsed
                        ? undefined
                        : HSK_CARD_SHADOW,
                }}
              >
                {word.english}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <h3
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            {isA0 ? "Pinyin" : "Chinese"}
          </h3>
          {words.map((word) => {
            const hasMatch = !!dropMatches[word.hanzi];
            const result = checked ? results[word.hanzi] : undefined;

            return (
              <div
                key={`zh-${word.id}`}
                onDragOver={(e) => !useTapMode && !checked && e.preventDefault()}
                onDrop={() => {
                  if (!useTapMode && !checked && draggedItem) {
                    assignMatch(word.hanzi, draggedItem);
                    setDraggedItem(null);
                  }
                }}
                onClick={() => {
                  if (checked) return;
                  if (useTapMode && selectedEnglishWord) {
                    assignMatch(word.hanzi, selectedEnglishWord);
                    setSelectedEnglishWord(null);
                  }
                }}
                className={`flex min-h-[56px] items-center justify-between gap-3 rounded-2xl border p-4 transition-all ${
                  checked && result === true
                    ? "border-emerald-500 bg-emerald-50"
                    : checked && result === false
                      ? "border-red-400 bg-red-50"
                      : hasMatch
                        ? "border-solid bg-white"
                        : "border-dashed bg-white/70"
                } ${useTapMode && !hasMatch ? "cursor-pointer" : ""}`}
                style={{
                  borderColor:
                    checked && result === true
                      ? undefined
                      : checked && result === false
                        ? undefined
                        : LINGO_ACCENT_BORDER,
                  boxShadow: hasMatch && !checked ? HSK_CARD_SHADOW : undefined,
                }}
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  {isA0 ? (
                    <span
                      className="text-2xl font-semibold text-[var(--lingo-blue)] md:text-[28px]"
                      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
                    >
                      {word.pinyin}
                    </span>
                  ) : (
                    <>
                      <span
                        className="lingo-display text-lg font-medium text-[var(--lingo-navy)]"
                      >
                        {convertText(word.hanzi)}
                      </span>
                      <span
                        className="truncate text-sm text-[var(--lingo-text-muted)]"
                        style={{
                          fontFamily: "'DM Sans', system-ui, sans-serif",
                        }}
                      >
                        {word.pinyin}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {hasMatch && (
                    <span
                      draggable={!useTapMode && !checked}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggedItem(dropMatches[word.hanzi]);
                      }}
                      onDragEnd={() => setDraggedItem(null)}
                      onClick={(e) => {
                        if (useTapMode && !checked) {
                          e.stopPropagation();
                          clearMatchForEnglish(dropMatches[word.hanzi]);
                        }
                      }}
                      className={`text-sm text-[var(--lingo-text-muted)] ${
                        !useTapMode && !checked
                          ? "cursor-grab rounded-full border border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)] px-2 py-0.5 active:cursor-grabbing"
                          : useTapMode && !checked
                            ? "cursor-pointer rounded-full border border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)] px-2 py-0.5"
                            : ""
                      }`}
                      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
                    >
                      {dropMatches[word.hanzi]}
                    </span>
                  )}
                  {checked && result === true && (
                    <span className="text-emerald-600">✓</span>
                  )}
                  {checked && result === false && (
                    <span className="text-red-500">✗</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {onBack ? (
          <SecondaryButton onClick={onBack}>← Back</SecondaryButton>
        ) : null}
        <PrimaryButton
          onClick={handleCheck}
          disabled={!allMatched || checked}
        >
          Check answers
        </PrimaryButton>
      </div>
      </LearnSequenceCard>
  );
}
