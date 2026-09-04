"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Headphones,
  PenLine,
  Play,
  Trophy,
} from "lucide-react";
import {
  HSK_CARD_BORDER,
  HSK_CARD_SHADOW,
  HSK_CARD_SHADOW_HOVER,
  LINGO_ACCENT_GRADIENT_GLOSSY,
} from "@/lib/glossy-theme";
import { HSK_APP_LABELS } from "@/lib/hsk-app-labels";

type SectionType = "listening" | "reading" | "writing";

type PracticeTest = {
  id: string;
  level: number;
  number: number;
  title: string;
  durationMinutes: number;
  sections: { type: SectionType; questions: number }[];
};

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

const LEVEL_TEST_DETAILS: Record<number, Omit<PracticeTest, "id" | "level" | "number" | "title">> = {
  1: { durationMinutes: 40, sections: [{ type: "listening", questions: 20 }, { type: "reading", questions: 20 }] },
  2: { durationMinutes: 55, sections: [{ type: "listening", questions: 35 }, { type: "reading", questions: 25 }] },
  3: { durationMinutes: 75, sections: [{ type: "listening", questions: 40 }, { type: "reading", questions: 30 }, { type: "writing", questions: 10 }] },
  4: { durationMinutes: 95, sections: [{ type: "listening", questions: 45 }, { type: "reading", questions: 40 }, { type: "writing", questions: 15 }] },
  5: { durationMinutes: 115, sections: [{ type: "listening", questions: 45 }, { type: "reading", questions: 45 }, { type: "writing", questions: 10 }] },
  6: { durationMinutes: 140, sections: [{ type: "listening", questions: 50 }, { type: "reading", questions: 50 }, { type: "writing", questions: 15 }] },
};

/** Temporary catalogue shape mirrors the test metadata expected from a future API. */
const PLACEHOLDER_TESTS_BY_LEVEL: Record<number, PracticeTest[]> = Object.fromEntries(
  LEVELS.map((level) => [
    level,
    Array.from({ length: 25 }, (_, index) => {
      const number = index + 1;
      return {
        id: `placeholder-hsk-${level}-${number}`,
        level,
        number,
        title: `HSK ${level} Practice Test ${String(number).padStart(2, "0")}`,
        ...LEVEL_TEST_DETAILS[level],
      };
    }),
  ]),
) as Record<number, PracticeTest[]>;

const SECTION_ICON: Record<SectionType, typeof Headphones> = {
  listening: Headphones,
  reading: BookOpenText,
  writing: PenLine,
};

function EmptyPerformancePanel() {
  return (
    <section
      className="relative min-h-[200px] overflow-hidden rounded-2xl bg-white p-5 sm:min-h-[220px] sm:p-6"
      style={{ border: HSK_CARD_BORDER, boxShadow: HSK_CARD_SHADOW }}
    >
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="lingo-display text-lg text-[var(--lingo-navy)]">Score history</h2>
            <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">Your performance over time</p>
          </div>
          <span className="rounded-xl bg-[var(--lingo-sky-pale)] p-2.5 text-[var(--lingo-blue)]">
            <BarChart3 className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <p className="max-w-[22rem] text-sm leading-relaxed text-[var(--lingo-text-muted)]">
          Your progress starts here. Complete your first practice test to see score trends.
        </p>
      </div>
      <svg className="absolute bottom-0 right-0 h-[130px] w-[58%] opacity-70" viewBox="0 0 250 104" aria-hidden>
        <path d="M0 85 C30 78 40 88 67 66 S111 73 136 47 S174 55 199 25 S225 31 250 11" fill="none" stroke="#BFE7F5" strokeWidth="2" strokeDasharray="5 6" />
        <path d="M0 103H250" stroke="#DDF3FA" strokeWidth="1" />
        <path d="M25 0V104M85 0V104M145 0V104M205 0V104" stroke="#EEF9FC" strokeWidth="1" />
      </svg>
    </section>
  );
}

function RecentTestsPanel() {
  return (
    <section
      className="min-h-[200px] rounded-2xl bg-white p-5 sm:min-h-[220px] sm:p-6"
      style={{ border: HSK_CARD_BORDER, boxShadow: HSK_CARD_SHADOW }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="lingo-display text-lg text-[var(--lingo-navy)]">Recent tests</h2>
          <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">Your latest completed attempts</p>
        </div>
        <span className="rounded-xl bg-[var(--lingo-sky-pale)] p-2.5 text-[var(--lingo-blue)]">
          <Clock3 className="h-5 w-5" aria-hidden />
        </span>
      </div>
      <div className="flex items-center gap-3.5 rounded-2xl border border-dashed border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)]/70 px-4 py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[var(--lingo-blue)] shadow-sm">
          <Trophy className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm leading-relaxed text-[var(--lingo-text-muted)]">
          No tests completed yet. Your attempts and results will appear here.
        </p>
      </div>
    </section>
  );
}

export default function HskTestsPage() {
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [notice, setNotice] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const tests = PLACEHOLDER_TESTS_BY_LEVEL[selectedLevel];
  const recommendedTest = tests[0];

  const scrollCarousel = (direction: "left" | "right") => {
    carouselRef.current?.scrollBy({
      left: direction === "right" ? 840 : -840,
      behavior: "smooth",
    });
  };

  const showComingSoon = (test: PracticeTest) => {
    setNotice(`${test.title} is being prepared. Full test content will be available soon.`);
  };

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 md:px-8 md:py-7">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="lingo-display text-[30px] leading-tight text-[var(--lingo-navy)] sm:text-[34px]">{HSK_APP_LABELS.tests.title}</h1>
            <p className="mt-1.5 text-[15px] text-[var(--lingo-text-muted)]">
              {HSK_APP_LABELS.tests.description}
            </p>
          </div>
          <p className="pb-1 text-sm font-medium text-[var(--lingo-text-muted)]">150 practice tests planned</p>
        </header>

        <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <EmptyPerformancePanel />
          <RecentTestsPanel />
        </section>

        <section className="rounded-[24px] bg-white p-5 sm:p-6" style={{ border: HSK_CARD_BORDER, boxShadow: HSK_CARD_SHADOW }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="lingo-display text-xl text-[var(--lingo-navy)]">Practice test library</h2>
                <span className="rounded-full bg-[var(--lingo-sky-pale)] px-2.5 py-1 text-xs font-bold text-[var(--lingo-blue)]">0 / 25 completed</span>
              </div>
              <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">Choose a level to browse its full test set.</p>
            </div>
            <div className="flex gap-1.5 rounded-xl border border-[var(--lingo-accent-border)] bg-white p-1" role="tablist" aria-label="HSK level">
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={selectedLevel === level}
                  onClick={() => setSelectedLevel(level)}
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition-all ${
                    selectedLevel === level
                      ? "text-white shadow-sm"
                      : "text-[var(--lingo-text-muted)] hover:bg-[var(--lingo-sky-pale)] hover:text-[var(--lingo-navy)]"
                  }`}
                  style={selectedLevel === level ? { background: LINGO_ACCENT_GRADIENT_GLOSSY } : undefined}
                >
                  HSK {level}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid items-center gap-4 rounded-2xl border border-[var(--lingo-accent-border)] bg-[linear-gradient(135deg,#F9FDFF_0%,#E5F5FA_100%)] px-5 py-4 sm:grid-cols-[1fr_auto] sm:px-6 sm:py-5">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">Recommended next</span>
              <h3 className="lingo-display mt-1.5 text-lg text-[var(--lingo-navy)]">{recommendedTest.title}</h3>
              <p className="mt-1.5 text-sm text-[var(--lingo-text-muted)]">Establish your baseline and discover where to focus next.</p>
              <TestMeta test={recommendedTest} className="mt-3" />
            </div>
            <button
              type="button"
              onClick={() => showComingSoon(recommendedTest)}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
              style={{ background: "var(--lingo-navy)", boxShadow: "0 8px 18px -10px rgba(7,30,46,.7)" }}
            >
              <Play className="h-4 w-4 fill-current" aria-hidden />
              Start test
            </button>
          </div>

          {notice && (
            <p className="mt-3 rounded-xl border border-[var(--lingo-accent-border)] bg-white px-3 py-2 text-sm text-[var(--lingo-text-muted)]" role="status">
              {notice}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--lingo-navy)]">All HSK {selectedLevel} tests</p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => scrollCarousel("left")} className="rounded-lg border border-[var(--lingo-accent-border)] bg-white p-2 text-[var(--lingo-navy)] transition-colors hover:bg-[var(--lingo-sky-pale)]" aria-label="Previous tests">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => scrollCarousel("right")} className="rounded-lg border border-[var(--lingo-accent-border)] bg-white p-2 text-[var(--lingo-navy)] transition-colors hover:bg-[var(--lingo-sky-pale)]" aria-label="Next tests">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div ref={carouselRef} className="mt-3 flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {tests.map((test) => (
              <article
                key={test.id}
                className="w-[240px] shrink-0 snap-start rounded-2xl bg-white p-4 transition-transform hover:-translate-y-0.5 sm:w-[260px]"
                style={{ border: HSK_CARD_BORDER, boxShadow: "0 10px 24px -20px rgba(7,30,46,.55)" }}
                onMouseEnter={(event) => { event.currentTarget.style.boxShadow = HSK_CARD_SHADOW_HOVER; }}
                onMouseLeave={(event) => { event.currentTarget.style.boxShadow = "0 10px 24px -20px rgba(7,30,46,.55)"; }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[var(--lingo-sky-pale)] px-2.5 py-1 text-[11px] font-bold text-[var(--lingo-blue)]">HSK {test.level}</span>
                  <span className="text-[11px] font-semibold text-[var(--lingo-text-muted)]">Not started</span>
                </div>
                <h3 className="lingo-display mt-3.5 text-[15px] leading-snug text-[var(--lingo-navy)]">Practice Test {String(test.number).padStart(2, "0")}</h3>
                <TestMeta test={test} className="mt-3.5" />
                <button type="button" onClick={() => showComingSoon(test)} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--lingo-blue)] transition-colors hover:text-[var(--lingo-navy)]">
                  View test <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TestMeta({ test, className = "" }: { test: PracticeTest; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--lingo-text-muted)] ${className}`}>
      {test.sections.map((section) => {
        const Icon = SECTION_ICON[section.type];
        return <span key={section.type} className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5" aria-hidden />{section.questions}</span>;
      })}
      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden />{test.durationMinutes} min</span>
    </div>
  );
}
