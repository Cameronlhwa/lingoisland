"use client";

import { useEffect, useRef, useState } from "react";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import { isBeginnerPath } from "@/lib/onboarding/personalized/flow";
import { CUSTOM_TEXT_MAX, normalizeCustomText } from "@/lib/onboarding/personalized/goals";
import {
  CUSTOM_PAIN_KEY,
  CUSTOM_PAIN_MAX,
  EXPERIENCE_OPTIONS,
  HESITATION_OPTIONS,
  LEARNING_PAIN_OPTIONS,
  NO_PAIN_KEY,
  TIMING_OPTIONS,
  timingHasEvent,
  togglePick,
  upcomingPlaceholder,
  usingPainOptionsFor,
  usingPainTitle,
  type HesitationKey,
  type LearningPainKey,
  type TimingKey,
  type UsingPainKey,
} from "@/lib/onboarding/personalized/painPoints";
import { SocialProofIntro } from "./SocialProofIntro";
import type { StepProps } from "./stepTypes";
import { CARD_BORDER, FieldError, NAVY, OptionCard, PrimaryButton, SectionLabel, StepFrame } from "./ui";

const INPUT =
  "w-full min-h-[48px] rounded-xl border bg-white px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2";
const LIMIT_MESSAGE = "Pick your top two. Tap one to remove it first.";

export function ExperienceStep({ state, update, next, back, progress, track }: StepProps) {
  const selected = state.answers.experience.key;
  return (
    <StepFrame title="How long have you been learning Mandarin?" subtitle="Your best guess is fine." progress={progress} onBack={back}>
      <div role="group" aria-labelledby="onboarding-step-title" className="grid gap-2.5 sm:grid-cols-2">
        {EXPERIENCE_OPTIONS.map((option) => (
          <OptionCard
            key={option.key}
            testId={`experience-${option.key}`}
            selected={selected === option.key}
            onSelect={() => update({ experience: { key: option.key } })}
            title={option.label}
          />
        ))}
      </div>
      <PrimaryButton
        className="mt-8"
        disabled={!selected}
        data-testid="continue"
        onClick={() => {
          track(ONBOARDING_EVENTS.experienceSelected, { experience: selected });
          next();
        }}
      >
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}

export function UsingPainStep({ state, update, next, back, progress, track }: StepProps) {
  const goal = state.answers.goal.primary;
  const { keys, timing, upcomingText } = state.answers.usingPain;
  const customText = state.answers.usingPain.customText ?? null;
  const [text, setText] = useState(upcomingText ?? "");
  const [painText, setPainText] = useState(customText ?? "");
  const [error, setError] = useState<string | null>(null);
  const options = usingPainOptionsFor(goal);
  const showEvent = timingHasEvent(timing);

  const toggle = (key: UsingPainKey) => {
    const picked = togglePick(keys, key, undefined, NO_PAIN_KEY);
    if (!picked) {
      setError(LIMIT_MESSAGE);
      return;
    }
    setError(null);
    update({ usingPain: { keys: picked, timing, upcomingText, customText } });
  };
  const chooseTiming = (key: TimingKey) =>
    update({ usingPain: { keys, timing: key, upcomingText: timingHasEvent(key) ? upcomingText : null, customText } });

  const wantsCustom = keys.includes(CUSTOM_PAIN_KEY);
  const customReady = !wantsCustom || Boolean(normalizeCustomText(painText, CUSTOM_PAIN_MAX));
  const ready = keys.length > 0 && timing !== null && customReady;
  const submit = () => {
    if (!ready) return;
    const normalized = showEvent ? normalizeCustomText(text) : null;
    const custom = wantsCustom ? normalizeCustomText(painText, CUSTOM_PAIN_MAX) : null;
    track(ONBOARDING_EVENTS.usingPainSelected, {
      pains: keys,
      timing,
      has_upcoming_text: Boolean(normalized),
      has_custom_pain: Boolean(custom),
    });
    next({ usingPain: { keys, timing, upcomingText: normalized, customText: custom } });
  };

  return (
    <StepFrame title={usingPainTitle(goal)} subtitle="Pick up to two." progress={progress} onBack={back}>
      <div role="group" aria-labelledby="onboarding-step-title" className="grid gap-2.5">
        {options.map((option) => (
          <OptionCard
            key={option.key}
            compact
            testId={`pain-${option.key}`}
            selected={keys.includes(option.key)}
            onSelect={() => toggle(option.key)}
            title={option.label}
          />
        ))}
      </div>
      {wantsCustom ? (
        <div className="mt-3">
          <label htmlFor="custom-pain-text" className="text-[15px] font-bold" style={{ color: NAVY }}>
            What happens? Tell us in a few words
          </label>
          <input
            id="custom-pain-text"
            data-testid="custom-pain-text"
            value={painText}
            maxLength={CUSTOM_PAIN_MAX}
            onChange={(event) => setPainText(event.target.value)}
            placeholder="For example, I understand emails but can't reply on calls"
            className={`${INPUT} mt-2`}
            style={{ borderColor: CARD_BORDER, color: NAVY }}
          />
        </div>
      ) : null}
      <FieldError message={error} />

      <div className="mt-7">
        <SectionLabel id="timing-label">When&rsquo;s the next time you&rsquo;ll need it?</SectionLabel>
        <div role="group" aria-labelledby="timing-label" className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {TIMING_OPTIONS.map((option) => (
            <OptionCard
              key={option.key}
              compact
              testId={`timing-${option.key}`}
              selected={timing === option.key}
              onSelect={() => chooseTiming(option.key)}
              title={option.label}
            />
          ))}
        </div>
      </div>

      {showEvent ? (
        <div className="mt-6">
          <label htmlFor="upcoming-text" className="text-[15px] font-bold" style={{ color: NAVY }}>
            What&rsquo;s coming up? (optional)
          </label>
          <input
            id="upcoming-text"
            value={text}
            maxLength={CUSTOM_TEXT_MAX}
            onChange={(event) => setText(event.target.value)}
            placeholder={upcomingPlaceholder(goal)}
            className={`${INPUT} mt-2`}
            style={{ borderColor: CARD_BORDER, color: NAVY }}
          />
        </div>
      ) : null}

      <PrimaryButton className="mt-8" disabled={!ready} onClick={submit} data-testid="continue">
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}

export function LearningPainStep({ state, update, next, back, progress, track }: StepProps) {
  const beginner = isBeginnerPath(state.answers);
  const { keys, hesitations } = state.answers.learningPain;
  const [error, setError] = useState<string | null>(null);

  const toggleLearning = (key: LearningPainKey) => {
    const picked = togglePick(keys, key);
    if (!picked) return setError(LIMIT_MESSAGE);
    setError(null);
    update({ learningPain: { keys: picked, hesitations } });
  };
  const toggleHesitation = (key: HesitationKey) => {
    const picked = togglePick(hesitations, key);
    if (!picked) return setError(LIMIT_MESSAGE);
    setError(null);
    update({ learningPain: { keys, hesitations: picked } });
  };

  const ready = beginner ? hesitations.length > 0 : keys.length > 0;
  const submit = () => {
    if (!ready) return;
    track(
      ONBOARDING_EVENTS.learningPainSelected,
      beginner ? { hesitations, path: "beginner" } : { learning_pains: keys, path: "learner" },
    );
    next();
  };

  return (
    <StepFrame
      title={beginner ? "What\u2019s held you back from starting?" : "What\u2019s been hardest about learning so far?"}
      subtitle={beginner ? "Pick up to two. Lots of people feel this way." : "Pick up to two."}
      progress={progress}
      onBack={back}
    >
      <div role="group" aria-labelledby="onboarding-step-title" className="grid gap-2.5">
        {beginner
          ? HESITATION_OPTIONS.map((option) => (
              <OptionCard
                key={option.key}
                compact
                testId={`hesitation-${option.key}`}
                selected={hesitations.includes(option.key)}
                onSelect={() => toggleHesitation(option.key)}
                title={option.label}
              />
            ))
          : LEARNING_PAIN_OPTIONS.map((option) => (
              <OptionCard
                key={option.key}
                compact
                testId={`learning-pain-${option.key}`}
                selected={keys.includes(option.key)}
                onSelect={() => toggleLearning(option.key)}
                title={option.label}
              />
            ))}
      </div>
      <FieldError message={error} />
      <PrimaryButton className="mt-8" disabled={!ready} onClick={submit} data-testid="continue">
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}

export function ReviewsStep({ state, next, back, progress, track }: StepProps) {
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track(ONBOARDING_EVENTS.reviewsViewed, { path: isBeginnerPath(state.answers) ? "beginner" : "learner" });
  }, [state.answers, track]);
  return <SocialProofIntro answers={state.answers} progress={progress} onBack={back} onContinue={() => next()} />;
}
