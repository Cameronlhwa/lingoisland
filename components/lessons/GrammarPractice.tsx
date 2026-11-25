"use client";
import { useState } from "react";
import type { Curriculum, CurriculumPractice } from "@/lib/lessons/curriculum";
import { grammarStepIndex, grammarSteps } from "@/lib/lessons/grammarSequence";
import { PrimaryButton, CARD_BORDER, GREEN, MUTED, SKY_PALE } from "@/components/Onboarding/personalized/ui";
import { BuildSentence, Feedback } from "@/components/Onboarding/personalized/firstLesson/LessonActivities";
import { ReadingPassage } from "@/components/Onboarding/personalized/firstLesson/ReadingPassage";
import { WritingExercise, type WritingContext } from "@/components/Onboarding/personalized/firstLesson/WritingExercise";
import { TeachingSlide } from "@/components/Onboarding/personalized/firstLesson/TeachingSlide";
import { ConversationPrompt } from "@/components/Onboarding/personalized/firstLesson/ConversationPrompt";

function Question({ practice, onComplete, onMistake, onUnavailable, onAnswer }: {
  practice: Extract<CurriculumPractice, { kind: "choice" }>;
  onAnswer?: (answer: string) => void;
  onUnavailable: () => void;
  onComplete: () => void;
  onMistake: (id: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<"correct" | "retry" | null>(null);
  return <div data-testid="grammar-choice">
    <ConversationPrompt prompt={practice.prompt} selected={practice.choices.find(choice => choice.id === selected)} onUnavailable={onUnavailable}/>
    <div className="grid gap-3 sm:grid-cols-2">{practice.choices.map(p => <button key={p.id} type="button"
      aria-pressed={selected === p.id} disabled={result === "correct"} data-testid={`grammar-option-${p.id}`}
      onClick={() => { setSelected(p.id); setResult(null); }}
      className="min-h-24 min-w-0 rounded-2xl border-2 p-4 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ borderColor: selected === p.id ? GREEN : CARD_BORDER, background: selected === p.id ? SKY_PALE : "white", outlineColor: GREEN }}>
      <span className="block break-words text-xl font-bold leading-relaxed sm:text-2xl" lang="zh-CN">{p.hanzi}</span>
      <span className="mt-2 block text-sm" style={{ color: MUTED }}>{p.pinyin}</span>
    </button>)}</div>
    {result && <Feedback correct={result === "correct"}>{result === "correct" ? practice.explanation : `Try again. ${practice.explanation}`}</Feedback>}
    <PrimaryButton mobileSticky className="mt-6" data-testid="grammar-check" disabled={!selected} onClick={() => {
      if (result === "correct") { onComplete(); return; }
      const correct = !practice.correct || selected === practice.correct;
      setResult(correct ? "correct" : "retry");
      if (correct && selected) onAnswer?.(selected);
      if (!correct) onMistake("grammar");
    }}>{result === "correct" ? "Continue" : "Check answer"}</PrimaryButton>
  </div>;
}

export function GrammarPractice({ curriculum, writingContext, onComplete, onMistake, onUnavailable, initialStepId, onProgress, responses = {}, onResponse, onEvidence }: {
  curriculum: Curriculum;
  onEvidence?: (stepId: string, answer: unknown) => void;
  writingContext:WritingContext;
  responses?: Record<string, string>;
  onResponse: (id: string, text: string) => void;
  initialStepId?: string;
  onProgress: (index: number, stepId: string) => void;
  onComplete: () => void;
  onMistake: (id: string) => void;
  onUnavailable: () => void;
}) {
  const steps = grammarSteps(curriculum);
  const index = grammarStepIndex(steps, initialStepId);
  const step = steps[index];
  const advance = () => index + 1 === steps.length ? onComplete() : onProgress(index + 1, steps[index + 1].id);
  return <div data-testid="grammar-practice" data-grammar-index={index} data-grammar-step={step.id} data-grammar-kind={step.kind} key={step.id}>
    <p className="mb-3 text-center text-xs font-semibold" style={{ color: MUTED }}>
      {step.kind === "teach" ? "Learn" : step.kind === "check" ? "Quick check" : "Practice"} · {index + 1} of {steps.length}
    </p>
    {step.kind !== "teach" && "reading" in step.practice && step.practice.reading && <ReadingPassage key={`${step.id}:reading`} reading={step.practice.reading} compact={step.practice.kind !== "reading"} onUnavailable={onUnavailable}/>}
    {step.kind === "teach" ? <>
      <TeachingSlide card={step.card} onUnavailable={onUnavailable}/>
      <PrimaryButton mobileSticky className="mt-5" data-testid="grammar-continue" onClick={advance}>Continue</PrimaryButton>
    </> : step.practice.kind === "reading" ? <PrimaryButton mobileSticky data-testid="reading-continue" onClick={advance}>Continue to the questions</PrimaryButton>
      : step.practice.kind === "writing" ? <WritingExercise key={step.id} practice={step.practice} context={writingContext} stepId={step.id} value={responses[step.id] ?? ""} onChange={text => onResponse(step.id,text)} onComplete={advance} onMistake={onMistake} onUnavailable={onUnavailable}/>
      : step.practice.kind === "build" ? <BuildSentence onAnswer={answer => onEvidence?.(step.id, answer)} key={step.id} prompt={step.practice.build} onComplete={advance} onMistake={onMistake} onUnavailable={onUnavailable}/>
      : <Question onAnswer={answer => onEvidence?.(step.id, answer)} key={step.id} practice={step.practice} onComplete={advance} onMistake={onMistake} onUnavailable={onUnavailable}/>}
  </div>;
}
