"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { bandForScore, pickEncouragement, toneShapeTip } from "@/lib/pronunciation/encouragement";
import type { ScoreResult } from "@/components/app/Pronunciation/RecordButton";

function toneGlyph(tone: number | null) {
  return tone === 1 ? "→" : tone === 2 ? "↗" : tone === 3 ? "∨" : tone === 4 ? "↘" : "—";
}

function chipStyle(score: number | null) {
  if (score === null) return { background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" };
  if (score >= 80) return { background: "#e7f7f5", color: "#0f766e", border: "1px solid #99f6e4" };
  if (score >= 60) return { background: "#fdf3e3", color: "#92400e", border: "1px solid #fcd9a0" };
  return { background: "#fdecea", color: "#9f1c14", border: "1px solid #f5c2bd" };
}

export default function TonePracticeFeedbackCard({
  result,
  recordedAudioUrl,
  onRetry,
  onIsolateSyllable,
  onContinue,
  continueLabel,
}: {
  result: ScoreResult;
  recordedAudioUrl?: string | null;
  onRetry: () => void;
  onIsolateSyllable?: (syllable: { hanzi: string; pinyin: string | null; targetTone: number | null }) => void;
  onContinue: () => void;
  continueLabel: string;
}) {
  const [openSyllable, setOpenSyllable] = useState<number | null>(null);
  const band = bandForScore(result.overallScore);
  const encouragement = band ? pickEncouragement(band, result.attemptId.length) : null;
  const worstSyllable = result.weakSyllables[0] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex items-center justify-between rounded-2xl px-4 py-2.5"
        style={{ background: "var(--lingo-sky-pale)" }}
      >
        <span className="text-sm font-semibold text-[var(--lingo-navy)]">{encouragement ?? "Here's your result"}</span>
        <span className="lingo-display text-lg font-bold text-[var(--lingo-navy)]">
          {result.overallScore === null ? "—" : Math.round(result.overallScore)}
        </span>
      </div>

      {result.characters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {result.characters.map((character, index) => {
            const open = openSyllable === index;
            const tip = toneShapeTip(character.targetTone);
            return (
              <div key={`${character.hanzi}-${index}`} className="flex flex-col items-start gap-1">
                <button
                  type="button"
                  onClick={() => setOpenSyllable(open ? null : index)}
                  className="rounded-xl px-3 py-1.5 text-sm font-bold"
                  style={chipStyle(character.score)}
                >
                  {character.hanzi}
                  {character.pinyin ? <span className="ml-1 font-normal">{character.pinyin}</span> : null}
                </button>
                {open && (character.score === null || character.score < 80) && tip && (
                  <div className="max-w-[220px] rounded-xl border border-[var(--lingo-accent-border)] bg-white p-2.5 text-xs leading-relaxed text-[var(--lingo-text)] shadow-sm">
                    Target tone {toneGlyph(character.targetTone)}. {tip}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {recordedAudioUrl && (
          <button
            type="button"
            onClick={() => new Audio(recordedAudioUrl).play()}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--lingo-accent-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--lingo-navy)]"
          >
            <Volume2 size={14} /> Listen back
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="rounded-xl border border-[var(--lingo-accent-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--lingo-navy)]"
        >
          Try again
        </button>
      </div>

      {worstSyllable && onIsolateSyllable && (
        <button
          type="button"
          onClick={() =>
            onIsolateSyllable({
              hanzi: worstSyllable.syllable,
              pinyin: worstSyllable.pinyin,
              targetTone: worstSyllable.targetTone,
            })
          }
          className="rounded-2xl bg-[var(--lingo-navy)] px-4 py-2.5 text-sm font-bold text-white"
        >
          Try just this sound: {worstSyllable.syllable}
        </button>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-sm"
        style={{ background: "var(--lingo-accent-gradient)" }}
      >
        {continueLabel}
      </button>
    </div>
  );
}
