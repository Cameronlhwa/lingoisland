"use client";

import { useMemo, useState } from "react";
import LearnSlideshow from "./LearnSlideshow";
import LearnDragDrop from "./LearnDragDrop";
import LearnChat from "./LearnChat";
import type { LearnIsland, LearnStep, LearnWord } from "./types";
import { pickLearnWords } from "./types";
import { useLearnLevel } from "./useLearnLevel";

export { learnSequenceKey } from "./types";

interface LearnSequenceProps {
  island: LearnIsland;
  words: LearnWord[];
  userCefrLevel?: string | null;
  onComplete: () => void;
}

const STEP_ORDER: LearnStep[] = ["slideshow", "dragdrop", "chat"];

const STEP_LABELS: Record<LearnStep, string> = {
  slideshow: "Learn",
  dragdrop: "Match",
  chat: "Practice",
};

export default function LearnSequence({
  island,
  words,
  userCefrLevel,
  onComplete,
}: LearnSequenceProps) {
  const [step, setStep] = useState<LearnStep>("slideshow");
  const learnLevel = useLearnLevel(island, userCefrLevel);

  const learnWords = useMemo(() => pickLearnWords(words, 5), [words]);
  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: "#D6EEF8" }}
    >
      <header className="sticky top-0 z-10 border-b border-[#2176AE]/15 bg-[#D6EEF8]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div>
            <p
              className="text-xs font-medium uppercase tracking-wider text-[#071E2E]/50"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              Getting started
            </p>
            <p
              className="text-sm font-semibold text-[#071E2E]"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              Step {stepIndex + 1} of 3 — {STEP_LABELS[step]}
            </p>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="text-xs text-[#071E2E]/45 underline-offset-2 hover:text-[#071E2E]/70 hover:underline"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Skip for now
          </button>
        </div>
        <div className="mx-auto flex max-w-3xl gap-1.5 px-6 pb-3">
          {STEP_ORDER.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? "bg-[#2176AE]" : "bg-[#2176AE]/20"
              }`}
            />
          ))}
        </div>
      </header>

      {step === "slideshow" && (
        <LearnSlideshow
          key={learnLevel}
          words={learnWords}
          island={island}
          learnLevel={learnLevel}
          onComplete={() => setStep("dragdrop")}
          onSkip={onComplete}
        />
      )}
      {step === "dragdrop" && (
        <LearnDragDrop
          words={learnWords}
          level={island.level}
          onComplete={() => setStep("chat")}
        />
      )}
      {step === "chat" && userCefrLevel !== undefined && (
        <LearnChat
          key={`chat-${learnLevel}`}
          words={learnWords}
          allIslandWords={words}
          island={island}
          learnLevel={learnLevel}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}
