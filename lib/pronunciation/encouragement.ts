/**
 * Calmer coaching copy for the redesigned pronunciation product.
 * Keeps the original band helpers for compatibility.
 */

import { guideForTone } from "@/lib/pronunciation/soundGuides";
import { asTone, type ToneContext } from "@/lib/pronunciation/tones";

export type ScoreBand = "strong" | "close" | "rough";

export function bandForScore(score: number | null): ScoreBand | null {
  if (score === null) return null;
  return score >= 80 ? "strong" : score >= 60 ? "close" : "rough";
}

const ENCOURAGEMENT: Record<ScoreBand, string[]> = {
  strong: [
    "Nice — that landed clearly.",
    "Nice work — keep practicing with the model.",
    "That sounded natural.",
  ],
  close: [
    "Almost — one small adjustment will get it.",
    "Close. Let's clean up one sound.",
    "You're nearly there — give the tone a little more shape.",
  ],
  rough: [
    "No worries — let's try that one again, slowly.",
    "We'll fix this one sound at a time.",
    "Take another pass — focus on the tone shape.",
  ],
};

export function pickEncouragement(band: ScoreBand, seed: number): string {
  const lines = ENCOURAGEMENT[band];
  return lines[seed % lines.length];
}

export function toneShapeTip(targetTone: number | null, context: ToneContext = {}): string | null {
  return guideForTone(targetTone, context)?.shortTip ?? null;
}

export function toneName(tone: number | null | undefined): string {
  return guideForTone(tone)?.title ?? "this tone";
}

export function toneGlyph(tone: number | null | undefined) {
  return tone === 1 ? "→" : tone === 2 ? "↗" : tone === 3 ? "∨" : tone === 4 ? "↘" : asTone(tone) === 5 ? "·" : "—";
}

export function feedbackHeadline(band: ScoreBand | null): string {
  if (band === "strong") return "Nice!";
  if (band === "close") return "Almost!";
  if (band === "rough") return "Let's fix one sound";
  return "Here's your result";
}
