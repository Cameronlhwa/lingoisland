export function say(text: string, onUnavailable?: () => void) {
  if (!("speechSynthesis" in window)) { onUnavailable?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.8;
  utterance.onerror = (event) => { if (event.error !== "interrupted" && event.error !== "canceled") onUnavailable?.(); };
  window.speechSynthesis.speak(utterance);
}
