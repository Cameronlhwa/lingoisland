import { convert, pinyin } from "pinyin-pro";
import { asTone } from "@/lib/pronunciation/tones";

/**
 * Mandarin third-tone sandhi: in a run of consecutive 3rd tones, every
 * syllable except the last becomes 2nd tone. Neutral tone (5) and unknown or
 * non-tone entries (null) break the run. Longer runs still use this simplified
 * rule; it does not model phrase grouping or measured pitch contours.
 */
export function applyThirdToneSandhi(tones: Array<number | null>): Array<number | null> {
  const result = tones.slice();
  let i = 0;
  while (i < result.length) {
    if (result[i] !== 3) {
      i += 1;
      continue;
    }
    let end = i;
    while (end < result.length && result[end] === 3) end += 1;
    for (let k = i; k < end - 1; k += 1) result[k] = 2;
    i = end;
  }
  return result;
}

function parseNumberedSyllable(token: string): { bare: string; tone: number } | null {
  const match = token.trim().match(/^([a-züv:]+)([0-5])$/i);
  if (!match) return null;
  return { bare: match[1].toLowerCase(), tone: Number(match[2]) };
}

/**
 * Spoken/surface pinyin for a Hanzi string.
 * Uses pinyin-pro for 不/一 sandhi, then applies third-tone sandhi.
 */
export function surfacePinyinForText(
  hanzi: string,
  { compact = false }: { compact?: boolean } = {},
): string {
  const text = hanzi.trim();
  if (!text) return "";

  const tokens = pinyin(text, {
    toneType: "num",
    type: "array",
    toneSandhi: true,
    nonZh: "consecutive",
  });

  if (!Array.isArray(tokens) || tokens.length === 0) return "";

  const parsed = tokens.map((token) => {
    if (typeof token !== "string") return { kind: "other" as const, text: String(token) };
    const syllable = parseNumberedSyllable(token);
    if (!syllable) return { kind: "other" as const, text: token };
    return { kind: "syllable" as const, bare: syllable.bare, tone: syllable.tone };
  });

  const citationTones = parsed.map((part) =>
    part.kind === "syllable" && part.tone >= 1 && part.tone <= 4 ? part.tone : null,
  );
  const spokenTones = applyThirdToneSandhi(citationTones);

  const pieces: Array<{ kind: "syl" | "other"; text: string }> = parsed.map((part, index) => {
    if (part.kind !== "syllable") return { kind: "other", text: part.text };
    const tone = spokenTones[index] ?? part.tone;
    if (tone === 0 || tone === 5) {
      return { kind: "syl", text: part.bare.replace(/v/g, "ü") };
    }
    const marked = convert(`${part.bare}${tone}`);
    return { kind: "syl", text: typeof marked === "string" ? marked : part.bare };
  });

  if (compact) {
    return pieces.map((piece) => piece.text).join("");
  }

  let out = "";
  for (const piece of pieces) {
    if (piece.kind === "other") {
      out += piece.text;
      continue;
    }
    if (out && !/[\s([{“‘]$/.test(out)) out += " ";
    out += piece.text;
  }

  // Match typical sentence-pinyin style: capitalize the first letter.
  return out.replace(/[a-zA-Zà-üÀ-Ü]/, (ch) => ch.toUpperCase());
}

export type CharacterTones = {
  hanzi: string;
  citationTone: number | null;
  spokenTone: number | null;
  previousTone: number | null;
  connectedSpeech: boolean;
  spokenPinyin: string | null;
};

/**
 * Per-character dictionary and spoken tones, using the same rules as
 * surfacePinyinForText (不/一 sandhi, then third-tone sandhi). Neutral is 5;
 * punctuation/unknown is null. Both break third-tone runs.
 */
export function spokenTonesForText(hanzi: string): CharacterTones[] {
  const text = hanzi.trim();
  if (!text) return [];
  // "spaced" keeps one array entry per character, so entries line up with the text.
  const options = { toneType: "num", type: "array", nonZh: "spaced" } as const;
  const citation = pinyin(text, { ...options, toneSandhi: false });
  const withYiBu = pinyin(text, { ...options, toneSandhi: true });
  if (!Array.isArray(citation) || !Array.isArray(withYiBu) || citation.length !== withYiBu.length) return [];

  const toneOf = (token: unknown) => {
    const syllable = typeof token === "string" ? parseNumberedSyllable(token) : null;
    return syllable ? asTone(syllable.tone) : null;
  };
  const chars = Array.from(text);
  if (chars.length !== citation.length) return [];
  const spoken = applyThirdToneSandhi(withYiBu.map(toneOf));
  return chars.map((char, index) => ({
    hanzi: char,
    citationTone: toneOf(citation[index]),
    spokenTone: spoken[index],
    previousTone: spoken[index - 1] ?? null,
    connectedSpeech: spoken[index] !== null && (spoken[index - 1] != null || spoken[index + 1] != null),
    spokenPinyin: (() => {
      const syllable = typeof withYiBu[index] === "string" ? parseNumberedSyllable(withYiBu[index]) : null;
      if (!syllable || spoken[index] === null) return null;
      if (spoken[index] === 5) return syllable.bare.replace(/v/g, "ü");
      return convert(`${syllable.bare}${spoken[index]}`);
    })(),
  }));
}

/** Model playback keeps the original phrase so contextual tones stay audible. */
export function contextualToneTarget(text: string, characterIndex: number) {
  const tone = spokenTonesForText(text)[characterIndex];
  if (!tone || tone.spokenTone === null) return null;
  return {
    hanzi: tone.hanzi,
    pinyin: tone.spokenPinyin,
    targetTone: tone.spokenTone,
    citationTone: tone.citationTone,
    previousTone: tone.previousTone,
    connectedSpeech: tone.connectedSpeech,
    practiceText: text.trim(),
    practicePinyin: surfacePinyinForText(text),
  };
}

/** Stored weak sounds retain dictionary identity; coaching uses their example's spoken form. */
export function contextualToneTargetForSound(text: string, hanzi: string, citationTone: number | null) {
  if (citationTone === null) return null;
  const index = spokenTonesForText(text).findIndex((part) => part.hanzi === hanzi && part.citationTone === citationTone);
  return contextualToneTarget(text, index);
}

export function withSurfaceDrillPinyin<
  T extends {
    wordHanzi: string;
    wordPinyin: string;
    sentenceHanzi: string;
    sentencePinyin: string;
  },
>(item: T): T {
  return {
    ...item,
    wordPinyin: surfacePinyinForText(item.wordHanzi, { compact: true }) || item.wordPinyin,
    sentencePinyin: surfacePinyinForText(item.sentenceHanzi) || item.sentencePinyin,
  };
}
