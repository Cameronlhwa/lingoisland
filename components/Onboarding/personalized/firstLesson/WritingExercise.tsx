"use client";
import { pinyin } from "pinyin-pro";
import { ConversationPrompt } from "./ConversationPrompt";
import { useState } from "react";
import type { WritingPractice } from "@/lib/onboarding/personalized/firstLesson/curriculum";
import { reviewWriting, type WritingFeedback } from "@/lib/onboarding/personalized/firstLesson/writing";
import { CARD_BORDER, GREEN, MUTED, PrimaryButton, SecondaryButton, SKY_PALE } from "../ui";
import { Feedback, WordCard } from "./LessonActivities";
export function WritingExercise({ practice, value, onChange, onComplete, onMistake, onUnavailable }: { practice: WritingPractice; value: string; onChange: (text: string) => void; onComplete: () => void; onMistake: (id: string) => void; onUnavailable: () => void }) {
 const [result, setResult] = useState<WritingFeedback | null>(null), [reviewed, setReviewed] = useState(false);
 return <div data-testid="writing-exercise">
  <ConversationPrompt prompt={practice.prompt} writing onUnavailable={onUnavailable}/>
  <label htmlFor="lesson-written-answer" className="mb-2 block text-sm font-semibold">Your answer</label>
  <p id="writing-hint" className="mb-3 text-sm leading-relaxed" style={{ color: MUTED }}>{practice.hint}</p>
  {practice.required.length > 0 && <div className="mb-3 flex flex-wrap gap-2" aria-label="Required pieces">{practice.required.map(word => <span key={word} lang="zh-CN" className="rounded-full px-3 py-1 text-sm font-semibold" style={{ background: SKY_PALE, color: GREEN }}><span className="block">{word}</span><span className="block text-xs font-normal" style={{ color: MUTED }}>{pinyin(word)}</span></span>)}</div>}
  <textarea id="lesson-written-answer" data-testid="writing-answer" lang="zh-CN" value={value} maxLength={600} rows={practice.minSentences ? 5 : 3} aria-describedby="writing-hint" className="w-full resize-y rounded-2xl border-2 bg-white p-4 text-lg leading-relaxed outline-offset-2" style={{ borderColor: CARD_BORDER, outlineColor: GREEN }} onChange={e => { onChange(e.target.value); setResult(null); setReviewed(false); }} placeholder="在这里写中文…" />
  <p className="mt-1 text-right text-xs" style={{ color: MUTED }}>{value.length} / 600</p>
  {result?.status === "retry" && <Feedback>{result.feedback}</Feedback>}
  {result?.status === "correct" && <Feedback correct>{result.feedback}</Feedback>}
  {result?.status === "review" && <div data-testid="writing-self-review" className="mt-4 rounded-2xl border p-4" style={{ borderColor: CARD_BORDER }}>
   <p role="status" className="text-sm leading-relaxed">{result.feedback}</p>
   <p className="mb-2 mt-4 text-sm font-bold">One possible answer</p><WordCard phrase={practice.sample} onUnavailable={onUnavailable}/>
   <p className="mt-4 text-sm font-semibold">Check your answer:</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed"><li>Does it answer the question?</li><li>Does each expression connect the ideas in the right order?</li><li>For an opinion, is your reason clear?</li></ul>
   <p className="mt-3 text-xs leading-relaxed" style={{ color: MUTED }}>This is a guided self-review. Your original wording hasn’t been automatically graded.</p>
   <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold"><input type="checkbox" data-testid="writing-reviewed" checked={reviewed} onChange={e => setReviewed(e.target.checked)} className="h-5 w-5" style={{ accentColor: GREEN }}/>I’ve checked my meaning and word order.</label>
   <SecondaryButton className="mt-2" onClick={() => { setResult(null); setReviewed(false); document.getElementById("lesson-written-answer")?.focus(); }}>Revise my answer</SecondaryButton>
  </div>}
  <PrimaryButton className="mt-5" data-testid="writing-check" disabled={!value.trim() || (result?.status === "review" && !reviewed)} onClick={() => {
   if (result?.status === "correct" || result?.status === "review" && reviewed) { onComplete(); return; }
   const feedback = reviewWriting(practice, value); setResult(feedback); if (feedback.status === "retry") onMistake("writing");
  }}>{result?.status === "correct" || result?.status === "review" ? "Continue" : "Review my answer"}</PrimaryButton>
 </div>;
}
