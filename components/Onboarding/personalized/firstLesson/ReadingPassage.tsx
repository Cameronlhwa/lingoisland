"use client";
import { useState } from "react";
import type { LessonReading } from "@/lib/onboarding/personalized/firstLesson/curriculum";
import { CARD_BORDER, MUTED, NAVY, SKY_PALE, TextButton } from "../ui";
import { AudioButton } from "./LessonActivities";
export function ReadingPassage({ reading, compact = false, onUnavailable }: { reading: LessonReading; compact?: boolean; onUnavailable: () => void }) {
 const [expanded, setExpanded] = useState(!compact), [support, setSupport] = useState(false);
 return <section className="mb-5 min-w-0 rounded-2xl border p-4 sm:p-5" style={{ borderColor: CARD_BORDER, background: SKY_PALE, color: NAVY }} data-testid="lesson-reading">
  <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-bold">{reading.title}</h2>{compact && <TextButton onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>{expanded ? "Hide passage" : "Show passage"}</TextButton>}</div>
  {expanded && <><p lang="zh-CN" className="mt-4 whitespace-pre-line break-words text-lg leading-loose sm:text-xl" data-testid="reading-text">{reading.text}</p>
   <AudioButton text={reading.text} label="Listen to the passage" onUnavailable={onUnavailable}/>
   <TextButton className="mt-2" aria-expanded={support} onClick={() => setSupport(v => !v)}>{support ? "Hide reading help" : "Show pinyin and meaning"}</TextButton>
   {support && <div className="mt-3 space-y-3 text-sm leading-relaxed" style={{ color: MUTED }}><p>{reading.pinyin}</p><p>{reading.translation}</p></div>}
  </>}
 </section>;
}
