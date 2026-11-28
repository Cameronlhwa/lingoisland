// Keep the utterance alive while browsers deliver speech events asynchronously.
let currentUtterance: SpeechSynthesisUtterance | null = null;
let requestId = 0;
let cancelPending: (() => void) | undefined;

export function say(text: string, onUnavailable?: () => void) {
  const id = ++requestId;
  cancelPending?.();
  if (typeof window === "undefined" || !("speechSynthesis" in window)) { onUnavailable?.(); return; }
  const synth = window.speechSynthesis;
  synth.cancel();
  synth.resume();
  let finished = false;
  let started = false;
  let waiting: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (waiting) clearTimeout(waiting);
    if (watchdog) clearTimeout(watchdog);
    synth.removeEventListener("voiceschanged", voicesReady);
  };
  const fail = () => {
    if (finished || id !== requestId) return;
    finished = true; cleanup(); currentUtterance = null;
    synth.cancel();
    onUnavailable?.();
  };
  const speak = () => {
    if (started || finished || id !== requestId) return;
    started = true; cleanup();
    const voices = synth.getVoices();
    const voice = voices.find(v => /^(zh[-_]CN|cmn[-_]CN)$/i.test(v.lang))
      ?? voices.find(v => /^(zh|cmn)([-_]|$)/i.test(v.lang));
    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;
    utterance.lang = voice?.lang ?? "zh-CN";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.8;
    utterance.volume = 1;
    utterance.onstart = () => { if (watchdog) clearTimeout(watchdog); };
    utterance.onend = () => { if (id === requestId) { finished = true; cleanup(); currentUtterance = null; } };
    utterance.onerror = event => {
      if (event.error !== "interrupted" && event.error !== "canceled") fail();
    };
    watchdog = setTimeout(fail, 5000);
    try { synth.resume(); synth.speak(utterance); } catch { fail(); }
  };
  const voicesReady = () => { if (synth.getVoices().length) speak(); };
  cancelPending = () => { finished = true; cleanup(); currentUtterance = null; };
  if (synth.getVoices().length) speak();
  else {
    synth.addEventListener("voiceschanged", voicesReady);
    // Some browsers never emit voiceschanged; let their default Mandarin voice try.
    waiting = setTimeout(speak, 1200);
  }
}
