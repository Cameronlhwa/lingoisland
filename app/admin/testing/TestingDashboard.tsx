"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, RotateCcw, LogOut, ArrowRight, Play } from "lucide-react";
import PersonalizedOnboardingFlow from "@/components/Onboarding/personalized/PersonalizedOnboardingFlow";
import { previewStorageKey } from "@/lib/testing/config";
import { MINI_COURSE_PREVIEWS, miniCoursePreview } from "@/lib/testing/miniCoursePreview";
import { GOALS, type GoalKey } from "@/lib/onboarding/personalized/goals";
import type { SelfReportKey } from "@/lib/onboarding/personalized/levels";
import { readLocalState } from "@/lib/onboarding/personalized/storage";
import { Shell, StepFrame, PrimaryButton, SecondaryButton, GREEN, MUTED, CARD_BORDER, SKY_PALE } from "@/components/Onboarding/personalized/ui";

export default function TestingDashboard() {
 const [ready, setReady] = useState(false);
 const [open, setOpen] = useState(false), [run, setRun] = useState(0), [error, setError] = useState("");
 const [firstLevel, setFirstLevel] = useState<"control"|"test">("control");
 const [goal, setGoal] = useState<GoalKey>("heritage");
 useEffect(() => {
  const savedVariant = localStorage.getItem("lingo_testing_first_level_variant") === "test" ? "test" : "control";
  setFirstLevel(savedVariant);
  const savedGoal = readLocalState(previewStorageKey(savedVariant))?.answers.goal.primary;
  if (savedGoal) setGoal(savedGoal);
  setReady(true);
 }, []);
 function chooseVariant(value:"control"|"test") {
  setFirstLevel(value); localStorage.setItem("lingo_testing_first_level_variant", value);
 }
 function reset() {
  try { localStorage.removeItem(previewStorageKey(firstLevel)); setRun(n => n + 1); setOpen(true); setError(""); }
  catch { setError("Could not reset this browser’s test progress."); }
 }
 function tryCourse(level: SelfReportKey, selectedVariant:"control"|"test" = firstLevel) {
  try {
   chooseVariant(selectedVariant);
   localStorage.setItem(previewStorageKey(selectedVariant), JSON.stringify(miniCoursePreview(level, goal, new Date(), selectedVariant)));
   setRun(n => n + 1); setOpen(true); setError("");
  } catch { setError("Could not start the course. Allow browser storage and try again."); }
 }
 async function signOut() {
  try { const response = await fetch("/api/admin/testing-session", { method: "DELETE" }); if (!response.ok) throw new Error(); window.location.reload(); }
  catch { setError("Could not sign out. Try again."); }
 }
 return <>
  <header className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2" style={{ borderColor: CARD_BORDER }}>
   <button disabled={!ready} className="flex min-h-11 items-center gap-2 text-sm font-semibold" style={{ color: GREEN }} onClick={() => setOpen(false)}><ArrowLeft size={16} aria-hidden/>Testing</button>
   <div className="flex items-center gap-3"><span className="hidden text-xs sm:inline" style={{ color: MUTED }}>Private preview</span><button disabled={!ready} className="flex min-h-11 items-center gap-2 text-sm font-semibold" style={{ color: GREEN }} onClick={reset}><RotateCcw size={16} aria-hidden/>Reset test run</button><button disabled={!ready} className="flex min-h-11 items-center gap-2 text-sm" style={{ color: MUTED }} onClick={() => void signOut()}><LogOut size={16} aria-hidden/>Sign out</button></div>
  </header>
  {error && <p role="alert" className="p-3 text-center">{error}</p>}
  {open ? <PersonalizedOnboardingFlow key={`${run}:${firstLevel}`} mode="public" preview firstLevel={firstLevel}/> : <Shell wide><StepFrame title="What would you like to test?" subtitle="Jump into a mini course, or try the full onboarding." onBack={null}>
   <section className="mb-6 rounded-2xl border p-5" style={{borderColor:CARD_BORDER}} aria-labelledby="beginner-experiment-heading">
    <h2 id="beginner-experiment-heading" className="text-xl font-bold">Beginner lesson A/B test</h2>
    <p className="my-2 text-sm" style={{color:MUTED}}>first-level-test · Control teaches greetings. Test teaches 喜欢 and 吗. Each version has separate preview progress.</p>
    <label className="mb-2 block text-sm font-semibold" htmlFor="beginner-variant">Version for onboarding preview</label>
    <select id="beginner-variant" data-testid="beginner-variant" disabled={!ready} value={firstLevel} onChange={e=>chooseVariant(e.target.value as "control"|"test")} className="min-h-12 w-full rounded-xl border-2 bg-white px-3" style={{borderColor:CARD_BORDER}}><option value="control">Control — greetings</option><option value="test">Test — likes and questions</option></select>
   </section>
   <section aria-labelledby="mini-courses-heading" data-testid="mini-course-picker">
    <h2 id="mini-courses-heading" className="text-xl font-bold">Try a mini course</h2>
    <p className="mb-4 mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>Skip the opening questions. Each button starts a fresh lesson. Use “Testing” above to come back and try another.</p>
    <label htmlFor="mini-course-goal" className="mb-2 block text-sm font-semibold">Personalize the lesson for</label>
    <select id="mini-course-goal" data-testid="mini-course-goal" disabled={!ready} value={goal} onChange={e => setGoal(e.target.value as GoalKey)} className="mb-5 min-h-12 w-full rounded-xl border-2 bg-white px-3 py-2 text-base outline-offset-2" style={{ borderColor: CARD_BORDER, outlineColor: GREEN }}>
     {GOALS.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
    </select>
    <div className="grid gap-3 sm:grid-cols-2">{MINI_COURSE_PREVIEWS.map((course, index) => <article key={course.level} className="flex min-w-0 flex-col rounded-2xl border p-4" style={{ borderColor: CARD_BORDER }}>
     <span className="mb-2 self-start rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: GREEN, background: SKY_PALE }}>Course {index + 1}</span>
     <h3 className="text-base font-bold">{course.title}</h3>
     <p className="mb-4 mt-2 flex-1 text-sm leading-relaxed" style={{ color: MUTED }}>{course.concepts}</p>
     {index===0 ? <div className="space-y-2"><PrimaryButton disabled={!ready} data-testid="preview-course-new" onClick={()=>tryCourse("new","control")}><Play size={15} aria-hidden/>Try control: greetings</PrimaryButton><SecondaryButton disabled={!ready} data-testid="preview-course-new-test" onClick={()=>tryCourse("new","test")}><Play size={15} aria-hidden/>Try test: likes and questions</SecondaryButton></div> : <PrimaryButton disabled={!ready} data-testid={`preview-course-${course.level}`} aria-label={`Try course ${index + 1}: ${course.title}`} onClick={() => tryCourse(course.level)}><Play size={15} aria-hidden/>Try course {index + 1}</PrimaryButton>}
    </article>)}</div>
   </section>
   <section className="mt-6 rounded-2xl border p-5" style={{ borderColor: CARD_BORDER }} aria-labelledby="full-onboarding-heading">
    <h2 id="full-onboarding-heading" className="text-xl font-bold">Onboarding flow</h2><p className="my-3 text-sm leading-relaxed" style={{ color: MUTED }}>Walk through the full experience, or continue your current preview.</p>
    <PrimaryButton disabled={!ready} onClick={() => setOpen(true)}>Open onboarding flow<ArrowRight size={17} aria-hidden/></PrimaryButton>
    <SecondaryButton disabled={!ready} className="mt-2" onClick={reset}>Start from the beginning</SecondaryButton>
   </section>
   <p className="mt-4 text-sm" style={{ color: MUTED }}>Test progress is separate from normal onboarding. Reset clears only this preview.</p>
  </StepFrame></Shell>}
 </>;
}
