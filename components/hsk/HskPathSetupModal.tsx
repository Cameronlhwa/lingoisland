"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  MOTIVATION_BUCKETS,
  getHskInterestCategories,
  type HskMotivation,
} from "@/components/Onboarding/hsk/hskPersonalizationContent";
import HskVocabChecklist from "@/components/Onboarding/hsk/HskVocabChecklist";
import {
  HSK_CARD_SHADOW,
  HSK_BTN_GRADIENT,
  HSK_BTN_SHADOW,
} from "@/lib/glossy-theme";

const NAVY = "#071E2E";
const MUTED = "#5A7A90";
const BORDER = "#C2DCF0";

type Step = "checklist" | "motivation" | "interests" | "personalize" | "generating";

/**
 * Blocking setup for existing HSK-Pro users who never ran onboarding.
 */
export default function HskPathSetupModal({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("checklist");
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [targetLevel, setTargetLevel] = useState<number>(2);
  const [motivation, setMotivation] = useState<HskMotivation | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [personalizationText, setPersonalizationText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setStep("generating");
    setError(null);
    try {
      const answers = await fetch("/api/hsk/onboarding-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLevel,
          levelSource: "checklist",
          targetLevel,
          motivation,
          personalizationText,
          interests,
        }),
      });
      if (!answers.ok) throw new Error("Couldn't save your answers");

      const res = await fetch("/api/hsk/curriculum/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Couldn't build your path");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStep("personalize");
    }
  };

  const card = "w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8";
  const pill = "rounded-full border px-4 py-2 text-sm font-medium transition-colors";
  const btn =
    "flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";
  const interestCategories = getHskInterestCategories(targetLevel);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto px-4 py-10"
      style={{ background: "rgba(7,30,46,0.55)", backdropFilter: "blur(3px)" }}
    >
      <div className={card} style={{ boxShadow: HSK_CARD_SHADOW }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "#42b9b4" }}>
          Set up My HSK Path
        </p>

        {step === "checklist" && (
          <div className="mt-3">
            <HskVocabChecklist
              onComplete={({ estimatedLevel, targetLevel: nextTarget }) => {
                setCurrentLevel(estimatedLevel);
                setTargetLevel(nextTarget);
                setStep("motivation");
              }}
            />
          </div>
        )}

        {step === "motivation" && (
          <>
            <h2 className="mt-2 text-xl font-bold" style={{ color: NAVY, fontFamily: "'Lora', Georgia, serif" }}>
              What brings you to HSK prep?
            </h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {MOTIVATION_BUCKETS.map((b) => {
                const Icon = b.icon;
                const on = motivation === b.value;
                return (
                  <button
                    key={b.value}
                    className={`${pill} inline-flex items-center gap-2`}
                    style={{
                      borderColor: on ? NAVY : BORDER,
                      background: on ? NAVY : "white",
                      color: on ? "white" : NAVY,
                    }}
                    onClick={() => {
                      setMotivation(b.value);
                      setStep("interests");
                    }}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    {b.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === "interests" && (
          <>
            <h2 className="mt-2 text-xl font-bold" style={{ color: NAVY, fontFamily: "'Lora', Georgia, serif" }}>
              Which of these are you into?
            </h2>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>
              Pick at least five — each unit of your path leans on a different one.
            </p>
            <div className="mt-5 max-h-[48vh] space-y-5 overflow-y-auto pr-1">
              {interestCategories.map((category) => (
                <section key={category.label}>
                  <h3 className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: MUTED }}>
                    {category.label}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2.5">
                    {category.options.map((opt) => {
                      const Icon = opt.icon;
                      const on = interests.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          className={`${pill} inline-flex items-center gap-2`}
                          style={{
                            borderColor: on ? NAVY : BORDER,
                            background: on ? NAVY : "white",
                            color: on ? "white" : NAVY,
                          }}
                          onClick={() =>
                            setInterests((p) =>
                              p.includes(opt.value)
                                ? p.filter((v) => v !== opt.value)
                                : [...p, opt.value],
                            )
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                          {opt.value}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            <button
              className={`${btn} mt-7`}
              style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
              disabled={interests.length < 5}
              onClick={() => setStep("personalize")}
            >
              Continue
            </button>
          </>
        )}

        {step === "personalize" && (
          <>
            <h2 className="mt-2 text-xl font-bold" style={{ color: NAVY, fontFamily: "'Lora', Georgia, serif" }}>
              Anything else we should know?
            </h2>
            <p className="mt-2 text-sm" style={{ color: MUTED }}>
              A sentence or two about what you want to do in Mandarin — we&apos;ll
              theme your units around it.
            </p>
            <textarea
              className="mt-4 w-full rounded-lg border p-4 text-sm"
              style={{ borderColor: BORDER, color: NAVY, minHeight: 110 }}
              placeholder="I want to follow C-dramas without subtitles and chat with my in-laws…"
              value={personalizationText}
              onChange={(e) => setPersonalizationText(e.target.value)}
            />
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <button
              className={`${btn} mt-6`}
              style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
              disabled={personalizationText.trim().length === 0}
              onClick={submit}
            >
              Build my path
            </button>
          </>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: NAVY }} />
            <p className="mt-4 text-sm" style={{ color: MUTED }}>
              Building your first unit…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
