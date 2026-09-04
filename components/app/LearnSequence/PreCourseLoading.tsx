"use client";

import HuahuaAvatar from "@/components/app/HuahuaAvatar";
import { hskLabelForCefr } from "@/lib/levelBands";
import {
  LINGO_ACCENT_CHIP_SHADOW,
  LINGO_ACCENT_GRADIENT_GLOSSY,
} from "@/lib/glossy-theme";
import { LearnEyebrow, LearnSequenceCard } from "./shell";

interface PreCourseLoadingProps {
  topic: string;
  level: string;
  progressLabel: string;
  progressPercentage: number;
}

export default function PreCourseLoading({
  topic,
  level,
  progressLabel,
  progressPercentage,
}: PreCourseLoadingProps) {
  return (
    <div className="hsk-app-theme lingo-body flex min-h-screen flex-col bg-white">
      <header className="border-b border-[var(--lingo-accent-border)]">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <LearnEyebrow>Getting started</LearnEyebrow>
          <h1 className="lingo-display mt-1.5 text-[30px] leading-tight text-[var(--lingo-navy)] sm:text-[34px]">
            Preparing your lesson
          </h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <LearnSequenceCard className="max-w-md text-center">
          <div className="mb-4 flex justify-center">
            <HuahuaAvatar className="h-14 w-14" />
          </div>
          <h2 className="lingo-display mb-2 text-xl text-[var(--lingo-navy)]">
            {topic}
          </h2>
          <p className="mb-6 text-sm text-[var(--lingo-text-muted)]">
            {hskLabelForCefr(level)}
          </p>

          <div className="mb-2 flex justify-between text-xs font-medium text-[var(--lingo-text-muted)]">
            <span>Building your island</span>
            <span>{progressLabel}</span>
          </div>
          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-[var(--lingo-sky)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPercentage}%`,
                background: LINGO_ACCENT_GRADIENT_GLOSSY,
                boxShadow: LINGO_ACCENT_CHIP_SHADOW,
              }}
            />
          </div>

          <p className="text-sm text-[var(--lingo-text-muted)]">
            华华 is picking words and example sentences for you…
          </p>
        </LearnSequenceCard>
      </div>
    </div>
  );
}
