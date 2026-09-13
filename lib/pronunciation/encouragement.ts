export type ScoreBand = "strong" | "close" | "rough";

export function bandForScore(score: number | null): ScoreBand | null {
  if (score === null) return null;
  return score >= 80 ? "strong" : score >= 60 ? "close" : "rough";
}

const ENCOURAGEMENT: Record<ScoreBand, string[]> = {
  strong: [
    "正确！(Correct!) 🎉 Those tones landed beautifully.",
    "好极了！(Amazing!) 华华 heard a really clear match there. 🦫",
    "太棒了！(Great!) Your tone shapes sound very steady.",
  ],
  close: [
    "很接近！(So close!) Try letting the tone move a little more clearly.",
    "不错！(Nice work!) One tiny tone adjustment and you'll have it. 🦫",
    "继续！(Keep going!) The sound is there — give the tone a little more space.",
  ],
  rough: [
    "没关系！(No worries!) Let's try that one again, nice and slowly. 🦫",
    "再来一次！(One more try!) Focus on the tone shape, not perfection.",
    "慢慢来！(Take it easy!) Every recording is useful practice. 🎉",
  ],
};

/** Deterministically picks one encouragement line for a band, varied by a seed (e.g. attempt id length). */
export function pickEncouragement(band: ScoreBand, seed: number): string {
  const lines = ENCOURAGEMENT[band];
  return lines[seed % lines.length];
}

/** Actionable, tone-shape-specific coaching — the one thing we can reliably say from a target tone number alone. */
const TONE_SHAPE_TIPS: Record<1 | 2 | 3 | 4, string> = {
  1: "Keep this tone flat and steady the whole way through — no rise or fall.",
  2: "Let this tone rise clearly from low to high, like you're asking \"huh?\"",
  3: "Let this tone dip low first, then come back up — it's closer to a first tone if it doesn't dip enough.",
  4: "Make this tone fall sharply and quickly from high to low, like giving a firm command.",
};

export function toneShapeTip(targetTone: number | null): string | null {
  if (targetTone === 1 || targetTone === 2 || targetTone === 3 || targetTone === 4) {
    return TONE_SHAPE_TIPS[targetTone];
  }
  return null;
}
