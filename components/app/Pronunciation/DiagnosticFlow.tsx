"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Mic, Square } from "lucide-react";
import {
  abortPcmRecording,
  startPcmRecording,
  stopPcmRecording,
  type PcmRecorderHandle,
} from "@/lib/audio/recordPcm";
import AppPageLoading from "@/components/app/AppPageLoading";

type PassLabel = "day1" | "remeasure";

type DiagnosticItem = {
  index: number;
  hanzi: string;
  pinyin: string;
  english: string;
  tags: string[];
  recorded: boolean;
};

type WorthTag = { tag: string; label: string; score: number };

const MAX_RETRIES = 2;

export default function DiagnosticFlow({
  passLabel,
  onFinished,
}: {
  passLabel: PassLabel;
  onFinished: (result: {
    overallScore: number | null;
    worthWorkingOn: WorthTag[];
  }) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "record" | "processing">("intro");
  const [items, setItems] = useState<DiagnosticItem[]>([]);
  const [itemIndex, setItemIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [retries, setRetries] = useState(0);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const recorder = useRef<PcmRecorderHandle | null>(null);
  const recordedCount = useRef(0);
  const requestIds = useRef(new WeakMap<Blob, string>());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pronunciation/diagnostic/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passLabel }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setError(typeof data?.error === "string" ? data.error : "Couldn't start the check.");
      setLoading(false);
      return;
    }
    setItems(data.items ?? []);
    setItemIndex(data.nextIndex ?? 0);
    recordedCount.current = data.recordedCount ?? 0;
    if (data.completed) {
      setPhase("processing");
      await complete();
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (recordedCount.current > 0 && phase === "record") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase]);

  const complete = async () => {
    setPhase("processing");
    const res = await fetch("/api/pronunciation/diagnostic/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passLabel }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setError(typeof data?.error === "string" ? data.error : "Couldn't finish the check.");
      setPhase("record");
      return;
    }
    onFinished({
      overallScore: data.overallScore ?? null,
      worthWorkingOn: data.worthWorkingOn ?? [],
    });
  };

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicDenied(false);
      setPhase("record");
    } catch {
      setMicDenied(true);
    }
  };

  const submitBlob = async (blob: Blob) => {
    setScoring(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("passLabel", passLabel);
      const requestId = requestIds.current.get(blob) ?? crypto.randomUUID();
      requestIds.current.set(blob, requestId);
      form.append("clientRequestId", requestId);
      form.append("audio", blob, "recording.wav");
      const res = await fetch(`/api/pronunciation/diagnostic/${itemIndex}/score`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        if (data?.code === "silent" || res.status === 422) {
          if (retries + 1 >= MAX_RETRIES) {
            await skipItem();
            return;
          }
          setRetries((r) => r + 1);
          setError("Didn't catch that — try again.");
          return;
        }
        throw new Error(typeof data?.error === "string" ? data.error : "Couldn't score that recording.");
      }
      recordedCount.current += 1;
      setRetries(0);
      await advance();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't score that recording.");
    } finally {
      setScoring(false);
    }
  };

  const skipItem = async () => {
    await fetch(`/api/pronunciation/diagnostic/${itemIndex}/score`, {
      method: "POST",
      body: (() => {
        const form = new FormData();
        form.append("passLabel", passLabel);
        form.append("skip", "true");
        return form;
      })(),
    }).catch(() => {});
    recordedCount.current += 1;
    setRetries(0);
    await advance();
  };

  const advance = async () => {
    if (itemIndex + 1 >= items.length) {
      await complete();
      return;
    }
    setItemIndex((i) => i + 1);
    setError(null);
  };

  const startRecording = async () => {
    setSeconds(0);
    try {
      recorder.current = await startPcmRecording();
      setRecording(true);
      setMicDenied(false);
    } catch {
      setMicDenied(true);
    }
  };

  const stopRecording = async () => {
    if (!recorder.current) return;
    setRecording(false);
    try {
      const blob = stopPcmRecording(recorder.current);
      recorder.current = null;
      await submitBlob(blob);
    } catch (cause) {
      recorder.current = null;
      setError(cause instanceof Error ? cause.message : "Couldn't capture audio.");
    }
  };

  const current = items[itemIndex];

  if (loading) {
    return <AppPageLoading />;
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-xl flex-col items-center justify-center px-4 py-10 text-center md:min-h-screen">
        <div className="relative mb-6 h-48 w-full max-w-sm overflow-hidden rounded-3xl">
          <Image
            src={
              passLabel === "remeasure"
                ? "/pronunciation/milestone-pronunciation.png"
                : "/pronunciation/hero-pronunciation-island.png"
            }
            alt=""
            fill
            className="object-cover"
            priority
          />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--lingo-blue)">
          {passLabel === "remeasure" ? "Progress check" : "Pronunciation check"}
        </p>
        <h1 className="lingo-display mt-2 text-3xl font-bold text-(--lingo-navy)">
          {passLabel === "remeasure" ? "Let's see how you've improved" : "Let's hear how you sound"}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-(--lingo-text-muted)">
          {passLabel === "remeasure"
            ? "You'll read a few sentences similar to your first check. No hints — just speak naturally."
            : "Read a few sentences out loud. We'll use them to figure out which sounds to focus on. About 2 minutes."}
        </p>
        {micDenied && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
            We need microphone access. In Chrome: click the lock icon in the address bar → Site settings → Microphone → Allow.
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={() => void requestMic()}
          className="mt-8 w-full max-w-sm rounded-2xl px-4 py-3.5 text-sm font-bold text-white"
          style={{ background: "var(--lingo-accent-gradient)" }}
        >
          {passLabel === "remeasure" ? "Start progress check →" : "Start assessment →"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/app/pronunciation")}
          className="mt-3 text-sm font-semibold text-(--lingo-text-muted)"
        >
          Back
        </button>
      </div>
    );
  }

  if (phase === "processing") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="relative mb-4 h-32 w-32 overflow-hidden rounded-3xl">
          <Image src="/pronunciation/huahua-listening.png" alt="" fill className="object-cover" />
        </div>
        <p className="text-sm font-semibold text-(--lingo-navy)">Putting together your pronunciation profile…</p>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-(--lingo-text-muted)">
        Nothing left to record.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:px-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-(--lingo-text-muted)">
          {passLabel === "remeasure" ? "Progress check" : "Pronunciation check"} · {itemIndex + 1} of {items.length}
        </p>
        <button
          type="button"
          onClick={() => {
            if (recordedCount.current > 0 && !leaveArmed) {
              setLeaveArmed(true);
              return;
            }
            router.push("/app/pronunciation");
          }}
          className="text-xs font-bold text-(--lingo-text-muted)"
        >
          {leaveArmed ? "Leave anyway" : "Exit"}
        </button>
      </div>
      {leaveArmed && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          You&apos;ll lose this attempt progress on this device view — your recorded sentences are saved and you can resume later.
        </p>
      )}
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-(--lingo-sky-pale)">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.round(((itemIndex + 0.2) / items.length) * 100)}%`,
            background: "var(--lingo-accent-gradient)",
          }}
        />
      </div>

      <div
        className="rounded-[32px] border bg-white p-6 sm:p-9"
        style={{ borderColor: "var(--lingo-accent-border)", boxShadow: "var(--lingo-shadow-card)" }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-(--lingo-blue)">
          Read this sentence out loud
        </p>
        <p className="lingo-display mt-5 text-center text-3xl font-bold leading-snug text-(--lingo-navy) sm:text-4xl">
          {current.hanzi}
        </p>
        {!hidden && (
          <div className="mt-3 text-center">
            <p className="text-base text-(--lingo-text-muted)">{current.pinyin}</p>
            <p className="mt-1 text-sm text-(--lingo-text-muted)">{current.english}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setHidden((h) => !h)}
          className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-bold text-(--lingo-text-muted)"
        >
          {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
          {hidden ? "Show help" : "Hide pinyin & translation"}
        </button>

        <div className="mt-8 flex flex-col items-center gap-3">
          {scoring ? (
            <>
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: "var(--lingo-accent-gradient)" }}
              >
                <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
              </div>
              <p className="text-sm text-(--lingo-text-muted)">Got it…</p>
            </>
          ) : recording ? (
            <>
              <button
                type="button"
                onClick={() => void stopRecording()}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white"
              >
                <Square size={26} fill="currentColor" />
              </button>
              <p className="text-sm font-semibold text-red-600">Listening… {seconds}s</p>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void startRecording()}
                className="flex h-20 w-20 items-center justify-center rounded-full text-white"
                style={{ background: "var(--lingo-accent-gradient)" }}
              >
                <Mic size={28} />
              </button>
              <p className="text-sm font-bold text-(--lingo-navy)">Tap to record</p>
            </>
          )}
        </div>

        {micDenied && (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Microphone blocked. Allow access in your browser, then try again.
          </p>
        )}
        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
