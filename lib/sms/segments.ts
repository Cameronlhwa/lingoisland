const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
  "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXTENDED = "^{}\\[~]|€\f";

const GSM7_BASIC_SET = new Set(Array.from(GSM7_BASIC));
const GSM7_EXTENDED_SET = new Set(Array.from(GSM7_EXTENDED));

export type SmsEncoding = "GSM-7" | "UCS-2";

export type SmsSegmentEstimate = {
  encoding: SmsEncoding;
  /** Septets for GSM-7, UTF-16 code units for UCS-2. */
  units: number;
  segments: number;
};

const LIMITS = {
  "GSM-7": { single: 160, multipart: 153 },
  "UCS-2": { single: 70, multipart: 67 },
} as const;

function isGsm7(text: string) {
  for (const char of text) {
    if (!GSM7_BASIC_SET.has(char) && !GSM7_EXTENDED_SET.has(char)) return false;
  }
  return true;
}

function unitWidth(char: string, encoding: SmsEncoding) {
  if (encoding === "GSM-7") return GSM7_EXTENDED_SET.has(char) ? 2 : 1;
  return char.length; // 2 for astral characters (surrogate pairs)
}

export function estimateSmsSegments(text: string): SmsSegmentEstimate {
  const encoding: SmsEncoding = isGsm7(text) ? "GSM-7" : "UCS-2";
  const chars = Array.from(text);
  const units = chars.reduce((sum, char) => sum + unitWidth(char, encoding), 0);
  if (units === 0) return { encoding, units, segments: 0 };
  if (units <= LIMITS[encoding].single) return { encoding, units, segments: 1 };

  // Multipart: escape sequences and surrogate pairs never straddle a boundary.
  const perPart = LIMITS[encoding].multipart;
  let segments = 1;
  let used = 0;
  for (const char of chars) {
    const width = unitWidth(char, encoding);
    if (used + width > perPart) {
      segments += 1;
      used = 0;
    }
    used += width;
  }
  return { encoding, units, segments };
}

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

const SENTENCE_END = /[。！？!?.…~～]$/;
const SOFT_BREAK = /[，,；;：:、\s]$/;
const ELLIPSIS = "…";

/**
 * Shortens text so it fits in `maxSegments`, cutting only on grapheme
 * boundaries (never inside an emoji or surrogate pair). Prefers ending on a
 * full sentence; otherwise appends an ellipsis.
 */
export function fitToSmsSegments(text: string, maxSegments: number) {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (estimateSmsSegments(clean).segments <= maxSegments) return clean;

  const parts = graphemes(clean);
  let prefix = "";
  let lastSentence = "";
  let lastSoft = "";
  let lastFit = "";

  for (const part of parts) {
    const next = prefix + part;
    if (estimateSmsSegments(next).segments > maxSegments) break;
    prefix = next;
    if (estimateSmsSegments(prefix.trimEnd() + ELLIPSIS).segments <= maxSegments) {
      lastFit = prefix;
      if (SOFT_BREAK.test(prefix)) lastSoft = prefix;
    }
    if (SENTENCE_END.test(prefix)) lastSentence = prefix;
  }

  // A complete sentence is better than an ellipsis, unless it throws away
  // most of the reply.
  if (lastSentence && lastSentence.length >= prefix.length * 0.5) {
    return lastSentence.trim();
  }

  const cut = lastSoft && lastSoft.length >= lastFit.length * 0.7 ? lastSoft : lastFit;
  return cut.replace(/[\s，,；;：:、]+$/, "") + ELLIPSIS;
}
