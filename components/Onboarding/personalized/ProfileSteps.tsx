"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import {
  CUSTOM_TEXT_MAX,
  GOALS,
  INTERESTS_BY_GOAL,
  interestOptionsFor,
  normalizeCustomText,
  type GoalKey,
  type InterestOption,
} from "@/lib/onboarding/personalized/goals";
import { SELF_REPORT_OPTIONS } from "@/lib/onboarding/personalized/levels";
import {
  DAYS_OPTIONS,
  MINUTES_OPTIONS,
  SESSION_OPTIONS,
  needsSessionPreference,
} from "@/lib/onboarding/personalized/plan";
import type { StepProps } from "./stepTypes";
import {
  CARD_BORDER,
  ChipButton,
  FieldError,
  GREEN,
  MUTED,
  NAVY,
  OptionCard,
  PrimaryButton,
  SectionLabel,
  StepFrame,
} from "./ui";

const INPUT =
  "w-full min-h-[48px] rounded-xl border bg-white px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2";

export function GoalStep({ state, update, next, back, progress, track }: StepProps) {
  const { primary, secondary, otherText } = state.answers.goal;
  const [text, setText] = useState(otherText ?? "");
  const showOther = primary === "other" || secondary === "other";

  const choosePrimary = (key: GoalKey) => {
    update({ goal: { primary: key, secondary: secondary === key ? null : secondary, otherText: key === "other" || secondary === "other" ? otherText : null } });
  };
  const toggleSecondary = (key: GoalKey) => {
    const nextSecondary = secondary === key ? null : key;
    update({ goal: { primary, secondary: nextSecondary, otherText: primary === "other" || nextSecondary === "other" ? otherText : null } });
  };

  const submit = () => {
    if (!primary) return;
    const normalized = showOther ? normalizeCustomText(text) : null;
    track(ONBOARDING_EVENTS.goalSelected, { goal: primary, secondary_goal: secondary, has_goal_other_text: Boolean(normalized) });
    next({ goal: { primary, secondary, otherText: normalized } });
  };

  return (
    <StepFrame
      title="Why do you want to learn Mandarin?"
      subtitle="Pick your main reason. You can add a second one if you like."
      progress={progress}
      onBack={back}
    >
      <div role="group" aria-labelledby="onboarding-step-title" className="grid gap-2.5 sm:grid-cols-2">
        {GOALS.map((goal) => (
          <OptionCard
            key={goal.key}
            testId={`goal-${goal.key}`}
            selected={primary === goal.key}
            onSelect={() => choosePrimary(goal.key)}
            title={goal.label}
            description={goal.description}
            badge={primary === goal.key ? "Main reason" : undefined}
          />
        ))}
      </div>

      {primary ? (
        <div className="mt-6">
          <SectionLabel id="secondary-goal-label">Anything else? (optional)</SectionLabel>
          <div role="group" aria-labelledby="secondary-goal-label" className="mt-2.5 flex flex-wrap gap-2">
            {GOALS.filter((goal) => goal.key !== primary && goal.key !== "other").map((goal) => (
              <ChipButton
                key={goal.key}
                testId={`secondary-goal-${goal.key}`}
                selected={secondary === goal.key}
                onToggle={() => toggleSecondary(goal.key)}
              >
                {goal.label}
              </ChipButton>
            ))}
          </div>
        </div>
      ) : null}

      {showOther ? (
        <div className="mt-6">
          <label htmlFor="goal-other" className="text-[15px] font-bold" style={{ color: NAVY }}>
            Tell us in a few words (optional)
          </label>
          <input
            id="goal-other"
            value={text}
            maxLength={CUSTOM_TEXT_MAX}
            onChange={(event) => setText(event.target.value)}
            placeholder="For example, watching dramas"
            className={`${INPUT} mt-2`}
            style={{ borderColor: CARD_BORDER, color: NAVY }}
          />
        </div>
      ) : null}

      <PrimaryButton className="mt-8" disabled={!primary} onClick={submit} data-testid="continue">
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}

export function InterestsStep({ state, update, next, back, progress, track }: StepProps) {
  const { primary, secondary } = state.answers.goal;
  const { keys, custom } = state.answers.interests;
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options: InterestOption[] = [];
  [...interestOptionsFor(primary, keys), ...(secondary ? INTERESTS_BY_GOAL[secondary] : [])].forEach((option) => {
    if (!options.some((existing) => existing.key === option.key)) options.push(option);
  });

  const toggle = (key: string) => {
    const nextKeys = keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key];
    update({ interests: { keys: nextKeys, custom } });
  };

  const addCustom = () => {
    const normalized = normalizeCustomText(draft);
    if (!normalized) {
      setError("Use at least two letters, like “hiking” or “K-dramas”.");
      return;
    }
    setError(null);
    update({ interests: { keys, custom: normalized } });
    setDraft("");
    setAdding(false);
  };

  const ready = keys.length > 0 || Boolean(custom);
  const submit = () => {
    if (!ready) return;
    track(ONBOARDING_EVENTS.interestsSelected, { interests: keys, interest_count: keys.length + (custom ? 1 : 0), has_custom_interest: Boolean(custom) });
    next();
  };

  return (
    <StepFrame
      title="Which situations do you want to handle first?"
      subtitle="Pick at least one. Your lessons and practice conversations will focus on these."
      progress={progress}
      onBack={back}
    >
      <div role="group" aria-labelledby="onboarding-step-title" className="flex flex-wrap gap-2">
        {options.map((option) => (
          <ChipButton key={option.key} testId={`interest-${option.key}`} selected={keys.includes(option.key)} onToggle={() => toggle(option.key)}>
            {option.label}
          </ChipButton>
        ))}
        {custom ? (
          <span
            className="inline-flex min-h-[44px] items-center gap-1 rounded-full pl-4 pr-1 text-sm font-semibold"
            style={{ border: `1px solid ${GREEN}`, boxShadow: `inset 0 0 0 1px ${GREEN}`, background: "rgba(32,103,79,0.08)", color: GREEN }}
          >
            {custom}
            <button
              type="button"
              aria-label={`Remove ${custom}`}
              onClick={() => update({ interests: { keys, custom: null } })}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/60"
            >
              <X size={16} aria-hidden />
            </button>
          </span>
        ) : null}
        {!custom && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-dashed px-4 text-sm font-semibold hover:bg-[#F4FAFD]"
            style={{ borderColor: MUTED, color: NAVY }}
          >
            <Plus size={15} aria-hidden />
            Add your own
          </button>
        ) : null}
      </div>

      {adding ? (
        <form
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            addCustom();
          }}
        >
          <label htmlFor="custom-interest" className="text-[15px] font-bold" style={{ color: NAVY }}>
            Your own topic
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="custom-interest"
              autoFocus
              value={draft}
              maxLength={CUSTOM_TEXT_MAX}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="For example, basketball"
              className={INPUT}
              style={{ borderColor: CARD_BORDER, color: NAVY }}
            />
            <button
              type="submit"
              className="min-h-[48px] shrink-0 rounded-xl px-4 text-sm font-semibold text-white"
              style={{ background: GREEN }}
            >
              Add
            </button>
          </div>
          <FieldError message={error} />
        </form>
      ) : null}

      <PrimaryButton className="mt-8" disabled={!ready} onClick={submit} data-testid="continue">
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}

export function LevelStep({ state, update, next, back, progress, track }: StepProps) {
  const selected = state.answers.level.selfReport;
  return (
    <StepFrame
      title="How does your Mandarin feel right now?"
      subtitle="Choose the description that feels closest. There is no wrong answer."
      progress={progress}
      onBack={back}
    >
      <div role="group" aria-labelledby="onboarding-step-title" className="grid gap-2.5">
        {SELF_REPORT_OPTIONS.map((option) => (
          <OptionCard
            key={option.key}
            testId={`level-${option.key}`}
            selected={selected === option.key}
            onSelect={() => update({ level: { selfReport: option.key } })}
            title={option.label}
            description={option.description}
          />
        ))}
      </div>
      <PrimaryButton
        className="mt-8"
        disabled={!selected}
        data-testid="continue"
        onClick={() => {
          const option = SELF_REPORT_OPTIONS.find((item) => item.key === selected);
          track(ONBOARDING_EVENTS.levelSelected, { self_report: selected, claimed_level: option?.level });
          next();
        }}
      >
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}

export function AvailabilityStep({ state, update, next, back, progress, track }: StepProps) {
  const availability = state.answers.availability;
  const showSession = needsSessionPreference(availability.minutes);
  const ready = Boolean(availability.minutes && availability.days && (!showSession || availability.session));
  const set = (patch: Partial<typeof availability>) => update({ availability: { ...availability, ...patch } });

  return (
    <StepFrame
      title="How much time can you usually spend learning Mandarin?"
      subtitle="Be realistic. A plan you can keep beats an ambitious one."
      progress={progress}
      onBack={back}
    >
      <div role="group" aria-labelledby="onboarding-step-title" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {MINUTES_OPTIONS.map((option) => (
          <OptionCard
            key={option.key}
            compact
            testId={`minutes-${option.key}`}
            selected={availability.minutes === option.key}
            onSelect={() => set({ minutes: option.key, session: needsSessionPreference(option.key) ? availability.session : null })}
            title={option.label}
          />
        ))}
      </div>

      <div className="mt-7">
        <SectionLabel id="days-label">How many days each week feels realistic?</SectionLabel>
        <div role="group" aria-labelledby="days-label" className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {DAYS_OPTIONS.map((option) => (
            <OptionCard
              key={option.key}
              compact
              testId={`days-${option.key}`}
              selected={availability.days === option.key}
              onSelect={() => set({ days: option.key })}
              title={option.label}
            />
          ))}
        </div>
      </div>

      {showSession ? (
        <div className="mt-7">
          <SectionLabel id="session-label">How would you prefer to use that time?</SectionLabel>
          <div role="group" aria-labelledby="session-label" className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
            {SESSION_OPTIONS.map((option) => (
              <OptionCard
                key={option.key}
                compact
                testId={`session-${option.key}`}
                selected={availability.session === option.key}
                onSelect={() => set({ session: option.key })}
                title={option.label}
              />
            ))}
          </div>
        </div>
      ) : null}

      <PrimaryButton
        className="mt-8"
        disabled={!ready}
        data-testid="continue"
        onClick={() => {
          track(ONBOARDING_EVENTS.availabilitySelected, {
            minutes: availability.minutes,
            days: availability.days,
            session: availability.session,
          });
          next();
        }}
      >
        Build my plan
      </PrimaryButton>
    </StepFrame>
  );
}
