"use client";
import { useState, type DragEvent } from "react";
import { Check, Coffee, BriefcaseBusiness, Music2, Volume2, Undo2 } from "lucide-react";
import type { AuthoredLesson, BuildPrompt, LessonPhrase, MatchPair } from "@/lib/onboarding/personalized/firstLesson/types";
import { CARD_BORDER, GREEN, MUTED, NAVY, PrimaryButton, SKY_PALE, TextButton } from "../ui";

// A transparent canvas keeps native drag previews rounded, including in WebKit.
function startWordDrag(event: DragEvent<HTMLButtonElement>, id: string) {
  event.dataTransfer.setData("text/plain", id);
  event.dataTransfer.effectAllowed = "copy";
  const canvas = document.createElement("canvas");
  const scale = window.devicePixelRatio || 1;
  const width = 180, height = 88, radius = 20;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${width}px;height:${height}px;pointer-events:none;z-index:-1;`;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(scale, scale);
  context.beginPath();
  context.moveTo(radius, 1);
  context.arcTo(width - 1, 1, width - 1, height - 1, radius);
  context.arcTo(width - 1, height - 1, 1, height - 1, radius);
  context.arcTo(1, height - 1, 1, 1, radius);
  context.arcTo(1, 1, width - 1, 1, radius);
  context.closePath();
  context.fillStyle = "white";
  context.fill();
  context.strokeStyle = GREEN;
  context.lineWidth = 2;
  context.stroke();
  const lines = event.currentTarget.querySelectorAll("span");
  const fontFamily = getComputedStyle(event.currentTarget).fontFamily;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = NAVY;
  context.font = `700 23px ${fontFamily}`;
  context.fillText(lines[0]?.textContent ?? "", width / 2, 33, width - 24);
  context.fillStyle = MUTED;
  context.font = `14px ${fontFamily}`;
  context.fillText(lines[1]?.textContent ?? "", width / 2, 59, width - 24);
  document.body.appendChild(canvas);
  event.dataTransfer.setDragImage(canvas, width / 2, height / 2);
  // The browser captures the image after dragstart has finished.
  setTimeout(() => canvas.remove(), 0);
}

export function say(text: string, onUnavailable?: () => void) {
  if (!("speechSynthesis" in window)) { onUnavailable?.(); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 0.8;
  utterance.onerror = (event) => { if (event.error !== "interrupted" && event.error !== "canceled") onUnavailable?.(); };
  window.speechSynthesis.speak(utterance);
}
export function AudioButton({ text, label = "Hear it", onUnavailable }: { text: string; label?: string; onUnavailable?: () => void }) {
  return <button type="button" onClick={() => say(text, onUnavailable)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2" style={{ color: GREEN }} aria-label={`${label}: ${text}`}><Volume2 size={18} aria-hidden />{label}</button>;
}
export function RouteIcon({ route }: { route: AuthoredLesson["route"] }) {
  const Icon = route === "travel" ? Coffee : route === "work" ? BriefcaseBusiness : Music2;
  return <Icon size={28} aria-hidden />;
}
export function WordCard({ phrase, route, onUnavailable }: { phrase: LessonPhrase; route?: AuthoredLesson["route"]; onUnavailable?: () => void }) {
  return <div className="rounded-2xl border px-4 py-6 text-center" style={{ borderColor: CARD_BORDER, background: SKY_PALE }}>
    {route && <div className="mb-3 flex justify-center" style={{ color: GREEN }}><RouteIcon route={route} /></div>}
    <p className="text-[28px] font-bold leading-relaxed sm:text-[34px]" lang="zh-CN" style={{ color: NAVY }}>{phrase.hanzi}</p>
    <p className="mt-1 text-base" style={{ color: MUTED }}>{phrase.pinyin}</p>
    <p className="mb-2 mt-2 text-base" style={{ color: NAVY }}>{phrase.meaning}</p>
    <AudioButton text={phrase.hanzi} onUnavailable={onUnavailable} />
  </div>;
}
export function Feedback({ children, correct = false }: { children: React.ReactNode; correct?: boolean }) {
  return <div role="status" className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-relaxed ${correct ? "lesson-correct" : ""}`} style={{ borderColor: correct ? GREEN : CARD_BORDER, background: correct ? "#EFF7F2" : SKY_PALE, color: NAVY }}>{correct && <Check className="mr-2 inline" size={17} aria-hidden />}{children}</div>;
}
function Choice({ selected, children, onClick, testId, audioText, onUnavailable }: { selected: boolean; children: React.ReactNode; onClick: () => void; testId?: string; audioText?: string; onUnavailable?: () => void }) {
  return <div className="relative min-w-0 flex-1">
    <button type="button" data-testid={testId} aria-pressed={selected} onClick={onClick} className={`w-full rounded-2xl border-2 px-3 text-center focus-visible:outline focus-visible:outline-2 ${audioText ? "min-h-[108px] pb-4 pt-10" : "min-h-[74px] py-3"}`} style={{ borderColor: selected ? GREEN : CARD_BORDER, background: selected ? "#EFF7F2" : "white", color: NAVY }}>{children}</button>
    {audioText && <button type="button" aria-label={`Hear ${audioText}`} onClick={() => say(audioText, onUnavailable)} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2" style={{ color: GREEN }}><Volume2 size={18} aria-hidden /></button>}
  </div>;
}
export function MeaningQuiz({ pairs, targetIndex = 0, listening = false, silent = false, onMistake, onComplete, onUnavailable }: {
  pairs: MatchPair[]; targetIndex?: number; listening?: boolean; silent?: boolean; onMistake: (id: string) => void; onComplete: () => void; onUnavailable: () => void;
}) {
  const target = pairs[targetIndex] ?? pairs[0];
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "retry" | null>(null);
  const [showText, setShowText] = useState(!listening);
  const [heard, setHeard] = useState(false);
  return <div data-testid="lesson-quiz" data-target-id={target.id}>
    {listening && showText && <p className="mb-3 text-sm" style={{ color: MUTED }}>Read the expression below, then choose its English meaning.</p>}
    {listening ? <div className="rounded-2xl p-5 text-center" style={{ background: SKY_PALE }}><button type="button" onClick={() => { setHeard(true); say(target.hanzi, () => { setShowText(true); onUnavailable(); }); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 font-semibold" style={{ color: GREEN }}><Volume2 size={22} aria-hidden />Play word</button>{showText && <p className="mt-3 text-2xl font-bold" lang="zh-CN">{target.hanzi} <span className="text-sm font-normal">{target.pinyin}</span></p>}</div> : <p className="py-5 text-center text-2xl font-bold" style={{ color: NAVY }}>{silent ? target.hanzi : target.label}</p>}
    <div className={pairs.length > 2 ? "mt-5 grid grid-cols-2 gap-3" : "mt-5 flex gap-3"}>{[...pairs].reverse().map((p) => <Choice key={p.id} selected={selected === p.id} testId={`quiz-choice-${p.id}`} audioText={!listening && !silent ? p.hanzi : undefined} onUnavailable={onUnavailable} onClick={() => { if (result === "correct") return; setSelected(p.id); setResult(null); }}>
      <span className="block text-lg font-bold" lang={listening || silent ? "en" : "zh-CN"}>{listening || silent ? p.label : p.hanzi}</span>
      {!listening && !silent && <span className="mt-1 block text-sm" style={{ color: MUTED }}>{p.pinyin}</span>}
    </Choice>)}</div>
    {result === "correct" && <Feedback correct>{target.hanzi} means “{target.label}”.</Feedback>}
    {result === "retry" && <Feedback>That means “{pairs.find(p => p.id === selected)?.label}”. {target.hanzi} means “{target.label}”. Choose it and try again.</Feedback>}
    <PrimaryButton className="mt-6" data-testid="lesson-quiz-check" disabled={!selected || (listening && !heard && !showText)} onClick={() => { if (result === "correct") { onComplete(); return; } if (selected === target.id) { setResult("correct"); say(target.hanzi, onUnavailable); } else { setResult("retry"); onMistake(target.id); } }}>{result === "correct" ? "Continue" : "Check answer"}</PrimaryButton>
    {listening && !showText && <TextButton className="mt-2" onClick={() => setShowText(true)}>Can’t listen? Show the word</TextButton>}
  </div>;
}
export function MatchWords({ pairs, onComplete, onMistake, onUnavailable }: { pairs: MatchPair[]; onComplete: () => void; onMistake: (id: string) => void; onUnavailable: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const place = (id: string, wordId: string) => {
    if (matched.includes(id) || matched.includes(wordId)) return;
    const word = pairs.find(p => p.id === wordId); if (!word) return;
    if (id !== wordId) { onMistake(wordId); setMessage(`${word.hanzi} means “${word.label}”. Match those two.`); setSelected(null); return; }
    setMatched(previous => [...previous, id]); setSelected(null); setMessage(`Matched: ${word.hanzi} — ${word.label}.`); say(word.hanzi, onUnavailable);
  };
  const done = matched.length === pairs.length;
  return <div data-testid="lesson-match"><p className="text-sm leading-relaxed" style={{ color: MUTED }}>Drag words to their meanings, or tap a word and then its meaning.</p>
    <div className="mt-4 grid grid-cols-2 gap-4"><div className="flex flex-col gap-3">{pairs.map(p => <button key={p.id} type="button" draggable={!matched.includes(p.id)} disabled={matched.includes(p.id)} data-testid={`match-tile-${p.id}`} aria-pressed={selected === p.id} onDragStart={e => startWordDrag(e, p.id)} onClick={() => { setSelected(p.id); say(p.hanzi, onUnavailable); }} className="min-h-24 rounded-2xl border-2 px-2 py-3" style={{ borderColor: selected === p.id ? GREEN : CARD_BORDER, background: matched.includes(p.id) ? "#EFF7F2" : "white", color: NAVY }}><span className="block text-xl font-bold" lang="zh-CN">{p.hanzi}</span><span className="text-sm" style={{ color: MUTED }}>{p.pinyin}</span>{matched.includes(p.id) && <Check className="mx-auto mt-1" size={17} aria-label="Matched" />}</button>)}</div>
    <div className="flex flex-col gap-3">{[...pairs].reverse().map(p => <button key={p.id} type="button" data-testid={`match-slot-${p.id}`} disabled={matched.includes(p.id)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); place(p.id, e.dataTransfer.getData("text/plain")); }} onClick={() => selected && place(p.id, selected)} className="min-h-24 rounded-2xl border border-dashed px-2 text-sm font-semibold" style={{ borderColor: matched.includes(p.id) ? GREEN : CARD_BORDER, background: SKY_PALE, color: NAVY }}>{p.label}{matched.includes(p.id) && <Check className="mx-auto mt-2" size={17} aria-hidden />}</button>)}</div></div>
    {message && <Feedback correct={done}>{message}</Feedback>}
    <PrimaryButton className="mt-6" disabled={!done} data-testid="lesson-match-continue" onClick={onComplete}>Continue</PrimaryButton>
  </div>;
}
export function BuildSentence({ prompt, options, supported = false, onComplete, onMistake, onUnavailable }: { prompt: BuildPrompt; options?: MatchPair[]; supported?: boolean; onComplete: () => void; onMistake: (id: string) => void; onUnavailable: () => void }) {
  const [order, setOrder] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "retry" | null>(null);
  const [hint, setHint] = useState(false);
  const variable = prompt.chunks.find(c => c.id === prompt.slotId) ?? prompt.chunks[1] ?? prompt.chunks[0];
  const choices = supported && (prompt.options ?? options) ? [...(prompt.options ?? options)!].reverse().map(p => ({ id: p.id, label: p.hanzi, pinyin: p.pinyin, meaning: p.label })) : [...prompt.chunks.slice(1), prompt.chunks[0]];
  const add = (id: string) => { if (result === "correct") return; setResult(null); if (supported) setSelected(id); else setOrder(prev => prev.includes(id) ? prev : [...prev, id]); };
  const correct = supported ? selected === variable.id : order.length === prompt.order.length && order.every((id, i) => id === prompt.order[i]);
  return <div data-testid="lesson-build" data-correct-order={prompt.order.join(",")}>
    <div className="mb-5 rounded-2xl border px-5 py-4" style={{ background: "#EFF7F2", borderColor: "#C8DED4" }}>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>Say this in Mandarin</p>
      <p className="mt-2 text-2xl font-bold leading-snug sm:text-3xl" style={{ color: NAVY }}>{prompt.result.meaning}</p>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>{supported ? "Choose the missing word or phrase to complete the sentence below." : "Tap the words or phrases below in order to build this sentence."}</p>
    </div>
    <div className="mt-4 flex min-h-24 flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed p-4" style={{ background: SKY_PALE, borderColor: CARD_BORDER }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(e.dataTransfer.getData("text/plain")); }} aria-label="Sentence area" data-testid="lesson-build-tray">
      {supported ? prompt.chunks.map(chunk => {
        const missing = chunk.id === variable.id;
        const chosen = missing ? choices.find(c => c.id === selected) : chunk;
        return <span key={chunk.id} className={`px-2 py-1 text-center ${missing ? "border-b-2 border-dashed" : ""}`}>
          <span className="block text-xl" lang="zh-CN">{chosen?.label ?? "…"}</span>
          <span className="mt-1 block min-h-5 text-sm" style={{color:MUTED}}>{chosen?.pinyin ?? ""}</span>
        </span>;
      }) : order.length ? order.map(id => {
        const chunk = prompt.chunks.find(c => c.id === id);
        return <button key={id} type="button" disabled={result === "correct"} onClick={() => { setOrder(prev => prev.filter(v => v !== id)); setResult(null); }} className="rounded-xl border bg-white px-3 py-2 text-center" style={{borderColor:CARD_BORDER}} aria-label={`Remove ${chunk?.label}`}>
          <span className="block text-xl" lang="zh-CN">{chunk?.label}</span>
          <span className="mt-1 block text-sm" style={{color:MUTED}}>{chunk?.pinyin}</span>
        </button>;
      }) : <span className="text-sm" style={{color:MUTED}}>Tap or drag the words or phrases here</span>}
    </div>
    <div className="mt-4 flex flex-wrap gap-3">{choices.filter(c => supported || !order.includes(c.id)).map(c => <button key={c.id} type="button" draggable={result !== "correct"} data-testid={`build-chunk-${c.id}`} aria-pressed={supported ? selected === c.id : undefined} onDragStart={e => startWordDrag(e, c.id)} onClick={() => add(c.id)} className="min-h-16 flex-1 rounded-2xl border-2 bg-white px-3 py-3" style={{ borderColor: selected === c.id ? GREEN : CARD_BORDER, color: NAVY }}><span className="block text-xl font-bold" lang="zh-CN">{c.label}</span><span className="mt-1 block text-sm" style={{ color: MUTED }}>{c.pinyin}</span>{hint && <span className="mt-1 block text-xs" style={{ color: MUTED }}>{c.meaning}</span>}</button>)}</div>
    {result === "retry" && <Feedback>Use this order: {prompt.chunks.map(c => c.label).join(" → ")}. Start with {prompt.chunks[0].label} (“{prompt.chunks[0].meaning}”), then add {variable.label} (“{variable.meaning}”){prompt.chunks[2] ? `, then ${prompt.chunks[2].label}` : ""}. Tap a chunk above to change it.</Feedback>}
    {result === "correct" && <Feedback correct><span className="block text-xl" lang="zh-CN">{prompt.result.hanzi}</span><span className="block">{prompt.result.pinyin}</span>{prompt.result.meaning}</Feedback>}
    <PrimaryButton className="mt-6" data-testid={result === "correct" ? "lesson-build-continue" : "lesson-build-check"} disabled={supported ? !selected : order.length === 0} onClick={() => { if (result === "correct") { onComplete(); return; } setResult(correct ? "correct" : "retry"); if (correct) say(prompt.result.hanzi, onUnavailable); else { setHint(true); onMistake(variable.id); } }}>{result === "correct" ? "Continue" : "Check sentence"}</PrimaryButton>
    {result !== "correct" && <div className="mt-2 flex justify-center gap-3"><TextButton onClick={() => setHint(!hint)}>{hint ? "Hide hint" : "Show a hint"}</TextButton>{order.length > 0 && <TextButton onClick={() => { setOrder(prev => prev.slice(0, -1)); setResult(null); }}><Undo2 size={15} aria-hidden /> Undo</TextButton>}</div>}
    {hint && result !== "correct" && <p className="mt-3 text-center text-sm" style={{ color: MUTED }} lang="zh-CN">{prompt.chunks.map(c => c.label).join(" + ")}</p>}
  </div>;
}

export function hasWordBreakdown(words: LessonPhrase[], sentence: LessonPhrase) {
  const normalize = (value: string) => value.replace(/[，。！？、,.!?\s]/g, "");
  return words.length > 1 || (words.length === 1 && normalize(words[0].hanzi) !== normalize(sentence.hanzi));
}
export function SentenceBreakdown({ words, sentence, onUnavailable }: { words: LessonPhrase[]; sentence: LessonPhrase; onUnavailable: () => void }) {
  const showBreakdown = hasWordBreakdown(words, sentence);
  return <>
        {showBreakdown && <div className="rounded-2xl border px-3 py-5" style={{ borderColor: CARD_BORDER, background: SKY_PALE }}>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-5" aria-label="Sentence word by word">
            {words.map((part, index) => <div key={`${part.id}-${index}`} className="relative min-w-[72px] max-w-[140px] flex-1 pt-9 text-center">
              <button type="button" aria-label={`Hear ${part.hanzi}`} onClick={() => say(part.hanzi, onUnavailable)} className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2" style={{ color: GREEN }}><Volume2 size={17} aria-hidden /></button>
              <p className="text-2xl font-bold" lang="zh-CN">{part.hanzi}</p>
              <p className="mt-1 text-xs" style={{ color: MUTED }}>{part.pinyin}</p>
              <p className="mt-2 text-sm leading-snug" style={{ color: NAVY }}>{part.meaning}</p>
            </div>)}
          </div>
        </div>}
        <div className={`relative rounded-2xl border px-4 pb-5 pt-12 text-center ${showBreakdown ? "mt-5" : ""}`} style={{ borderColor: CARD_BORDER }}>
          <button type="button" aria-label={showBreakdown ? "Hear the full sentence" : "Hear the phrase"} onClick={() => say(sentence.hanzi, onUnavailable)} className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2" style={{ color: GREEN }}><Volume2 size={19} aria-hidden /></button>
          <p className="text-2xl font-bold leading-relaxed" lang="zh-CN">{sentence.hanzi}</p>
          <p className="mt-2 text-sm" style={{ color: MUTED }}>{sentence.pinyin}</p>
          <p className="mt-3 text-base">{sentence.meaning}</p>
        </div>
  </>;
}
