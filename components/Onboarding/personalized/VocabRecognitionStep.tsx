"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import { isCompletelyNew } from "@/lib/onboarding/personalized/flow";
import {
  getVocabWord,
  VOCAB_COUNT_DESKTOP,
  VOCAB_COUNT_MOBILE,
  wordsForScreen,
  type VocabBand,
  type VocabWord,
} from "@/lib/onboarding/personalized/vocabRecognition";
import type { StepProps } from "./stepTypes";
import {
  CARD_BORDER,
  ChipButton,
  GREEN,
  MUTED,
  NAVY,
  PrimaryButton,
  SecondaryButton,
  SKY_PALE,
  StepFrame,
} from "./ui";

function useVocabCount() {
  const [count, setCount] = useState(VOCAB_COUNT_DESKTOP);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const sync = () => setCount(query.matches ? VOCAB_COUNT_MOBILE : VOCAB_COUNT_DESKTOP);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return count;
}

function WordChip({
  word,
  selected,
  onToggle,
}: {
  word: VocabWord;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      data-testid={`vocab-word-${word.id}`}
      lang="zh-CN"
      className="flex min-h-[64px] w-full flex-col items-center justify-center rounded-2xl px-2 py-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        border: `1px solid ${selected ? GREEN : CARD_BORDER}`,
        boxShadow: selected ? `inset 0 0 0 1px ${GREEN}` : undefined,
        background: selected ? "rgba(32,103,79,0.08)" : "#fff",
        outlineColor: GREEN,
      }}
    >
      <span className="text-[20px] font-semibold leading-none" style={{ color: NAVY }}>
        {word.hanzi}
      </span>
      <span className="mt-1 text-[12px]" style={{ color: MUTED }}>
        {word.pinyin}
      </span>
    </button>
  );
}

export function VocabRecognitionStep({
  band,
  state,
  update,
  next,
  back,
  progress,
  track,
}: StepProps & { band: VocabBand }) {
  const existing = band === "basic" ? state.answers.vocabBasic : state.answers.vocabAdvanced;
  const count = useVocabCount();
  const seed = `${state.answers.goal.primary ?? "x"}:${state.answers.interests.keys.join(",")}:${band}:${count}`;
  const words = useMemo(() => {
    const fresh = wordsForScreen(band, state.answers.goal.primary, state.answers.interests.keys, seed, count);
    if (existing.shownIds.length === 0) return fresh;
    const restored = existing.shownIds
      .map((id) => getVocabWord(id))
      .filter((word): word is VocabWord => Boolean(word));
    if (restored.length === count) return restored;
    // Viewport changed or an older save had a different size: keep known picks, then fill.
    const seen = new Set(restored.map((word) => word.id));
    const filled = [...restored];
    for (const word of fresh) {
      if (filled.length >= count) break;
      if (!seen.has(word.id)) {
        seen.add(word.id);
        filled.push(word);
      }
    }
    return filled.slice(0, count);
  }, [band, count, existing.shownIds, seed, state.answers.goal.primary, state.answers.interests.keys]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(existing.selectedIds));
  const [noneKnown, setNoneKnown] = useState(existing.noneKnown);
  const persistedKeyRef = useRef("");
  const beginner = isCompletelyNew(state.answers);
  const shownKey = words.map((word) => word.id).join(",");

  useEffect(() => {
    if (persistedKeyRef.current === shownKey) return;
    const isFirstView = persistedKeyRef.current === "";
    persistedKeyRef.current = shownKey;
    if (isFirstView) {
      track(band === "basic" ? ONBOARDING_EVENTS.vocabBasicViewed : ONBOARDING_EVENTS.vocabAdvancedViewed, {
        word_count: words.length,
      });
    }
    const selectedIds = Array.from(selected).filter((id) => words.some((word) => word.id === id));
    setSelected(new Set(selectedIds));
    const screen = {
      shownIds: words.map((word) => word.id),
      selectedIds: noneKnown ? [] : selectedIds,
      noneKnown,
      skipped: false,
    };
    update(band === "basic" ? { vocabBasic: screen } : { vocabAdvanced: screen });
    // Persist the visible set when count/viewport settles; selection state is owned locally until Continue.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the shown word set changes
  }, [band, shownKey, track, update, words]);

  const toggle = (id: string) => {
    setNoneKnown(false);
    setSelected((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  };

  const selectAll = () => {
    setNoneKnown(false);
    setSelected(new Set(words.map((word) => word.id)));
  };

  const clearAll = () => {
    setSelected(new Set());
    setNoneKnown(false);
  };

  const markNone = () => {
    setSelected(new Set());
    setNoneKnown(true);
  };

  const persistAndNext = (screen: { shownIds: string[]; selectedIds: string[]; noneKnown: boolean; skipped?: boolean }) => {
    track(band === "basic" ? ONBOARDING_EVENTS.vocabBasicCompleted : ONBOARDING_EVENTS.vocabAdvancedCompleted, {
      selected_count: screen.selectedIds.length,
      none_known: screen.noneKnown,
      skipped: Boolean(screen.skipped),
    });
    next(band === "basic" ? { vocabBasic: screen } : { vocabAdvanced: { ...screen, skipped: Boolean(screen.skipped) } });
  };

  const continueEnabled = noneKnown || selected.size > 0;

  return (
    <StepFrame
      title={band === "basic" ? "Which of these words do you recognize?" : "What about these more advanced words?"}
      subtitle="Select words whose meaning you know, even if you’re not confident saying them. This is only an estimate of word familiarity."
      progress={progress}
      onBack={back}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <ChipButton selected={false} onToggle={selectAll} testId="vocab-select-all">
          Select all
        </ChipButton>
        <ChipButton selected={false} onToggle={clearAll} testId="vocab-clear-all">
          Clear all
        </ChipButton>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="group" aria-label="Vocabulary words" data-testid="vocab-grid" data-count={words.length}>
        {words.map((word) => (
          <WordChip key={word.id} word={word} selected={!noneKnown && selected.has(word.id)} onToggle={() => toggle(word.id)} />
        ))}
      </div>

      <button
        type="button"
        aria-pressed={noneKnown}
        data-testid="vocab-none-known"
        onClick={markNone}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-2xl px-4 text-[15px] font-semibold"
        style={{
          border: `1px solid ${noneKnown ? GREEN : CARD_BORDER}`,
          background: noneKnown ? "rgba(32,103,79,0.08)" : SKY_PALE,
          color: NAVY,
        }}
      >
        I don’t know any yet
      </button>

      {band === "advanced" && beginner ? (
        <SecondaryButton
          className="mt-3"
          data-testid="vocab-skip-new"
          onClick={() =>
            persistAndNext({
              shownIds: words.map((word) => word.id),
              selectedIds: [],
              noneKnown: true,
              skipped: true,
            })
          }
        >
          Skip — I’m completely new
        </SecondaryButton>
      ) : null}

      <PrimaryButton
        className="mt-6"
        disabled={!continueEnabled}
        data-testid="vocab-continue"
        onClick={() =>
          persistAndNext({
            shownIds: words.map((word) => word.id),
            selectedIds: noneKnown ? [] : Array.from(selected),
            noneKnown,
          })
        }
      >
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}
