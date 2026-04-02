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

// ─── Design tokens ────────────────────────────────────────────────────────────

const ACCENT_PALETTE = [
  "#4a9fc4",
  "#5abeaa",
  "#e8a83a",
  "#9b7ee8",
  "#e87e7e",
  "#5aaa72",
];

function accentFor(topic: string): string {
  const hash = [...topic].reduce((n, c) => n + c.charCodeAt(0), 0);
  return ACCENT_PALETTE[hash % ACCENT_PALETTE.length];
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

// ─── Ferry Ticket Card ────────────────────────────────────────────────────────

function JourneyTicket({ journey }: { journey: CompletedJourney }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  const accent = accentFor(journey.topic);
  const TopicIcon = iconFor(journey.topic);
  const isCompleted = !!journey.completed_at;

  const islands = journey.journey_islands.filter((n) => n.node_type === "island");
  const stories = journey.journey_islands.filter((n) => n.node_type === "story");
  const doneIslands = islands.filter((n) => !!n.completed_at);
  // word_count is now set by the API from the actual topic_island word_target,
  // falling back to the design rule (island 1 = 5 words, others = 10).
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
      ? [{ Icon: BookOpen, label: `${stories.length} ${stories.length === 1 ? "story" : "stories"}` }]
      : []),
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/app/journey/${journey.id}`)}
      onKeyDown={(e) => e.key === "Enter" && router.push(`/app/journey/${journey.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        borderRadius: 14,
        background: "white",
        border: "1px solid #e8f0f5",
        overflow: "visible",
        cursor: "pointer",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 8px 24px rgba(26,35,50,0.12)"
          : "0 1px 4px rgba(26,35,50,0.06)",
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
        position: "relative",
      }}
    >
      {/* Accent strip */}
      <div
        style={{
          width: 7,
          background: accent,
          flexShrink: 0,
          borderRadius: "14px 0 0 14px",
        }}
      />

      {/* Left half */}
      <div
        style={{
          flex: 1,
          padding: "16px 20px 15px 17px",
          display: "flex",
          flexDirection: "column",
          gap: 7,
          position: "relative",
          minWidth: 0,
          borderRight: "2px dashed #ddeaf0",
          overflow: "hidden",
        }}
      >
        {/* Notch cutouts */}
        <div
          style={{
            position: "absolute",
            right: -9,
            top: -9,
            width: 17,
            height: 17,
            borderRadius: "50%",
            background: "#f0f7fa",
            zIndex: 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -9,
            bottom: -9,
            width: 17,
            height: 17,
            borderRadius: "50%",
            background: "#f0f7fa",
            zIndex: 2,
          }}
        />

        {/* Badge row */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <MapPin size={11} color={accent} />
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: accent,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {badge}
          </span>
        </div>

        {/* Journey name */}
        <p
          style={{
            fontSize: 15.5,
            fontWeight: 800,
            color: "#1a2332",
            letterSpacing: "-0.3px",
            lineHeight: 1.25,
            margin: 0,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {journey.topic}
        </p>

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          {meta.map(({ Icon, label }) => (
            <span
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontSize: 12,
                color: "#8aa8b5",
              }}
            >
              <Icon size={12} color="#8aa8b5" />
              {label}
            </span>
          ))}
        </div>

        {/* Date row */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Calendar size={11} color="#b5cdd8" />
          <span style={{ fontSize: 11.5, color: "#b5cdd8" }}>{dateLabel}</span>
        </div>
      </div>

      {/* Right stub */}
      <div
        style={{
          width: 108,
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          gap: 10,
        }}
      >
        {/* Topic icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: accent + "26",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <TopicIcon size={20} color={accent} />
        </div>

        {/* Word count */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#1a2332",
              lineHeight: 1,
              margin: 0,
            }}
          >
            {isCompleted ? totalWords : wordsLearned}
          </p>
          <p style={{ fontSize: 10, color: "#aabfc9", marginTop: 3 }}>
            {isCompleted ? "words learned" : "words done"}
          </p>
        </div>

        {/* Status badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            ...(isCompleted
              ? { background: "#e6f4eb", color: "#2a8a4a" }
              : { background: "#fef3e2", color: "#c47a1a" }),
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 20,
            padding: "4px 9px",
            whiteSpace: "nowrap",
          }}
        >
          {isCompleted ? <Check size={10} /> : <Clock size={10} />}
          {isCompleted ? "Completed" : "In Progress"}
        </div>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  label,
  journeys,
}: {
  label: string;
  journeys: CompletedJourney[];
}) {
  if (journeys.length === 0) return null;
  return (
    <div style={{ marginBottom: 32 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.8px",
          color: "#9ab8c5",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {label}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 16,
        }}
      >
        {journeys.map((j) => (
          <JourneyTicket key={j.id} journey={j} />
        ))}
      </div>
    </div>
  );
}

// ─── Filter chip ─────────────────────────────────────────────────────────────

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
      style={{
        padding: "7px 14px",
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s, border-color 0.15s",
        ...(active
          ? {
              background: "#1a2332",
              color: "white",
              border: "1.5px solid #1a2332",
            }
          : {
              background: "white",
              color: "#556070",
              border: "1.5px solid #d0e4ed",
            }),
      }}
    >
      {label}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f7fa",
        padding: "32px 24px 64px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 28,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: "#1a2332",
                margin: 0,
                letterSpacing: "-0.5px",
                lineHeight: 1.2,
              }}
            >
              My{" "}
              <em style={{ fontStyle: "italic", color: "#4a9fc4" }}>
                Journeys
              </em>
            </h1>
            <p
              style={{
                fontSize: 13.5,
                color: "#7a9aaa",
                marginTop: 6,
                marginBottom: 0,
              }}
            >
              All your journeys — active, in progress, and completed.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => router.push("/app/journey")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "1.5px solid #c8dce6",
                background: "transparent",
                fontSize: 13,
                fontWeight: 600,
                color: "#1a2332",
                cursor: "pointer",
              }}
            >
              <ArrowLeft size={14} />
              Back to Journey
            </button>
            <button
              type="button"
              onClick={() => router.push("/app/journey/create")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: "none",
                background: "#1a2332",
                fontSize: 13,
                fontWeight: 600,
                color: "white",
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              New Journey
            </button>
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              color="#8aa8b5"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Search journeys…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="focus:border-[#4a9fc4] focus:outline-none"
              style={{
                width: 240,
                paddingLeft: 32,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                border: "1.5px solid #d0e4ed",
                borderRadius: 8,
                fontSize: 13,
                color: "#1a2332",
                background: "white",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6 }}>
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

          <span style={{ marginLeft: "auto", fontSize: 13, color: "#8aa8b5" }}>
            {filtered.length} journey{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Empty state ── */}
        {filtered.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 80,
              gap: 14,
            }}
          >
            <Map size={40} color="#c8dce6" />
            <p
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: "#1a2332",
                margin: 0,
              }}
            >
              No journeys yet
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#8aa8b5",
                textAlign: "center",
                maxWidth: 280,
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              Your completed and in-progress journeys will appear here.
            </p>
            <button
              type="button"
              onClick={() => router.push("/app/journey/create")}
              style={{
                marginTop: 6,
                padding: "10px 20px",
                borderRadius: 8,
                background: "#1a2332",
                color: "white",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Start your first journey →
            </button>
          </div>
        )}

        {/* ── Sections ── */}
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
