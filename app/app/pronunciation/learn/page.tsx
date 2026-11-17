"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import AppPage, { AppPageHeader } from "@/components/app/AppPage";
import AppPageLoading from "@/components/app/AppPageLoading";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ToneCoursePath from "@/components/app/Pronunciation/ToneCoursePath";
import { useCourseProgress } from "@/components/app/Pronunciation/useCourseProgress";
import { COURSE_UNITS, unitForActivity } from "@/lib/pronunciation/course/content";
import { courseSummary, safeCourseReturn, unitMasteredCount } from "@/lib/pronunciation/course/progress";

export default function ToneMasteryOverviewPage() {
  const { progress, loading, error, reload } = useCourseProgress();
  const router = useRouter();
  const search = useSearchParams();
  const returnTo = safeCourseReturn(search.get("returnTo"));
  const suffix = search.get("returnTo") ? `?returnTo=${encodeURIComponent(returnTo)}` : "";
  const summary = courseSummary(progress);
  const completedUnits = COURSE_UNITS.filter(unit => unitMasteredCount(unit.activities, progress) === unit.activities.length).length;
  const savedUnit = unitForActivity(progress.currentActivityId) ?? COURSE_UNITS[0];
  const resumeUnit = unitMasteredCount(savedUnit.activities, progress) === savedUnit.activities.length
    ? COURSE_UNITS.find(unit => unitMasteredCount(unit.activities, progress) < unit.activities.length) ?? savedUnit
    : savedUnit;
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  async function startPractice() {
    setStarting(true);
    setStartError(null);
    try {
      const response = await fetch("/api/pronunciation/session", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.sessionId) throw new Error(data.error ?? "Could not start practice.");
      router.push(`/app/pronunciation/session/${data.sessionId}`);
    } catch (cause) {
      setStartError(cause instanceof Error ? cause.message : "Could not start practice.");
      setStarting(false);
    }
  }

  if (loading) return <AppPageLoading />;

  const hasProgress = summary.finished > 0 || summary.completed > 0;
  const heading = summary.courseComplete ? "Course complete — keep practicing"
    : summary.skipped > 0 ? "Keep speaking to finish" : "A little practice at a time";

  return <AppPage>
    <AppPageHeader eyebrow="Pronunciation" title="Tone Mastery"
      description="Hear the difference. Find the shape. Speak with confidence."
      />

    {error ? <Card hover={false} role="alert">
      <h2 className="text-lg font-bold text-[var(--lingo-navy)]">Couldn’t load your course</h2>
      <p className="mt-2 text-sm text-[var(--lingo-text-muted)]">{error}</p>
      <Button className="mt-4" size="compact" onClick={() => void reload()}>Try again</Button>
    </Card> : <>
      <Card hover={false} padded={false} style={{ background: "var(--lingo-sky-pale)" }}>
        <section aria-label="Course progress" className="flex flex-col gap-3 p-5 sm:gap-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 lg:max-w-xs">
            <h2 className="lingo-display text-xl text-[var(--lingo-navy)]">{heading}</h2>
            <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">Your place is saved after every step.</p>
          </div>
          <div className="min-w-0 flex-1 lg:max-w-xs">
            <p id="tone-course-progress-label" className="text-sm font-semibold text-[var(--lingo-navy)]">{completedUnits} of {COURSE_UNITS.length} units complete</p>
            <progress aria-labelledby="tone-course-progress-label" aria-valuetext={`${summary.completed} of ${summary.total} activities complete`}
              value={summary.completed} max={summary.total}
              className="mt-2 block h-2.5 w-full appearance-none overflow-hidden rounded-full bg-[var(--lingo-sky)] [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[var(--lingo-sky)] [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[var(--lingo-teal)] [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[var(--lingo-teal)]" />
            <p className="mt-1.5 text-xs text-[var(--lingo-text-muted)]">{summary.completed} / {summary.total} activities complete</p>
          </div>
          {summary.courseComplete
            ? <Button disabled={starting} onClick={() => void startPractice()} className="shrink-0" style={{ background: "var(--lingo-navy)" }}>{starting ? "Preparing practice…" : "Practice with my words"}<ArrowRight size={16} aria-hidden="true" /></Button>
            : <Button href={`/app/pronunciation/learn/${resumeUnit.id}${suffix}`} className="shrink-0" style={{ background: "var(--lingo-navy)" }}>{hasProgress ? "Resume course" : "Start course"}<ArrowRight size={16} aria-hidden="true" /></Button>}
        </section>
      </Card>
      {startError && <p role="alert" className="mt-3 text-sm text-red-700">{startError}</p>}
      {summary.skipped > 0 && <p className="mt-3 text-sm leading-relaxed text-[var(--lingo-text-muted)]">{summary.skipped} {summary.skipped === 1 ? "activity was" : "activities were"} continued without speaking. Revisit these to finish the course.</p>}
      {summary.courseComplete && <p className="mt-3 text-sm text-[var(--lingo-text-muted)]">{summary.firstCorrect} of {summary.questionsAnswered} questions right on the first try · {summary.speaking} speaking activities checked. Finishing the course is a foundation for continued practice.</p>}

      <ToneCoursePath progress={progress} currentUnitId={summary.courseComplete ? null : resumeUnit.id} suffix={suffix} />


    </>}
  </AppPage>;
}
