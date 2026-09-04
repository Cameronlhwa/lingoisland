"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  SENTENCE_STYLE_OPTIONS,
  type SentenceStyle,
} from "@/lib/sentenceStyle";

import { PROFILE_LEVEL_OPTIONS } from "@/lib/levelBands";

const LEVELS = PROFILE_LEVEL_OPTIONS.map((o) => ({
  code: o.cefr,
  label: `HSK ${o.hsk}`,
  desc: o.label,
}));

export default function JourneyCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicFromQuery = searchParams.get("topic")?.trim() ?? "";
  const [topic, setTopic] = useState(topicFromQuery);
  const [level, setLevel] = useState("B1");
  const [sentenceStyle, setSentenceStyle] = useState<SentenceStyle>("casual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = topic.trim();
    if (!trimmed) {
      setError("Please enter a topic for your journey.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/journey/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: trimmed,
          cefrLevel: level,
          // Use the topic itself as the learning goal so the plan is contextually relevant.
          learningGoal: trimmed,
          sentenceStyle,
          timeLabel: "15min",
          daysPerWeek: 4,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to create journey. Please try again.");
        return;
      }
      if (data.journeyId) {
        router.push(`/app/journey`);
      } else {
        setError("Unexpected response from server.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "#f0f7fa" }}>
      {/* Header */}
      <div className="flex h-14 items-center border-b border-[#ddeef7] bg-white px-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-lg px-6 py-14">
        {/* Heading */}
        <p className="mb-1 text-xs font-black uppercase tracking-widest text-[#8aa8b5]">
          New Journey
        </p>
        <h1 className="text-3xl font-black leading-tight text-[#1a2332]">
          What do you want
          <br />
          to <em className="not-italic text-[#4a9fc4]">learn about?</em>
        </h1>
        <p className="mt-2 text-sm text-[#7a9aaa]">
          Pick a topic and your level — we'll build a custom learning path in seconds.
        </p>

        {/* Form */}
        <div className="mt-10 flex flex-col gap-8">
          {/* Topic */}
          <div>
            <label
              htmlFor="topic"
              className="mb-2 block text-xs font-black uppercase tracking-widest text-[#1a2332]"
            >
              Topic
            </label>
            <input
              id="topic"
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleCreate()}
              placeholder="e.g. Coffee shop conversations, K-pop, Business emails…"
              disabled={loading}
              className="w-full rounded-xl border border-[#c8dce6] bg-white px-4 py-3 text-sm font-medium text-[#1a2332] placeholder-[#b5cdd8] outline-none transition focus:border-[#4a9fc4] focus:ring-2 focus:ring-[#4a9fc4]/20 disabled:opacity-60"
            />
          </div>

          {/* Level */}
          <div>
            <label className="mb-3 block text-xs font-black uppercase tracking-widest text-[#1a2332]">
              Your Mandarin Level
            </label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => {
                const active = level === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    disabled={loading}
                    onClick={() => setLevel(l.code)}
                    className="flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all disabled:opacity-60"
                    style={
                      active
                        ? {
                            background: "#1a2332",
                            borderColor: "#1a2332",
                            color: "#ffffff",
                          }
                        : {
                            background: "#ffffff",
                            borderColor: "#c8dce6",
                            color: "#1a2332",
                          }
                    }
                  >
                    <span className="text-sm font-black">{l.label}</span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: active ? "rgba(255,255,255,0.65)" : "#8aa8b5" }}
                    >
                      {l.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sentence style */}
          <div>
            <label className="mb-3 block text-xs font-black uppercase tracking-widest text-[#1a2332]">
              Example Sentences
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              {SENTENCE_STYLE_OPTIONS.map((option) => {
                const active = sentenceStyle === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={loading}
                    onClick={() => setSentenceStyle(option.value)}
                    className="flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-all disabled:opacity-60"
                    style={
                      active
                        ? {
                            background: "#1a2332",
                            borderColor: "#1a2332",
                            color: "#ffffff",
                          }
                        : {
                            background: "#ffffff",
                            borderColor: "#c8dce6",
                            color: "#1a2332",
                          }
                    }
                  >
                    <span className="text-sm font-black">{option.label}</span>
                    <span
                      className="mt-1 text-[10px] font-medium leading-snug"
                      style={{
                        color: active ? "rgba(255,255,255,0.65)" : "#8aa8b5",
                      }}
                    >
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            type="button"
            disabled={loading || !topic.trim()}
            onClick={handleCreate}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black text-white transition-all disabled:opacity-50"
            style={{ background: "#1a2332" }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Building your journey…
              </>
            ) : (
              "Create journey →"
            )}
          </button>

          {loading && (
            <p className="text-center text-xs text-[#8aa8b5]">
              We're generating your personalized learning path. This takes about 10 seconds.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
