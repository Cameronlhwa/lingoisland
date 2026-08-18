"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  FloatingPortal,
} from "@floating-ui/react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import {
  lookupChineseWordDetailed,
  segmentChineseText,
  toneMarks,
} from "@/lib/chineseTokenizer";
import type { DictionaryEntry } from "cc-cedict";
import type { SegmentToken } from "segmentit";

// ---------------------------------------------------------------------------
// POS tag bitmasks (from segmentit POSTAG constants)
// ---------------------------------------------------------------------------
const POS_V = 0x00001000; // verb
const POS_N = 0x00100000; // noun
const POS_A = 0x40000000; // adjective
const POS_U = 0x00002000; // particle
const POS_M = 0x00400000; // numeral/measure

function posLabel(p: number): string {
  if ((p & POS_V) > 0) return "verb";
  if ((p & POS_N) > 0) return "noun";
  if ((p & POS_A) > 0) return "adj.";
  if ((p & POS_U) > 0) return "particle";
  if ((p & POS_M) > 0) return "num.";
  return "";
}

// ---------------------------------------------------------------------------
// Pinyin sanitisation + tone-mark conversion
// CC-CEDICT format: "ni3 hao3" → "nǐ hǎo"
// Sanitisation: strip bracket variants like (r5), take first slash-reading
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Unicode code-point helper for the "not found" fallback
// ---------------------------------------------------------------------------
function toCodePoints(s: string): string {
  return Array.from(s)
    .map(
      (c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`,
    )
    .join(" ");
}

// ---------------------------------------------------------------------------
// Chinese-character check
// ---------------------------------------------------------------------------
const ZH_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const isChinese = (s: string) => ZH_RE.test(s);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ChineseTooltipTextProps {
  text: string;
  className?: string;
}

export default function ChineseTooltipText({
  text,
  className,
}: ChineseTooltipTextProps) {
  const { convertText } = useCharacterSet();
  const [segments, setSegments] = useState<SegmentToken[] | null>(null);
  const [open, setOpen] = useState(false);
  // null = loading, DictionaryEntry = found, 'not_found' = lookup done, nothing found
  const [entry, setEntry] = useState<DictionaryEntry | "not_found" | null>(
    null,
  );
  const [activeWord, setActiveWord] = useState("");
  const [activePOS, setActivePOS] = useState("");
  const lookupIdRef = useRef(0);

  const { refs, floatingStyles } = useFloating({
    placement: "bottom",
    open,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  // Kick off module + segmentation load immediately on mount
  useEffect(() => {
    let cancelled = false;
    void segmentChineseText(text).then((segs) => {
      if (!cancelled) setSegments(segs);
    });
    return () => {
      cancelled = true;
    };
  }, [text]);

  const handleEnter = useCallback(
    async (e: React.MouseEvent<HTMLSpanElement>, seg: SegmentToken) => {
      const id = ++lookupIdRef.current;
      refs.setReference(e.currentTarget);
      setActiveWord(seg.w);
      setActivePOS(posLabel(seg.p));
      setEntry(null); // show loading state
      setOpen(true);

      const entryResult = await lookupChineseWordDetailed(seg.w);
      if (lookupIdRef.current !== id) return;
      setEntry(entryResult);
    },
    [refs],
  );

  const handleLeave = useCallback(() => {
    setOpen(false);
    setEntry(null);
  }, []);

  // Unsegmented fallback while modules are loading
  if (!segments) {
    return (
      <span className={className} style={{ display: "inline" }}>
        {convertText(text)}
      </span>
    );
  }

  return (
    <>
      {/* wordSpacing/letterSpacing:0 prevents gaps between inline word spans */}
      <span
        className={className}
        style={{ wordSpacing: 0, letterSpacing: 0, display: "inline" }}
      >
        {segments.map((seg, i) =>
          isChinese(seg.w) ? (
            <span
              key={i}
              data-word={seg.w}
              onMouseEnter={(e) => handleEnter(e, seg)}
              onMouseLeave={handleLeave}
              style={{ display: "inline" }}
              className="cursor-help rounded transition-colors hover:bg-blue-50 hover:text-blue-800"
            >
              {convertText(seg.w)}
            </span>
          ) : (
            <span key={i} style={{ display: "inline" }}>
              {convertText(seg.w)}
            </span>
          ),
        )}
      </span>

      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="z-50 min-w-[180px] max-w-[260px] rounded-xl border border-gray-200 bg-white px-3.5 py-3 shadow-lg"
          >
            {/* Chinese characters (respects simplified/traditional setting) */}
            <div className="mb-0.5 text-xl font-bold leading-tight text-gray-900">
              {convertText(activeWord)}
            </div>

            {entry === null ? (
              <div className="text-xs text-gray-400">Looking up…</div>
            ) : entry === "not_found" ? (
              /* Step 5: nothing found — show Unicode code points */
              <div className="space-y-1">
                <div className="font-mono text-xs text-gray-500">
                  {toCodePoints(activeWord)}
                </div>
                <div className="text-xs text-gray-400">No definition found</div>
              </div>
            ) : (
              <>
                {/* Pinyin with tone marks (sanitised) */}
                <div className="mb-1.5 text-[0.8125rem] font-medium text-blue-600">
                  {toneMarks(entry.pinyin)}
                </div>

                {/* POS badge */}
                {activePOS && (
                  <span className="mb-1.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                    {activePOS}
                  </span>
                )}

                {/* Definitions — up to 3 */}
                <div className="space-y-0.5 text-sm text-gray-700">
                  {entry.english.slice(0, 3).map((def, idx) => (
                    <div key={idx} className={idx > 0 ? "text-gray-500" : ""}>
                      {entry.english.length > 1 ? `${idx + 1}. ${def}` : def}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
