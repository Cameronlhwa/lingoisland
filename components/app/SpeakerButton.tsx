"use client";

import { useState, type ReactNode } from "react";
import { playTextToSpeech } from "@/lib/utils/tts";
import { useTTS } from "@/contexts/TTSContext";
import { Volume2 } from "lucide-react";

interface SpeakerButtonProps {
  text: string;
  type?: "word" | "sentence";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** When set, overrides profile TTS speed for this playback. */
  rate?: number;
  /** Optional visible label (e.g. a Hanzi character) instead of the speaker icon. */
  label?: ReactNode;
  /** Describe contextual playback when the visible label is only one character. */
  ariaLabel?: string;
}

/**
 * Button component that plays text-to-speech when clicked
 */
export default function SpeakerButton({
  text,
  type = "sentence",
  size = "md",
  className = "",
  rate: rateOverride,
  label,
  ariaLabel,
}: SpeakerButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { settings } = useTTS();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isPlaying) return;

    setIsPlaying(true);
    setError(null);

    try {
      const rate =
        rateOverride ??
        (type === "word" ? settings.ttsRateWords : settings.ttsRateSentences);
      await playTextToSpeech(text, rate);
    } catch (err) {
      console.error("Failed to play audio:", err);
      setError("Failed to play audio");
    } finally {
      setIsPlaying(false);
    }
  };

  const sizeClasses = {
    sm: "h-6 w-6 p-1",
    md: "h-8 w-8 p-1.5",
    lg: "h-10 w-10 p-2",
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPlaying}
      className={`
        inline-flex items-center justify-center
        rounded-full border border-gray-200 bg-gray-100
        text-gray-700 transition-all
        hover:bg-gray-200 hover:border-gray-300
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${className}
      `}
      title={error || (isPlaying ? "Playing..." : "Play audio")}
      aria-label={ariaLabel ?? (typeof label === "string" ? `Play ${label}` : "Play pronunciation")}
    >
      {label != null ? (
        <span className={isPlaying ? "animate-pulse" : ""}>{label}</span>
      ) : (
        <Volume2
          size={iconSizes[size]}
          className={isPlaying ? "animate-pulse" : ""}
        />
      )}
    </button>
  );
}
