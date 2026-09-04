"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Mode = "word" | "sentence";
type Result = Record<string, unknown>;
type PhonemeScore = {
  role: "initial" | "final" | "other";
  phone: string;
  pronunciation: number | null;
};
type CharacterScore = {
  hanzi: string;
  pinyin: string | null;
  targetTone: number | null;
  score: number | null;
  phonemes: PhonemeScore[];
};

const STATUS_STYLES = {
  strong: "border-teal-300 bg-teal-50",
  close: "border-orange-300 bg-orange-50",
  unavailable: "border-gray-200 bg-gray-50",
};

const FEEDBACK = {
  strong: [
    "正确！(Correct!) 🎉 Those tones landed beautifully.",
    "好极了！(Amazing!) 华华 heard a really clear match there. 🦫",
    "太棒了！(Great!) Your tone shapes sound very steady.",
  ],
  close: [
    "很接近！(So close!) Try letting the tone move a little more clearly.",
    "不错！(Nice work!) One tiny tone adjustment and you’ll have it. 🦫",
    "继续！(Keep going!) The sound is there — give the tone a little more space.",
  ],
  rough: [
    "没关系！(No worries!) Let’s try that one again, nice and slowly. 🦫",
    "再来一次！(One more try!) Focus on the tone shape, not perfection.",
    "慢慢来！(Take it easy!) Every recording is useful practice. 🎉",
  ],
};

function asNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function speechResult(value: Result | null) {
  const nested = value?.result;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
}

function toneNumber(value: unknown) {
  const match = typeof value === "string" ? value.match(/tone([1-4])/i) : null;
  return match ? Number(match[1]) : null;
}

function extractPhonemes(word: Record<string, unknown>): PhonemeScore[] {
  const phonemes = word.phonemes;
  if (!Array.isArray(phonemes)) return [];
  return phonemes.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const phoneme = item as Record<string, unknown>;
    const category = asNumber(phoneme.category);
    const role = category === 0 ? "initial" : category === 1 ? "final" : "other";
    const phone = typeof phoneme.phone === "string" ? phoneme.phone : "";
    if (!phone) return [];
    return [{ role, phone, pronunciation: asNumber(phoneme.pronunciation) } as PhonemeScore];
  });
}

function extractCharacters(value: Result | null): CharacterScore[] {
  const words = speechResult(value)?.words;
  if (!Array.isArray(words)) return [];
  return words.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const word = item as Record<string, unknown>;
    const hanzi = typeof word.word === "string" ? word.word : "";
    const scores = word.scores as Record<string, unknown> | undefined;
    if (!hanzi) return [];
    return [{
      hanzi,
      pinyin: typeof word.symbolpinyin === "string" ? word.symbolpinyin : typeof word.pinyin === "string" ? word.pinyin : null,
      targetTone: toneNumber(word.tone),
      score: asNumber(scores?.tone ?? scores?.overall ?? scores?.pronunciation),
      phonemes: extractPhonemes(word),
    }];
  });
}

function pcmToWav(chunks: Float32Array[], sourceRate: number): Blob {
  const targetRate = 16_000;
  const inputLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  if (inputLength === 0) throw new Error("No microphone audio was captured.");
  const input = new Float32Array(inputLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    input.set(chunk, offset);
    offset += chunk.length;
  });
  let peak = 0;
  let squaredSum = 0;
  for (let index = 0; index < input.length; index += 1) {
    const sample = input[index];
    peak = Math.max(peak, Math.abs(sample));
    squaredSum += sample * sample;
  }
  const rms = Math.sqrt(squaredSum / inputLength);
  if (rms < 0.001) {
    throw new Error("The microphone signal was silent. Check the selected input device and try again.");
  }
  // SpeechSuper rejects quiet but otherwise valid WAV files. Normalize the
  // captured PCM before encoding while preserving headroom to prevent clipping.
  const gain = 0.85 / peak;
  const outputLength = Math.ceil((inputLength * targetRate) / sourceRate);
  const pcm = new Int16Array(outputLength);
  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = Math.min(Math.floor((index * sourceRate) / targetRate), inputLength - 1);
    const sample = Math.max(-1, Math.min(1, (input[sourceIndex] ?? 0) * gain));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const wav = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(wav);
    const write = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + pcm.byteLength, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, pcm.byteLength, true);
    new Int16Array(wav, 44).set(pcm);
  return new Blob([wav], { type: "audio/wav" });
}

function toneGlyph(tone: number | null) {
  return tone === 1 ? "→" : tone === 2 ? "↗" : tone === 3 ? "∨" : tone === 4 ? "↘" : "—";
}

function statusForScore(score: number | null) {
  return score === null
    ? STATUS_STYLES.unavailable
    : score >= 80
      ? STATUS_STYLES.strong
      : STATUS_STYLES.close;
}

export default function ToneTestClient() {
  const [mode, setMode] = useState<Mode>("word");
  const [referenceText, setReferenceText] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const source = useRef<MediaStreamAudioSourceNode | null>(null);
  const processor = useRef<ScriptProcessorNode | null>(null);
  const pcmChunks = useRef<Float32Array[]>([]);
  const maxSeconds = mode === "word" ? 20 : 90;
  const overallScore = useMemo(
    () => asNumber(speechResult(result)?.overall),
    [result],
  );
  const characters = useMemo(() => extractCharacters(result), [result]);

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= maxSeconds) stopRecording();
  }, [maxSeconds, recording, seconds]);

  useEffect(() => () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    void audioContext.current?.close();
  }, []);

  const startRecording = async () => {
    setError("");
    setResult(null);
    setAudio(null);
    setSeconds(0);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          noiseSuppression: true,
          echoCancellation: false,
        },
      });
      stream.current = mediaStream;
      const context = new AudioContext();
      const mediaSource = context.createMediaStreamSource(mediaStream);
      const scriptProcessor = context.createScriptProcessor(4096, 1, 1);
      pcmChunks.current = [];
      scriptProcessor.onaudioprocess = (event) => {
        pcmChunks.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      mediaSource.connect(scriptProcessor);
      scriptProcessor.connect(context.destination);
      audioContext.current = context;
      source.current = mediaSource;
      processor.current = scriptProcessor;
      await context.resume();
      setRecording(true);
    } catch (cause) {
      console.error("Unable to start recording:", cause);
      setError("Microphone access is needed to record a pronunciation sample.");
    }
  };

  const stopRecording = () => {
    const context = audioContext.current;
    const mediaStream = stream.current;
    processor.current?.disconnect();
    source.current?.disconnect();
    processor.current = null;
    source.current = null;
    if (context) {
      try {
        setAudio(pcmToWav(pcmChunks.current, context.sampleRate));
      } catch (cause) {
        console.error("Unable to prepare WAV recording:", cause);
        setError(cause instanceof Error ? cause.message : "Unable to prepare the recording.");
      }
      void context.close();
    }
    audioContext.current = null;
    mediaStream?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setRecording(false);
  };

  const submit = async () => {
    if (!audio || !referenceText.trim()) {
      setError("Enter reference Hanzi and record a sample first.");
      return;
    }
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("referenceText", referenceText.trim());
      form.append("mode", mode);
      form.append("audio", audio, "recording.wav");
      const response = await fetch("/api/admin/speechsuper-eval", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as Result | null;
      if (!response.ok) {
        if (data?.raw && typeof data.raw === "object") {
          setResult(data.raw as Result);
          setShowRaw(true);
        }
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to score recording.");
      }
      if (!data) throw new Error("The scoring service returned an empty response.");
      setResult(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to score recording.");
    } finally {
      setSubmitting(false);
    }
  };

  const band = overallScore === null ? null : overallScore >= 80 ? "strong" : overallScore >= 60 ? "close" : "rough";
  const feedback = band && result
    ? FEEDBACK[band][JSON.stringify(result).length % FEEDBACK[band].length]
    : null;
  const metrics = speechResult(result);

  return (
    <main
      className="min-h-screen px-4 py-8 sm:px-6 sm:py-12"
      style={{
        background:
          "radial-gradient(100% 55% at 50% -10%, #ffffff 0%, #EAF6FB 52%, #D6EEF8 100%)",
      }}
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 sm:mb-10">
          <p className="mb-3 inline-flex rounded-full border border-[#2176AE]/15 bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#2176AE] shadow-sm">
            LingoIsland Lab · Internal tools
          </p>
          <h1 className="lingo-display text-3xl text-[var(--lingo-navy)] sm:text-[40px]">
            Tone & pronunciation test
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--lingo-text-muted)] sm:text-base">
            Practice Mandarin pronunciation with LingoIsland.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--lingo-text-muted)]">
            Write a word or sentence in Chinese characters, then record and submit.
            You&apos;ll see overall pronunciation, tone, fluency, and per-character scores after
            LingoIsland finishes analyzing your audio.
          </p>
        </header>

      <div className="mb-6 inline-flex rounded-2xl border border-[var(--lingo-accent-border)] bg-white/70 p-1.5 shadow-sm">
        {(["word", "sentence"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={recording}
            onClick={() => { setMode(option); setAudio(null); setResult(null); }}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              mode === option
                ? "bg-[var(--lingo-navy)] text-white shadow-sm"
                : "text-[var(--lingo-text-muted)] hover:bg-white hover:text-[var(--lingo-navy)]"
            }`}
          >
            {option === "word" ? "Word" : "Sentence"}
          </button>
        ))}
      </div>

      <section
        className="rounded-[28px] border bg-white p-5 sm:p-7"
        style={{ borderColor: "var(--lingo-accent-border)", boxShadow: "var(--lingo-shadow-card)" }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lingo-accent-tint)] text-sm font-bold text-[var(--lingo-blue)]">
            1
          </span>
          <div>
            <p className="text-sm font-bold text-[var(--lingo-navy)]">Set your reference</p>
            <p className="text-xs text-[var(--lingo-text-muted)]">Use Simplified or Traditional Hanzi.</p>
          </div>
        </div>
        <label htmlFor="reference-text" className="mb-2 block text-sm font-semibold text-[var(--lingo-text)]">
          {mode === "word" ? "Reference Hanzi" : "Reference sentence (Hanzi)"}
        </label>
        <input
          id="reference-text"
          value={referenceText}
          onChange={(event) => setReferenceText(event.target.value)}
          disabled={recording || submitting}
          placeholder={mode === "word" ? "例如：你好" : "例如：今天天气很好。"}
          className="w-full rounded-2xl border border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)] px-4 py-3 text-lg text-[var(--lingo-navy)] placeholder:text-[var(--lingo-text-muted)] focus:border-[var(--lingo-blue)] focus:outline-none disabled:bg-gray-50"
        />
        <div className="mt-7 border-t border-[var(--lingo-accent-border)] pt-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lingo-accent-tint)] text-sm font-bold text-[var(--lingo-blue)]">
              2
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--lingo-navy)]">Record your voice</p>
              <p className="text-xs text-[var(--lingo-text-muted)]">
                Speak clearly at a normal volume, then stop when you&apos;re done. You can re-record
                before sending. Up to {maxSeconds} seconds.
              </p>
            </div>
          </div>
        <div className="flex flex-wrap items-center gap-3">
          {recording ? (
            <button type="button" onClick={stopRecording} className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700">
              Stop recording
            </button>
          ) : (
            <button type="button" onClick={startRecording} disabled={submitting} className="rounded-2xl bg-[var(--lingo-navy)] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60">
              {audio ? "Record again" : "Start recording"}
            </button>
          )}
          {recording && <span className="flex items-center gap-2 text-sm font-semibold text-red-700"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />Recording {seconds}s / {maxSeconds}s</span>}
          {!recording && audio && <span className="text-sm font-medium text-[var(--lingo-text-muted)]">Recording ready ({seconds}s).</span>}
        </div>
        {audio && !recording && (
          <div className="mt-5">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: "var(--lingo-accent-gradient)" }}
            >
              {submitting ? "Scoring…" : "Submit for scoring"}
            </button>
            <p className="mt-2 text-xs text-[var(--lingo-text-muted)]">
              We&apos;ll send the WAV recording securely for scoring and show the detailed result here.
            </p>
          </div>
        )}
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </section>

      {result && (
        <section className="mt-6 rounded-[28px] border border-[var(--lingo-accent-border)] bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">LingoIsland feedback</p>
              <h2 className="lingo-display mt-1 text-2xl text-[var(--lingo-navy)]">Results</h2>
            </div>
            <span className={`rounded-full border px-3 py-1 text-sm font-bold ${statusForScore(overallScore)}`}>
              Overall: {overallScore === null ? "No score" : Math.round(overallScore)}
            </span>
          </div>
          {feedback && <p className="mt-4 rounded-2xl bg-[var(--lingo-sky-pale)] px-4 py-3 text-sm font-medium text-[var(--lingo-text)]">{feedback}</p>}
          {metrics && (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Pronunciation", metrics.pronunciation],
                ["Tone", metrics.tone],
                ["Fluency", metrics.fluency],
                ["Rhythm", metrics.rhythm],
              ].map(([label, value]) => {
                const score = asNumber(value);
                return (
                  <div key={String(label)} className={`rounded-2xl border p-3 ${statusForScore(score)}`}>
                    <p className="text-xs font-semibold text-[var(--lingo-text-muted)]">{String(label)}</p>
                    <p className="lingo-display mt-1 text-xl text-[var(--lingo-navy)]">
                      {score === null ? "—" : Math.round(score)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          {characters.length ? (
            <div className="mt-5 space-y-2">
              {characters.map((character, index) => (
                <div key={`${character.hanzi}-${index}`} className={`rounded-2xl border p-4 ${statusForScore(character.score)}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="lingo-display text-2xl text-[var(--lingo-navy)]">{character.hanzi}</span>
                      {character.pinyin && <span className="text-sm text-[var(--lingo-text-muted)]">{character.pinyin}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[var(--lingo-text)]">target tone {toneGlyph(character.targetTone)} {character.targetTone ?? "—"}</span>
                      <span className="text-sm font-bold text-[var(--lingo-navy)]">tone {character.score === null ? "—" : Math.round(character.score)}</span>
                    </div>
                  </div>
                  {character.phonemes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {character.phonemes.map((phoneme, phonemeIndex) => (
                        <span
                          key={`${phoneme.role}-${phonemeIndex}`}
                          className={`rounded-xl border px-2 py-1 text-xs font-medium ${statusForScore(phoneme.pronunciation)}`}
                        >
                          {phoneme.role === "initial" ? "Initial" : phoneme.role === "final" ? "Final" : "Sound"} “{phoneme.phone}”: {phoneme.pronunciation === null ? "—" : Math.round(phoneme.pronunciation)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">No per-character tone data was detected. Inspect the raw response below.</p>}
          <button type="button" onClick={() => setShowRaw((value) => !value)} className="mt-5 text-sm font-bold text-[var(--lingo-blue)] hover:text-[var(--lingo-navy)]">
            {showRaw ? "Hide raw response" : "Show raw response"}
          </button>
          {showRaw && <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">{JSON.stringify(result, null, 2)}</pre>}
        </section>
      )}
      </div>
    </main>
  );
}
