"use client";
import {LessonIntroImage} from "./firstLesson/LessonIntroImage";
import chatStyles from "./firstLesson/LessonChat.module.css";
import { ChatSituation } from "./firstLesson/ChatSituation";
import { curriculumProgress } from "@/lib/onboarding/personalized/firstLesson/lessonProgress";
import { VocabularyLesson } from "./firstLesson/VocabularyLesson";
import { vocabularyEvidence } from "@/lib/onboarding/personalized/firstLesson/templates";
import { grammarSteps, grammarStepIndex } from "@/lib/onboarding/personalized/firstLesson/grammarSequence";
import { GrammarPractice } from "./firstLesson/GrammarPractice";
import { CorrectCelebration } from "./firstLesson/CorrectCelebration";
import { prepareCelebrationSound } from "@/lib/pronunciation/celebration";
import { CoursePlacementGate } from "./firstLesson/CoursePlacementGate";
import { updatedLessonLevel, updatedFirstLesson } from "@/lib/onboarding/personalized/firstLesson/curriculum";
import { PronunciationResults } from "./firstLesson/PronunciationResults";
import { parsePronunciationPieces } from "@/lib/onboarding/personalized/firstLesson/pronunciationResults";
import { lessonInput } from "@/lib/onboarding/personalized/firstLesson/personalization";
import { compileTemplate, fallbackTemplatePlan, templateKey, templatePrerequisites, validTemplatePlan } from "@/lib/onboarding/personalized/firstLesson/templates";
import { PrepareMessage } from "./firstLesson/PrepareMessage";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Mic, Square, Volume2 } from "lucide-react";
import { abortPcmRecording, startPcmRecording, stopPcmRecording, type PcmRecorderHandle } from "@/lib/audio/recordPcm";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import { awardLessonXp, lessonXpTotal } from "@/lib/onboarding/personalized/flow";
import { getLessonById, LESSON_BANK } from "@/lib/onboarding/personalized/firstLesson/bank";
import { selectFirstLesson } from "@/lib/onboarding/personalized/firstLesson/select";
import { EMPTY_FIRST_LESSON, LESSON_XP_TOTAL, type FirstLessonProgress, type LessonPhase, type LessonPhrase, type LessonXpKey, type SpeakingAttempt, type AuthoredLesson } from "@/lib/onboarding/personalized/firstLesson/types";
import type { StepProps } from "./stepTypes";
import { CARD_BORDER, GREEN, MUTED, NAVY, PrimaryButton, SecondaryButton, SKY_PALE, StepFrame, TextButton } from "./ui";
import { AudioButton, BuildSentence, Feedback, SentenceBreakdown, hasWordBreakdown, MatchWords, MeaningQuiz, RouteIcon, WordCard, say } from "./firstLesson/LessonActivities";

const PHASES: LessonPhase[] = ["intro", "vocabulary", "teach_first", "beginner_match", "beginner_recall", "recognize", "teach_second", "meaning", "listen", "frame", "supported", "build", "transfer", "baseline", "prepare", "chat", "discussion", "note", "complete"];
const HEADINGS: Partial<Record<LessonPhase, [string, string]>> = {
  intro: ["Your first conversation starts here.", "A little practice. Then a real task with Huahua."],
  teach_first: ["Start with one useful word.", "Read the meaning and play the audio when you can."],
  recognize: ["Find the word you just learned.", "Choose its Mandarin expression."],
  teach_second: ["Here’s another useful word.", "Read the meaning and play the audio when you can."],
  beginner_match: ["Match the words you’ve learned.", "Drag each Mandarin word to its English meaning, or tap a pair."],
  beginner_recall: ["Can you find the Mandarin word?", "Read the English meaning, then choose the word you learned."],
  meaning: ["Match the words.", "Connect each expression with its meaning."],
  listen: ["What did you hear?", "Listen, then choose the meaning."],
  frame: ["Put the pieces together.", "A small pattern makes a useful sentence."],
  supported: ["Finish the sentence.", "Choose the missing piece. The rest is ready for you."],
  baseline: ["Record your sentence.", "Play the model, then record yourself saying the sentence."],
  build: ["Build it with less help.", "Tap the words or phrases in order to make the sentence."],
  transfer: ["Now change one piece.", "Choose the missing piece to match the English sentence."],
  coach: ["Record it again.", "Play the model, record another try, then compare your recordings."],
  prepare: ["Here’s what I’ll ask.", "You only need to answer with your practiced reply."],
  chat: ["Your mission", "Use what you practiced in a short chat."],
  revisit: ["One quick revisit.", "Let’s return to a word you practiced earlier."],
  complete: ["You did it.", "You understood it, built it, and used it."],
};
function Bubble({ phrase, mine = false }: { phrase: LessonPhrase; mine?: boolean }) {
  return <div className={`lesson-message my-3 max-w-[92%] rounded-2xl px-4 py-3 ${mine ? "ml-auto rounded-br-sm" : "mr-auto rounded-bl-sm"}`} style={{ background: mine ? GREEN : "#E9EDF0", color: mine ? "white" : NAVY }}>
    <p className="text-lg font-bold leading-relaxed" lang="zh-CN">{phrase.hanzi}</p>
    <p className="mt-1 text-xs leading-relaxed">{phrase.pinyin}</p><p className="mt-1 text-xs leading-relaxed">{phrase.meaning}</p>
  </div>;
}
function LessonPlayer({ state, update, next, back, track, ensureSession, lessonOverride, onAlternative }: StepProps & { ensureSession: () => Promise<boolean>; lessonOverride?: AuthoredLesson; onAlternative?: () => void }) {
  const answers = state.answers;
  const lesson = useMemo(() => lessonOverride ?? getLessonById(answers.firstLesson.lessonId ?? "") ?? selectFirstLesson({ goal: answers.goal.primary, interestKeys: answers.interests.keys, selfReport: answers.level.selfReport, basic: answers.vocabBasic, advanced: answers.vocabAdvanced }), [lessonOverride, answers.firstLesson.lessonId, answers.goal.primary, answers.interests.keys, answers.level.selfReport, answers.vocabBasic, answers.vocabAdvanced]);
  const [progress, setProgress] = useState<FirstLessonProgress>(() => {
    const saved = answers.firstLesson.version === 2 && (lessonOverride ? answers.firstLesson.lessonId === lesson.id : getLessonById(answers.firstLesson.lessonId ?? "")) ? answers.firstLesson : {...EMPTY_FIRST_LESSON,lessonId:lesson.id};
    return {...saved,phase:saved.phase === "discussion" && !lesson.curriculum?.discussion ? "prepare" : saved.phase === "baseline" && lesson.curriculum?.pronunciation === false ? "prepare" : lesson.curriculum && ["teach_first","meaning"].includes(saved.phase) ? "vocabulary" : saved.phase === "coach" ? "baseline" : saved.phase,discussionReplyId:lesson.curriculum?.discussion?.choices.some(p=>p.id===saved.discussionReplyId)?saved.discussionReplyId:null,selectedDrinkId:lesson.chat.choices.some(p=>p.id===saved.selectedDrinkId)?saved.selectedDrinkId:null};
  });
  const progressRef = useRef(progress);
  const phase = progress.phase;
  const chatting = phase === "chat" || phase === "discussion";
  const activeChat = phase === "discussion" ? lesson.curriculum?.discussion ?? lesson.chat : lesson.chat;
  const sentReplyId = phase === "discussion" ? progress.discussionReplyId : progress.selectedDrinkId;
  const [status, setStatus] = useState("");
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"baseline" | "coach" | "chat">("baseline");
  const [silent, setSilent] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [chatError, setChatError] = useState(false);
  const [typing, setTyping] = useState(false);
  const [xpBurst, setXpBurst] = useState(0);
  const [celebration,setCelebration] = useState(0);
  const recorder = useRef<PcmRecorderHandle | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreAbort = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const starting = useRef(false);
  const captureRequest = useRef(0);
  const init = useRef(false);
  const urls = useRef<string[]>([]);
  const heading = useRef<HTMLDivElement>(null);
  const target = lesson.targets.find(p => p.id === lesson.speakTargetId) ?? lesson.targets[0];
  const word = (index: number): LessonPhrase => { const w = lesson.match[index] ?? lesson.match[0]; return { ...w, meaning: w.label }; };
  const teaching = lesson.template?.teaching ?? [];
  const teachingIndex = Math.min(progress.teachingIndex ?? 0, Math.max(0,teaching.length-1));
  const quizPairs = lesson.template?.quizPairs ?? lesson.match;
  const beginnerRounds = !lesson.curriculum && lesson.template?.tier === 1 && teaching.length >= 2;
  const roundPairs = lesson.match.filter(p => teaching.slice(Math.max(0, teachingIndex - 2), teachingIndex + 1).some(w => w.id === p.id));
  const phases = PHASES.filter(p => {
    if (lesson.curriculum) return ["intro", "vocabulary", "frame", ...(lesson.curriculum.pronunciation === false ? [] : ["baseline"]), "prepare", "chat", ...(lesson.curriculum.discussion ? ["discussion"] : []), "note", "complete"].includes(p);
    if (p === "discussion" || p === "note" || p === "vocabulary") return false;
    if (["beginner_match", "beginner_recall"].includes(p)) return beginnerRounds;
    if (beginnerRounds && ["recognize", "meaning", "listen"].includes(p)) return false;
    return !lesson.template || (p !== "teach_second" && !(teaching.length === 0 && ["teach_first", "recognize"].includes(p)) && !(teaching.length <= 1 && ["meaning", "listen"].includes(p)));
  });
  const failAudio = () => setAudioUnavailable(true);
  const save = (patch: Partial<FirstLessonProgress>, xpKey?: LessonXpKey) => {
    const previous = progressRef.current;
    let value = { ...previous, ...patch };
    if (xpKey) value = awardLessonXp(value, xpKey);
    progressRef.current = value; setProgress(value); update({ firstLesson: value });
    const delta = lessonXpTotal(value) - lessonXpTotal(previous);
    if (delta > 0) {
      setXpBurst(delta); if (xpTimer.current) clearTimeout(xpTimer.current);
      xpTimer.current = setTimeout(() => setXpBurst(0), 1600);
      track(ONBOARDING_EVENTS.firstLessonXp, { lesson_id: lesson.id, xp_key: xpKey, xp_total: lessonXpTotal(value) });
    }
    return value;
  };
  const go = (phase: LessonPhase, patch: Partial<FirstLessonProgress> = {}, xpKey?: LessonXpKey) => {
    if (!phases.includes(phase) && phase !== "revisit") {
      const index = PHASES.indexOf(phase); phase = phases.find(p => PHASES.indexOf(p)>index) ?? "complete";
    }
    if (lesson.template && phase === "frame" && teaching.length<=1) xpKey = "meaning";
    setStatus(""); setSilent(false); setChoice(null); setChatError(false); save({ ...patch, phase }, xpKey);
    track(ONBOARDING_EVENTS.firstLessonPhase, { lesson_id: lesson.id, phase });
  };
  const mistake = (id: string) => save({ mistakes: Array.from(new Set([...(progressRef.current.mistakes ?? []), id])) });
  useEffect(() => {
    if (init.current) return; init.current = true;
    update({ firstLesson: progressRef.current });
    track(ONBOARDING_EVENTS.firstLessonStarted, { lesson_id: lesson.id });
  }, [lesson.id, track, update]);
  useEffect(() => { heading.current?.scrollIntoView({ block: "nearest", behavior: "instant" }); }, [progress.phase]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; captureRequest.current += 1; if (timer.current) clearTimeout(timer.current); if (typingTimer.current) clearTimeout(typingTimer.current); if (xpTimer.current) clearTimeout(xpTimer.current);
      if (recorder.current) abortPcmRecording(recorder.current); scoreAbort.current?.abort();
      urls.current.forEach(url => URL.revokeObjectURL(url));
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  const finish = () => {
    if (lesson.curriculum?.discussion && !progressRef.current.discussionReplyId) { go("discussion"); return; }
    if (lesson.curriculum && progressRef.current.phase !== "note") { go("note"); return; }
    setCelebration(n=>n+1);
    const completed = save({ phase: "complete", completedAt: new Date().toISOString() }, "exchange");
    track(ONBOARDING_EVENTS.firstLessonCompleted, { lesson_id: lesson.id, xp_total: lessonXpTotal(completed), speaking_path: completed.speakingPath, used_alternative: completed.usedAlternative });
    setStatus("Mission complete. You used your Mandarin in context.");
  };
  const deliver = () => {
    if (!choice || choice !== activeChat.expectedChoiceId) return;
    save(phase === "discussion" ? { discussionReplyId: choice } : { selectedDrinkId: choice }); setTyping(true);
    typingTimer.current = setTimeout(() => { if (alive.current) { setTyping(false); const reply = activeChat.responses[choice]; if (reply) say(reply.hanzi, failAudio); } }, 850);
  };
  const evaluate = async (blob: Blob, attemptKind: "baseline" | "coach" | "chat") => {
    if (!alive.current) return;
    setBusy(true); setStatus("Checking your recording…");
    const playbackUrl = URL.createObjectURL(blob); urls.current.push(playbackUrl);
    let attempt: SpeakingAttempt = { at: new Date().toISOString(), playbackUrl, feedback: "unavailable", weakSyllable: null, overall: null, tone: null };
    const controller = new AbortController(); scoreAbort.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const authenticated = await Promise.race([ensureSession(), new Promise<boolean>(resolve => setTimeout(() => resolve(false), 6000))]);
      if (!authenticated || !alive.current) throw new Error("Assessment session unavailable");
      const body = new FormData();
      const text = attemptKind === "chat" ? activeChat.choices.find(p => p.id === choice)?.hanzi ?? target.hanzi : target.hanzi;
      if (progressRef.current.generated?.token) body.append("lessonToken", progressRef.current.generated.token);
      body.append("targetText", text.replace(/[，。！？、\s]/g, "")); body.append("audio", blob, "phrase.wav");
      const response = await fetch("/api/onboarding/pronunciation", { method: "POST", body, signal: controller.signal });
      const data = await response.json();
      if (response.ok && data?.status === "ok") attempt = { ...attempt, characters: parsePronunciationPieces(data.characters), feedback: ["great", "close", "retry"].includes(data.feedback) ? data.feedback : "unavailable", weakSyllable: typeof data.weakSyllable === "string" ? data.weakSyllable : null, overall: typeof data.overall === "number" && Number.isFinite(data.overall) ? data.overall : null, tone: typeof data.tone === "number" && Number.isFinite(data.tone) ? data.tone : null };
    } catch { /* Playback remains available when scoring cannot be reached. */ }
    finally { clearTimeout(timeout); scoreAbort.current = null; }
    if (!alive.current) return;
    setBusy(false);
    if (typeof attempt.overall === "number" && attempt.overall >= 90) setCelebration(n=>n+1);
    if (attemptKind === "chat") { setStatus("Your reply is ready."); deliver(); return; }
    const first = progressRef.current.baseline;
    save({ baseline: first ?? attempt, latest: attempt, coachRetries: first ? progressRef.current.coachRetries + 1 : 0, speakingPath: "spoken" }, "speaking");
    setStatus("");
  };
  const stop = async (attemptKind = kind) => {
    const handle = recorder.current; if (!handle) return;
    recorder.current = null; if (timer.current) clearTimeout(timer.current);
    setRecording(false); setBusy(true);
    try { const blob = await stopPcmRecording(handle); await evaluate(blob, attemptKind); }
    catch { if (alive.current) { setBusy(false); setStatus("The recording could not be saved. Try again or use listening practice."); } }
  };
  const record = async (attemptKind: "baseline" | "coach" | "chat") => {
    if (starting.current || recorder.current || busy) return;
    if (attemptKind !== "chat" && progressRef.current.baseline && progressRef.current.coachRetries >= 2) return;
    if (attemptKind === "chat" && !validateChoice()) return;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    const request = ++captureRequest.current;
    starting.current = true; setBusy(true); setStatus("Getting your microphone ready…"); setKind(attemptKind);
    try {
      const pending = startPcmRecording();
      void pending.then(handle => { if (!alive.current || request !== captureRequest.current) abortPcmRecording(handle); }, () => undefined);
      let permissionTimeout: ReturnType<typeof setTimeout> | undefined;
      let handle: PcmRecorderHandle;
      try {
        handle = await Promise.race([pending, new Promise<never>((_, reject) => { permissionTimeout = setTimeout(() => reject(new Error("Microphone request timed out")), 12000); })]);
      } finally { if (permissionTimeout) clearTimeout(permissionTimeout); }
      if (!alive.current || request !== captureRequest.current) return;
      recorder.current = handle; setBusy(false); setRecording(true); setStatus("Listening… Say the sentence, then tap Stop.");
      timer.current = setTimeout(() => void stop(attemptKind), lesson.template ? 20000 : 12000);
    } catch { if (alive.current && request === captureRequest.current) { captureRequest.current += 1; starting.current = false; setBusy(false); setStatus("Microphone unavailable. You can try again or continue with the silent path."); } }
    finally { if (request === captureRequest.current) starting.current = false; }
  };
  const validateChoice = () => {
    if (choice === activeChat.expectedChoiceId) { setChatError(false); return true; }
    setChatError(true); mistake(lesson.template ? "mission" : lesson.match[1].id); return false;
  };
  const conceptSteps = lesson.curriculum ? grammarSteps(lesson.curriculum) : [];
  const conceptIndex = grammarStepIndex(conceptSteps, progress.grammarStepId);
  const conceptStep = conceptSteps[conceptIndex];
  const phaseIndex = phase === "revisit" ? phases.length-2 : phases.indexOf(phase);
  const roundPhase = ["teach_first", "beginner_match", "beginner_recall"].includes(phase);
  const roundFraction = (Math.floor(teachingIndex / 2) + (phase === "teach_first" ? 0 : phase === "beginner_match" ? 0.55 : 0.8)) / Math.ceil(teaching.length / 2);
  const progressIndex = beginnerRounds && roundPhase ? 1 + roundFraction * (phases.indexOf("frame") - 1) : Math.max(0, phaseIndex);
  const percentage = lesson.curriculum ? curriculumProgress(lesson, progress) : phase === "complete" ? 100 : Math.round((progressIndex + (phase === "frame" && conceptSteps.length ? conceptIndex / conceptSteps.length : 0)) / (phases.length - 1) * 100);
  const xp = lessonXpTotal(progress);
  const simplePhrase = !hasWordBreakdown(lesson.sentenceWords, lesson.transferBuild.result);
  let title = phase === "vocabulary" ? (progress.vocabularyChecked ? "A few words, then a little practice." : "Let’s build on what you know.") : phase === "teach_first" && lesson.template ? (teaching.length===1 && teaching[0].hanzi===lesson.build.result.hanzi ? "A useful way to say it." : "Learn the pieces you’ll use.") : phase === "chat" && lesson.template ? lesson.outcome : phase === "frame" && simplePhrase ? "Use it in a conversation." : phase === "note" ? lesson.curriculum?.note.title ?? "Remember this" : phase === "frame" && lesson.curriculum ? "Discover the pattern. Then use it." : phase === "intro" ? lesson.outcome : phase === "chat" ? `Your mission: ${lesson.mission.toLowerCase()}.` : phase === "complete" ? lesson.completionLine : phase === "prepare" && lesson.template ? (lesson.chat.huahua.hanzi.includes("？") ? "Understand Huahua’s question." : "Understand Huahua’s message.") : HEADINGS[phase]?.[0] ?? "Practice with Huahua";
  let subtitle = phase === "vocabulary" ? "Learn only the words you need, up to three at a time." : phase === "prepare" && lesson.template ? "A short explanation, then your conversation." : phase === "frame" && simplePhrase ? "A short phrase can do a lot." : phase === "intro" ? lesson.situation : HEADINGS[phase]?.[1];
  if (phase === "frame" && conceptStep) {
    title = conceptStep.kind === "teach" ? conceptStep.card.title : conceptStep.kind === "check" ? "Your turn." : "Put it into practice.";
    subtitle = conceptStep.kind === "teach" ? conceptStep.card.explanation : conceptStep.kind === "check" ? "Use the idea you just learned." : "Use what you’ve learned in a situation that matters to you.";
  }
  if (beginnerRounds && phase === "teach_first") {
    title = "Learn one word at a time.";
    subtitle = "Read the meaning and play the audio. You’ll practise after every two new words.";
  }
  if (phase === "discussion") { title = "Consider another perspective."; subtitle = "Huahua raises a concern. Acknowledge it and explain a balanced response."; }
  const meaningPractice = (phase === "baseline" && silent) || (phase === "coach" && (progress.speakingPath !== "spoken" || silent));
  const sentenceRevisit = phase === "revisit" && lesson.template && !lesson.match.some(p => progress.mistakes?.includes(p.id));
  if (meaningPractice || (phase === "listen" && audioUnavailable) || (phase === "revisit" && !sentenceRevisit)) {
    const reading = audioUnavailable || phase === "revisit";
    title = reading ? "What does this mean?" : "What did you hear?";
    subtitle = reading ? "Read the Mandarin expression, then choose its English meaning." : "Play the audio, then choose its English meaning.";
  } else if (sentenceRevisit) {
    title = "Complete the sentence again.";
    subtitle = "Choose the missing piece to match the English sentence.";
  }
  if (phase === "baseline" && !silent && progress.baseline) {
    title = "Review your pronunciation.";
    subtitle = progress.coachRetries >= 2 ? "Review your results, then continue to your chat." : "Tap a highlighted part for feedback. Retry if you like, or continue.";
  }
  const baselineDone = Boolean(progress.baseline?.at);
  const pronunciationAttempt = progress.latest ?? progress.baseline;
  const attemptCount = baselineDone ? 1 + progress.coachRetries : 0;
  const coached = baselineDone && progress.coachRetries > 0;
  const improved = coached && typeof progress.latest?.overall === "number" && typeof progress.baseline?.overall === "number" && progress.latest.overall > progress.baseline.overall;
  const playback = (attempt: SpeakingAttempt | null, label: string, compact = false) => { const Button = compact ? TextButton : SecondaryButton; return attempt?.playbackUrl ? <Button className={compact ? "!w-auto !px-2" : ""} onClick={() => { const audio = new Audio(attempt.playbackUrl!); void audio.play().catch(() => setStatus("Playback unavailable. Try the model audio instead.")); }}><Volume2 size={16} aria-hidden />{label}</Button> : null; };
  const speaker = (attemptKind: "baseline" | "coach" | "chat", label: string, secondary = false, disabled = false) => { const Button = secondary ? SecondaryButton : PrimaryButton; return recording ? <PrimaryButton data-testid="lesson-stop" onClick={() => void stop(attemptKind)}><Square size={16} aria-hidden />Stop recording</PrimaryButton> : <Button className={secondary ? "!px-3 whitespace-nowrap" : ""} disabled={busy || disabled} data-testid={`lesson-${attemptKind}-record`} onClick={() => {prepareCelebrationSound(); void record(attemptKind);}}><Mic size={18} aria-hidden />{busy ? "Please wait…" : label}</Button>; };
  const bands = ["beginner", "elementary", "intermediate", "advanced"];
  const alternative = LESSON_BANK.find(p => p.route === lesson.route && p.band === bands[bands.indexOf(lesson.band) + 1]);
  const switchLesson = () => {
    if (lesson.curriculum) { go("frame",{},"meaning"); return; }
    if (onAlternative && !progress.usedAlternative) { onAlternative(); return; }
    if (!alternative || progress.usedAlternative) { go(lesson.template ? "frame" : "teach_first"); return; }
    const initial = { ...EMPTY_FIRST_LESSON, lessonId: alternative.id, usedAlternative: true };
    progressRef.current = initial; setProgress(initial); update({ firstLesson: initial }); setChoice(null); setStatus("");
    track(ONBOARDING_EVENTS.firstLessonAlreadyKnew, { lesson_id: lesson.id });
  };
  return <div onClickCapture={prepareCelebrationSound} onPointerDownCapture={prepareCelebrationSound} className="onboarding-mini-lesson" data-testid="first-lesson" data-lesson-id={lesson.id} data-lesson-phase={phase} data-teaching-index={teachingIndex}>
    {celebration > 0 && <CorrectCelebration key={celebration}/>}
    <style jsx global>{`
      @keyframes lesson-arrive { from { transform: translateY(6px) scale(.97); } to { transform: translateY(0) scale(1); } }
      @media (prefers-reduced-motion: no-preference) {
        .onboarding-mini-lesson .lesson-message, .onboarding-mini-lesson .lesson-correct { animation: lesson-arrive .22s ease-out both; }
      }
    `}</style>
    <StepFrame hideTitle={chatting} compact={chatting || (phase === "frame" && Boolean(lesson.curriculum))} key={phase === "frame" && conceptStep ? `${phase}:${conceptStep.id}` : phase} title={title} subtitle={chatting ? undefined : subtitle} onBack={null} header={<div ref={heading} tabIndex={-1} className="outline-none">
        <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold" style={{ color: MUTED }}><button type="button" disabled={recording || busy} onClick={() => { if (phase === "intro") back?.(); else if (phase === "frame" && conceptIndex > 0) save({grammarIndex:conceptIndex-1,grammarStepId:conceptSteps[conceptIndex-1].id}); else { const index = phases.indexOf(phase); go(phases[Math.max(0, index - 1)]); } }} aria-label={phase === "intro" ? "Back to your plan" : "Previous lesson step"} className="flex min-h-11 items-center gap-1"><ChevronLeft size={16} aria-hidden />Back</button><span>{phase === "complete" ? "Complete" : (phase === "chat" || phase === "discussion") ? "Chat with Huahua" : "Your first lesson"}</span><span data-testid="lesson-xp">{xp} / {LESSON_XP_TOTAL} XP</span></div>
        <div role="progressbar" aria-label="Lesson progress" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} className={`${chatting ? "mb-4" : "mb-5"} h-2 overflow-hidden rounded-full`} style={{ background: "#E7F0F6" }}><div className="h-full origin-left rounded-full motion-safe:transition-transform motion-safe:duration-500" style={{ background: GREEN, transform: `scaleX(${percentage / 100})` }} /></div>
      </div>}>
      {xpBurst > 0 && <p role="status" className="mb-3 text-center text-sm font-bold motion-safe:animate-bounce" style={{ color: GREEN }}>+{xpBurst} XP</p>}
      {audioUnavailable && <p role="status" className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: CARD_BORDER, color: MUTED }}>Audio is unavailable here. Text and meaning hints will help you keep practicing.</p>}
      <div key={`${lesson.id}-${phase}`} data-testid={phase === "intro" ? "lesson-intro" : undefined}>
      {phase === "intro" && <>
        {progress.coursePlacement?.notice && <p role="status" className="mb-4 rounded-2xl p-3 text-sm" style={{background:SKY_PALE,color:GREEN}}>{progress.coursePlacement.notice}</p>}
        <LessonIntroImage goal={answers.goal.primary}/>
        <ul className="my-5 space-y-3 text-sm" style={{ color: NAVY }}>{[lesson.template?.tier && lesson.template.tier >= 4 ? "Learn a useful way to express yourself" : lesson.route === "work" ? "Expand your work vocabulary" : lesson.route === "travel" ? "Build vocabulary for your next trip" : "Find words to connect with others", "Turn new words into a sentence you can use", "Put it into practice with Huahua, your personalized Mandarin companion"].map(text => <li key={text} className="flex items-center gap-2"><Check size={17} style={{ color: GREEN }} aria-hidden />{text}</li>)}</ul>
        <p data-testid="lesson-learning-budget" className="text-center text-xs" style={{ color: MUTED }}>{progress.coursePlacement ? (lesson.match.some(w=>!progress.vocabularyKnownIds?.includes(w.id)) ? `${lesson.match.filter(w=>!progress.vocabularyKnownIds?.includes(w.id)).length} new words and expressions · One useful grammar family` : "Familiar words · One useful pattern to practise") : "About 5–8 minutes · Extra practice is optional"}</p>
        <PrimaryButton className="mt-6" data-testid="lesson-start" onClick={() => go(lesson.curriculum ? "vocabulary" : "teach_first")}>Let’s learn</PrimaryButton>
        {!lesson.curriculum && <TextButton className="mt-2" data-testid="lesson-already-know" onClick={switchLesson}>{progress.usedAlternative || (!alternative && !onAlternative) ? "Practice this in context" : "I already know this"}</TextButton>}
      </>}
      {(phase === "teach_first" || phase === "teach_second") && <>
        {lesson.template && <p className="mb-3 text-center text-xs" style={{color:MUTED}}>New piece {teachingIndex+1} of {teaching.length}</p>}
        <WordCard phrase={lesson.template ? teaching[teachingIndex] : word(phase === "teach_first" ? 0 : 1)} route={lesson.route} onUnavailable={failAudio}/>
        <PrimaryButton className="mt-6" data-testid="lesson-teach-continue" onClick={()=>{
          if (beginnerRounds && ((teachingIndex + 1) % 2 === 0 || teachingIndex === teaching.length - 1)) go("beginner_match");
          else if(lesson.template && teachingIndex<teaching.length-1) save({teachingIndex:teachingIndex+1});
          else go(lesson.curriculum ? "meaning" : phase==="teach_first"?"recognize":"meaning");
        }}>Continue</PrimaryButton><p className="mt-3 text-center text-xs" style={{color:MUTED}}>Replay as often as you like.</p>
      </>}
      {phase === "beginner_match" && <MatchWords key={`round-match-${teachingIndex}`} pairs={roundPairs} onMistake={mistake} onUnavailable={failAudio} onComplete={() => go("beginner_recall")} />}
      {phase === "beginner_recall" && <MeaningQuiz key={`round-recall-${teachingIndex}`} pairs={roundPairs} targetIndex={roundPairs.length - 1} onMistake={mistake} onUnavailable={failAudio} onComplete={() => {
        if (teachingIndex < teaching.length - 1) go("teach_first", {teachingIndex: teachingIndex + 1});
        else go("frame", {}, "meaning");
      }} />}
      {phase === "recognize" && <MeaningQuiz pairs={quizPairs} onMistake={mistake} onUnavailable={failAudio} onComplete={() => go("teach_second")} />}
      {phase === "vocabulary" && lesson.curriculum && <VocabularyLesson matching={lesson.curriculum.vocabularyMatching!==false} groups={lesson.curriculum.vocabularyGroups} words={lesson.match} progress={progress} previouslyKnown={vocabularyEvidence(answers).known} onSave={save} onComplete={()=>go("frame",{},"meaning")} onMistake={mistake} onUnavailable={failAudio}/>}
      {phase === "meaning" && <MatchWords pairs={lesson.match} onMistake={mistake} onUnavailable={failAudio} onComplete={()=>go("listen",{},"meaning")}/>}
      {phase === "listen" && <MeaningQuiz pairs={quizPairs} targetIndex={Math.min(1,lesson.match.length-1)} listening={!audioUnavailable} silent={audioUnavailable} onMistake={mistake} onUnavailable={failAudio} onComplete={() => go("frame")} />}
      {phase === "frame" && (lesson.curriculum ? <GrammarPractice writingContext={{tier:lesson.template?.tier??4,goal:answers.goal.primary??"other",variant:progress.coursePlacement?.variant??0,interestKeys:answers.interests.keys,lessonId:lesson.id}} initialStepId={progress.grammarStepId} onProgress={(grammarIndex,grammarStepId)=>save({grammarIndex,grammarStepId})} curriculum={lesson.curriculum} responses={progress.writingResponses} onResponse={(id,text)=>save({writingResponses:{...progressRef.current.writingResponses,[id]:text}})} onMistake={mistake} onUnavailable={failAudio} onComplete={()=>{ if(lesson.curriculum?.pronunciation===false){save({},"build");go("prepare",{speakingPath:"skipped"},"speaking");}else go("baseline",{},"build");}}/> : <>
        <p className="mb-4 rounded-2xl p-4 text-sm leading-relaxed" style={{background:SKY_PALE,color:NAVY}}>{lesson.skill}</p><SentenceBreakdown words={lesson.sentenceWords} sentence={lesson.transferBuild.result} onUnavailable={failAudio} />
        <PrimaryButton className="mt-6" onClick={() => go("supported")}>{simplePhrase ? "Practice using it" : "Try building it"}</PrimaryButton>
      </>)}
      {phase === "supported" && <BuildSentence prompt={lesson.build} supported options={lesson.match} onMistake={mistake} onUnavailable={failAudio} onComplete={() => go("build")} />}
      {phase === "baseline" && (silent ? <MeaningQuiz key="silent-pronunciation" pairs={quizPairs} targetIndex={0} listening={!audioUnavailable} silent={audioUnavailable} onMistake={mistake} onUnavailable={failAudio} onComplete={() => go("prepare", {speakingPath:"listening"}, "speaking")} /> : <>
        {!pronunciationAttempt && <WordCard phrase={target} onUnavailable={failAudio}/>}
        {pronunciationAttempt && <PronunciationResults key={pronunciationAttempt.at} attempt={pronunciationAttempt} phrase={target} onUnavailable={failAudio}/>}
        {baselineDone && <div className="mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex flex-wrap items-center gap-1">{playback(pronunciationAttempt!, "My recording", true)}{attemptCount>1 && playback(progress.baseline,"First recording",true)}</div>
          <span className="text-xs" style={{color:MUTED}}>Attempt {Math.min(3,attemptCount)} of 3</span>
        </div>}
        {!baselineDone && <p className="my-3 text-center text-xs" style={{color:MUTED}}>Record once to see your results. Retrying is optional.</p>}
        {attemptCount>=3 && <Feedback correct>Practice complete. You’ve worked on this sentence. Let’s use it in your chat.</Feedback>}
        <div className={baselineDone && attemptCount<3 && !recording ? "mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-2" : "mt-3"}>
          {attemptCount<3 && speaker(baselineDone ? "coach" : "baseline", baselineDone ? "Try again" : "Record my sentence",baselineDone)}
          {baselineDone && <PrimaryButton disabled={busy || recording} data-testid="lesson-baseline-continue" onClick={() => go("prepare")}>Continue to chat</PrimaryButton>}
        </div>
        <TextButton className="mt-2" disabled={recording || (busy && !starting.current)} data-testid="lesson-cant-speak" onClick={() => {captureRequest.current+=1;starting.current=false;setBusy(false);setSilent(true);setStatus("");}}>Practice without speaking</TextButton>
      </>)}
      {phase === "build" && <BuildSentence prompt={lesson.build} onMistake={mistake} onUnavailable={failAudio} onComplete={() => go("transfer")} />}
      {phase === "transfer" && <BuildSentence prompt={lesson.transferBuild} supported options={lesson.match} onMistake={mistake} onUnavailable={failAudio} onComplete={() => go("baseline", {}, "build")} />}
      {phase === "prepare" && <PrepareMessage lesson={lesson} onMistake={mistake} onUnavailable={failAudio} onContinue={()=>{setChoice(null);go("chat");say(lesson.chat.huahua.hanzi,failAudio);}}/>}
      {chatting && <div data-testid="lesson-chat" className={chatStyles.chat}>
        {lesson.template && <ChatSituation mission={activeChat.mission} fallback={phase === "discussion" ? "Acknowledge Huahua’s concern and explain a balanced response." : lesson.template.scene}/>}
        {phase === "discussion" && <div className="mb-3 rounded-xl px-3 py-2" style={{background:SKY_PALE}}><p className="text-xs font-bold" style={{color:MUTED}}>Your first point</p><p className="mt-1 text-sm" lang="zh-CN">{(lesson.chat.choices.find(p=>p.id===progress.selectedDrinkId) ?? lesson.chat.choices[1]).hanzi}</p></div>}
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold" style={{background:"#E9DFD1",color:NAVY}} aria-hidden>H</span>
          <p className="text-sm font-bold">Huahua</p>
        </div>
        <div className={chatStyles.question} data-testid="chat-question">
          <div className="min-w-0">
            <p className="text-xl font-bold leading-snug sm:text-2xl" lang="zh-CN">{activeChat.huahua.hanzi}</p>
            <p className="mt-1 text-sm leading-relaxed" style={{color:MUTED}}>{activeChat.huahua.pinyin}</p>
            <p className="mt-1 text-sm leading-relaxed">{activeChat.huahua.meaning}</p>
          </div>
          <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{color:GREEN,outlineColor:GREEN}} aria-label={`Replay question: ${activeChat.huahua.hanzi}`} onClick={()=>say(activeChat.huahua.hanzi,failAudio)}><Volume2 size={23} aria-hidden/></button>
        </div>
        {sentReplyId ? <div className="mt-3">
          <Bubble mine phrase={activeChat.choices.find(p=>p.id===sentReplyId)!}/>
          <p className="text-right text-xs" style={{color:MUTED}}>Delivered</p>
          {typing ? <p role="status" className="mt-3 text-sm" style={{color:MUTED}}>Huahua is typing…</p> : <Bubble phrase={activeChat.responses[sentReplyId]}/>}
        </div> : <>
          <p className="sr-only" id="chat-replies-label">Choose your reply</p>
          <div role="group" aria-labelledby="chat-replies-label" data-testid="chat-replies" className={`${chatStyles.choices} ${activeChat.choices.every(p=>p.hanzi.length<=12) ? chatStyles.shortChoices : ""}`}>
            {activeChat.choices.map(p=><button key={p.id} type="button" disabled={busy||recording} aria-pressed={choice===p.id} data-testid={`lesson-choice-${p.id}`} onClick={()=>{setChoice(p.id);setChatError(false);}} className={chatStyles.choice} style={{borderColor:choice===p.id?GREEN:CARD_BORDER,background:choice===p.id?"#EFF7F2":"white",color:NAVY,outlineColor:GREEN}}>
              <span className="block text-lg font-bold leading-snug sm:text-xl" lang="zh-CN">{p.hanzi}</span>
              <span className="mt-1 block text-xs leading-relaxed sm:text-sm" style={{color:MUTED}}>{p.pinyin}</span>
            </button>)}
          </div>
        </>}
        {chatError && <Feedback>That is a valid Mandarin reply meaning “{activeChat.choices.find(p=>p.id===choice)?.meaning}”. {activeChat.mission?.task ?? lesson.mission} Choose the reply that expresses that intention.</Feedback>}
        {sentReplyId ? <PrimaryButton className="mt-4" disabled={typing} data-testid="lesson-chat-finish" onClick={()=>(phase==="chat" && progress.mistakes?.length ? go("revisit") : finish())}>{phase==="chat" && lesson.curriculum?.discussion ? "Hear another perspective" : "Finish my lesson"}</PrimaryButton> : <div className="mt-4">
          {speaker("chat","Say & send",false,!choice)}
          <TextButton className="mt-1 w-full" data-testid="lesson-chat-skip-speak" disabled={!choice||busy||recording} onClick={()=>{if(validateChoice())deliver();}}>Send without speaking</TextButton>
        </div>}
      </div>}
      {phase === "revisit" && (lesson.template && !lesson.match.some(p=>progress.mistakes?.includes(p.id)) ? <BuildSentence prompt={lesson.transferBuild} supported onMistake={mistake} onUnavailable={failAudio} onComplete={finish}/> : <MeaningQuiz pairs={quizPairs} targetIndex={Math.max(0,lesson.match.findIndex(p=>progress.mistakes?.includes(p.id)))} silent onMistake={mistake} onUnavailable={failAudio} onComplete={finish}/>)}
      {phase === "note" && lesson.curriculum && <div data-testid="lesson-note"><p className="rounded-2xl p-5 text-base leading-relaxed" style={{background:SKY_PALE}}>{lesson.curriculum.note.text}</p><PrimaryButton className="mt-6" data-testid="lesson-note-continue" onClick={finish}>Complete my lesson</PrimaryButton></div>}
      {phase === "complete" && <div data-testid="lesson-complete">
        <div className="flex justify-center rounded-2xl py-5" style={{ background: "#EFF7F2", color: GREEN }}><Check size={34} aria-hidden /></div>
        <p className="my-4 text-center text-lg font-bold" style={{ color: GREEN }}>Mission complete · {xp} XP</p>
        <div className="rounded-2xl border p-4" style={{ borderColor: CARD_BORDER }}><Bubble phrase={lesson.chat.huahua} /><Bubble mine phrase={lesson.chat.choices.find(p => p.id === progress.selectedDrinkId) ?? lesson.targets[1]} /><Bubble phrase={lesson.chat.responses[lesson.chat.expectedChoiceId!]} /></div>
        <p className="mt-4 text-center text-sm" style={{ color: MUTED }}>{progress.speakingPath === "spoken" ? "You practiced speaking and used a sentence in context." : "You practiced meanings and built a reply in context."}</p>
        {baselineDone && coached && <div className="mt-4 rounded-2xl p-4 text-center" style={{ background: SKY_PALE }}><p className="mb-3 text-sm font-bold">Hear your progress</p><div className="grid gap-2 sm:grid-cols-2">{playback(progress.baseline, "First try")}{playback(progress.latest, "Latest try")}</div>{improved && <p className="mt-3 text-sm" style={{ color: GREEN }}>Your latest pronunciation score is higher.</p>}</div>}
        <PrimaryButton className="mt-6" data-testid="lesson-to-commitment" onClick={() => next({ firstLesson: progressRef.current })}>Continue my journey</PrimaryButton>
        <TextButton className="mt-2" onClick={() => go(lesson.curriculum ? "frame" : "transfer",{grammarIndex:0,grammarStepId:undefined})}>Practice a little more</TextButton>
      </div>}
      </div>
      {status && <p className="mt-4 text-sm leading-relaxed" role="status" style={{ color: MUTED }}>{status}</p>}
    </StepFrame>
  </div>;
}

function TemplateFirstLessonStep(props: StepProps & { ensureSession: () => Promise<boolean> }) {
  const {state,update}=props, answers=state.answers, key=templateKey(answers);
  const stored=validTemplatePlan(answers.firstLesson.templatePlan,answers);
  const beginner=answers.level.selfReport==="new";
  const [loading,setLoading]=useState(false),[confirmed,setConfirmed]=useState<string[]>([]);
  const controller=useRef<AbortController|null>(null),live=useRef(answers);live.current=answers;
  const currentKey=useRef(key);currentKey.current=key;
  const savePlan=(plan: ReturnType<typeof fallbackTemplatePlan>,alternative=false)=>update({firstLesson:{...EMPTY_FIRST_LESSON,lessonId:`template-${plan.templateId}`,templatePlan:plan,selectionKey:plan.key,usedAlternative:alternative}});
  const load=async(excluded:string[]=[])=>{
    controller.current?.abort();const abort=new AbortController();controller.current=abort;setLoading(true);setConfirmed([]);
    const timer=setTimeout(()=>abort.abort(),19000);
    try{
      const response=await fetch("/api/onboarding/first-lesson",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile:lessonInput(live.current),exclude:excluded}),signal:abort.signal});
      const result=response.ok?await response.json():null;
      if(currentKey.current!==key||controller.current!==abort||abort.signal.aborted)return;
      savePlan(validTemplatePlan(result?.plan,live.current)??fallbackTemplatePlan(live.current,excluded),excluded.length>0);
    }catch{if(currentKey.current===key&&controller.current===abort)savePlan(fallbackTemplatePlan(live.current,excluded),excluded.length>0);}
    finally{clearTimeout(timer);if(controller.current===abort)setLoading(false);}
  };
  useEffect(()=>{
    if(!stored){if(beginner)savePlan(fallbackTemplatePlan(answers));else void load();}
    return()=>{controller.current?.abort();controller.current=null;};
    // A profile change remounts this onboarding step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const skip=()=>{controller.current?.abort();controller.current=null;setLoading(false);savePlan(fallbackTemplatePlan(answers));};
  if(loading||!stored)return <StepFrame title="Finding something useful for you." subtitle="Choosing a short conversation and planning the unfamiliar pieces." onBack={props.back}><p role="status" className="py-6 text-sm" style={{color:MUTED}}>Preparing your first conversation…</p><SecondaryButton onClick={skip}>Start a ready-made lesson</SecondaryButton></StepFrame>;
  const prerequisites=stored.checked?[]:templatePrerequisites(stored,answers);
  if(prerequisites.length)return <StepFrame title="A quick familiarity check." subtitle="Select the words you already understand. We’ll explain unfamiliar pieces." onBack={props.back}>
    <div className="grid grid-cols-2 gap-3">{prerequisites.map(w=><button type="button" key={w.hanzi} aria-pressed={confirmed.includes(w.hanzi)} onClick={()=>setConfirmed(prev=>prev.includes(w.hanzi)?prev.filter(v=>v!==w.hanzi):[...prev,w.hanzi])} className="rounded-2xl border-2 p-4" style={{borderColor:confirmed.includes(w.hanzi)?GREEN:CARD_BORDER}}><span className="block text-xl" lang="zh-CN">{w.hanzi}</span><span className="text-sm" style={{color:MUTED}}>{w.pinyin}</span></button>)}</div>
    <TextButton onClick={()=>setConfirmed(prerequisites.map(w=>w.hanzi))}>I know all of these</TextButton>
    <PrimaryButton className="mt-4" onClick={()=>{
      const unknown=prerequisites.filter(w=>!confirmed.includes(w.hanzi)).map(w=>w.hanzi);
      const revised={...stored,familiarWords:stored.familiarWords.filter(w=>!unknown.includes(w)),checked:true};
      const plan=validTemplatePlan(revised,answers)??{...fallbackTemplatePlan(answers,[stored.templateId],unknown),checked:true};
      update({firstLesson:{...EMPTY_FIRST_LESSON,lessonId:`template-${plan.templateId}`,templatePlan:plan,selectionKey:key}});
    }}>Continue</PrimaryButton><p className="mt-3 text-sm" style={{color:MUTED}}>Leave unfamiliar words unselected.</p>
  </StepFrame>;
  const lesson=compileTemplate(stored);
  return <LessonPlayer key={`${lesson.id}:${stored.familiarWords.join("|")}:${stored.patternFamiliar}:${Boolean(answers.firstLesson.usedAlternative)}`} {...props} lessonOverride={lesson} onAlternative={()=>void load([stored.templateId])}/>;
}

/** Placement confirms prerequisites before a bounded, authored course begins. */
export function FirstLessonStep(props: StepProps & { ensureSession: () => Promise<boolean> }) {
 const tier=updatedLessonLevel(props.state.answers);
 if(!tier)return <TemplateFirstLessonStep {...props}/>;
 return <CoursePlacementGate key={`${tier}:${props.state.answers.goal.primary}`} answers={props.state.answers} tier={tier} onBack={props.back} onSave={firstLesson=>props.update({firstLesson})}>
  {lesson=><LessonPlayer key={lesson.id} {...props} lessonOverride={lesson}/>}
 </CoursePlacementGate>;
}
