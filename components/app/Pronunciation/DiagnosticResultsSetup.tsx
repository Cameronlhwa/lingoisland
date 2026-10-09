"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { DAILY_MINUTES_OPTIONS, DEFAULT_DAILY_MINUTES } from "@/lib/pronunciation/sessionSizing";

type WorthTag = { tag: string; label: string; score: number };

function ScoreRing({ score }: { score: number | null }) {
  const value = score == null ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const size = 108;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setDrawn(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const offset = circumference - (drawn ? value / 100 : 0) * circumference;

  return (
    <div className="relative mx-auto h-[108px] w-[108px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--lingo-sky-pale)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--lingo-teal)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
      </svg>
      <span className="lingo-display absolute inset-0 flex items-center justify-center text-[32px] font-bold text-[var(--lingo-navy)]">
        {score == null ? "—" : Math.round(score)}
      </span>
    </div>
  );
}

function StepCard({
  step,
  title,
  copy,
  extra,
  imageSrc,
  children,
}: {
  step: number;
  title: string;
  copy: string;
  extra?: string;
  imageSrc: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex items-stretch gap-3 md:gap-4">
      <div
        className="relative z-10 mt-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{
          background: "var(--lingo-accent-gradient)",
          boxShadow: "0 6px 14px rgba(33, 118, 174, 0.28)",
        }}
      >
        {step}
      </div>
      <article
        className="relative z-0 min-h-[155px] flex-1 overflow-hidden rounded-[20px] border bg-white"
        style={{
          borderColor: "rgba(89, 198, 222, 0.38)",
          boxShadow: "0 8px 22px rgba(33, 118, 174, 0.07)",
        }}
      >
        <div className="grid grid-cols-1 items-center gap-4 p-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-4 md:py-5 md:pl-5 md:pr-6">
          <div className="relative z-10 flex min-w-0 flex-col justify-center">
            <h2 className="text-[17px] font-bold leading-snug text-[var(--lingo-navy)]">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--lingo-text-muted)]">{copy}</p>
            {extra ? (
              <p className="mt-0.5 text-[12px] text-[var(--lingo-text-muted)]">{extra}</p>
            ) : null}
            <Image
              src={imageSrc}
              alt=""
              width={96}
              height={96}
              className="pointer-events-none relative z-0 mt-3 h-[88px] w-[88px] rounded-2xl object-contain md:h-[96px] md:w-[96px]"
            />
          </div>
          <div className="relative z-10 flex w-full min-w-0 max-w-[460px] flex-col justify-center justify-self-start">
            {children}
          </div>
        </div>
      </article>
    </div>
  );
}

export default function DiagnosticResultsSetup({
  overallScore,
  worthWorkingOn,
}: {
  overallScore: number | null;
  worthWorkingOn: WorthTag[];
}) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(DEFAULT_DAILY_MINUTES);
  const [saving, setSaving] = useState(false);
  const weaknesses = worthWorkingOn.slice(0, 3);

  const startFirst = async () => {
    setSaving(true);
    await fetch("/api/pronunciation/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyMinutes: minutes }),
    }).catch(() => {});
    const res = await fetch("/api/pronunciation/session", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.sessionId) {
      router.push(`/app/pronunciation/session/${data.sessionId}`);
      return;
    }
    router.push("/app/pronunciation");
  };

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 py-10 md:px-6 md:py-12">
      <div className="text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-blue)]">
          Your profile
        </p>
        <h1 className="lingo-display mt-2 text-[28px] font-bold text-[var(--lingo-navy)] md:text-[32px]">
          Your pronunciation profile
        </h1>
        <div className="mt-5">
          <ScoreRing score={overallScore} />
        </div>
        <p className="mt-3 text-sm font-semibold text-[var(--lingo-navy)]">
          You already have a solid base.
        </p>
        <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">
          We&apos;ll personalize practice around these sounds.
        </p>
      </div>

      <div className="relative mt-8">
        <div
          className="pointer-events-none absolute bottom-10 left-[19px] top-10 border-l-2 border-dotted"
          style={{ borderColor: "rgba(89, 198, 222, 0.55)" }}
          aria-hidden
        />
        <div className="space-y-4">
          <StepCard
            step={1}
            title="Here's what to work on"
            copy="These are the areas to focus on. We'll build them into your daily practice."
            imageSrc="/pronunciation/pronunciation-step-target.png"
          >
            {weaknesses.length === 0 ? (
              <p className="text-sm text-[var(--lingo-text-muted)]">
                Looking solid overall — daily practice will keep you sharp.
              </p>
            ) : (
              <ul className="space-y-2">
                {weaknesses.map((tag) => (
                  <li
                    key={tag.tag}
                    className="flex h-11 items-center justify-between rounded-xl bg-[var(--lingo-sky-pale)] px-3.5"
                  >
                    <span className="truncate pr-3 text-sm font-bold text-[var(--lingo-navy)]">
                      {tag.label}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-[var(--lingo-text-muted)]">
                      {Math.round(tag.score)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </StepCard>

          <StepCard
            step={2}
            title="Choose your daily practice time"
            copy="A little practice each day goes a long way."
            extra="You can always change this later."
            imageSrc="/pronunciation/pronunciation-step-clock.png"
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DAILY_MINUTES_OPTIONS.map((option) => {
                const selected = minutes === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMinutes(option)}
                    className={`h-12 rounded-xl text-sm font-bold transition-colors ${
                      selected
                        ? "bg-[var(--lingo-navy)] text-white"
                        : "bg-[var(--lingo-sky-pale)] text-[var(--lingo-navy)] hover:bg-[#d7f1f7]"
                    }`}
                  >
                    {option} min
                  </button>
                );
              })}
            </div>
          </StepCard>

          <StepCard
            step={3}
            title="Start personalized practice"
            copy="Let's turn your insights into real improvement!"
            imageSrc="/pronunciation/pronunciation-step-sprout.png"
          >
            <div className="w-full max-w-[400px] md:ml-10">
              <button
                type="button"
                disabled={saving}
                onClick={() => void startFirst()}
                className="h-[52px] w-full rounded-2xl px-5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "var(--lingo-accent-gradient)" }}
              >
                {saving ? "Starting…" : "Build my personalized practice →"}
              </button>
              <p className="mt-2 text-center text-[12px] text-[var(--lingo-text-muted)]">
                You can always adjust your goals in settings.
              </p>
            </div>
          </StepCard>
        </div>
      </div>
    </div>
  );
}
