"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";

/**
 * Lightweight first-run entry. Prefers the pronunciation check when no
 * baseline exists; otherwise starts a normal practice session.
 */
export default function PronunciationSetupPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startPractice = async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/pronunciation/session", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.sessionId) {
        throw new Error(typeof data.error === "string" ? data.error : "Unable to start practice.");
      }
      router.push(`/app/pronunciation/session/${data.sessionId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 md:px-6">
      <div
        className="rounded-[28px] border border-[var(--lingo-accent-border)] bg-white p-6 shadow-sm sm:p-8"
        style={{ boxShadow: "var(--lingo-shadow-card)" }}
      >
        <div className="relative mx-auto mb-4 h-28 w-28 overflow-hidden rounded-3xl">
          <Image src="/pronunciation/huahua-speaking.png" alt="" fill className="object-cover" />
        </div>
        <h1 className="lingo-display text-center text-xl font-bold text-[var(--lingo-navy)]">
          {convertText(t("Pronunciation practice"))}
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--lingo-text-muted)]">
          {convertText(t("Start with a quick check so we know what to focus on — or jump straight into today's practice."))}
        </p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <Link
          href="/app/pronunciation/diagnostic"
          className="mt-6 flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-sm"
          style={{ background: "var(--lingo-accent-gradient)" }}
        >
          {convertText(t("Take the 2-minute check →"))}
        </Link>
        <button
          type="button"
          disabled={starting}
          onClick={() => void startPractice()}
          className="mt-3 w-full rounded-2xl border border-[var(--lingo-accent-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--lingo-navy)] disabled:opacity-60"
        >
          {convertText(t(starting ? "Preparing your session…" : "Skip — start practicing"))}
        </button>
      </div>
    </div>
  );
}
