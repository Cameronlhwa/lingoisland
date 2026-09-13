"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

type Step = "level" | "topics" | "time" | "preview";

const HSK_LEVELS = ["1", "2", "3", "4", "5", "6", "7-9"];
const TOPIC_OPTIONS = [
  "✈️ Travel",
  "🏠 Daily life",
  "🍜 Food",
  "💼 Work",
  "👨‍👩‍👧 Friends & family",
  "🎨 Hobbies",
  "🛍 Shopping",
];
const TIME_OPTIONS = [5, 10, 15];

const FEATURES = [
  { icon: "🎯", title: "Practice what you need", body: "Sentences generated around your level and interests." },
  { icon: "👂", title: "Train your ear, then your mouth", body: "Listen and repeat, word first, then the full sentence." },
  { icon: "🗣️", title: "Feedback that actually helps", body: "Not just a score — the specific fix for each sound." },
  { icon: "📈", title: "See yourself improve", body: "Your pronunciation is tracked over time." },
];

export default function PronunciationSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("level");
  const [hskLevel, setHskLevel] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTopic = (key: string) => {
    setTopics((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  };

  const resolvedMinutes = dailyMinutes ?? (customMinutes ? Number(customMinutes) : null);

  const finish = async () => {
    if (!hskLevel || !resolvedMinutes) return;
    setSubmitting(true);
    setError(null);
    try {
      const profileRes = await fetch("/api/pronunciation/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hskLevel,
          topics,
          customTopic: customTopic.trim() || null,
          dailyMinutes: resolvedMinutes,
        }),
      });
      if (!profileRes.ok) throw new Error("Unable to save your preferences.");

      const sessionRes = await fetch("/api/pronunciation/session", { method: "POST" });
      const sessionData = await sessionRes.json().catch(() => ({}));
      if (!sessionRes.ok || !sessionData.sessionId) {
        throw new Error(typeof sessionData?.error === "string" ? sessionData.error : "Unable to start practice.");
      }
      router.push(`/app/pronunciation/session/${sessionData.sessionId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:px-6">
      <div className="rounded-[28px] border border-[var(--lingo-accent-border)] bg-white p-6 shadow-sm sm:p-8" style={{ boxShadow: "var(--lingo-shadow-card)" }}>
        {step === "level" && (
          <>
            <h1 className="lingo-display text-xl font-bold text-[var(--lingo-navy)]">What's your current level?</h1>
            <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">
              This makes sure your practice sentences use vocabulary you actually know.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {HSK_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setHskLevel(level)}
                  className={`flex items-center justify-between rounded-2xl border-[1.5px] px-4 py-3 text-sm font-bold transition ${
                    hskLevel === level
                      ? "border-[var(--lingo-blue)] bg-[var(--lingo-sky-pale)] text-[var(--lingo-navy)]"
                      : "border-[var(--lingo-accent-border)] bg-white text-[var(--lingo-navy)]"
                  }`}
                >
                  HSK {level}
                  {hskLevel === level && <Check size={16} className="text-[var(--lingo-blue)]" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!hskLevel}
              onClick={() => setStep("topics")}
              className="mt-6 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              style={{ background: "var(--lingo-accent-gradient)" }}
            >
              Continue
            </button>
          </>
        )}

        {step === "topics" && (
          <>
            <h1 className="lingo-display text-xl font-bold text-[var(--lingo-navy)]">
              What would you actually like to talk about?
            </h1>
            <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">Choose as many as you like.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {TOPIC_OPTIONS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className={`rounded-xl border-[1.5px] px-3.5 py-2 text-sm font-semibold transition ${
                    topics.includes(topic)
                      ? "border-[var(--lingo-navy)] bg-[var(--lingo-navy)] text-white"
                      : "border-[var(--lingo-accent-border)] bg-white text-[var(--lingo-navy)]"
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
            <input
              value={customTopic}
              onChange={(event) => setCustomTopic(event.target.value)}
              placeholder="Something else… (e.g. skincare, tech)"
              className="mt-4 w-full rounded-2xl border-[1.5px] border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)] px-4 py-3 text-sm text-[var(--lingo-navy)] placeholder:text-[var(--lingo-text-muted)] focus:border-[var(--lingo-blue)] focus:outline-none"
            />
            <button
              type="button"
              disabled={topics.length === 0 && !customTopic.trim()}
              onClick={() => setStep("time")}
              className="mt-6 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              style={{ background: "var(--lingo-accent-gradient)" }}
            >
              Continue
            </button>
          </>
        )}

        {step === "time" && (
          <>
            <h1 className="lingo-display text-xl font-bold text-[var(--lingo-navy)]">
              How much time do you have today?
            </h1>
            <div className="mt-5 flex flex-col gap-2">
              {TIME_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => {
                    setDailyMinutes(minutes);
                    setCustomMinutes("");
                  }}
                  className={`flex items-center justify-between rounded-2xl border-[1.5px] px-4 py-3 text-sm font-bold transition ${
                    dailyMinutes === minutes
                      ? "border-[var(--lingo-blue)] bg-[var(--lingo-sky-pale)] text-[var(--lingo-navy)]"
                      : "border-[var(--lingo-accent-border)] bg-white text-[var(--lingo-navy)]"
                  }`}
                >
                  {minutes} min
                  {dailyMinutes === minutes && <Check size={16} className="text-[var(--lingo-blue)]" />}
                </button>
              ))}
              <div
                className={`flex items-center gap-2 rounded-2xl border-[1.5px] px-4 py-3 ${
                  dailyMinutes === null && customMinutes
                    ? "border-[var(--lingo-blue)] bg-[var(--lingo-sky-pale)]"
                    : "border-[var(--lingo-accent-border)] bg-white"
                }`}
              >
                <span className="text-sm font-bold text-[var(--lingo-navy)]">Set my own</span>
                <input
                  type="number"
                  min={1}
                  value={customMinutes}
                  onChange={(event) => {
                    setCustomMinutes(event.target.value);
                    setDailyMinutes(null);
                  }}
                  className="w-16 rounded-lg border border-[var(--lingo-accent-border)] px-2 py-1 text-sm text-[var(--lingo-navy)] focus:border-[var(--lingo-blue)] focus:outline-none"
                />
                <span className="text-sm text-[var(--lingo-text-muted)]">min</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--lingo-text-muted)]">You can always change this later.</p>
            <button
              type="button"
              disabled={!resolvedMinutes}
              onClick={() => setStep("preview")}
              className="mt-6 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
              style={{ background: "var(--lingo-accent-gradient)" }}
            >
              Continue
            </button>
          </>
        )}

        {step === "preview" && (
          <>
            <h1 className="lingo-display text-xl font-bold text-[var(--lingo-navy)]">
              Your personalized pronunciation practice
            </h1>
            <div className="mt-4 divide-y divide-[var(--lingo-border)]">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="flex gap-3 py-3">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[var(--lingo-sky-pale)] text-base">
                    {feature.icon}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[var(--lingo-navy)]">{feature.title}</p>
                    <p className="text-xs text-[var(--lingo-text-muted)]">{feature.body}</p>
                  </div>
                </div>
              ))}
            </div>
            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              disabled={submitting}
              onClick={() => void finish()}
              className="mt-6 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
              style={{ background: "var(--lingo-accent-gradient)" }}
            >
              {submitting ? "Preparing your session…" : "Start today's practice"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
