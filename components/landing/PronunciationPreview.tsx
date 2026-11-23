"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, Square, Volume2, X, RotateCcw, Headphones, AudioLines, BookOpen } from "lucide-react";
import { abortPcmRecording, startPcmRecording, stopPcmRecording, type PcmRecorderHandle } from "@/lib/audio/recordPcm";
import { createClient } from "@/lib/supabase/browser";
import { PREVIEW_SENTENCE, PREVIEW_PINYIN, PREVIEW_MEANING, previewFeedback } from "@/lib/pronunciation/preview";
import styles from "./PronunciationPreview.module.css";

type Result = { overall: number; tone: number | null; characters: { hanzi: string; pinyin: string | null; score: number | null }[] };
type Phase = "intro" | "test" | "starting" | "recording" | "checking" | "result";

export default function PronunciationPreview({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const recorder = useRef<PcmRecorderHandle | null>(null);
  const timer = useRef<number | null>(null);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [canListen, setCanListen] = useState(false);

  useEffect(() => {
    mounted.current = true;
    setCanListen("speechSynthesis" in window);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      mounted.current = false;
      document.body.style.overflow = overflow;
      if (timer.current) window.clearTimeout(timer.current);
      request.current?.abort();
      if (recorder.current) { abortPcmRecording(recorder.current); recorder.current = null; }
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => { if (phase === "test" || phase === "result") heading.current?.focus(); }, [phase]);
  useEffect(() => {
    if (phase !== "recording") return;
    const interval = window.setInterval(() => setSeconds((value) => Math.min(value + 1, 8)), 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  const hear = () => {
    setError("");
    if (!canListen) { setError("Example audio is unavailable in this browser. You can still use the pinyin below."); return; }
    const utterance = new SpeechSynthesisUtterance(PREVIEW_SENTENCE);
    utterance.lang = "zh-CN"; utterance.rate = 0.75;
    utterance.onerror = (event) => { if (mounted.current && event.error !== "canceled" && event.error !== "interrupted") setError("The example audio could not play. Try again or use the pinyin."); };
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance);
  };

  const submit = async (audio: Blob) => {
    setPhase("checking");
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 25000);
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!mounted.current) return;
      if (!user) {
        const { error: authError } = await client.auth.signInAnonymously();
        if (authError) throw new Error("We couldn’t start the pronunciation check. Please try again.");
      }
      if (!mounted.current) return;
      if (controller.signal.aborted) throw new Error("The check took too long. Please try again.");
      const body = new FormData(); body.append("targetText", PREVIEW_SENTENCE); body.append("audio", audio, "pronunciation-preview.wav");
      const response = await fetch("/api/onboarding/pronunciation", { method: "POST", body, signal: controller.signal });
      const data = await response.json();
      if (!response.ok || data.status !== "ok" || typeof data.overall !== "number" || !Number.isFinite(data.overall) || data.overall < 0 || data.overall > 100) throw new Error("We couldn’t score that recording. Try again in a quiet spot, or build your journey below.");
      if (!mounted.current) return;
      setResult({ overall: Math.round(data.overall), tone: typeof data.tone === "number" && Number.isFinite(data.tone) && data.tone >= 0 && data.tone <= 100 ? Math.round(data.tone) : null, characters: Array.isArray(data.characters) ? data.characters.filter((item: Result["characters"][number]) => typeof item.hanzi === "string" && PREVIEW_SENTENCE.includes(item.hanzi)).map((item: Result["characters"][number]) => ({ hanzi: item.hanzi, pinyin: typeof item.pinyin === "string" ? item.pinyin : null, score: typeof item.score === "number" && Number.isFinite(item.score) ? item.score : null })) : [] });
      setPhase("result");
    } catch (cause) {
      if (mounted.current) { setError(cause instanceof Error && cause.name !== "AbortError" ? cause.message : "The check took too long. Please try again."); setPhase("test"); }
    } finally { window.clearTimeout(timeout); busy.current = false; }
  };

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const handle = recorder.current; recorder.current = null;
    if (!handle) return;
    try { void submit(stopPcmRecording(handle)); }
    catch { busy.current = false; setPhase("test"); setError("We didn’t hear enough audio. Check your microphone and try again."); }
  };
  const record = async () => {
    if (busy.current) return;
    busy.current = true; setError(""); setPhase("starting");
    window.speechSynthesis?.cancel();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const handle = await startPcmRecording();
      if (!mounted.current) { abortPcmRecording(handle); return; }
      recorder.current = handle; setSeconds(0); setPhase("recording");
      timer.current = window.setTimeout(stop, 8000);
    } catch (cause) {
      busy.current = false;
      if (!mounted.current) return;
      setPhase("test");
      setError((cause as { name?: string })?.name === "NotAllowedError" ? "Microphone access is off. Allow it in your browser settings to try, or continue without recording." : "Your microphone couldn’t start. Check your input device and try again, or continue without recording.");
    }
  };

  const feedback = result ? previewFeedback(result.overall) : null;
  const weak = result?.characters.filter((item) => item.score !== null && item.score < 85).sort((a, b) => (a.score ?? 100) - (b.score ?? 100)).slice(0, 2) ?? [];
  const title = phase === "intro" ? "Make yourself understood." : phase === "result" ? feedback!.title : "Let’s hear your Mandarin.";
  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="pronunciation-preview-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.panel}>
        <button autoFocus className={styles.close} type="button" aria-label="Close pronunciation preview" onClick={onClose}><X size={21} aria-hidden /></button>
        <h2 ref={heading} tabIndex={-1} id="pronunciation-preview-title">{title}</h2>
        {phase === "intro" ? <>
          <p className={styles.description}>Follow a guided course that teaches you Mandarin pronunciation step by step, from the four tones to the small details of connected speech that help you sound more natural and more like a native speaker.</p>
          <div className={styles.lessons}>
            <div><Headphones aria-hidden /><span><strong>Hear the difference</strong>Train your ear with four-tone and neutral-tone listening practice.</span></div>
            <div><BookOpen aria-hidden /><span><strong>Understand the changes</strong>Learn how tones shift when words come together.</span></div>
            <div><AudioLines aria-hidden /><span><strong>Put it into speech</strong>Record phrases and tongue twisters, then use feedback to focus your practice.</span></div>
          </div>
          <p className={styles.invitation}>Want to try a quick pronunciation check?</p>
          <button className={styles.primary} type="button" onClick={() => setPhase("test")}><Mic size={18} aria-hidden /> Test my pronunciation</button>
          <Link className={styles.secondary} href="/onboarding/journey">Build my journey instead</Link>
        </> : phase === "result" && result && feedback ? <>
          <div className={styles.score}><strong>{result.overall}<span>/100</span></strong><p>Your score on this sentence</p>{result.tone !== null && <p>Tones: {result.tone}/100</p>}</div>
          <p className={styles.quote}>“{feedback.quote}”</p>
          {weak.length > 0 && <div className={styles.focus}><strong>A place to focus</strong><p>Give {weak.map((item) => `${item.hanzi}${item.pinyin ? ` (${item.pinyin})` : ""}`).join(" and ")} another listen. These received lower scores in this recording.</p></div>}
          <div className={styles.help}><h3>How the Academy can help</h3><p>{result.tone !== null && result.tone < 70 ? "Give your tones a little extra attention with listen-and-repeat practice, then practise the same patterns in connected speech. " : ""}{feedback.help}</p></div>
          <p className={styles.note}>A quick snapshot of one sentence, not a full assessment of your Mandarin.</p>
          <Link className={styles.primary} href="/onboarding/journey">Build my journey</Link>
          <button className={styles.secondary} type="button" onClick={() => { setError(""); setPhase("test"); }}><RotateCcw size={16} aria-hidden /> Try the sentence again</button>
        </> : <>
          <p className={styles.description}>Listen first, then say this short sentence at a comfortable pace.</p>
          <div className={styles.sentence}><p lang="zh-CN">{PREVIEW_SENTENCE}</p><p lang="zh-Latn-pinyin">{PREVIEW_PINYIN}</p><p>{PREVIEW_MEANING}</p><button type="button" onClick={hear} disabled={phase !== "test"} className={styles.listen}><Volume2 size={18} aria-hidden /> Listen to the sentence</button></div>
          <p className={styles.note}>When you record, your audio is sent to SpeechSuper for pronunciation scoring. It is not saved to your LingoIsland profile. No signup form needed.</p>
          <div role="status" aria-live="polite" className={styles.status}>{phase === "starting" ? "Allow microphone access when your browser asks." : phase === "recording" ? `Recording ${seconds}/8 seconds. Say the sentence, then tap Stop.` : phase === "checking" ? "Listening closely. Checking your pronunciation…" : "You have up to 8 seconds. Ready when you are."}</div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button type="button" className={styles.primary} disabled={phase === "starting" || phase === "checking"} onClick={phase === "recording" ? stop : () => void record()}>{phase === "recording" ? <><Square size={17} aria-hidden /> Stop and check</> : <><Mic size={18} aria-hidden />{phase === "checking" ? "Checking your recording…" : phase === "starting" ? "Starting microphone…" : "Record my sentence"}</>}</button>
          <Link href="/onboarding/journey" className={styles.secondary}>Build my journey without recording</Link>
        </>}
      </div>
    </dialog>
  );
}
