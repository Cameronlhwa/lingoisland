"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
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
    <div className="relative mx-auto shrink-0 h-[72px] w-[72px] sm:h-[88px] sm:w-[88px]">
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
        className="relative z-10 mt-4 hidden h-10 w-10 sm:flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
        style={{
          background: "var(--lingo-accent-gradient)",
          boxShadow: "0 6px 14px rgba(33, 118, 174, 0.28)",
        }}
      >
        {step}
      </div>
      <article
        className="relative z-0 min-w-0 flex-1 overflow-hidden rounded-[20px] border bg-white"
        style={{
          borderColor: "rgba(89, 198, 222, 0.38)",
          boxShadow: "0 8px 22px rgba(33, 118, 174, 0.07)",
        }}
      >
        <div className="grid grid-cols-1 items-center gap-2 p-3 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:gap-4 md:py-5 md:pl-5 md:pr-6">
          <div className="relative z-10 flex min-w-0 flex-col justify-center">
            <h2 className="text-base font-bold leading-snug text-[var(--lingo-navy)]">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-[var(--lingo-text-muted)]">{copy}</p>
            {extra ? (
              <p className="mt-0.5 text-[12px] text-[var(--lingo-text-muted)]">{extra}</p>
            ) : null}
            <Image
              src={imageSrc}
              alt=""
              width={96}
              height={96}
              className="pointer-events-none relative z-0 mt-3 hidden h-[88px] md:block w-[88px] rounded-2xl object-contain md:h-[96px] md:w-[96px]"
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
    router.push("/app/pronunciation/practice");
  };

  return (
    <div className="mx-auto w-full max-w-[920px] px-4 py-4 md:px-6 md:py-5">
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-blue)]">Your profile</p>
          <h1 className="lingo-display mt-1 text-xl font-bold text-[var(--lingo-navy)] sm:text-2xl">Your pronunciation profile</h1>
          <p className="mt-2 text-sm font-semibold text-[var(--lingo-navy)]">You already have a solid base.</p>
          <p className="mt-1 text-xs text-[var(--lingo-text-muted)]">We’ll personalize practice around these sounds.</p>
        </div>
        <ScoreRing score={overallScore}/>
      </header>

      <div className="relative mt-4">
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
              <ul className="grid grid-cols-3 gap-2">
                {weaknesses.map((tag) => (
                  <li
                    key={tag.tag}
                    className="flex min-h-11 flex-col items-center justify-center rounded-xl py-2 bg-[var(--lingo-sky-pale)] px-3.5"
                  >
                    <span className="text-center text-xs font-bold text-[var(--lingo-navy)]">
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
            <div className="grid grid-cols-4 gap-2">
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

          <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-20 rounded-2xl border border-[var(--lingo-border)] bg-white p-3 md:bottom-4">
            <div className="w-full">
              <button
                type="button"
                disabled={saving}
                onClick={() => void startFirst()}
                className="h-[52px] w-full rounded-2xl px-5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "var(--lingo-accent-gradient)" }}
              >
                {saving ? "Starting…" : "Build my personalized practice →"}
              </button>
              <Link href="/app/pronunciation/learn" className="mt-1 flex min-h-11 items-center justify-center text-center text-sm font-semibold text-[var(--lingo-teal)] underline">Learn the tone concepts in Tone Mastery</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
