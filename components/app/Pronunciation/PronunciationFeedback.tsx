"use client";

import Image from "next/image";
import { Volume2 } from "lucide-react";
import {
  bandForScore,
  feedbackHeadline,
  pickEncouragement,
  toneGlyph,
  toneName,
  toneShapeTip,
} from "@/lib/pronunciation/encouragement";
import { primaryGuide } from "@/lib/pronunciation/soundGuides";
import type { ScoreResult } from "@/components/app/Pronunciation/RecordButton";
import SpeakerButton from "@/components/app/SpeakerButton";
import {
  pickIsolateFocus,
  type IsolateTarget,
} from "@/lib/pronunciation/isolateTarget";
import { scoreTierStyle } from "@/lib/pronunciation/weakSoundTypes";

export default function PronunciationFeedback({
  result,
  recordedAudioUrl,
  onRetry,
  onIsolateSyllable,
  onContinue,
  continueLabel,
  forcedSyllable,
  mode = "word",
}: {
  result: ScoreResult;
  recordedAudioUrl?: string | null;
  onRetry: () => void;
  onIsolateSyllable?: (syllable: IsolateTarget) => void;
  onContinue: () => void;
  continueLabel: string;
  forcedSyllable?: IsolateTarget | { hanzi: string; pinyin: string | null; targetTone: number | null } | null;
  mode?: "word" | "sentence" | "isolate";
}) {
  const band = bandForScore(result.overallScore);
  const encouragement = band ? pickEncouragement(band, result.attemptId.length) : null;
  const focus = pickIsolateFocus(result.characters, result.weakSyllables, forcedSyllable);
  const tip = focus ? toneShapeTip(focus.targetTone) : null;
  const guide = focus ? primaryGuide({ tone: focus.targetTone, pinyin: focus.pinyin }) : null;
  const isStrong = band === "strong";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-4">
        <div className="relative hidden h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl sm:block">
          <Image
            src={isStrong ? "/pronunciation/huahua-celebrating.png" : "/pronunciation/huahua-coaching.png"}
            alt=""
            fill
            className="object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-blue)]">
            {mode === "sentence" ? "Sentence" : mode === "isolate" ? "Sound check" : "Word"}
          </p>
          <h2 className="lingo-display mt-1 text-2xl font-bold text-[var(--lingo-navy)]">
            {feedbackHeadline(band)}
          </h2>
          <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">{encouragement}</p>
        </div>
        <div
          className="lingo-display flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold"
          style={scoreTierStyle(result.overallScore)}
        >
          {result.overallScore === null ? "—" : Math.round(result.overallScore)}
        </div>
      </div>

      {result.characters.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {result.characters.map((character, index) => {
            const weak = character.score !== null && character.score < 80;
            return (
              <span
                key={`${character.hanzi}-${index}`}
                className="rounded-xl px-2.5 py-1.5 text-base font-bold"
                style={scoreTierStyle(character.score)}
                title={character.pinyin ?? undefined}
              >
                {character.hanzi}
                {weak && character.pinyin ? (
                  <span className="ml-1 text-xs font-medium opacity-80">{character.pinyin}</span>
                ) : null}
              </span>
            );
          })}
        </div>
      )}

      {!isStrong && focus && (
        <div
          className="rounded-[22px] border p-4"
          style={{ borderColor: "var(--lingo-border)", background: "var(--lingo-sky-pale)" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">
            Focus on this
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="lingo-display text-3xl font-bold text-[var(--lingo-navy)]">{focus.practiceText}</span>
            <div>
              <p className="text-sm font-semibold text-[var(--lingo-navy)]">
                {focus.practicePinyin ?? focus.pinyin ?? focus.hanzi}
                {focus.targetTone != null && (
                  <span className="ml-1.5 text-[var(--lingo-text-muted)]">
                    {toneGlyph(focus.targetTone)} {toneName(focus.targetTone)}
                  </span>
                )}
              </p>
              {focus.sandhiApplied && focus.pinyin && focus.citationPinyin && focus.pinyin !== focus.citationPinyin && (
                <p className="mt-1 text-xs text-[var(--lingo-text-muted)]">
                  {focus.hanzi} is spoken as {focus.pinyin} here — not {focus.citationPinyin}.
                </p>
              )}
              {(tip || guide?.shortTip) && (
                <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--lingo-text)]">
                  {tip ?? guide?.shortTip}
                </p>
              )}
            </div>
            <SpeakerButton text={focus.practiceText} type="word" size="md" />
          </div>
          {guide?.commonMistake && (
            <p className="mt-3 text-xs text-[var(--lingo-text-muted)]">
              Common slip: {guide.commonMistake}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {recordedAudioUrl && (
          <button
            type="button"
            onClick={() => new Audio(recordedAudioUrl).play()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--lingo-accent-border)] bg-white px-3.5 py-2.5 text-xs font-bold text-[var(--lingo-navy)]"
          >
            <Volume2 size={14} /> Listen back
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl border border-[var(--lingo-accent-border)] bg-white px-3.5 py-2.5 text-xs font-bold text-[var(--lingo-navy)]"
        >
          Try again
        </button>
        {focus && onIsolateSyllable && mode !== "isolate" && (
          <button
            type="button"
            onClick={() => onIsolateSyllable(focus)}
            className="rounded-xl bg-[var(--lingo-navy)] px-3.5 py-2.5 text-xs font-bold text-white"
          >
            Practice {focus.practiceText}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white shadow-sm"
        style={{ background: "var(--lingo-accent-gradient)" }}
      >
        {continueLabel}
      </button>
    </div>
  );
}
