"use client";

import { useState } from "react";
import {
  BookOpen,
  Check,
  Layers,
  Lock,
  Map,
  MessageCircle,
  Sparkles,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Map,
    title: "Unlimited Journeys",
    desc: "Generate a full 5-island journey on any topic, any time.",
  },
  {
    icon: Layers,
    title: "Custom Topic Islands",
    desc: "Learn any niche topic fast — one laser-focused island.",
  },
  {
    icon: BookOpen,
    title: "Custom Story Creation",
    desc: "Stories built around your words and your interests.",
  },
  {
    icon: Sparkles,
    title: "Topic Suggestions",
    desc: "Smart recommendations based on your level and goals.",
  },
  {
    icon: MessageCircle,
    title: "24/7 Mandarin Helper",
    desc: "Ask anything — grammar, usage, pronunciation — instantly.",
  },
];

export default function JourneyIslandPaywall({
  journeyTitle,
  wordsPerWeek,
  weeksToComplete,
  completedWords,
  lockedIslands,
  onSubscribe,
}: {
  journeyTitle: string;
  wordsPerWeek: number;
  weeksToComplete: number;
  completedWords: number;
  lockedIslands: Array<{
    order: number;
    name: string;
    zh: string | null;
    node_type: "island" | "story";
    hint: string | null;
  }>;
  onSubscribe: (interval: "monthly" | "yearly") => void;
}) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");

  const totalWords = 50;
  // +1 for the island the user just completed (Island 1)
  const islandCount =
    lockedIslands.filter((i) => i.node_type === "island").length + 1;
  const storyCount = lockedIslands.filter((i) => i.node_type === "story").length;
  // Fallback to the standard 5-island / 2-story journey shape if data is missing
  const displayIslands = islandCount > 1 ? islandCount : 5;
  const displayStories = storyCount > 0 ? storyCount : 2;

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-gray-900 shadow-xl">
      <div className="grid lg:grid-cols-[1fr_1fr]">

        {/* ── Left: dark journey panel ── */}
        <div className="bg-gray-900 px-6 py-6 text-white">
          {/* Completion badge */}
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-teal-500/20 px-3 py-1 text-xs font-bold text-teal-400">
            <Check size={11} strokeWidth={3} />
            Island 1 complete · {completedWords} words
          </div>

          <h3 className="text-xl font-black leading-tight">
            Your {journeyTitle} journey
          </h3>
          <p className="mt-1 text-sm text-gray-400">
            {totalWords} words across {displayIslands} islands + {displayStories} stories
          </p>

          {/* Projection card */}
          <div className="mt-4 rounded-xl bg-white/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <Zap size={14} className="mt-0.5 flex-shrink-0 text-teal-400" />
              <p className="text-sm leading-snug text-gray-200">
                At your pace, you&apos;ll know{" "}
                <strong className="text-white">all {totalWords} words</strong>{" "}
                in{" "}
                <strong className="text-white">
                  ~{weeksToComplete} {weeksToComplete === 1 ? "week" : "weeks"}
                </strong>
                .
              </p>
            </div>
          </div>

          {/* What's waiting */}
          <p className="mb-3 mt-5 text-[10px] font-black uppercase tracking-widest text-gray-400">
            What&apos;s Waiting
          </p>
          <ul className="space-y-2">
            {lockedIslands.map((item) =>
              item.node_type === "story" ? (
                <li
                  key={`story-${item.order}`}
                  className="flex items-center gap-2.5 rounded-lg bg-amber-500/10 px-3 py-2"
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-amber-500/30">
                    <BookOpen size={11} className="text-amber-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-100">
                      {item.name}
                    </p>
                    {item.hint && (
                      <p className="text-[10px] text-amber-400">{item.hint}</p>
                    )}
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                    Story
                  </span>
                </li>
              ) : (
                <li
                  key={`island-${item.order}`}
                  className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2"
                >
                  <Lock size={12} className="flex-shrink-0 text-gray-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-300">
                      {item.name}
                    </p>
                    {item.zh && (
                      <p className="text-[10px] text-gray-500">{item.zh}</p>
                    )}
                  </div>
                </li>
              )
            )}
          </ul>
        </div>

        {/* ── Right: upgrade panel ── */}
        <div className="bg-white px-6 py-6">
          <h2 className="text-xl font-black text-gray-900">
            Unlock everything
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Finish this journey and get every tool to keep going.
          </p>

          <ul className="mt-5 space-y-3.5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-900">
                  <Icon size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </li>
            ))}
            <li className="flex items-center gap-2 pt-0.5 text-xs text-gray-400">
              <Sparkles size={11} className="text-gray-300" />
              + SRS reviews, daily stories, quiz decks &amp; more
            </li>
          </ul>

          {/* Billing toggle */}
          <div className="mt-6 flex rounded-xl border border-gray-200 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={`flex-1 rounded-lg py-2 transition-colors ${
                billing === "monthly"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={`flex-1 rounded-lg py-2 transition-colors ${
                billing === "yearly"
                  ? "bg-gray-900 text-white"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Annual{" "}
              <span className="ml-1 rounded-full bg-teal-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                -42%
              </span>
            </button>
          </div>

          {/* Price */}
          <div className="mt-4 text-center">
            {billing === "monthly" ? (
              <p className="text-3xl font-black text-gray-900">
                $9.99
                <span className="text-base font-semibold text-gray-500">
                  /month
                </span>
              </p>
            ) : (
              <>
                <p className="text-3xl font-black text-gray-900">
                  $6.67
                  <span className="text-base font-semibold text-gray-500">
                    /month
                  </span>{" "}
                  <span className="text-base font-medium text-gray-400 line-through">
                    $9.99
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-gray-400">
                  Billed $79.99/year · save $40
                </p>
              </>
            )}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={() => onSubscribe(billing)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-4 text-sm font-black text-white transition-colors hover:bg-gray-700"
          >
            Unlock everything →
          </button>
          <p className="mt-2 text-center text-xs text-gray-400">
            Cancel anytime · No questions asked
          </p>
        </div>
      </div>
    </div>
  );
}
