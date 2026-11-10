"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import {
  ASSESSMENT_LENGTH,
  scoreAssessment,
  selectAssessment,
  type AssessmentAnswer,
} from "@/lib/onboarding/personalized/assessment";
import { claimedLevel, topicFamily } from "@/lib/onboarding/personalized/flow";
import { WRITING_SYSTEMS, type WritingSystem } from "@/lib/onboarding/personalized/huahua";
import { presentQuestion } from "@/lib/onboarding/personalized/presentation";
import type { StepProps } from "./stepTypes";
import { CARD_BORDER, GREEN, MUTED, NAVY, PrimaryButton, SKY_PALE, StepFrame } from "./ui";

function newAttemptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // RFC 4122 v4 fallback for older browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    return (char === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

function WritingToggle({ value, onChange }: { value: WritingSystem; onChange: (value: WritingSystem) => void }) {
  const selected = WRITING_SYSTEMS.find((option) => option.key === value) ?? WRITING_SYSTEMS[0];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span id="writing-toggle-label" className="text-sm font-semibold" style={{ color: NAVY }}>
          Show characters in
        </span>
        <div
          role="group"
          aria-labelledby="writing-toggle-label"
          aria-describedby="writing-toggle-used-in"
          className="inline-flex rounded-full p-1"
          style={{ background: SKY_PALE, border: `1px solid ${CARD_BORDER}` }}
        >
          {WRITING_SYSTEMS.map((option) => {
            const active = value === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(option.key)}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 text-sm font-semibold"
                style={{ background: active ? "#fff" : "transparent", color: active ? GREEN : NAVY, boxShadow: active ? `inset 0 0 0 2px ${GREEN}` : undefined }}
              >
                {active ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
                {option.label.replace(" Chinese", "")}
              </button>
            );
          })}
        </div>
      </div>
      <p id="writing-toggle-used-in" data-testid="writing-used-in" className="mt-1.5 text-xs" style={{ color: MUTED }}>
        {selected.usedIn}
      </p>
    </div>
  );
}

export function CalibrationStep({
  state,
  update,
  next,
  back,
  progress,
  track,
  announce,
}: StepProps) {
  const calibration = state.answers.calibration;
  const started = calibration.items.length === ASSESSMENT_LENGTH;
  const answeredCount = calibration.answers.length;
  const [currentIndex, setCurrentIndex] = useState(() => Math.min(answeredCount, ASSESSMENT_LENGTH - 1));
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);

  const item = started ? calibration.items[currentIndex] : null;
  const question = useMemo(
    () => (item ? presentQuestion(item, calibration.writingSystem) : null),
    [item, calibration.writingSystem],
  );
  const chosen = item ? calibration.answers.find((answer) => answer.position === item.position)?.choiceId ?? null : null;
  const lang = calibration.writingSystem === "traditional" ? "zh-Hant" : "zh-Hans";

  useEffect(() => {
    if (started) questionHeadingRef.current?.focus();
  }, [started, currentIndex]);

  const start = () => {
    const level = claimedLevel(state.answers);
    const attemptId = calibration.attemptId ?? newAttemptId();
    const items = selectAssessment({ claimedLevel: level, topic: topicFamily(state.answers), seed: attemptId });
    update({ calibration: { ...calibration, attemptId, claimedLevel: level, items, answers: [], placement: null } });
    setCurrentIndex(0);
    track(ONBOARDING_EVENTS.calibrationStarted, { claimed_level: level });
  };

  const answer = (choiceId: string) => {
    if (!item) return;
    const response: AssessmentAnswer = { position: item.position, questionId: item.questionId, choiceId };
    const answers = [...calibration.answers.filter((entry) => entry.position !== item.position), response].sort(
      (left, right) => left.position - right.position,
    );
    update({ calibration: { ...calibration, answers } });
    track(ONBOARDING_EVENTS.calibrationAnswered, { position: item.position, role: item.role });

    if (currentIndex < ASSESSMENT_LENGTH - 1) {
      const nextPosition = currentIndex + 2;
      announce?.(`Question ${nextPosition} of ${ASSESSMENT_LENGTH}`);
      setCurrentIndex(currentIndex + 1);
      return;
    }

    const placement = scoreAssessment({
      claimedLevel: calibration.claimedLevel ?? claimedLevel(state.answers),
      items: calibration.items,
      answers,
    });
    track(ONBOARDING_EVENTS.calibrationCompleted, { answered_count: answers.length, provisional_level: placement.provisionalLevel });
    next({ calibration: { ...calibration, answers, placement } });
  };

  const goBack = () => {
    if (started && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      return;
    }
    back?.();
  };

  if (!started) {
    return (
      <StepFrame
        key="calibration-intro"
        title="Let’s personalize your starting point"
        subtitle="Answer five quick questions so we can match your learning plan to you."
        progress={progress}
        onBack={back}
      >
        <WritingToggle
          value={calibration.writingSystem}
          onChange={(writingSystem) => update({ calibration: { ...calibration, writingSystem } })}
        />
        <p className="mt-4 text-sm leading-relaxed" style={{ color: MUTED }}>
          Pick whatever feels right. If something is unfamiliar, choose your best guess and keep going.
        </p>
        <PrimaryButton className="mt-8" onClick={start} data-testid="calibration-start">
          Start
        </PrimaryButton>
      </StepFrame>
    );
  }

  if (!question || !item) return null;

  return (
    <StepFrame
      title="Let’s personalize your starting point"
      progress={progress}
      onBack={goBack}
      eyebrow={`Question ${item.position} of ${ASSESSMENT_LENGTH}`}
    >
      <div className="flex gap-1.5" aria-hidden>
        {calibration.items.map((entry) => (
          <span
            key={entry.position}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: entry.position <= answeredCount ? GREEN : "rgba(194,220,240,0.9)" }}
          />
        ))}
      </div>

      <h2
        ref={questionHeadingRef}
        tabIndex={-1}
        id="calibration-question"
        className="mt-5 text-[15px] font-semibold outline-none"
        style={{ color: MUTED }}
        data-testid="calibration-question"
        data-role={item.role}
      >
        {question.prompt}
      </h2>
      {question.context ? (
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: NAVY }}>
          {question.context}
        </p>
      ) : null}
      {question.zh ? (
        <div className="mt-3 rounded-2xl px-4 py-4 text-center" style={{ background: SKY_PALE, border: `1px solid ${CARD_BORDER}` }}>
          <p lang={lang} className="text-[26px] font-semibold leading-snug sm:text-[30px]" style={{ color: NAVY }}>
            {question.zh}
          </p>
          {question.pinyin ? (
            <p lang="zh-Latn-pinyin" className="mt-1 text-sm" style={{ color: MUTED }}>
              {question.pinyin}
            </p>
          ) : null}
        </div>
      ) : null}

      <div role="group" aria-labelledby="calibration-question" className="mt-4 grid gap-2.5">
        {question.choices.map((choice) => {
          const isChosen = chosen === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              aria-pressed={isChosen}
              onClick={(event) => {
                // The second click of a double-click lands on the next question, which the learner hasn't read.
                if (event.detail > 1) return;
                answer(choice.id);
              }}
              data-testid="calibration-choice"
              className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left transition-colors hover:bg-[#F4FAFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                border: `1px solid ${isChosen ? GREEN : CARD_BORDER}`,
                boxShadow: isChosen ? `inset 0 0 0 1px ${GREEN}` : undefined,
                outlineColor: GREEN,
              }}
            >
              <span
                aria-hidden
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: isChosen ? GREEN : CARD_BORDER, background: isChosen ? GREEN : "#fff" }}
              >
                {isChosen ? <Check size={14} strokeWidth={3} color="#fff" /> : null}
              </span>
              <span className="min-w-0">
                <span lang={choice.lang === "zh" ? lang : "en"} className="block text-[17px] font-semibold leading-snug" style={{ color: NAVY }}>
                  {choice.text}
                </span>
                {choice.pinyin ? (
                  <span lang="zh-Latn-pinyin" className="mt-0.5 block text-[13px]" style={{ color: MUTED }}>
                    {choice.pinyin}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </StepFrame>
  );
}
