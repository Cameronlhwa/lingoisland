"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Loader2, MessageCircle, BriefcaseBusiness } from "lucide-react";
import Button from "@/components/ui/Button";
import { SENTENCE_STYLE_OPTIONS, type SentenceStyle } from "@/lib/sentenceStyle";
import { PROFILE_LEVEL_OPTIONS } from "@/lib/levelBands";
import { useLanguage } from "@/contexts/LanguageContext";

const LEVELS = PROFILE_LEVEL_OPTIONS.map((option) => ({ code: option.cefr, label: `HSK ${option.hsk}`, desc: option.label }));
const TOPIC_IDEAS = ["Coffee shop conversations", "Business emails", "Travel"];

export default function JourneyCreatePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get("topic")?.trim() ?? "");
  const [level, setLevel] = useState("B1");
  const [sentenceStyle, setSentenceStyle] = useState<SentenceStyle>("casual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = topic.trim();
    if (!trimmed) {
      setError(t("Please enter a topic for your journey."));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/journey/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: trimmed, cefrLevel: level, learningGoal: trimmed, sentenceStyle, timeLabel: "15min", daysPerWeek: 4 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? t("Failed to create journey. Please try again."));
        return;
      }
      if (data.journeyId) router.push("/app/journey");
      else setError(t("Unexpected response from server."));
    } catch {
      setError(t("Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const selectionClass = (active: boolean) => `flex h-full cursor-pointer flex-col rounded-2xl border-2 p-4 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-[var(--lingo-teal)] peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${active ? "border-[var(--lingo-teal)] bg-[var(--lingo-sky-pale)]" : "border-[var(--lingo-border)] bg-white hover:border-[var(--lingo-teal)]"}`;

  return (
    <div className="min-h-screen bg-[var(--lingo-sky-pale)] px-4 py-6 text-[var(--lingo-navy)] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => router.back()} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--lingo-text-muted)] hover:text-[var(--lingo-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
          <ArrowLeft size={16} aria-hidden="true" /> {t("Back")}
        </button>
        <header className="mb-7 mt-5 sm:mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--lingo-teal)]">{t("New Journey")}</p>
          <h1 className="lingo-display mt-3 max-w-xl text-3xl font-bold leading-tight sm:text-4xl">{t("What do you want")} <span className="text-[var(--lingo-teal)]">{t("to learn about?")}</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--lingo-text-muted)]">{t("Pick a topic and your level — we'll build a custom learning path in seconds.")}</p>
        </header>

        <form onSubmit={(event) => { event.preventDefault(); if (!loading) void handleCreate(); }} aria-busy={loading} className="space-y-8 rounded-[28px] border border-[var(--lingo-border)] bg-white p-5 sm:p-8">
          <div>
            <label htmlFor="topic" className="mb-3 block text-sm font-bold">{t("Topic")}</label>
            <input id="topic" name="topic" type="text" value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={t("e.g. Coffee shop conversations, K-pop, Business emails…")} required disabled={loading} className="min-h-12 w-full rounded-2xl border-2 border-[var(--lingo-border)] bg-[var(--lingo-page-bg)] px-4 py-3 text-sm text-[var(--lingo-navy)] outline-none transition-colors placeholder:text-[var(--lingo-text-muted)] focus:border-[var(--lingo-teal)] focus:ring-2 focus:ring-[var(--lingo-sky-pale)] disabled:opacity-60" />
            <div className="mt-3 flex flex-wrap gap-2">
              {TOPIC_IDEAS.map((idea) => <button key={idea} type="button" disabled={loading} onClick={() => setTopic(t(idea))} className="min-h-9 rounded-full border border-[var(--lingo-border)] bg-[var(--lingo-sky-pale)] px-3 py-1.5 text-xs font-semibold text-[var(--lingo-text-muted)] transition-colors hover:border-[var(--lingo-teal)] hover:text-[var(--lingo-teal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60">{t(idea)}</button>)}
            </div>
          </div>

          <fieldset disabled={loading}>
            <legend className="mb-3 text-sm font-bold">{t("Your Mandarin Level")}</legend>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {LEVELS.map((option) => {
                const active = level === option.code;
                return <label key={option.code} className="relative">
                  <input type="radio" name="level" value={option.code} checked={active} onChange={() => setLevel(option.code)} className="peer sr-only" />
                  <span className={selectionClass(active)}>
                    <span className="flex items-center justify-between gap-2 text-sm font-bold"><span>{option.label}</span><Check size={15} aria-hidden="true" className={active ? "shrink-0 text-[var(--lingo-teal)]" : "invisible shrink-0"} /></span>
                    <span className="mt-1 text-xs leading-relaxed text-[var(--lingo-text-muted)]">{t(option.desc)}</span>
                  </span>
                </label>;
              })}
            </div>
          </fieldset>

          <fieldset disabled={loading}>
            <legend className="mb-3 text-sm font-bold">{t("Example Sentences")}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {SENTENCE_STYLE_OPTIONS.map((option) => {
                const active = sentenceStyle === option.value;
                const Icon = option.value === "professional" ? BriefcaseBusiness : MessageCircle;
                return <label key={option.value} className="relative">
                  <input type="radio" name="sentenceStyle" value={option.value} checked={active} onChange={() => setSentenceStyle(option.value)} className="peer sr-only" />
                  <span className={selectionClass(active)}>
                    <span className="flex items-center gap-2 text-sm font-bold"><Icon size={18} className="text-[var(--lingo-teal)]" aria-hidden="true" />{t(option.label)}<Check size={16} aria-hidden="true" className={`ml-auto text-[var(--lingo-teal)] ${active ? "" : "invisible"}`} /></span>
                    <span className="mt-2 text-xs leading-relaxed text-[var(--lingo-text-muted)]">{t(option.description)}</span>
                  </span>
                </label>;
              })}
            </div>
          </fieldset>

          {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <div className="border-t border-[var(--lingo-border)] pt-6">
            <Button type="submit" disabled={loading || !topic.trim()} className="w-full">{loading ? <><Loader2 size={18} className="animate-spin" aria-hidden="true" />{t("Building your journey…")}</> : t("Create journey →")}</Button>
            {loading && <p role="status" className="mt-4 text-center text-xs leading-relaxed text-[var(--lingo-text-muted)]">{t("We're generating your personalized learning path. This takes about 10 seconds.")}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}
