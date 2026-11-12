"use client";

import { useState } from "react";
import type { BuildPrompt } from "@/lib/onboarding/personalized/firstLesson/types";
import { CARD_BORDER, GREEN, MUTED, NAVY, PrimaryButton, SKY_PALE, TextButton } from "../ui";

function speak(hanzi: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(hanzi);
  utterance.lang = "zh-CN";
  utterance.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function BuildActivity({
  prompt,
  onComplete,
}: {
  prompt: BuildPrompt;
  onComplete: () => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [status, setStatus] = useState<"editing" | "correct" | "retry">("editing");

  const available = prompt.chunks.filter((chunk) => !order.includes(chunk.id));
  const built = order
    .map((id) => prompt.chunks.find((chunk) => chunk.id === id)?.label ?? "")
    .join("");

  const add = (id: string) => {
    if (status === "correct") return;
    setStatus("editing");
    setOrder((prev) => [...prev, id]);
  };

  const undo = () => {
    setStatus("editing");
    setOrder((prev) => prev.slice(0, -1));
  };

  const check = () => {
    const ok = order.length === prompt.order.length && order.every((id, index) => id === prompt.order[index]);
    if (!ok) {
      setStatus("retry");
      setOrder([]);
      return;
    }
    setStatus("correct");
    speak(prompt.result.hanzi);
  };

  return (
    <div data-testid="lesson-build" data-correct-order={prompt.order.join(",")}>
      <p className="text-[15px] font-semibold" style={{ color: NAVY }}>
        {prompt.prompt}
      </p>
      <p className="mt-1 text-[14px]" style={{ color: MUTED }}>
        Tap chunks in order. You can also use the keyboard-friendly buttons below.
      </p>

      <div
        className="mt-4 flex min-h-[64px] flex-wrap items-center gap-2 rounded-2xl px-4 py-3"
        style={{ background: SKY_PALE, border: `1px solid ${CARD_BORDER}` }}
        aria-live="polite"
        data-testid="lesson-build-tray"
      >
        {order.length === 0 ? (
          <span style={{ color: MUTED }}>Your phrase appears here</span>
        ) : (
          <span className="text-[22px] font-bold" lang="zh-CN" style={{ color: NAVY }}>
            {built}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {available.map((chunk) => (
          <button
            key={chunk.id}
            type="button"
            data-testid={`build-chunk-${chunk.id}`}
            onClick={() => add(chunk.id)}
            className="min-h-[48px] rounded-full px-4 text-[15px] font-semibold"
            style={{ border: `1px solid ${CARD_BORDER}`, background: "#fff", color: NAVY }}
            lang="zh-CN"
          >
            {chunk.label}
          </button>
        ))}
      </div>

      {status === "retry" ? (
        <p className="mt-3 text-sm" style={{ color: MUTED }} role="status">
          Not quite — try arranging the chunks again.
        </p>
      ) : null}
      {status === "correct" ? (
        <div className="mt-3 rounded-2xl px-4 py-3" style={{ background: "rgba(32,103,79,0.08)" }}>
          <p className="text-[18px] font-bold" lang="zh-CN" style={{ color: NAVY }}>
            {prompt.result.hanzi}
          </p>
          <p className="text-[13px]" style={{ color: MUTED }}>
            {prompt.result.pinyin}
          </p>
          <p className="mt-1 text-[14px]" style={{ color: NAVY }}>
            {prompt.result.meaning}
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-2">
        {status !== "correct" ? (
          <>
            <PrimaryButton data-testid="lesson-build-check" disabled={order.length === 0} onClick={check}>
              Check
            </PrimaryButton>
            <TextButton onClick={undo} disabled={order.length === 0}>
              Undo
            </TextButton>
          </>
        ) : (
          <PrimaryButton data-testid="lesson-build-continue" onClick={onComplete} style={{ background: GREEN }}>
            Continue
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
