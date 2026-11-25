"use client";

import { useEffect, useRef, useState } from "react";
import JourneyConversation from "./JourneyConversation";
import { BookOpen, Check, Leaf, LogOut, MessageCircle, Mic, Loader2 } from "lucide-react";
import styles from "./JourneyLessonPlayer.module.css";
import PreCourseLoading from "@/components/app/LearnSequence/PreCourseLoading";
import type { JourneyLesson, LessonProgress } from "@/lib/journey/teaching/curriculum";
import { lessonStepIds } from "@/lib/journey/teaching/curriculum";
import { GrammarPractice } from "@/components/lessons/GrammarPractice";
import { VocabularyLesson } from "@/components/Onboarding/personalized/firstLesson/VocabularyLesson";
import { EMPTY_FIRST_LESSON, type FirstLessonProgress } from "@/lib/onboarding/personalized/firstLesson/types";
import { WordCard } from "@/components/Onboarding/personalized/firstLesson/LessonActivities";
import { PrimaryButton, TextButton } from "@/components/Onboarding/personalized/ui";
import RecordButton, { type ScoreResult } from "@/components/app/Pronunciation/RecordButton";
import PronunciationFeedback from "@/components/app/Pronunciation/PronunciationFeedback";
import { grammarSteps } from "@/lib/lessons/grammarSequence";

export type LessonSnapshot = { lesson: JourneyLesson | null; progress: LessonProgress; revision: number };

async function readResponse(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "We couldn’t save your lesson. Please try again.");
  return data;
}

function Speaking({ islandId, lesson, onComplete }: { islandId: string; lesson: JourneyLesson; onComplete: (path: "spoken" | "listening") => void }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listened, setListened] = useState(false);
  const [starting, setStarting] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<string | null>(null);
  useEffect(() => () => { if (audioRef.current) URL.revokeObjectURL(audioRef.current); }, []);
  const start = async () => {
    setStarting(true); setError("");
    try {
      const data = await readResponse(await fetch(`/api/topic-islands/${islandId}/lesson-speaking`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
      setSessionId(data.sessionId);
    } catch (error) { setError((error as Error).message); }
    finally { setStarting(false); }
  };
  return <section data-testid="journey-speaking">
    <h2 className="mb-3 text-xl font-bold">Listen, then try saying it</h2>
    <WordCard phrase={{ ...lesson.speaking, id: "speaking" }} onUnavailable={() => setError("Audio isn’t available on this device. You can return to this practice later.")} />
    {!sessionId && <PrimaryButton className="mt-5" disabled={starting} onClick={() => void start()}>{starting ? "Preparing practice…" : "Practise my pronunciation"}</PrimaryButton>}
    {sessionId && !result && <div className="mt-5 flex justify-center"><RecordButton sessionId={sessionId} itemId="item-0" unitType="sentence" targetText={lesson.speaking.hanzi} targetPinyin={lesson.speaking.pinyin} onBusyChange={setBusy} onScored={setResult} onError={error => setError(error.message)} onRecorded={blob => {
      if (audioRef.current) URL.revokeObjectURL(audioRef.current);
      audioRef.current = URL.createObjectURL(blob); setAudioUrl(audioRef.current);
    }} /></div>}
    {result && <div className="mt-5"><PronunciationFeedback result={result} mode="sentence" layout="lesson" recordedAudioUrl={audioUrl} onRetry={() => { setResult(null); setError(""); }} onContinue={() => onComplete("spoken")} continueLabel="Practise with Huahua" /></div>}
    {error && <p role="alert" className="mt-4 text-sm">{error}</p>}
    {!result && <div className="mt-5 space-y-3 text-center">
      <p className="text-sm">Can’t record right now? Listen and practise quietly.</p>
      <TextButton disabled={busy || starting} onClick={() => {
        setError(""); setListened(false);
        if (!("speechSynthesis" in window)) { setError("Audio isn’t available on this device. Save and return when you can practise."); return; }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(lesson.speaking.hanzi); utterance.lang = "zh-CN"; utterance.rate = 0.8;
        utterance.onend = () => setListened(true);
        utterance.onerror = () => setError("Audio couldn’t play. Try listening again.");
        window.speechSynthesis.speak(utterance);
      }}>Listen to the sentence</TextButton>
      {listened && <PrimaryButton disabled={busy} onClick={() => onComplete("listening")}>Continue with listening practice</PrimaryButton>}
    </div>}
  </section>;
}


export default function JourneyLessonPlayer({ islandId, initial, onExit, onComplete }: { islandId: string; initial: LessonSnapshot; onExit: () => void; onComplete: () => void }) {
  const [snapshot, setSnapshot] = useState(initial);
  const savedRef = useRef(initial);
  // Keep rapid word selections responsive without letting older save responses undo them.
  const optimisticKnown = useRef<{ ids: string[]; version: number } | null>(null);
  const selectionVersion = useRef(0);
  const activityRef = useRef<HTMLFieldSetElement>(null);
  const previousStep = useRef(initial.progress.stepId);
  useEffect(() => {
    if (previousStep.current !== snapshot.progress.stepId) {
      previousStep.current = snapshot.progress.stepId;
      activityRef.current?.focus({ preventScroll: true });
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
    }
  }, [snapshot.progress.stepId]);
  const [pending, setPending] = useState(0);
  const [blockingPending, setBlockingPending] = useState(0);
  const [draftDirty, setDraftDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [drafts, setDrafts] = useState(initial.progress.writingResponses ?? {});
  const draftsRef = useRef(drafts);
  const draftVersion = useRef(0);
  const evidenceRef = useRef<Record<string, unknown>>({});
  const queue = useRef<Promise<void>>(Promise.resolve());
  const failedRef = useRef(false);
  const retryRef = useRef<Partial<LessonProgress> | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const prepareRunning = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (draftTimer.current) clearTimeout(draftTimer.current); window.speechSynthesis?.cancel(); }; }, []);

  const prepare = async () => {
    if (prepareRunning.current) return;
    prepareRunning.current = true;
    setPreparing(true); setError("");
    try {
      const data = await readResponse(await fetch(`/api/topic-islands/${islandId}/lesson`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(45000) }));
      savedRef.current = data; setSnapshot(data);
    } catch (error) { setError((error as Error).message); }
    finally { prepareRunning.current = false; setPreparing(false); }
  };
  useEffect(() => { if (!initial.lesson) void prepare(); /* Prepare once, not after every save. */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (patch: Partial<LessonProgress>) => {
    const selectionOnly = Object.keys(patch).length === 1 && Array.isArray(patch.vocabularyKnownIds);
    const draftOnly = Object.keys(patch).length === 1 && !!patch.writingResponses;
    const savedDraftVersion = draftVersion.current;
    const blocking = !selectionOnly && !draftOnly;
    const version = selectionOnly ? ++selectionVersion.current : null;
    if (selectionOnly) {
      optimisticKnown.current = { ids: patch.vocabularyKnownIds!, version: version! };
      setSnapshot(current => ({ ...current, progress: { ...current.progress, vocabularyKnownIds: patch.vocabularyKnownIds } }));
    }
    setPending(count => count + 1);
    if (blocking) setBlockingPending(count => count + 1);
    queue.current = queue.current.then(async () => {
      if (failedRef.current) {
        if (selectionOnly && optimisticKnown.current) retryRef.current = { vocabularyKnownIds: optimisticKnown.current.ids };
        return;
      }
      try {
        const saved = savedRef.current;
        const data = await readResponse(await fetch(`/api/topic-islands/${islandId}/lesson-progress`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: saved.revision, progress: patch, evidence: evidenceRef.current[saved.progress.stepId] }), signal: AbortSignal.timeout(15000) }));
        savedRef.current = { ...saved, ...data };
        if (patch.writingResponses && savedDraftVersion === draftVersion.current && mounted.current) setDraftDirty(false);
        if (version === optimisticKnown.current?.version) optimisticKnown.current = null;
        if (mounted.current) setSnapshot({ ...savedRef.current, progress: {
          ...savedRef.current.progress,
          ...(optimisticKnown.current ? { vocabularyKnownIds: optimisticKnown.current.ids } : {}),
        } });
      } catch (error) {
        failedRef.current = true;
        retryRef.current = selectionOnly && optimisticKnown.current
          ? { vocabularyKnownIds: optimisticKnown.current.ids }
          : draftOnly ? { writingResponses: draftsRef.current } : patch;
        if (mounted.current) setError((error as Error).message);
      }
    }).finally(() => {
      if (mounted.current) {
        setPending(count => count - 1);
        if (blocking) setBlockingPending(count => count - 1);
      }
    });
  };
  const lesson = snapshot.lesson;
  if (!lesson) return <PreCourseLoading paused={!!error}>
    {error && <>
      <p role="alert">{error}</p>
      {!preparing && <PrimaryButton className="mt-5" onClick={() => void prepare()}>Try again</PrimaryButton>}
      <TextButton className="mt-4" onClick={onExit}>Return to my island</TextButton>
    </>}
  </PreCourseLoading>;
  const steps = lessonStepIds(lesson), progress = snapshot.progress;
  const grammar = grammarSteps(lesson.curriculum), currentGrammar = grammar.find(step => step.id === progress.stepId);
  const advance = (patch: Partial<LessonProgress> = {}) => {
    if (draftTimer.current) { clearTimeout(draftTimer.current); draftTimer.current = null; }
    save({ ...patch, writingResponses: drafts, stepId: steps[steps.indexOf(progress.stepId) + 1] });
  };
  const vocabProgress: FirstLessonProgress = { ...EMPTY_FIRST_LESSON, ...progress, phase: "vocabulary" };
  const phases = [
    { label: "Words", icon: BookOpen }, { label: "Grammar", icon: Leaf },
    { label: "Speaking", icon: Mic }, { label: "Conversation", icon: MessageCircle },
  ];
  const phase = progress.stepId === "vocabulary" ? 0 : currentGrammar ? 1 : progress.stepId === "speaking" ? 2 : progress.stepId === "chat" ? 3 : 4;
  const percent = Math.round(100 * steps.indexOf(progress.stepId) / Math.max(1, steps.length - 1));
  return <main className={`hsk-app-theme lingo-body ${styles.player} ${progress.stepId === "chat" ? styles.chatPlayer : ""}`} data-testid="journey-mini-lesson">
    <header className={styles.header}><div className={styles.headerInner}>
      <div className={styles.topline}>
        <p className={styles.topic}><span className={styles.topicIcon}><Leaf size={15} aria-hidden /></span>{lesson.topic}</p>
        <button type="button" className={styles.exit} disabled={pending > 0 || !!error} onClick={() => {
          if (draftTimer.current) { clearTimeout(draftTimer.current); draftTimer.current = null; save({ writingResponses: drafts }); }
          void queue.current.then(() => { if (!failedRef.current) onExit(); });
        }}><LogOut size={16} aria-hidden /><span>Save and exit</span></button>
      </div>
      <h1 className={styles.title}>{lesson.objective.outcome}</h1>
      <div className={styles.progressMeta}>
        <span>{phase === 4 ? "Lesson complete" : `Part ${phase + 1} of 4`}</span>
        <span className={styles.saveStatus} role="status">{error ? "Progress not saved" : (pending || draftDirty) ? <><Loader2 size={13} className={styles.spinner} aria-hidden />Saving…</> : <><Check size={13} aria-hidden />All progress saved</>}</span>
      </div>
      <div className={styles.progress} role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div style={{ width: `${percent}%` }} />
      </div>
      <ol className={styles.phases} aria-label="Lesson stages">{phases.map(({ label, icon: Icon }, index) => <li key={label} data-state={index < phase ? "done" : index === phase ? "active" : "upcoming"} aria-current={index === phase ? "step" : undefined}>
        <span className={styles.phaseIcon}>{index < phase ? <Check size={14} aria-hidden /> : <Icon size={14} aria-hidden />}</span><span>{label}</span>
      </li>)}</ol>
    </div></header>
    <div className={styles.content}>
      {error && <div role="alert" className={styles.alert}><p>{error}</p><div className="mt-3 flex gap-4"><button type="button" className="underline" onClick={() => {
        failedRef.current = false; setError(""); if (retryRef.current) save(retryRef.current);
      }}>Retry saving</button><button type="button" className="underline" onClick={() => window.location.reload()}>Reload saved lesson</button></div></div>}
      {notice && <p role="status" className="mb-4 text-sm">{notice}</p>}
      <fieldset ref={activityRef} tabIndex={-1} disabled={blockingPending > 0 || !!error} className={`${styles.activity} ${progress.stepId === "chat" ? styles.chatActivity : ""}`}>
        <div key={progress.stepId} className={styles.step}>
        {progress.stepId === "vocabulary" && <VocabularyLesson polished saving={pending > 0} words={lesson.words} groups={lesson.curriculum.vocabularyGroups} progress={vocabProgress} previouslyKnown={new Set()} onSave={patch => save(patch as Partial<LessonProgress>)} onComplete={() => advance()} onMistake={() => {}} onUnavailable={() => setNotice("Audio is unavailable right now. You can continue with the written examples.")} />}
        {currentGrammar && <GrammarPractice curriculum={lesson.curriculum} writingContext={{ islandId }} initialStepId={progress.stepId} onEvidence={(id, answer) => { evidenceRef.current[id] = answer; }} responses={drafts} onResponse={(id, text) => {
          const next = { ...draftsRef.current, [id]: text };
          draftsRef.current = next; draftVersion.current += 1;
          setDrafts(next); setDraftDirty(true);
          if (draftTimer.current) clearTimeout(draftTimer.current);
          draftTimer.current = setTimeout(() => { save({ writingResponses: next }); draftTimer.current = null; }, 700);
        }} onProgress={(_index, stepId) => save({ stepId, writingResponses: drafts })} onComplete={() => advance()} onMistake={() => {}} onUnavailable={() => setNotice("Audio is unavailable right now. You can continue with the written examples.")} />}
        {progress.stepId === "speaking" && <Speaking islandId={islandId} lesson={lesson} onComplete={speakingPath => advance({ speakingPath })} />}
        {progress.stepId === "chat" && <JourneyConversation islandId={islandId} lesson={lesson} messages={progress.chatMessages ?? []} onMessages={chatMessages => save({ chatMessages: chatMessages.slice(-20) })} onComplete={() => advance()} />}
        {progress.stepId === "complete" && <section className={styles.complete} data-testid="journey-lesson-complete"><span className={styles.completionMark}><Check size={30} aria-hidden /></span><h2 className="text-2xl font-bold">You put your Mandarin to use</h2><p className="my-5">{lesson.curriculum.note.text}. Try this in your next real conversation.</p><PrimaryButton onClick={onComplete}>Return to my island</PrimaryButton></section>}
        </div>
      </fieldset>
    </div>
  </main>;
}
