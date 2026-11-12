"use client";

import { useMemo, useState } from "react";
import type { MatchPair } from "@/lib/onboarding/personalized/firstLesson/types";
import { CARD_BORDER, GREEN, MUTED, NAVY, PrimaryButton, SKY_PALE } from "../ui";

function speak(hanzi: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(hanzi);
  utterance.lang = "zh-CN";
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function MatchActivity({
  pairs,
  onComplete,
}: {
  pairs: MatchPair[];
  onComplete: () => void;
}) {
  const visuals = useMemo(() => [...pairs].sort((a, b) => a.id.localeCompare(b.id)), [pairs]);
  const [tiles] = useState(() => [...pairs].sort(() => Math.random() - 0.5));
  const [selectedTile, setSelectedTile] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [bounceId, setBounceId] = useState<string | null>(null);

  const place = (visualId: string, tileId: string) => {
    const pair = pairs.find((item) => item.id === visualId);
    if (!pair) return;
    if (pair.id !== tileId) {
      setSelectedTile(null);
      return;
    }
    setMatches((prev) => ({ ...prev, [visualId]: tileId }));
    setBounceId(visualId);
    setSelectedTile(null);
    speak(pair.hanzi);
    window.setTimeout(() => setBounceId(null), 280);
  };

  const done = visuals.every((item) => matches[item.id]);

  return (
    <div data-testid="lesson-match">
      <p className="text-[15px] leading-relaxed" style={{ color: MUTED }}>
        Match each word to its drink. You can tap a word, then tap a picture — or drag on desktop.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visuals.map((item) => {
          const filled = matches[item.id];
          const tile = pairs.find((pair) => pair.id === filled);
          return (
            <div
              key={item.id}
              data-testid={`match-slot-${item.id}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const tileId = event.dataTransfer.getData("text/plain");
                if (tileId) place(item.id, tileId);
              }}
              onClick={() => {
                if (selectedTile) place(item.id, selectedTile);
              }}
              className="flex min-h-[96px] flex-col items-center justify-center rounded-2xl border px-3 py-4 transition-transform motion-safe:duration-200"
              style={{
                borderColor: filled ? GREEN : CARD_BORDER,
                background: filled ? "rgba(32,103,79,0.06)" : SKY_PALE,
                transform: bounceId === item.id ? "scale(1.04)" : "scale(1)",
              }}
            >
              <span className="text-[36px]" aria-hidden>
                {item.visual}
              </span>
              <span className="mt-1 text-[13px] font-semibold" style={{ color: MUTED }}>
                {item.label}
              </span>
              {tile ? (
                <span className="mt-2 text-[18px] font-bold" lang="zh-CN" style={{ color: NAVY }}>
                  {tile.hanzi}
                </span>
              ) : (
                <span className="mt-2 text-[13px]" style={{ color: MUTED }}>
                  Drop or tap here
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Words to place">
        {tiles
          .filter((tile) => !Object.values(matches).includes(tile.id))
          .map((tile) => (
            <button
              key={tile.id}
              type="button"
              draggable
              role="listitem"
              aria-pressed={selectedTile === tile.id}
              data-testid={`match-tile-${tile.id}`}
              onDragStart={(event) => event.dataTransfer.setData("text/plain", tile.id)}
              onClick={() => setSelectedTile((prev) => (prev === tile.id ? null : tile.id))}
              className="min-h-[48px] rounded-full px-4 text-[15px] font-semibold"
              style={{
                border: `1px solid ${selectedTile === tile.id ? GREEN : CARD_BORDER}`,
                background: selectedTile === tile.id ? "rgba(32,103,79,0.08)" : "#fff",
                color: NAVY,
              }}
              lang="zh-CN"
            >
              {tile.hanzi}
              <span className="ml-2 text-[12px] font-medium" style={{ color: MUTED }}>
                {tile.pinyin}
              </span>
            </button>
          ))}
      </div>

      <PrimaryButton className="mt-6" disabled={!done} data-testid="lesson-match-continue" onClick={onComplete}>
        Continue
      </PrimaryButton>
    </div>
  );
}
