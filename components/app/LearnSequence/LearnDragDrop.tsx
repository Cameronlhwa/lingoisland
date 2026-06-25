"use client";

import { useEffect, useMemo, useState } from "react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import type { LearnWord } from "./types";

interface LearnDragDropProps {
  words: LearnWord[];
  onComplete: () => void;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function LearnDragDrop({ words, onComplete }: LearnDragDropProps) {
  const { convertText } = useCharacterSet();
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
      <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6">
        <p
          className="text-2xl font-semibold text-[#071E2E]"
          style={{ fontFamily: "'Lora', Georgia, serif" }}
        >
          Perfect! 🎉
        </p>
        <button
          type="button"
          onClick={onComplete}
          className="mt-8 rounded-lg bg-[#2176AE] px-8 py-3 text-sm font-semibold text-white"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          Continue →
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h2
        className="mb-2 text-center text-xl font-semibold text-[#071E2E]"
        style={{ fontFamily: "'Lora', Georgia, serif" }}
      >
        Match the pairs
      </h2>
      <p
        className="mb-8 text-center text-sm text-[#071E2E]/60"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {useTapMode
          ? "Tap an English word, then tap a Chinese slot. Tap a matched word to undo."
          : "Drag English words to match their Chinese translations. Drag back to change your guess."}
      </p>

      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-3">
          <h3
            className="mb-3 text-sm font-semibold text-[#071E2E]/70"
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
                className={`rounded-lg border-2 p-4 transition-all ${
                  isUsed
                    ? useTapMode
                      ? "cursor-pointer border-[#2176AE]/30 bg-white/40 opacity-60 hover:border-[#2176AE]/50"
                      : "border-[#2176AE]/30 bg-white/40 opacity-60"
                    : isSelected || isDragging
                      ? "cursor-grabbing border-[#071E2E] bg-[#071E2E] text-white shadow-lg"
                      : "cursor-grab border-[#2176AE]/20 bg-white hover:border-[#2176AE]/50"
                } ${useTapMode && !isUsed ? "cursor-pointer" : ""} ${
                  !useTapMode && isUsed && !checked ? "cursor-default" : ""
                }`}
                style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
              >
                {word.english}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <h3
            className="mb-3 text-sm font-semibold text-[#071E2E]/70"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Chinese
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
                className={`flex min-h-[56px] items-center justify-between gap-3 rounded-lg border-2 p-4 transition-all ${
                  checked && result === true
                    ? "border-emerald-500 bg-emerald-50"
                    : checked && result === false
                      ? "border-red-400 bg-red-50"
                      : hasMatch
                        ? "border-[#2176AE]/40 border-solid bg-white"
                        : "border-dashed border-[#2176AE]/25 bg-white/50 hover:border-[#2176AE]/40"
                } ${useTapMode && !hasMatch ? "cursor-pointer" : ""}`}
              >
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span
                    className="text-lg font-medium text-[#071E2E]"
                    style={{ fontFamily: "'Lora', Georgia, serif" }}
                  >
                    {convertText(word.hanzi)}
                  </span>
                  <span
                    className="truncate text-sm text-[#071E2E]/50"
                    style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
                  >
                    {word.pinyin}
                  </span>
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
                      className={`text-sm text-[#071E2E]/70 ${
                        !useTapMode && !checked
                          ? "cursor-grab rounded-md border border-[#2176AE]/20 bg-[#D6EEF8]/60 px-2 py-0.5 active:cursor-grabbing"
                          : useTapMode && !checked
                            ? "cursor-pointer rounded-md border border-[#2176AE]/20 bg-[#D6EEF8]/60 px-2 py-0.5"
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

      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleCheck}
          disabled={!allMatched || checked}
          className="rounded-lg bg-[#2176AE] px-8 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          Check answers
        </button>
      </div>
    </div>
  );
}
