"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Check, Clock, Flag, ListChecks, MessageCircle, MessagesSquare, Mic, RotateCcw, Sparkles, Target, TrendingUp, Volume2 } from "lucide-react";
import { NUMBER_GRAPH_FLAG, ONBOARDING_EVENTS, showsChartNumbers } from "@/lib/onboarding/personalized/analytics";
import { useIsOnboardingPreview } from "./OnboardingExperiment";
import { useFeatureFlag } from "@/lib/posthog/client";
import {
  buildStageLabels,
  buildingState,
} from "@/lib/onboarding/personalized/building";
import { hasMessaging, isBeginnerPath, planFor } from "@/lib/onboarding/personalized/flow";
import type { FixId } from "@/lib/onboarding/personalized/fixes";
import { currentInsight, templateInsight } from "@/lib/onboarding/personalized/insight";
import { buildProgress, type ProgressEvent } from "@/lib/onboarding/personalized/progress";
import { answerSummary, PROGRESS_SOURCE } from "@/lib/onboarding/personalized/reflection";
import { buildRoadmap, type Roadmap } from "@/lib/onboarding/personalized/roadmap";
import { goalLabel, joinList } from "@/lib/onboarding/personalized/goals";
import { ProgressChart } from "./ProgressChart";
import type { StepProps } from "./stepTypes";
import {
  CARD_BORDER,
  FONT_DISPLAY,
  GREEN,
  LiveRegion,
  MUTED,
  NAVY,
  PrimaryButton,
  SecondaryButton,
  SKY_PALE,
  StepFrame,
  TextButton,
  usePrefersReducedMotion,
} from "./ui";

export function BuildingStep({
  state,
  next,
  serverWork,
}: StepProps & { serverWork: () => Promise<void> }) {
  const reduced = usePrefersReducedMotion();
  const stages = useMemo(() => buildStageLabels(planFor(state.answers)), [state.answers]);
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
      ? `${stages[view.completedStages - 1]}: done`
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
        {stages.map((stage, index) => {
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
    : "Practice conversations included";
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
      title="Ready to continue your Mandarin journey?"
      progress={progress}
      onBack={sealed ? null : back}
    >
      <div
        className={`relative rounded-2xl px-4 py-5 text-center sm:px-6 ${sealed && !reduced ? "motion-safe:animate-[commitment-seal_0.8s_ease-out]" : ""}`}
        style={{
          border: `2px solid ${sealed ? GREEN : CARD_BORDER}`,
          background: sealed
            ? "linear-gradient(115deg, transparent 18%, rgba(255,255,255,0.8) 32%, transparent 54%), linear-gradient(160deg, #FFFFFF 0%, #F0FAF4 45%, #E0F0E7 100%)"
            : "linear-gradient(115deg, transparent 18%, rgba(255,255,255,0.85) 32%, rgba(255,255,255,0.25) 43%, transparent 54%), linear-gradient(160deg, #FFFFFF 0%, #F2F9FD 45%, #E2F0F8 100%)",
          boxShadow: sealed
            ? "inset 0 2px 0 rgba(255,255,255,0.95), 0 10px 24px rgba(32,103,79,0.13)"
            : "inset 0 2px 0 rgba(255,255,255,0.98), 0 10px 24px rgba(79,110,131,0.16)",
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
              style={{
                color: NAVY,
                border: `1px solid ${CARD_BORDER}`,
                background: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 45%, #F2F8FC 100%)",
                boxShadow: "inset 0 1px 0 #FFFFFF, 0 2px 0 rgba(168,199,218,0.3), 0 3px 7px rgba(79,110,131,0.06)",
              }}
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
      {state.answers.firstLesson.completedAt ? (
        <p className="mt-3 text-center text-[14px]" style={{ color: MUTED }} data-testid="commitment-lesson-note">
          Nice work on your first lesson — seal your plan to keep going.
        </p>
      ) : null}

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
        {sealed ? "Opening your plan…" : "I’m ready, start my plan"}
      </PrimaryButton>
    </StepFrame>
  );
}

/** Week-by-week path from the first lesson to the milestone. The last stage is the payoff. */
export function RoadmapList({ roadmap, compact = false, firstLessons = [] }: { roadmap: Roadmap; compact?: boolean; firstLessons?: string[] }) {
  return (
    <ol className="relative flex flex-col gap-3" data-testid="roadmap">
      {roadmap.stages.map((stage, index) => {
        const last = index === roadmap.stages.length - 1;
        return (
          <li key={stage.week} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: last ? GREEN : SKY_PALE, color: last ? "#fff" : GREEN, border: `1.5px solid ${GREEN}` }}
                aria-hidden
              >
                {last ? <Sparkles size={14} strokeWidth={2.4} /> : index + 1}
              </span>
              {last ? null : <span className="mt-1 w-[2px] flex-1 rounded" style={{ background: CARD_BORDER, minHeight: compact ? 8 : 14 }} aria-hidden />}
            </div>
            <div className={last ? "rounded-2xl px-4 py-3" : "pb-1 pt-0.5"} style={last ? { background: "rgba(32,103,79,0.08)", border: `1px solid rgba(32,103,79,0.25)` } : undefined}>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: GREEN }}>
                {stage.when}
              </p>
              <p className={`mt-0.5 leading-snug ${last ? "text-[16px] font-bold" : "text-[15px] font-semibold"}`} style={{ color: NAVY }}>
                {stage.title}
              </p>
              {index === 0 && firstLessons.length ? (
                <p className="mt-0.5 text-[13px] leading-snug" style={{ color: MUTED }} data-testid="roadmap-first-lessons">
                  First lessons: {firstLessons.join(" · ")}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const REASON_ICONS: Record<FixId, typeof Clock> = {
  speak: Mic,
  practice: MessagesSquare,
  relevant: Target,
  remember: RotateCcw,
  hear: Volume2,
  tones: AudioLines,
  time: Clock,
  level: TrendingUp,
  next: ListChecks,
};

/** The green "Week 12: …" bubble: the moment they're working towards. */
function MomentBubble({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: "#EAF4EF" }} data-testid="progress-moment">
      <MessageCircle size={20} strokeWidth={2.2} className="shrink-0" style={{ color: GREEN }} aria-hidden />
      <p className="text-[15px] font-bold leading-snug" style={{ color: GREEN }}>
        {text}
      </p>
    </div>
  );
}

/** Shown only when they told us about a dated event: what they'll have ready by then. */
function EventNote({ event }: { event: ProgressEvent }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3" style={{ background: "#FBF1EC" }} data-testid="progress-event">
      <Flag size={18} strokeWidth={2.2} className="mt-0.5 shrink-0" style={{ color: "#B5543C" }} aria-hidden />
      <p className="text-[14px] leading-snug" style={{ color: NAVY }}>
        <span className="font-bold">{event.label}.</span> {event.detail}.
      </p>
    </div>
  );
}

export function ReflectStep({ state, next, back, progress, track, jumpTo }: StepProps) {
  const plan = useMemo(() => planFor(state.answers), [state.answers]);
  const insight = useMemo(() => currentInsight(state.answers) ?? templateInsight(state.answers, plan), [state.answers, plan]);
  const roadmap = useMemo(() => buildRoadmap(state.answers, plan), [state.answers, plan]);
  const path_ = useMemo(() => buildProgress(state.answers, plan, roadmap), [state.answers, plan, roadmap]);
  const summary = useMemo(() => answerSummary(state.answers, plan), [state.answers, plan]);
  const [explainOpen, setExplainOpen] = useState(false);
  const path = isBeginnerPath(state.answers) ? "beginner" : "learner";
  // Experiment: word counts on the chart only for the "test" variant.
  const preview = useIsOnboardingPreview();
  const chartVariant = useFeatureFlag(NUMBER_GRAPH_FLAG, !preview);
  const showNumbers = showsChartNumbers(chartVariant);
  const chartVariantLabel = typeof chartVariant === "string" ? chartVariant : "none";
  const viewedRef = useRef(false);
  useEffect(() => {
    // Wait for flags so the event carries the variant the learner actually saw.
    if (viewedRef.current || chartVariant === undefined) return;
    viewedRef.current = true;
    track(ONBOARDING_EVENTS.reflectionViewed, { path, chart_variant: chartVariantLabel });
  }, [chartVariant, chartVariantLabel, path, track]);
  const milestones = [
    { week: path_.weeks[0], title: roadmap.stages[1]?.title },
    { week: path_.weeks[1], title: roadmap.stages[2]?.title },
  ].filter((item): item is { week: number; title: string } => Boolean(item.title));

  const actions = (
    <>
      <PrimaryButton
        data-testid="reflect-confirm"
        onClick={() => {
          track(ONBOARDING_EVENTS.reflectionConfirmed, { path, insight_source: insight.source, chart_variant: chartVariantLabel });
          next();
        }}
      >
        Start my first lesson
      </PrimaryButton>
      <TextButton className="mt-2" data-testid="reflect-explain" onClick={() => setExplainOpen(true)}>
        How did we work this out?
      </TextButton>
    </>
  );

  return (
    <StepFrame title={path_.headline} eyebrow="Your path" progress={progress} onBack={back}>
      <div data-testid="reflection" data-insight-source={insight.source}>
        {/* Phone (A1): chart card, then the reasons as a list. */}
        <div className="md:hidden" data-testid="reflect-mobile">
          <div className="rounded-[22px] border px-3.5 pb-3 pt-4" style={{ borderColor: CARD_BORDER }}>
            <ProgressChart progress={path_} showNumbers={showNumbers} />
            <div className="mt-1 flex flex-col gap-2">
              <MomentBubble text={path_.moment} />
              {path_.event ? <EventNote event={path_.event} /> : null}
            </div>
          </div>
          <h2 className="mb-2.5 mt-6 text-[15px] font-bold" style={{ color: NAVY }}>
            Why you’ll get there fast
          </h2>
          <ul className="flex flex-col gap-2.5" data-testid="reflect-fixes">
            {path_.reasons.map((reason) => {
              const Icon = REASON_ICONS[reason.id];
              return (
                <li key={reason.id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white" style={{ borderColor: CARD_BORDER }}>
                    <Icon size={18} strokeWidth={2.2} style={{ color: GREEN }} aria-hidden />
                  </span>
                  <p className="text-[15px] leading-snug" style={{ color: NAVY }}>
                    <span className="font-bold">{reason.short}.</span> {reason.tagline}
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="mt-7">{actions}</div>
        </div>

        {/* Desktop (A2): shaded chart beside the milestones, reasons as chips. */}
        <div className="hidden md:flex md:flex-wrap md:items-start md:gap-8" data-testid="reflect-desktop">
          <div className="min-w-0" style={{ flex: "999 1 420px" }}>
            <div className="rounded-[22px] border px-5 pb-4 pt-5" style={{ borderColor: CARD_BORDER, background: "#F8FBFD" }}>
              <ProgressChart progress={path_} area showNumbers={showNumbers} />
              <ul
                className="mt-3 grid grid-cols-3 gap-3 border-t pt-3"
                style={{ borderColor: CARD_BORDER }}
                aria-label="Why you’ll get there fast"
                data-testid="reflect-reasons"
              >
                {path_.reasons.map((reason) => (
                  <li key={reason.id} className="flex items-start gap-1.5 text-[14px] font-semibold leading-snug" style={{ color: NAVY }}>
                    <Check size={15} strokeWidth={3} className="mt-0.5 shrink-0" style={{ color: GREEN }} aria-hidden />
                    {reason.short}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex min-w-0 flex-col" style={{ flex: "1 1 280px" }}>
            <ol className="flex flex-col gap-2.5" aria-label="Milestones">
              {milestones.map((item) => (
                <li key={item.week} className="rounded-2xl px-3.5 py-3" style={{ background: SKY_PALE }}>
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: MUTED }}>
                    Week {item.week}
                  </p>
                  <p className="mt-0.5 text-[15px] font-bold leading-snug" style={{ color: NAVY }}>
                    {item.title}
                  </p>
                </li>
              ))}
              <li>
                <MomentBubble text={path_.moment} />
              </li>
            </ol>
            {path_.event ? (
              <div className="mt-2.5">
                <EventNote event={path_.event} />
              </div>
            ) : null}
            <div className="min-h-6 flex-1" />
            <div className="mt-6">{actions}</div>
          </div>
        </div>
      </div>

      {explainOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" style={{ background: "rgba(7,30,46,0.45)" }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="explain-title"
            className="max-h-[85vh] w-full max-w-[460px] overflow-y-auto rounded-3xl bg-white p-6"
            data-testid="reflect-explain-panel"
          >
            <h2 id="explain-title" className="text-[20px] font-bold" style={{ color: NAVY }}>
              How we worked this out
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: MUTED }} data-testid="reflect-explain-source">
              {PROGRESS_SOURCE}
            </p>
            <p className="mt-4 text-[12px] font-bold uppercase tracking-[0.1em]" style={{ color: GREEN }}>
              From your answers
            </p>
            <dl className="mt-2 flex flex-col gap-2">
              {summary.map((row) => (
                <div key={row.label} className="flex gap-2 text-[14px] leading-snug">
                  <dt className="w-[42%] shrink-0" style={{ color: MUTED }}>{row.label}</dt>
                  <dd className="font-semibold" style={{ color: NAVY }}>{row.value}</dd>
                </div>
              ))}
            </dl>
            <PrimaryButton className="mt-6" data-testid="reflect-explain-close" onClick={() => setExplainOpen(false)}>
              Looks right
            </PrimaryButton>
            <TextButton
              className="mt-2"
              data-testid="reflect-edit"
              onClick={() => {
                track(ONBOARDING_EVENTS.reflectionEdited, { insight_source: insight.source });
                setExplainOpen(false);
                jumpTo?.("using_pain");
              }}
            >
              Edit my answers
            </TextButton>
          </div>
        </div>
      ) : null}
    </StepFrame>
  );
}
