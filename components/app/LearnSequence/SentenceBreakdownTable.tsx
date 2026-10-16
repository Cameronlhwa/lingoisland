"use client";

import { useEffect, useState } from "react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import {
  buildSentenceBreakdown,
  type BreakdownToken,
} from "@/lib/chineseTokenizer";

export default function SentenceBreakdownTable({
  sentenceHanzi,
  target,
}: {
  sentenceHanzi: string;
  target: { hanzi: string; pinyin: string; english: string };
}) {
  const { convertText } = useCharacterSet();
  const [tokens, setTokens] = useState<BreakdownToken[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void buildSentenceBreakdown(sentenceHanzi, target).then((rows) => {
      if (!cancelled) setTokens(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [sentenceHanzi, target]);

  if (!tokens) {
    return (
      <p className="text-center text-sm text-[#5F3119]/50">Loading breakdown…</p>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto">
      <div className="inline-flex min-w-full gap-3 px-1">
        {tokens.map((token, i) => (
          <div
            key={`${token.hanzi}-${i}`}
            className={`flex min-w-[3.25rem] flex-col items-center gap-1 text-center ${
              i > 0 ? "border-l border-[#20674F]/15 pl-3" : ""
            }`}
          >
            <span
              className={`text-base leading-tight ${
                token.isTarget
                  ? "font-bold text-[#5F3119]"
                  : "font-medium text-[#5F3119]/80"
              }`}
              style={{ fontFamily: 'var(--font-home-display), Nunito, system-ui, sans-serif' }}
            >
              {convertText(token.hanzi)}
            </span>
            {token.isChinese ? (
              <>
                <span
                  className={`text-xs leading-tight ${
                    token.isTarget ? "font-semibold text-[#20674F]" : "text-[#5F3119]/50"
                  }`}
                >
                  {token.pinyin || "—"}
                </span>
                <span
                  className={`text-[10px] leading-tight ${
                    token.isTarget ? "font-medium text-[#20674F]" : "text-[#5F3119]/45"
                  }`}
                >
                  {token.english || "—"}
                </span>
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
