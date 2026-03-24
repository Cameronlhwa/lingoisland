"use client";

import { useState } from "react";
import { Lock } from "lucide-react";

export default function JourneyIslandPaywall({
  journeyTitle,
  topic,
  wordsPerWeek,
  weeksToComplete,
  lockedIslands,
  onSubscribe,
}: {
  journeyTitle: string;
  topic: string;
  wordsPerWeek: number;
  weeksToComplete: number;
  lockedIslands: Array<{ name: string; zh: string | null }>;
  onSubscribe: (interval: "monthly" | "yearly") => void;
}) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");

  return (
    <div className="mt-12 border-2 border-slate-900 rounded-2xl overflow-hidden bg-white">
      <div className="bg-slate-900 px-6 py-5 text-white">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          YOUR JOURNEY
        </p>
        <h3 className="mt-1 text-xl font-black">{journeyTitle}</h3>
        <p className="mt-1 text-sm text-slate-300">50 words total on this path</p>
        <p className="mt-4 text-sm leading-relaxed text-slate-100">
          At your pace you&apos;ll know{" "}
          <strong className="text-white">{wordsPerWeek} words about {topic}</strong> in
          just one week — and be conversational on this topic in ~
          <strong className="text-white">{weeksToComplete}</strong> weeks.
        </p>
      </div>
      <div className="px-6 py-6">
        <p className="text-sm font-bold text-slate-900">What&apos;s waiting for you</p>
        <ul className="mt-3 space-y-2">
          {lockedIslands.map((island) => (
            <li
              key={island.name}
              className="flex items-center gap-2 text-sm text-slate-700"
            >
              <Lock className="h-4 w-4 text-slate-400 shrink-0" />
              <span>
                {island.name}
                {island.zh ? (
                  <span className="text-slate-500"> · {island.zh}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex rounded-xl border border-slate-200 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`flex-1 rounded-lg py-2 ${
              billing === "monthly"
                ? "bg-slate-900 text-white"
                : "text-slate-600"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={`flex-1 rounded-lg py-2 ${
              billing === "yearly"
                ? "bg-slate-900 text-white"
                : "text-slate-600"
            }`}
          >
            Annual · save 42%
          </button>
        </div>
        <div className="mt-4 text-center">
          {billing === "monthly" ? (
            <p className="text-2xl font-black text-slate-900">
              $9.99<span className="text-base font-semibold">/month</span>
            </p>
          ) : (
            <>
              <p className="text-2xl font-black text-slate-900">
                $6.67<span className="text-base font-semibold">/month</span>
              </p>
              <p className="text-sm text-slate-500">billed as $79.99 / year</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSubscribe(billing)}
          className="mt-6 w-full rounded-xl bg-slate-900 py-4 text-center text-lg font-semibold text-white"
        >
          Unlock full journey →
        </button>
        <p className="mt-3 text-center text-xs text-slate-500">
          Cancel anytime · No questions asked
        </p>
      </div>
    </div>
  );
}
