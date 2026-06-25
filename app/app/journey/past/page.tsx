"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BookMarked,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Coffee,
  Cpu,
  Layers,
  Map,
  MapPin,
  Plane,
  Plus,
  Search,
  Type,
  Utensils,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CompletedJourney } from "@/types/journey";

const ACCENT_COLORS = [
  "#14b8a6",
  "#0ea5e9",
  "#1a2332",
  "#0f766e",
  "#0284c7",
  "#6366f1",
];

function accentFor(topic: string): string {
  const hash = Array.from(topic).reduce((n, c) => n + c.charCodeAt(0), 0);
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

function iconFor(topic: string): LucideIcon {
  const t = topic.toLowerCase();
  if (/tech|ai|computer|software|code|digital|程序|技术/.test(t)) return Cpu;
  if (/coffee|caf[eé]|drink|tea|咖啡/.test(t)) return Coffee;
  if (/health|hospital|medical|doctor|clinic|医/.test(t)) return Activity;
  if (/financ|money|bank|invest|econom|钱|金融/.test(t)) return Wallet;
  if (/travel|airport|flight|trip|tour|旅|飞机/.test(t)) return Plane;
  if (/food|restaurant|eat|cook|cuisin|吃|餐/.test(t)) return Utensils;
  return BookMarked;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function JourneyTicket({ journey }: { journey: CompletedJourney }) {
  const router = useRouter();
  const accent = accentFor(journey.topic);
  const TopicIcon = iconFor(journey.topic);
  const isCompleted = !!journey.completed_at;

  const islands = journey.journey_islands.filter((n) => n.node_type === "island");
  const stories = journey.journey_islands.filter((n) => n.node_type === "story");
  const doneIslands = islands.filter((n) => !!n.completed_at);
  const totalWords = islands.reduce(
    (s, n) => s + (n.word_count ?? ((n.step_order ?? 0) === 1 ? 5 : 10)),
    0,
  );
  const wordsLearned = doneIslands.reduce(
    (s, n) => s + (n.word_count ?? ((n.step_order ?? 0) === 1 ? 5 : 10)),
    0,
  );

  const badge = isCompleted
    ? `All ${islands.length} islands`
    : `Island ${doneIslands.length} of ${islands.length}`;

  const dateLabel = isCompleted
    ? `Completed ${fmtDate(journey.completed_at!)}`
    : `Started ${fmtDate(journey.created_at)}`;

  const meta = [
    { Icon: Layers, label: `${islands.length} islands` },
    { Icon: Type, label: `${totalWords} words` },
    ...(stories.length > 0
      ? [
          {
            Icon: BookOpen,
            label: `${stories.length} ${stories.length === 1 ? "story" : "stories"}`,
          },
        ]
      : []),
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/app/journey/${journey.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/app/journey/${journey.id}`)}
      className="group relative flex cursor-pointer overflow-visible rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
    >
      <div
        className="w-1.5 shrink-0 rounded-l-2xl"
        style={{ background: accent }}
      />

      <div className="relative flex min-w-0 flex-1 flex-col gap-1.5 overflow-hidden border-r-2 border-dashed border-gray-200 px-4 py-4 pl-[17px]">
        <div className="absolute -right-[9px] -top-[9px] z-[2] h-[17px] w-[17px] rounded-full bg-white" />
        <div className="absolute -bottom-[9px] -right-[9px] z-[2] h-[17px] w-[17px] rounded-full bg-white" />

        <div className="flex items-center gap-1">
          <MapPin size={11} style={{ color: accent }} />
          <span
            className="text-[10.5px] font-bold uppercase tracking-wide"
            style={{ color: accent }}
          >
            {badge}
          </span>
        </div>

        <p className="m-0 line-clamp-2 text-[15.5px] font-black leading-tight tracking-tight text-gray-900">
          {journey.topic}
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          {meta.map(({ Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1 text-xs text-gray-500"
            >
              <Icon size={12} className="text-gray-400" />
              {label}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Calendar size={11} className="text-gray-400" />
          <span className="text-[11.5px] text-gray-400">{dateLabel}</span>
        </div>
      </div>

      <div className="flex w-[108px] shrink-0 flex-col items-center justify-between gap-2.5 px-3 py-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}26` }}
        >
          <TopicIcon size={20} style={{ color: accent }} />
        </div>

        <div className="text-center">
          <p className="m-0 text-[22px] font-black leading-none text-gray-900">
            {isCompleted ? totalWords : wordsLearned}
          </p>
          <p className="mt-0.5 text-[10px] text-gray-400">
            {isCompleted ? "words learned" : "words done"}
          </p>
        </div>

        <div
          className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${
            isCompleted
              ? "bg-teal-50 text-teal-600"
              : "bg-amber-50 text-amber-600"
          }`}
        >
          {isCompleted ? <Check size={10} /> : <Clock size={10} />}
          {isCompleted ? "Completed" : "In Progress"}
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  journeys,
}: {
  label: string;
  journeys: CompletedJourney[];
}) {
  if (journeys.length === 0) return null;
  return (
    <div className="mb-8">
      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
        {label}
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {journeys.map((j) => (
          <JourneyTicket key={j.id} journey={j} />
        ))}
      </div>
    </div>
  );
}

type Filter = "all" | "in-progress" | "completed";

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? "bg-[#1a2332] text-white"
          : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

export default function MyJourneysPage() {
  const router = useRouter();
  const [journeys, setJourneys] = useState<CompletedJourney[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/journey/past", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setJourneys(data.journeys ?? []);
      }
      setLoading(false);
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    let list = journeys;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((j) => j.topic.toLowerCase().includes(q));
    }
    if (filter === "in-progress") list = list.filter((j) => !j.completed_at);
    if (filter === "completed") list = list.filter((j) => !!j.completed_at);
    return list;
  }, [journeys, filter, search]);

  const inProgress = filtered.filter((j) => !j.completed_at);
  const completed = filtered.filter((j) => !!j.completed_at);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1380px]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
              Learning Path
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900">
              My Journeys
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              All your journeys — active, in progress, and completed.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/app/journey")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Journey
            </button>
            <button
              type="button"
              onClick={() => router.push("/app/journey/create")}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-[#1a2332] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#2d3a4d]"
            >
              <Plus className="h-3.5 w-3.5" />
              New Journey
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search journeys…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-60 rounded-xl border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-teal-400 focus:outline-none"
            />
          </div>

          <div className="flex gap-1.5">
            <Chip
              label="All"
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <Chip
              label="In Progress"
              active={filter === "in-progress"}
              onClick={() => setFilter("in-progress")}
            />
            <Chip
              label="Completed"
              active={filter === "completed"}
              onClick={() => setFilter("completed")}
            />
          </div>

          <span className="ml-auto text-sm text-gray-500">
            {filtered.length} journey{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3.5 pt-20">
            <Map size={40} className="text-gray-300" />
            <p className="m-0 text-lg font-black text-gray-900">
              No journeys yet
            </p>
            <p className="m-0 max-w-[280px] text-center text-sm leading-relaxed text-gray-500">
              Your completed and in-progress journeys will appear here.
            </p>
            <button
              type="button"
              onClick={() => router.push("/app/journey/create")}
              className="mt-1.5 rounded-xl bg-[#1a2332] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2d3a4d]"
            >
              Start your first journey →
            </button>
          </div>
        )}

        {(filter === "all" || filter === "in-progress") && (
          <Section label="In Progress" journeys={inProgress} />
        )}
        {(filter === "all" || filter === "completed") && (
          <Section label="Completed" journeys={completed} />
        )}
      </div>
    </div>
  );
}
