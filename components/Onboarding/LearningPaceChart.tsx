"use client";

import { BookOpen, CalendarDays, Clock, type LucideIcon } from "lucide-react";
import Card from "@/components/ui/Card";

const MUTED = "#5A7A90";
const BAR_AREA_PX = 50;

/** Parses wizard time labels such as "15min" or "1h+" for display. */
export function parseDailyMinutes(
  timeLabel: string | null | undefined,
): { minutes: number; orMore: boolean } | null {
  if (!timeLabel) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(h|m)/i.exec(timeLabel.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const minutes = match[2].toLowerCase() === "h" ? value * 60 : value;
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return { minutes: Math.round(minutes), orMore: timeLabel.includes("+") };
}

/** Splits a weekly word target into whole numbers that sum to the target. */
export function distributeWords(total: number, days: number): number[] {
  const base = Math.floor(total / days);
  const remainder = total - base * days;
  return Array.from({ length: days }, (_, i) => base + (i < remainder ? 1 : 0));
}

type Stat = {
  icon: LucideIcon;
  value: string;
  label: string;
  color: string;
  tint: string;
};

export default function LearningPaceChart({
  wordsPerWeek,
  daysPerWeek,
  timeLabel,
}: {
  wordsPerWeek?: number;
  daysPerWeek?: number;
  timeLabel?: string;
}) {
  const words =
    typeof wordsPerWeek === "number" && wordsPerWeek > 0
      ? Math.round(wordsPerWeek)
      : null;
  const days =
    typeof daysPerWeek === "number" &&
    Number.isInteger(daysPerWeek) &&
    daysPerWeek >= 1 &&
    daysPerWeek <= 7
      ? daysPerWeek
      : null;
  const daily = parseDailyMinutes(timeLabel);

  const split = words !== null && days !== null ? distributeWords(words, days) : null;
  const maxBar = split ? Math.max(...split, 1) : 1;

  const stats: Stat[] = [];
  if (words !== null) {
    stats.push({
      icon: BookOpen,
      value: String(words),
      label: "words/week",
      color: "var(--lingo-teal)",
      tint: "rgba(32,103,79,0.10)",
    });
  }
  if (days !== null) {
    stats.push({
      icon: CalendarDays,
      value: String(days),
      label: days === 1 ? "study day/week" : "study days/week",
      color: "#2176AE",
      tint: "rgba(33,118,174,0.10)",
    });
  }
  if (daily) {
    stats.push({
      icon: Clock,
      value: `${daily.minutes}${daily.orMore ? "+" : ""}`,
      label: "min/day",
      color: "var(--lingo-accent)",
      tint: "var(--lingo-accent-tint)",
    });
  }

  if (!split && stats.length === 0) return null;

  return (
    <section className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold text-[var(--lingo-navy)]">
          Your weekly learning pace
        </h2>
        {split && days !== null && words !== null ? (
          <p className="shrink-0 text-[12px]" style={{ color: MUTED }}>
            ~{Math.round(words / days)} words per study day
          </p>
        ) : null}
      </div>

      {split ? (
        <div
          className="mt-2 rounded-2xl px-4 pb-2 pt-2.5"
          style={{ background: "var(--lingo-sky-pale)" }}
        >
          <div
            role="img"
            aria-label={`${words} words spread across ${days} study days: ${split.join(", ")}`}
            className="flex items-end gap-2"
          >
            {split.map((count, idx) => (
              <div key={idx} className="flex min-w-0 flex-1 flex-col items-center">
                <span
                  aria-hidden
                  className="mb-1 text-[11px] font-bold text-[var(--lingo-teal)]"
                >
                  {count}
                </span>
                <div
                  aria-hidden
                  className="flex w-full items-end justify-center"
                  style={{ height: BAR_AREA_PX }}
                >
                  <div
                    className="w-full max-w-[34px] rounded-t-md rounded-b-[3px]"
                    style={{
                      height: count > 0 ? `${Math.max(12, (count / maxBar) * 100)}%` : 0,
                      background: "var(--lingo-icon-bg)",
                      opacity: 0.55 + 0.45 * (count / maxBar),
                    }}
                  />
                </div>
                <span aria-hidden className="mt-1 text-[11px]" style={{ color: MUTED }}>
                  Day {idx + 1}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[11px]" style={{ color: MUTED }}>
            Illustrative split — study on whichever days suit you
          </p>
        </div>
      ) : null}

      {stats.length > 0 ? (
        <div
          className="mt-2 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
        >
          {stats.map(({ icon: Icon, value, label, color, tint }) => (
            <Card
              key={label}
              hover={false}
              padded={false}
              className="flex items-center gap-2.5 px-3 py-2"
              style={{ borderRadius: "var(--lingo-radius-control)", boxShadow: "none" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: tint }}
              >
                <Icon size={17} strokeWidth={2.2} style={{ color }} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="lingo-display block text-[19px] leading-none text-[var(--lingo-navy)]">
                  {value}
                </span>
                <span className="mt-0.5 block truncate text-[11px]" style={{ color: MUTED }}>
                  {label}
                </span>
              </span>
            </Card>
          ))}
        </div>
      ) : null}
    </section>
  );
}
