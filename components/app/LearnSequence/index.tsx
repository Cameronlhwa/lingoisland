"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import LearnSlideshow from "./LearnSlideshow";
import LearnDragDrop from "./LearnDragDrop";
import LearnChat from "./LearnChat";
import { GlossyProgressBar, LearnEyebrow } from "./shell";
import type { LearnIsland, LearnStep, LearnWord } from "./types";
import { pickLearnWords } from "./types";
import { useLearnLevel } from "./useLearnLevel";
import { useLanguage } from "@/contexts/LanguageContext";

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
  const { t } = useLanguage();
  const [step, setStep] = useState<LearnStep>("slideshow");
  const [mounted, setMounted] = useState(false);
  const learnLevel = useLearnLevel(island, userCefrLevel);

  const learnWords = useMemo(() => pickLearnWords(words, 5), [words]);
  const stepIndex = STEP_ORDER.indexOf(step);

  useEffect(() => {
    setMounted(true);
  }, []);

  const overlay = (
    <div
      className="hsk-app-theme lingo-body fixed inset-0 z-[100] flex flex-col bg-white"
      style={{ backgroundColor: "#fff" }}
    >
      <header className="shrink-0 border-b border-[var(--lingo-accent-border)] bg-white">
        <div className="mx-auto flex max-w-3xl items-end justify-between gap-4 px-4 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6">
          <div>
            <LearnEyebrow>{t("Getting started")}</LearnEyebrow>
            <h1 className="lingo-display mt-1.5 text-[30px] leading-tight text-[var(--lingo-navy)] sm:text-[34px]">
              {t("Step")} {stepIndex + 1} {t("of")} 3 — {t(STEP_LABELS[step])}
            </h1>
          </div>
          <button
            type="button"
            onClick={onComplete}
            className="mb-1 shrink-0 text-sm font-bold text-[var(--lingo-blue)] underline-offset-2 hover:text-[var(--lingo-navy)] hover:underline"
          >
            {t("Skip for now")}
          </button>
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
          <GlossyProgressBar active={stepIndex} total={STEP_ORDER.length} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
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
            onBack={() => setStep("slideshow")}
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
            onBack={() => setStep("dragdrop")}
          />
        )}
      </div>
      </div>
    </div>
  );

  if (!mounted) {
    return <div className="min-h-[100dvh] w-full bg-white" style={{ backgroundColor: "#fff" }} />;
  }
  return createPortal(overlay, document.body);
}
