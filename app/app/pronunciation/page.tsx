"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Profile = {
  hsk_level: string;
  topics: string[];
  custom_topic: string | null;
  daily_minutes: number;
  streak_count: number;
  overall_score: number | null;
};

export default function PronunciationHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/pronunciation/profile", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setProfile(data.profile ?? null);
      setLoading(false);
    })();
  }, []);

  const startPractice = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/pronunciation/session", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sessionId) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to start practice.");
      }
      router.push(`/app/pronunciation/session/${data.sessionId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start practice.");
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <div className="overflow-hidden rounded-[32px] shadow-sm" style={{ boxShadow: "var(--lingo-shadow-card)" }}>
        <div className="relative h-48 w-full sm:h-64">
          <Image
            src="/animation-photos/hero-pronunciation-island.png"
            alt=""
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="bg-white p-6 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-blue)]">
            Pronunciation Practice
          </p>
          <h1 className="lingo-display mt-1 text-2xl font-bold text-[var(--lingo-navy)] sm:text-3xl">
            {profile ? "Ready for today's practice?" : "Let's fix your pronunciation"}
          </h1>
          <p className="mt-2 text-sm text-[var(--lingo-text-muted)]">
            {profile
              ? "Short, focused sessions built around your level and interests."
              : "A couple quick questions, then we'll build practice sentences just for you."}
          </p>

          {profile && (
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--lingo-sky-pale)] px-3 py-1.5 text-xs font-bold text-[var(--lingo-navy)]">
                HSK {profile.hsk_level}
              </span>
              {profile.topics.slice(0, 3).map((topic) => (
                <span key={topic} className="rounded-full bg-[var(--lingo-sky-pale)] px-3 py-1.5 text-xs font-bold text-[var(--lingo-navy)]">
                  {topic}
                </span>
              ))}
              {profile.streak_count > 0 && (
                <span className="rounded-full bg-[var(--lingo-navy)] px-3 py-1.5 text-xs font-bold text-white">
                  🔥 {profile.streak_count} day streak
                </span>
              )}
            </div>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-6">
            {profile ? (
              <button
                type="button"
                onClick={() => void startPractice()}
                disabled={starting}
                className="rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
                style={{ background: "var(--lingo-accent-gradient)" }}
              >
                {starting ? "Preparing your session…" : "Start today's practice"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.push("/app/pronunciation/onboarding/setup")}
                className="rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5"
                style={{ background: "var(--lingo-accent-gradient)" }}
              >
                Set up my practice
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
