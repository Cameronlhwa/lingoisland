"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import SpeakerButton from "@/components/app/SpeakerButton";
import { useTTS } from "@/contexts/TTSContext";

const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

function clampRate(value: number): number {
  return Math.round(Math.max(0.25, Math.min(2.0, value)) * 100) / 100;
}

function formatSpeed(rate: number): string {
  return `${Number(rate.toFixed(2))}×`;
}

interface SpeakerWithSpeedProps {
  text: string;
  type?: "word" | "sentence";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export default function SpeakerWithSpeed({
  text,
  type = "sentence",
  size = "md",
  className = "",
}: SpeakerWithSpeedProps) {
  const { settings, updateSettings } = useTTS();
  const contextRate =
    type === "word" ? settings.ttsRateWords : settings.ttsRateSentences;
  const [rate, setRate] = useState(contextRate);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRate(contextRate);
  }, [contextRate]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const persistRate = useCallback(
    (nextRate: number) => {
      const rounded = clampRate(nextRate);
      setRate(rounded);
      setOpen(false);
      void updateSettings(
        type === "word"
          ? { ttsRateWords: rounded }
          : { ttsRateSentences: rounded },
      );
    },
    [type, updateSettings],
  );

  const buttonHeights = {
    sm: "h-6",
    md: "h-8",
    lg: "h-10",
  };

  const textSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex items-center gap-1 ${className}`}
    >
      <SpeakerButton text={text} type={type} size={size} rate={rate} />

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex ${buttonHeights[size]} items-center gap-0.5 rounded-full border border-gray-200 bg-gray-100 px-2 text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-200 ${textSizes[size]}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Audio speed, ${formatSpeed(rate)}`}
        title="Change audio speed"
      >
        <span className="font-semibold tabular-nums">{formatSpeed(rate)}</span>
        <ChevronDown
          size={size === "sm" ? 12 : size === "lg" ? 16 : 14}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Audio speed options"
          className="absolute left-0 top-full z-20 mt-1 min-w-[5.5rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {SPEED_OPTIONS.map((option) => (
            <li key={option} role="option" aria-selected={rate === option}>
              <button
                type="button"
                onClick={() => persistRate(option)}
                className={`w-full px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-gray-50 ${
                  Math.abs(rate - option) < 0.03
                    ? "bg-[#2176AE]/10 text-[#2176AE]"
                    : "text-gray-700"
                }`}
              >
                {formatSpeed(option)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
