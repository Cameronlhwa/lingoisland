/** Only the live recording response opts in; restored attempts never celebrate. */
export type CelebrationResult = { attemptId: string; overallScore: number | null; newlyScored?: boolean };

export const CELEBRATION_THRESHOLD = 90;
export const CELEBRATION_DURATION_MS = 1600;
export const CELEBRATION_SOUND_URL = "/audio/pronunciation-fairy-dust.mp3";
const SOUND_PREFERENCE_KEY = "lingo-celebration-sound";
const celebratedAttempts = new Set<string>();

/** Freshness is intentionally omitted from JSON/checkpoint persistence. */
export function markFreshScore<T extends { attemptId: string; overallScore: number | null }>(result: T): T & { newlyScored: true } {
  return Object.defineProperty({ ...result }, "newlyScored", { value: true, enumerable: false }) as T & { newlyScored: true };
}

export function isCelebrationEligible(result: CelebrationResult): boolean {
  return result.newlyScored === true && typeof result.attemptId === "string" && result.attemptId.length > 0
    && typeof result.overallScore === "number" && Number.isFinite(result.overallScore)
    && result.overallScore >= CELEBRATION_THRESHOLD && result.overallScore <= 100;
}

export function claimCelebration(result: CelebrationResult): boolean {
  if (!isCelebrationEligible(result) || celebratedAttempts.has(result.attemptId)) return false;
  celebratedAttempts.add(result.attemptId);
  return true;
}

export function celebrationSoundEnabled(): boolean {
  try { return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "off"; }
  catch { return true; }
}

export function setCelebrationSoundEnabled(enabled: boolean): void {
  try { window.localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? "on" : "off"); } catch { /* Storage is optional. */ }
  if (!enabled) stopCelebrationSound();
}

let audioContext: AudioContext | null = null;
let bufferPromise: Promise<AudioBuffer | null> | null = null;
let source: AudioBufferSourceNode | null = null;
let playbackVersion = 0;

/** Called on the record tap, so browsers can unlock audio during a user gesture. */
export function prepareCelebrationSound(): void {
  if (typeof window === "undefined" || !celebrationSoundEnabled()) return;
  try {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContextClass();
      bufferPromise = null;
    }
    const context = audioContext;
    if (context.state === "suspended") void context.resume().catch(() => {});
    if (!bufferPromise) {
      bufferPromise = fetch(CELEBRATION_SOUND_URL)
        .then(response => { if (!response.ok) throw new Error("Sound unavailable"); return response.arrayBuffer(); })
        .then(bytes => context.decodeAudioData(bytes))
        .catch(() => { bufferPromise = null; return null; });
    }
  } catch { /* Celebration audio must never interrupt recording or scoring. */ }
}

export function stopCelebrationSound(): void {
  playbackVersion += 1;
  if (source) { try { source.stop(); } catch { /* Already finished. */ } }
  source = null;
}

export async function playCelebrationSound(): Promise<void> {
  stopCelebrationSound();
  if (!celebrationSoundEnabled()) return;
  const version = playbackVersion;
  prepareCelebrationSound();
  const context = audioContext;
  const pendingBuffer = bufferPromise;
  if (!context || !pendingBuffer) return;
  try {
    const buffer = await pendingBuffer;
    if (!buffer || version !== playbackVersion || !celebrationSoundEnabled() || document.hidden) return;
    if (context.state !== "running") return; // Never defer a sound until a later click.
    const nextSource = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = 0.4;
    nextSource.buffer = buffer;
    nextSource.connect(gain);
    gain.connect(context.destination);
    source = nextSource;
    nextSource.onended = () => { nextSource.disconnect(); gain.disconnect(); if (source === nextSource) source = null; };
    nextSource.start();
  } catch { /* Unsupported/blocked audio leaves the visual celebration working. */ }
}
