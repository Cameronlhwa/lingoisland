"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, MessageCircle, Sparkles, Target } from "lucide-react";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import {
  BUILD_STAGES,
  buildingState,
} from "@/lib/onboarding/personalized/building";
import { hasMessaging, planFor } from "@/lib/onboarding/personalized/flow";
import { goalLabel, joinList } from "@/lib/onboarding/personalized/goals";
import type { StepProps } from "./stepTypes";
import {
  CARD_BORDER,
  FONT_DISPLAY,
  GREEN,
  LiveRegion,
  MUTED,
  NAVY,
  PrimaryButton,
  SKY_PALE,
  StepFrame,
  usePrefersReducedMotion,
} from "./ui";

export function BuildingStep({
  next,
  serverWork,
}: StepProps & { serverWork: () => Promise<void> }) {
  const reduced = usePrefersReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [serverDone, setServerDone] = useState(false);
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    headingRef.current?.focus();
    const timer = window.setInterval(
      () => setElapsed(Date.now() - startedAtRef.current),
      100,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void serverWork()
      .catch(() => undefined)
      .finally(() => setServerDone(true));
  }, [serverWork]);

  const view = buildingState(elapsed, serverDone, reduced);

  useEffect(() => {
    if (!view.done || doneRef.current) return;
    doneRef.current = true;
    const timeout = window.setTimeout(() => next(), reduced ? 500 : 900);
    return () => window.clearTimeout(timeout);
  }, [view.done, next, reduced]);

  const announcement = view.done
    ? "Your personalized plan is ready!"
    : view.completedStages > 0
      ? `${BUILD_STAGES[view.completedStages - 1]}: done`
      : "Building your plan";

  return (
    <section aria-labelledby="building-title" aria-busy={!view.done}>
      <LiveRegion message={announcement} />
      <h1
        id="building-title"
        ref={headingRef}
        tabIndex={-1}
        className="mt-2 text-center text-[22px] font-bold leading-tight outline-none sm:text-[26px]"
        style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
      >
        {view.done
          ? "Your personalized plan is ready!"
          : "We’re adjusting your learning plan to help you learn Mandarin more efficiently."}
      </h1>
      <ol
        className="mx-auto mt-8 flex max-w-sm flex-col gap-3"
        data-testid="building-stages"
      >
        {BUILD_STAGES.map((stage, index) => {
          const complete = index < view.completedStages;
          const active = !complete && index === view.completedStages;
          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${active && !reduced ? "motion-safe:animate-pulse" : ""}`}
                style={{
                  borderColor: complete ? GREEN : CARD_BORDER,
                  background: complete ? GREEN : "#fff",
                }}
              >
                {complete ? (
                  <Check size={15} strokeWidth={3} color="#fff" />
                ) : null}
              </span>
              <span
                className="text-[15px] font-semibold"
                style={{ color: complete || active ? NAVY : MUTED }}
              >
                {stage}
                <span className="sr-only">
                  {complete
                    ? " (done)"
                    : active
                      ? " (in progress)"
                      : " (waiting)"}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {view.waitingOnServer ? (
        <p className="mt-6 text-center text-sm" style={{ color: MUTED }}>
          Still saving your plan. This can take a few more seconds.
        </p>
      ) : null}
    </section>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <dt
        className="flex items-center gap-3 text-xs font-bold uppercase tracking-wide"
        style={{ color: MUTED }}
      >
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: "rgba(32,103,79,0.1)", color: GREEN }}
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd
        className="-mt-1.5 pl-11 text-[15px] font-semibold leading-snug"
        style={{ color: NAVY }}
      >
        {value}
      </dd>
    </div>
  );
}

export function PlanStep({ state, next, back, progress, track }: StepProps) {
  const plan = useMemo(() => planFor(state.answers), [state.answers]);
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track(ONBOARDING_EVENTS.planViewed, {
      journeys_count: plan.journeys.length,
      milestone_key: plan.milestone.key,
    });
  }, [plan, track]);

  const schedule = plan.daysVary
    ? `${plan.minutesLabel} a day, a few days each week`
    : `${plan.minutesLabel} a day, ${plan.daysLabel === "every day" ? "every day" : `${plan.daysLabel} a week`}`;

  return (
    <StepFrame
      title="Here’s your personalized plan"
      subtitle={plan.benefit}
      progress={progress}
      onBack={back}
      eyebrow="Your plan"
    >
      <dl
        className="divide-y rounded-2xl px-4"
        style={{ border: `1px solid ${CARD_BORDER}`, borderColor: CARD_BORDER }}
      >
        <SummaryRow
          icon={<Target size={16} aria-hidden />}
          label="Goal"
          value={goalLabel(plan.goal, state.answers.goal.otherText)}
        />
        <SummaryRow
          icon={<Sparkles size={16} aria-hidden />}
          label="Focus"
          value={joinList(plan.interests)}
        />
        <SummaryRow
          icon={<Check size={16} aria-hidden />}
          label="Starting point"
          value={plan.startingPoint}
        />
        <SummaryRow
          icon={<Clock size={16} aria-hidden />}
          label="Schedule"
          value={
            plan.sessionSplit ? `${schedule}. ${plan.sessionSplit}.` : schedule
          }
        />
        <SummaryRow
          icon={<MessageCircle size={16} aria-hidden />}
          label="Pinyin and English"
          value={plan.support.summary}
        />
      </dl>

      <h2 className="mt-6 text-[15px] font-bold" style={{ color: NAVY }}>
        Your first Journeys
      </h2>
      <ol className="mt-2 flex flex-col gap-2" data-testid="plan-journeys">
        {plan.journeys.map((journey, index) => (
          <li
            key={journey.key + index}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style={{ background: SKY_PALE }}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: GREEN }}
            >
              {index + 1}
            </span>
            <span
              className="min-w-0 flex-1 text-[15px] font-semibold"
              style={{ color: NAVY }}
            >
              {journey.title}
            </span>
            <span className="shrink-0 text-xs" style={{ color: MUTED }}>
              about {journey.minutes} min
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm leading-relaxed" style={{ color: MUTED }}>
        Your starting point is a guide, not a label. Lessons and Huahua keep
        adjusting as you learn.
      </p>
      <PrimaryButton
        className="mt-8"
        onClick={() => next()}
        data-testid="continue"
      >
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}

export function CommitmentStep({
  state,
  update,
  next,
  back,
  progress,
  track,
  defaultName,
}: StepProps & { defaultName: string | null }) {
  const plan = useMemo(() => planFor(state.answers), [state.answers]);
  const reduced = usePrefersReducedMotion();
  const [name, setName] = useState(
    state.answers.commitment.name ?? defaultName ?? "",
  );
  const [sealed, setSealed] = useState(false);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track(ONBOARDING_EVENTS.commitmentViewed);
  }, [track]);

  const trimmed = name.trim().slice(0, 40);
  const milestone = `${plan.milestone.text.charAt(0).toUpperCase()}${plan.milestone.text.slice(1)}`;
  const schedule = plan.daysVary
    ? `${plan.minutesLabel}, a few days a week`
    : `${plan.minutesLabel}, ${plan.daysLabel === "every day" ? "every day" : `${plan.daysLabel} a week`}`;
  const frequency = state.answers.huahua?.frequency;
  const huahua = hasMessaging(state.answers)
    ? `Huahua ${state.answers.messaging.channel === "whatsapp" ? "on WhatsApp" : "by text"}, ${
        frequency === "7" ? "every day" : frequency && frequency !== "auto" ? `${frequency} times a week` : "adjusts to you"
      }`
    : "Add Huahua anytime";
  const summary = [
    { icon: Target, label: goalLabel(plan.goal, state.answers.goal.otherText) },
    { icon: Clock, label: schedule },
    { icon: MessageCircle, label: huahua },
  ];

  const commit = () => {
    if (sealed) return;
    setSealed(true);
    const committedAt = new Date().toISOString();
    track(ONBOARDING_EVENTS.commitmentCompleted);
    update({ commitment: { name: trimmed || null, committedAt } });
    window.setTimeout(
      () => next({ commitment: { name: trimmed || null, committedAt } }),
      reduced ? 150 : 900,
    );
  };

  return (
    <StepFrame
      title="Ready to begin your Mandarin journey?"
      progress={progress}
      onBack={sealed ? null : back}
    >
      <div
        className={`relative rounded-2xl px-4 py-5 text-center sm:px-6 ${sealed && !reduced ? "motion-safe:animate-[commitment-seal_0.8s_ease-out]" : ""}`}
        style={{
          border: `2px solid ${sealed ? GREEN : CARD_BORDER}`,
          background: sealed ? "rgba(32,103,79,0.05)" : SKY_PALE,
        }}
        data-testid="commitment-card"
      >
        <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: GREEN }}>
          Your first milestone
        </p>
        <p
          className="mt-2 text-[20px] font-bold leading-snug sm:text-[22px]"
          style={{ color: NAVY, fontFamily: FONT_DISPLAY }}
          data-testid="commitment-milestone"
        >
          {milestone}
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2" aria-label="Your plan">
          {summary.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold"
              style={{ color: NAVY, border: `1px solid ${CARD_BORDER}` }}
            >
              <Icon size={14} strokeWidth={2.3} style={{ color: GREEN }} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
        {sealed ? (
          <span
            aria-hidden
            className="absolute -right-2 -top-3 flex h-9 w-9 items-center justify-center rounded-full text-white shadow"
            style={{ background: GREEN }}
          >
            <Check size={18} strokeWidth={3} />
          </span>
        ) : null}
      </div>

      <label
        htmlFor="commitment-name"
        className="mt-6 block text-sm font-semibold"
        style={{ color: NAVY }}
      >
        Your first name
      </label>
      <input
        id="commitment-name"
        value={name}
        maxLength={40}
        autoComplete="given-name"
        disabled={sealed}
        onChange={(event) => setName(event.target.value)}
        className="mt-1.5 w-full min-h-[48px] rounded-xl border px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2"
        style={{ borderColor: CARD_BORDER, color: NAVY }}
      />
      <p
        className="mt-3 text-[15px] italic"
        style={{ color: NAVY }}
        aria-live="polite"
        data-testid="commitment-statement"
      >
        {trimmed
          ? `I, ${trimmed}, am ready to begin my Mandarin journey.`
          : "I am ready to begin my Mandarin journey."}
      </p>
      <PrimaryButton
        className="mt-6"
        onClick={commit}
        disabled={sealed}
        data-testid="commitment-cta"
      >
        {sealed ? "Opening your plan…" : "I’m ready, show me my plan"}
      </PrimaryButton>
    </StepFrame>
  );
}
