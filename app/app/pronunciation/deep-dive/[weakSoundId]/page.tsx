"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { WeakSoundRow } from "@/lib/pronunciation/weakSoundTypes";
import { primaryGuide, weakSoundLabel } from "@/lib/pronunciation/soundGuides";
import SpeakerButton from "@/components/app/SpeakerButton";
import AppPageLoading from "@/components/app/AppPageLoading";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";

type Tab = "guide" | "tips" | "challenge";

export default function DeepDivePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const weakSoundId = params?.weakSoundId as string;
  const from = searchParams.get("from") ?? "/app/pronunciation/review";

  const [tab, setTab] = useState<Tab>("guide");
  const [row, setRow] = useState<WeakSoundRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/pronunciation/weak-sounds?status=active", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    const rows: WeakSoundRow[] = res.ok && data ? data.weakSounds ?? [] : [];
    const masteredRes = await fetch("/api/pronunciation/weak-sounds?status=mastered", { cache: "no-store" });
    const masteredData = await masteredRes.json().catch(() => null);
    const all = rows.concat(masteredRes.ok && masteredData ? masteredData.weakSounds ?? [] : []);
    setRow(all.find((r) => r.id === weakSoundId) ?? null);
    setLoading(false);
  }, [weakSoundId]);

  useEffect(() => {
    void load();
  }, [load]);

  const guide = primaryGuide({ tone: row?.target_tone, pinyin: row?.pinyin });

  const startPractice = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("/api/pronunciation/session/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weakSoundIds: [weakSoundId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sessionId) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to start practice.");
      }
      router.push(`/app/pronunciation/session/${data.sessionId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start practice.");
      setStarting(false);
    }
  };

  if (loading) {
    return <AppPageLoading />;
  }

  if (!row) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-[var(--lingo-text-muted)]">{convertText(t("That sound isn't on your list anymore."))}</p>
        <Link href="/app/pronunciation/review" className="mt-4 inline-block text-sm font-bold text-[var(--lingo-blue)]">
          {convertText(t("Back to your sounds"))}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
      <button
        type="button"
        onClick={() => router.push(from)}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--lingo-text-muted)]"
      >
        <ArrowLeft size={13} /> {convertText(t("Back"))}
      </button>

      <div className="mb-6 flex items-start gap-4">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl">
          <Image src="/pronunciation/huahua-coaching.png" alt="" fill className="object-cover" />
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-blue)]">{convertText(t("Deep dive"))}</p>
          <h1 className="lingo-display mt-1 text-3xl font-bold text-[var(--lingo-navy)]">
            {convertText(weakSoundLabel(row.syllable, row.pinyin, row.target_tone))}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <span className="lingo-display text-2xl font-bold text-[var(--lingo-navy)]">{convertText(row.syllable)}</span>
            <SpeakerButton text={row.syllable} type="word" size="sm" />
          </div>
        </div>
      </div>

      <div className="mb-5 inline-flex rounded-full bg-[var(--lingo-sky-pale)] p-1">
        {(
          [
            ["guide", t("Visual guide")],
            ["tips", t("Tips")],
            ["challenge", t("Practice")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold ${
              tab === id ? "bg-white text-[var(--lingo-navy)] shadow-sm" : "text-[var(--lingo-text-muted)]"
            }`}
          >
            {convertText(label)}
          </button>
        ))}
      </div>

      <div
        className="rounded-[28px] border bg-white p-6"
        style={{ borderColor: "var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
      >
        {tab === "guide" && (
          <>
            <h2 className="text-sm font-bold text-[var(--lingo-navy)]">{guide?.title ?? convertText(t("Mouth position"))}</h2>
            <p className="mt-2 text-sm text-[var(--lingo-text)]">{guide?.shortTip ?? "Focus on a clear tone shape."}</p>
            <div className="mt-5 flex justify-center">
              <svg viewBox="0 0 200 120" className="h-28 w-48 text-[var(--lingo-blue)]">
                <ellipse cx="100" cy="70" rx="70" ry="40" fill="var(--lingo-sky-pale)" stroke="currentColor" strokeWidth="2" />
                <path d="M40 70 Q100 30 160 70" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                <circle cx="100" cy="55" r="8" fill="currentColor" opacity="0.35" />
                <text x="100" y="105" textAnchor="middle" fontSize="10" fill="#66869a">
                  Tongue / pitch path
                </text>
              </svg>
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-[var(--lingo-text)]">
              {(guide?.steps ?? ["Listen to the model", "Imitate slowly", "Put it back in a word"]).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </>
        )}

        {tab === "tips" && (
          <>
            <h2 className="text-sm font-bold text-[var(--lingo-navy)]">{convertText(t("Tips & tricks"))}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--lingo-text)]">
              {guide?.shortTip ?? "Give the tone a clear shape — length and pitch matter more than volume."}
            </p>
            {guide?.commonMistake && (
              <div className="mt-4 rounded-2xl bg-[var(--lingo-sky-pale)] p-4 text-sm text-[var(--lingo-navy)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">{convertText(t("Common slip"))}</p>
                <p className="mt-1">{guide.commonMistake}</p>
              </div>
            )}
            {guide?.earContrast && (
              <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--lingo-border)" }}>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">{convertText(t("Ear warm-up"))}</p>
                <p className="mt-1 text-sm text-[var(--lingo-text)]">{guide.earContrast.prompt}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--lingo-navy)]">
                  {convertText(t("Contrast"))}: {guide.earContrast.a} vs {guide.earContrast.b}
                </p>
                <p className="mt-1 text-xs text-[var(--lingo-text-muted)]">
                  Play the model for {row.syllable}, then say both contrasts out loud before recording.
                </p>
              </div>
            )}
          </>
        )}

        {tab === "challenge" && (
          <>
            <h2 className="text-sm font-bold text-[var(--lingo-navy)]">{convertText(t("Practice this sound"))}</h2>
            <p className="mt-2 text-sm text-[var(--lingo-text-muted)]">
              We&apos;ll build a short word + sentence session around {convertText(row.syllable)}
              {row.example_sentence ? `, using contexts like “${convertText(row.example_sentence)}”.` : "."}
            </p>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              disabled={starting}
              onClick={() => void startPractice()}
              className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "var(--lingo-accent-gradient)" }}
            >
              {convertText(t(starting ? "Preparing" : "Start focused practice →"))}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
