"use client";

import type { DictionaryEntry } from "cc-cedict";
import type { SegmentToken } from "segmentit";

export { toneMarks } from "@/lib/pinyinToneMarks";

export type BreakdownToken = {
  hanzi: string;
  pinyin: string;
  english: string;
  isTarget: boolean;
  isChinese: boolean;
};

type BreakdownTarget = { hanzi: string; pinyin: string; english: string };

async function postChinese<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/chinese", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`/api/chinese ${payload.action} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

const segmentCache = new Map<string, Promise<SegmentToken[]>>();
let pendingSegments: {
  text: string;
  resolve: (tokens: SegmentToken[]) => void;
}[] = [];
let segmentFlushScheduled = false;

function unsegmented(text: string): SegmentToken[] {
  return [{ w: text, p: 0 } as SegmentToken];
}

async function flushSegments() {
  segmentFlushScheduled = false;
  const batch = pendingSegments;
  pendingSegments = [];
  try {
    const { segments } = await postChinese<{ segments: SegmentToken[][] }>({
      action: "segment",
      texts: batch.map((item) => item.text),
    });
    batch.forEach((item, i) => item.resolve(segments[i] ?? unsegmented(item.text)));
  } catch (error) {
    console.error(error);
    batch.forEach((item) => {
      segmentCache.delete(item.text);
      item.resolve(unsegmented(item.text));
    });
  }
}

/** Segments are batched so a page full of tooltip text makes one request. */
export function segmentChineseText(text: string): Promise<SegmentToken[]> {
  const cached = segmentCache.get(text);
  if (cached) return cached;

  const promise = new Promise<SegmentToken[]>((resolve) => {
    pendingSegments.push({ text, resolve });
    if (pendingSegments.length >= 100) {
      void flushSegments();
    } else if (!segmentFlushScheduled) {
      segmentFlushScheduled = true;
      window.setTimeout(() => void flushSegments(), 0);
    }
  });
  segmentCache.set(text, promise);
  return promise;
}

const lookupCache = new Map<string, Promise<DictionaryEntry | "not_found">>();

export function lookupChineseWordDetailed(
  word: string,
): Promise<DictionaryEntry | "not_found"> {
  const cached = lookupCache.get(word);
  if (cached) return cached;

  const promise = postChinese<{ entry: DictionaryEntry | "not_found" }>({
    action: "lookup",
    word,
  })
    .then(({ entry }) => entry)
    .catch((error) => {
      console.error(error);
      lookupCache.delete(word);
      return "not_found" as const;
    });
  lookupCache.set(word, promise);
  return promise;
}

const breakdownCache = new Map<string, Promise<BreakdownToken[]>>();

export function buildSentenceBreakdown(
  sentenceHanzi: string,
  target: BreakdownTarget,
): Promise<BreakdownToken[]> {
  const key = JSON.stringify([sentenceHanzi, target.hanzi, target.pinyin, target.english]);
  const cached = breakdownCache.get(key);
  if (cached) return cached;

  const promise = postChinese<{ tokens: BreakdownToken[] }>({
    action: "breakdown",
    sentence: sentenceHanzi,
    target: { hanzi: target.hanzi, pinyin: target.pinyin, english: target.english },
  })
    .then(({ tokens }) => tokens)
    .catch((error) => {
      console.error(error);
      breakdownCache.delete(key);
      return [];
    });
  breakdownCache.set(key, promise);
  return promise;
}
