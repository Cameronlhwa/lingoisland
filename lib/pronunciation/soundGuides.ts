import { asTone, neutralToneTip, type ToneContext } from "@/lib/pronunciation/tones";

/**
 * Curated coaching copy for tones and common Mandarin initial families.
 * Used by session feedback, review tips, and deep-dive style panels.
 */

export type SoundFamily =
  | "tone1"
  | "tone2"
  | "tone3"
  | "tone4"
  | "neutral"
  | "retroflex"
  | "dental_sibilant"
  | "palatal"
  | "general";

export type SoundGuide = {
  family: SoundFamily;
  title: string;
  shortTip: string;
  commonMistake: string;
  steps: string[];
  earContrast?: { a: string; b: string; prompt: string };
};

const TONE_GUIDES: Record<1 | 2 | 3 | 4 | 5, SoundGuide> = {
  1: {
    family: "tone1",
    title: "1st tone",
    shortTip: "Keep it high and flat — like holding a steady note.",
    commonMistake: "Letting the pitch drift down at the end.",
    steps: [
      "Start high in your comfortable range.",
      "Hold the pitch steady — no rise or fall.",
      "Finish at the same height you started.",
    ],
    earContrast: { a: "mā", b: "má", prompt: "Which one stayed flat?" },
  },
  2: {
    family: "tone2",
    title: "2nd tone",
    shortTip: "Rise clearly from mid to high — like asking \"huh?\"",
    commonMistake: "Starting too high, so there's nowhere to rise.",
    steps: [
      "Start in the middle of your range.",
      "Glide upward smoothly.",
      "Land clearly higher than where you began.",
    ],
    earContrast: { a: "má", b: "mǎ", prompt: "Which one rose?" },
  },
  3: {
    family: "tone3",
    title: "3rd tone",
    shortTip: "Keep this tone low. A full rise is usually unnecessary in connected speech.",
    commonMistake: "Staying too high, so it sounds like a flat or rising tone.",
    steps: [
      "Start mid-low.",
      "Drop clearly into the bottom of your range.",
      "In connected speech, keep it low without forcing a full rise.",
    ],
    earContrast: { a: "mǎ", b: "má", prompt: "Which one dipped low?" },
  },
  4: {
    family: "tone4",
    title: "4th tone",
    shortTip: "Let this tone fall firmly from high to low, with a quick drop.",
    commonMistake: "Trailing off softly instead of cutting down.",
    steps: [
      "Start high.",
      "Drop quickly and decisively.",
      "End low — like giving a short command.",
    ],
    earContrast: { a: "mà", b: "mā", prompt: "Which one fell sharply?" },
  },
  5: {
    family: "neutral",
    title: "Neutral tone",
    shortTip: neutralToneTip(),
    commonMistake: "Giving it the same length and stress as a full-tone syllable.",
    steps: ["Say the preceding syllable first.", "Make this syllable shorter and lighter.", "Let its pitch follow the preceding tone."],
    earContrast: { a: "māma", b: "māmā", prompt: "Which second syllable is short and light?" },
  },
};

const INITIAL_GUIDES: Record<"retroflex" | "dental_sibilant" | "palatal", SoundGuide> = {
  retroflex: {
    family: "retroflex",
    title: "zh / ch / sh / r",
    shortTip: "Curl the tongue tip slightly back toward the roof of the mouth.",
    commonMistake: "Flattening into English \"j / ch / sh\" without the tongue curl.",
    steps: [
      "Lift the tongue tip toward the ridge behind your teeth.",
      "Curl it slightly back — not as far as a deep English 'r'.",
      "Keep the sound farther back than z / c / s.",
    ],
    earContrast: { a: "zhī", b: "zī", prompt: "Which one is farther back?" },
  },
  dental_sibilant: {
    family: "dental_sibilant",
    title: "z / c / s",
    shortTip: "Tongue tip near the teeth — brighter and more forward than zh/ch/sh.",
    commonMistake: "Pulling the tongue back into retroflex territory.",
    steps: [
      "Place the tongue tip close to the upper teeth.",
      "Keep the sound forward and clear.",
      "For c, add a light puff of air.",
    ],
    earContrast: { a: "sī", b: "shī", prompt: "Which one is more forward?" },
  },
  palatal: {
    family: "palatal",
    title: "j / q / x",
    shortTip: "Flat tongue against the hard palate — smile a little, no English \"ch\".",
    commonMistake: "Turning q into English \"ch\" or x into \"sh\".",
    steps: [
      "Spread the lips slightly (a soft smile).",
      "Raise the middle of the tongue toward the palate.",
      "Keep the tip down — don't curl it.",
    ],
    earContrast: { a: "xī", b: "shī", prompt: "Which one is the palatal x?" },
  },
};

export function guideForTone(tone: number | null | undefined, context: ToneContext = {}): SoundGuide | null {
  const normalized = asTone(tone);
  if (normalized === null) return null;
  const guide = TONE_GUIDES[normalized];
  if (normalized === 5) {
    const shortTip = neutralToneTip(context.previousTone);
    return { ...guide, shortTip, steps: [guide.steps[0], guide.steps[1], shortTip] };
  }
  if (normalized === 3 && context.connectedSpeech === false) {
    return {
      ...guide,
      shortTip: "Dip low, then let the pitch rise when saying this syllable on its own.",
      steps: ["Start mid-low.", "Dip into the low part of your comfortable range.", "Let the pitch rise when practicing the syllable on its own."],
    };
  }
  return guide;
}

/** Rough initial-family detection from a pinyin syllable (e.g. "xiǎng", "zhī"). */
export function guideForPinyin(pinyin: string | null | undefined): SoundGuide | null {
  if (!pinyin) return null;
  const bare = pinyin
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (/^(zh|ch|sh|r)/.test(bare)) return INITIAL_GUIDES.retroflex;
  if (/^(j|q|x)/.test(bare)) return INITIAL_GUIDES.palatal;
  if (/^(z|c|s)/.test(bare)) return INITIAL_GUIDES.dental_sibilant;
  return null;
}

export function primaryGuide(opts: {
  tone?: number | null;
  pinyin?: string | null;
} & ToneContext): SoundGuide | null {
  return guideForTone(opts.tone ?? null, opts) ?? guideForPinyin(opts.pinyin);
}

export function weakSoundLabel(syllable: string, pinyin: string | null, tone: number | null): string {
  const toneGuide = guideForTone(tone);
  if (toneGuide && !pinyin) return toneGuide.title;
  if (asTone(tone) !== null) {
    return `${pinyin ?? syllable} · ${toneGuide?.title ?? `tone ${tone}`}`;
  }
  return pinyin ?? syllable;
}
