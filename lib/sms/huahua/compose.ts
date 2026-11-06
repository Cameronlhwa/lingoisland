import { pinyin as toPinyin } from "pinyin-pro";
import { estimateSmsSegments, fitToSmsSegments } from "../segments";

const HAN = /[\u3400-\u9fff\uf900-\ufaff]/;

export function containsChinese(text: string) {
  return HAN.test(text);
}

export function cleanModelText(text: string) {
  return text
    .replace(/\*\*|__|`|#+\s/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Tone-marked pinyin for the Chinese parts of a message. */
export function pinyinFor(text: string) {
  const chinese = Array.from(text.matchAll(/[\u3400-\u9fff\uf900-\ufaff，。！？、]+/g), (match) => match[0]).join(" ");
  if (!chinese) return "";
  return toPinyin(chinese, { toneType: "symbol", nonZh: "consecutive" })
    .replace(/\s*，\s*/g, ", ")
    .replace(/\s*。\s*/g, ". ")
    .replace(/\s*！\s*/g, "! ")
    .replace(/\s*？\s*/g, "? ")
    .replace(/\s*、\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ComposedSms = {
  body: string;
  segments: number;
  includedPinyin: boolean;
  includedTranslation: boolean;
};

/**
 * Builds the SMS body from the message plus optional pinyin and translation
 * lines, staying within `maxSegments`. Support lines are dropped (translation
 * first for higher levels, pinyin first for beginners) before the message
 * itself is shortened.
 */
export function composeSms(input: {
  message: string;
  pinyin?: string | null;
  translation?: string | null;
  includePinyin: boolean;
  includeTranslation: boolean;
  maxSegments: number;
  beginner?: boolean;
}): ComposedSms {
  const message = cleanModelText(input.message);
  const hasChinese = containsChinese(message);
  const pinyinLine =
    input.includePinyin && hasChinese ? cleanModelText(input.pinyin || "") || pinyinFor(message) : "";
  const translation = input.includeTranslation ? cleanModelText(input.translation || "") : "";
  const translationLine = translation ? `(${translation.replace(/^\(|\)$/g, "")})` : "";

  const variants: Array<{ lines: string[]; pinyin: boolean; translation: boolean }> = [
    { lines: [message, pinyinLine, translationLine], pinyin: Boolean(pinyinLine), translation: Boolean(translationLine) },
  ];
  if (input.beginner) {
    variants.push({ lines: [message, translationLine], pinyin: false, translation: Boolean(translationLine) });
    variants.push({ lines: [message, pinyinLine], pinyin: Boolean(pinyinLine), translation: false });
  } else {
    variants.push({ lines: [message, pinyinLine], pinyin: Boolean(pinyinLine), translation: false });
    variants.push({ lines: [message, translationLine], pinyin: false, translation: Boolean(translationLine) });
  }

  for (const variant of variants) {
    const body = variant.lines.filter(Boolean).join("\n");
    const segments = estimateSmsSegments(body).segments;
    if (segments <= input.maxSegments) {
      return { body, segments, includedPinyin: variant.pinyin, includedTranslation: variant.translation };
    }
  }

  const body = fitToSmsSegments(message, input.maxSegments);
  return { body, segments: estimateSmsSegments(body).segments, includedPinyin: false, includedTranslation: false };
}
