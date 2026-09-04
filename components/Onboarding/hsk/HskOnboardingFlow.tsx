"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import {
  MOTIVATION_BUCKETS,
  PERSONALIZATION_CONTENT,
  getHskInterestCategories,
  type HskMotivation,
} from "./hskPersonalizationContent";
import HskPlanReveal, { type HskGenerationResult } from "./HskPlanReveal";
import HskVocabChecklist from "./HskVocabChecklist";
import { formatHskLevel } from "@/lib/utils/hsk";
import {
  HSK_PATH_LEVEL_OPTIONS,
  nextHskPathTargetLevel,
} from "@/lib/hsk/pathStandard";
import { getLocalDateKey } from "@/lib/utils/date";
import {
  HSK_CARD_SHADOW,
  HSK_BTN_GRADIENT,
  HSK_BTN_SHADOW,
} from "@/lib/glossy-theme";

const NAVY = "#071E2E";
const BLUE = "#2176AE";
const CARD_BORDER = "#C2DCF0";

const CARD = "w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8";
const BTN_PRIMARY =
  "flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100 sm:text-base";
const OPTION_ROW =
  "flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left transition-all hover:bg-[#F4FAFD]";
const PILL_OFF =
  "rounded-full border px-4 py-2 text-sm font-medium transition-colors";

type Step =
  | "taken-before"
  | "official-level"
  | "checklist"
  | "exam-timing"
  | "daily-time"
  | "personalize"
  | "interests"
  | "generating"
  | "reveal";

type TimeLabel = "5min" | "15min" | "30min" | "1h+";
const TIME_OPTIONS: { value: TimeLabel; label: string; sublabel: string }[] = [
  { value: "5min", label: "5 minutes", sublabel: "A quick daily habit" },
  { value: "15min", label: "15 minutes", sublabel: "Steady, sustainable pace" },
  { value: "30min", label: "30 minutes", sublabel: "Serious, focused progress" },
  { value: "1h+", label: "1 hour+", sublabel: "Fast-tracking it" },
];

const LEVEL_OPTIONS = HSK_PATH_LEVEL_OPTIONS;

const DRAFT_KEY = "hsk_onboarding_draft_v2";
const FLOW_PATH = "/onboarding/hsk";

type Draft = {
  v: 1;
  step: Step;
  officialLevel: number | null;
  showTargetPicker: boolean;
  targetLevel: number;
  currentLevel: number;
  levelSource: "official" | "checklist";
  examPlanned: boolean | null;
  testDate: string;
  timeLabel: TimeLabel | null;
  motivation: HskMotivation | null;
  personalizationText: string;
  interests: string[];
  pickerMode: boolean;
  selectedChips: string[];
  checkoutPlan?: "monthly" | "yearly";
  result: HskGenerationResult | null;
};

export default function HskOnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const todayMin = useMemo(() => getLocalDateKey(), []);

  const [step, setStep] = useState<Step>("taken-before");
  const [error, setError] = useState<string | null>(null);

  // A1
  const [officialLevel, setOfficialLevel] = useState<number | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [levelSource, setLevelSource] = useState<"official" | "checklist">(
    "checklist",
  );
  const [showTargetPicker, setShowTargetPicker] = useState(false);

  // A2 — defaulted imperatively (one band above current level) at the point
  // each A1 path resolves currentLevel, not reactively, so it can't race the
  // draft-resume effect below.
  const [targetLevel, setTargetLevel] = useState<number>(2);

  // Exam timing — taking a real HSK exam (with a date) vs. learning casually.
  const [examPlanned, setExamPlanned] = useState<boolean | null>(null);
  const [testDate, setTestDate] = useState("");

  // A3
  const [timeLabel, setTimeLabel] = useState<TimeLabel | null>(null);

  // A4/A5
  const [motivation, setMotivation] = useState<HskMotivation | null>(null);
  const [personalizationText, setPersonalizationText] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [pickerMode, setPickerMode] = useState(false);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);

  // A6 / B
  const [result, setResult] = useState<HskGenerationResult | null>(null);
  const [generationComplete, setGenerationComplete] = useState(false);
  const generateStartedRef = useRef(false);
  const draftResumeRef = useRef(false);

  // Resume after Stripe cancel / OAuth round-trip mid-checkout.
  useEffect(() => {
    if (typeof window === "undefined" || draftResumeRef.current) return;
    const fromStripe =
      typeof document !== "undefined" &&
      /checkout\.stripe\.com/i.test(document.referrer);
    const shouldResume =
      searchParams.get("resume") === "1" ||
      searchParams.get("autoCheckout") === "1" ||
      searchParams.get("canceled") === "1" ||
      fromStripe;
    if (!shouldResume) return;
    draftResumeRef.current = true;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Draft;
        setOfficialLevel(d.officialLevel ?? null);
        setShowTargetPicker(!!d.showTargetPicker);
        setTargetLevel(d.targetLevel);
        setCurrentLevel(d.currentLevel);
        setLevelSource(d.levelSource === "official" ? "official" : "checklist");
        setExamPlanned(d.examPlanned);
        setTestDate(d.testDate ?? "");
        setTimeLabel(d.timeLabel);
        setMotivation(d.motivation);
        setPersonalizationText(d.personalizationText ?? "");
        setInterests(Array.isArray(d.interests) ? d.interests : []);
        setPickerMode(!!d.pickerMode);
        setSelectedChips(d.selectedChips ?? []);
        setResult(d.result);
        // Prefer reveal when we have a generated plan (Stripe back / checkout).
        if (d.result && (d.motivation || d.timeLabel)) {
          setStep("reveal");
        } else if (d.step) {
          setStep(d.step);
        }
      }
    } catch {
      // ignore malformed draft
    }
    const plan = searchParams.get("plan");
    const auto = searchParams.get("autoCheckout") === "1" ? "1" : "0";
    const qs =
      auto === "1"
        ? `?autoCheckout=1${plan === "monthly" || plan === "yearly" ? `&plan=${plan}` : ""}`
        : "";
    router.replace(`${FLOW_PATH}${qs}`);
  }, [searchParams, router]);

  const persistDraft = useCallback(
    (overrides: Partial<Draft> = {}) => {
      try {
        const draft: Draft = {
          v: 1,
          step,
          officialLevel,
          showTargetPicker,
          targetLevel,
          currentLevel,
          levelSource,
          examPlanned,
          testDate,
          timeLabel,
          motivation,
          personalizationText,
          interests,
          pickerMode,
          selectedChips,
          result,
          ...overrides,
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // sessionStorage blocked
      }
    },
    [
      step,
      officialLevel,
      showTargetPicker,
      targetLevel,
      currentLevel,
      levelSource,
      examPlanned,
      testDate,
      timeLabel,
      motivation,
      personalizationText,
      interests,
      pickerMode,
      selectedChips,
      result,
    ],
  );

  // Keep onboarding progress warm so Stripe cancel / refresh can restore it.
  useEffect(() => {
    if (step === "taken-before" && !result) return;
    persistDraft();
  }, [persistDraft, step, result]);

  const variant = motivation ? PERSONALIZATION_CONTENT[motivation] : null;

  const insertChip = (phrase: string) => {
    setPersonalizationText((prev) => {
      const trimmed = prev.trim();
      return trimmed.length > 0 ? `${trimmed} ${phrase}` : phrase;
    });
  };

  const toggleChip = (label: string) => {
    setSelectedChips((prev) =>
      prev.includes(label) ? prev.filter((c) => c !== label) : [...prev, label],
    );
  };

  useEffect(() => {
    if (!pickerMode) return;
    setPersonalizationText(
      selectedChips.length > 0 ? `Interested in: ${selectedChips.join(", ")}.` : "",
    );
  }, [pickerMode, selectedChips]);

  const runGeneration = async () => {
    setError(null);
    try {
      let {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { data: anonData, error: anonErr } =
          await supabase.auth.signInAnonymously();
        if (anonErr) {
          throw new Error(anonErr.message || "Could not start a guest session");
        }
        user = anonData.user;
      }
      if (!user) throw new Error("Could not start a guest session");

      const minsMap: Record<string, number> = {
        "5min": 5,
        "15min": 15,
        "30min": 30,
        "1h+": 60,
      };
      const mins = minsMap[timeLabel ?? "15min"] ?? 15;
      const wordsPerWeek = Math.round((mins / 15) * 4 * 10);

      await fetch("/api/hsk/onboarding-answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentLevel,
          levelSource,
          targetLevel,
          motivation,
          personalizationText,
          interests,
          dailyTimeMinutes: mins,
          testDate: examPlanned && testDate ? testDate : null,
        }),
      });

      const res = await fetch("/api/hsk/curriculum/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Could not build your path");
      }

      const nextResult: HskGenerationResult = {
        curriculumId: data.curriculum?.id,
        unit1JourneyId: data.unit1JourneyId ?? null,
        framingPhrase: interests[0] || "Your HSK Path",
        journeyTitle: `Your ${formatHskLevel(targetLevel)} path`,
        wordsPerWeek,
        units: (data.units ?? []).map(
          (u: {
            unit_number: number;
            title: string;
            title_zh: string | null;
            milestone_level: number;
            status: string;
          }) => ({
            unit_number: u.unit_number,
            title: u.title,
            title_zh: u.title_zh,
            milestone_level: u.milestone_level,
            status: u.status,
          }),
        ),
      };
      setResult(nextResult);
      persistDraft({ result: nextResult, step: "reveal" });
      setGenerationComplete(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      generateStartedRef.current = false;
      setGenerationComplete(false);
      setStep("personalize");
    }
  };

  useEffect(() => {
    if (step !== "generating" || generateStartedRef.current) return;
    generateStartedRef.current = true;
    setGenerationComplete(false);
    void runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const isReveal = step === "reveal";

  return (
    <div
      className={`relative flex min-h-screen flex-col items-center px-3 sm:px-4 ${
        isReveal ? "justify-center py-4 sm:py-6" : "justify-center overflow-hidden py-10"
      }`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#EAF6FB" }}
    >
      {/* Viewport-pinned only — never stretch with tall reveal content */}
      <div
        aria-hidden
        className="hsk-onboarding-bg pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "url(/hskprep/hsk-onboarding-bg.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 40%",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background: isReveal
            ? "radial-gradient(ellipse 65% 50% at 50% 30%, rgba(255,255,255,0.72) 0%, rgba(234,246,251,0.45) 55%, rgba(234,246,251,0.85) 100%)"
            : "radial-gradient(ellipse 70% 55% at 50% 38%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.22) 45%, transparent 72%)",
        }}
      />

      <div className={`relative z-10 flex w-full flex-col items-center ${isReveal ? "max-w-[900px]" : "max-w-[1100px]"}`}>
      {step === "taken-before" && (
        <div className={CARD} style={{ boxShadow: HSK_CARD_SHADOW }}>
          <Heading>Have you taken the HSK before?</Heading>
          <div className="mt-6 flex flex-col gap-3">
            <button
              className={OPTION_ROW}
              style={{ boxShadow: HSK_CARD_SHADOW }}
              onClick={() => {
                setShowTargetPicker(false);
                setOfficialLevel(null);
                setStep("official-level");
              }}
            >
              <span className="font-medium" style={{ color: NAVY }}>
                Yes — I know my level
              </span>
            </button>
            <button
              className={OPTION_ROW}
              style={{ boxShadow: HSK_CARD_SHADOW }}
              onClick={() => {
                setShowTargetPicker(false);
                setStep("checklist");
              }}
            >
              <span className="font-medium" style={{ color: NAVY }}>
                No, not yet
              </span>
            </button>
          </div>
        </div>
      )}

      {step === "official-level" && (
        <div className={CARD} style={{ boxShadow: HSK_CARD_SHADOW }}>
          <Heading>Which level did you pass?</Heading>
          <select
            className="mt-6 w-full rounded-lg border px-4 py-3 text-sm"
            style={{ borderColor: CARD_BORDER, color: NAVY }}
            value={officialLevel ?? ""}
            onChange={(e) => {
              const level = Number(e.target.value);
              setOfficialLevel(level);
              setCurrentLevel(level);
              setLevelSource("official");
              setTargetLevel(nextHskPathTargetLevel(level));
              setShowTargetPicker(true);
            }}
          >
            <option value="" disabled>
              Select a level
            </option>
            {LEVEL_OPTIONS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {formatHskLevel(lvl)}
              </option>
            ))}
          </select>

          {showTargetPicker && officialLevel != null && (
            <TargetLevelPicker
              targetLevel={targetLevel}
              onTargetLevelChange={setTargetLevel}
              onContinue={() => setStep("exam-timing")}
            />
          )}
        </div>
      )}

      {step === "checklist" && (
        <div className={CARD} style={{ boxShadow: HSK_CARD_SHADOW, maxWidth: 640 }}>
          <HskVocabChecklist
            onComplete={({ estimatedLevel, targetLevel: nextTarget }) => {
              setCurrentLevel(estimatedLevel);
              setTargetLevel(nextTarget);
              setLevelSource("checklist");
              setStep("exam-timing");
            }}
          />
        </div>
      )}

      {step === "exam-timing" && (
        <div className={CARD} style={{ boxShadow: HSK_CARD_SHADOW }}>
          <Heading>Are you taking the HSK exam?</Heading>
          <p className="mt-2 text-sm" style={{ color: "#5A7A90" }}>
            So we can help you pace toward test day — or you can just take it
            at your own speed.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <button
              className={OPTION_ROW}
              style={{
                boxShadow: HSK_CARD_SHADOW,
                ...(examPlanned === true
                  ? { borderColor: NAVY, borderWidth: 2 }
                  : {}),
              }}
              onClick={() => setExamPlanned(true)}
            >
              <span className="font-medium" style={{ color: NAVY }}>
                Yes, I have a test date in mind
              </span>
            </button>
            <button
              className={OPTION_ROW}
              style={{ boxShadow: HSK_CARD_SHADOW }}
              onClick={() => {
                setExamPlanned(false);
                setTestDate("");
                setStep("daily-time");
              }}
            >
              <span className="font-medium" style={{ color: NAVY }}>
                No, I'm just learning casually
              </span>
            </button>
          </div>

          {examPlanned === true && (
            <div className="mt-4">
              <input
                type="date"
                className="w-full rounded-lg border px-4 py-3 text-sm"
                style={{ borderColor: CARD_BORDER, color: NAVY }}
                value={testDate}
                min={todayMin}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next && next < todayMin) return;
                  setTestDate(next);
                }}
              />
              <button
                className={`${BTN_PRIMARY} mt-4`}
                style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
                disabled={!testDate || testDate < todayMin}
                onClick={() => setStep("daily-time")}
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {step === "daily-time" && (
        <div className={CARD} style={{ boxShadow: HSK_CARD_SHADOW }}>
          <Heading>How much time can you study each day?</Heading>
          <div className="mt-6 flex flex-col gap-3">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={OPTION_ROW}
                style={{ boxShadow: HSK_CARD_SHADOW }}
                onClick={() => {
                  setTimeLabel(opt.value);
                  setStep("personalize");
                }}
              >
                <div>
                  <div className="font-medium" style={{ color: NAVY }}>{opt.label}</div>
                  <div className="text-xs" style={{ color: "#5A7A90" }}>{opt.sublabel}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "personalize" && (
        <div className={CARD} style={{ boxShadow: HSK_CARD_SHADOW, maxWidth: 640 }}>
          <Heading>What brings you to HSK prep?</Heading>
          <div className="mt-5 flex flex-wrap gap-3">
            {MOTIVATION_BUCKETS.map((bucket) => {
              const on = motivation === bucket.value;
              const Icon = bucket.icon;
              return (
                <button
                  key={bucket.value}
                  className={`${PILL_OFF} inline-flex items-center gap-2`}
                  style={{
                    borderColor: on ? NAVY : CARD_BORDER,
                    background: on ? NAVY : "white",
                    color: on ? "white" : NAVY,
                  }}
                  onClick={() => {
                    setMotivation(bucket.value);
                    setPickerMode(false);
                    setSelectedChips([]);
                    setPersonalizationText("");
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                  {bucket.label}
                </button>
              );
            })}
          </div>

          {variant && (
            <div className="mt-6">
              <h3
                className="text-lg font-bold"
                style={{ fontFamily: "'Lora', Georgia, serif", color: NAVY }}
              >
                {variant.headline}
              </h3>
              <p className="mt-1.5 text-sm" style={{ color: "#5A7A90" }}>
                {variant.subtext}
              </p>

              {!pickerMode ? (
                <>
                  <textarea
                    className="mt-4 w-full rounded-lg border p-4 text-sm"
                    style={{ borderColor: CARD_BORDER, color: NAVY, minHeight: 110 }}
                    placeholder={variant.placeholder}
                    value={personalizationText}
                    onChange={(e) => setPersonalizationText(e.target.value)}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {variant.chips.map((chip) => {
                      const Icon = chip.icon;
                      return (
                        <button
                          key={chip.label}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[#F4FAFD]"
                          style={{ borderColor: CARD_BORDER, color: NAVY }}
                          onClick={() => insertChip(chip.phrase)}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs" style={{ color: "#8AABBF" }}>
                    tapping a chip inserts a starter phrase — still their own words
                  </p>
                  <button
                    className="mt-3 text-sm font-medium underline-offset-2 hover:underline"
                    style={{ color: BLUE }}
                    onClick={() => setPickerMode(true)}
                  >
                    Prefer to just pick a few things instead? →
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {variant.chips.map((chip) => {
                      const on = selectedChips.includes(chip.label);
                      const Icon = chip.icon;
                      return (
                        <button
                          key={chip.label}
                          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors"
                          style={{
                            borderColor: on ? NAVY : CARD_BORDER,
                            background: on ? NAVY : "white",
                            color: on ? "white" : NAVY,
                          }}
                          onClick={() => toggleChip(chip.label)}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="mt-3 text-sm font-medium underline-offset-2 hover:underline"
                    style={{ color: BLUE }}
                    onClick={() => {
                      setPickerMode(false);
                      setSelectedChips([]);
                      setPersonalizationText("");
                    }}
                  >
                    ← Back to writing my own
                  </button>
                </>
              )}

              <button
                className={`${BTN_PRIMARY} mt-6`}
                style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
                disabled={personalizationText.trim().length === 0}
                onClick={() => setStep("interests")}
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {step === "interests" && (
        <div className={CARD} style={{ boxShadow: HSK_CARD_SHADOW, maxWidth: 640 }}>
          <Heading>Which of these are you into?</Heading>
          <p className="mt-2 text-sm" style={{ color: "#5A7A90" }}>
            Pick at least five — each unit of your path leans on a different
            one, so the vocabulary shows up in scenes you actually care about.
          </p>
          <div className="mt-5 max-h-[48vh] space-y-5 overflow-y-auto pr-1">
            {getHskInterestCategories(targetLevel).map((category) => (
              <section key={category.label}>
                <h3
                  className="text-xs font-bold uppercase tracking-[0.1em]"
                  style={{ color: "#5A7A90" }}
                >
                  {category.label}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2.5">
                  {category.options.map((opt) => {
                    const on = interests.includes(opt.value);
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        className={`${PILL_OFF} inline-flex items-center gap-2`}
                        style={{
                          borderColor: on ? NAVY : CARD_BORDER,
                          background: on ? NAVY : "white",
                          color: on ? "white" : NAVY,
                        }}
                        onClick={() =>
                          setInterests((prev) =>
                            prev.includes(opt.value)
                              ? prev.filter((v) => v !== opt.value)
                              : [...prev, opt.value],
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
            className={`${BTN_PRIMARY} mt-7`}
            style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
            disabled={interests.length < 5}
            onClick={() => setStep("generating")}
          >
            Build my path
          </button>
        </div>
      )}

      {step === "generating" && (
        <div className={CARD} style={{ boxShadow: HSK_CARD_SHADOW }}>
          <div className="flex flex-col items-center py-6 text-center">
            <GeneratingProgressBar
              active
              complete={generationComplete}
              onFinished={() => setStep("reveal")}
            />
            <h2
              className="mt-5 text-xl font-bold"
              style={{ fontFamily: "'Lora', Georgia, serif", color: NAVY }}
            >
              Building your {formatHskLevel(targetLevel)} path…
            </h2>
            <p className="mt-2 text-sm" style={{ color: "#5A7A90" }}>
              Pulling real HSK vocabulary and organizing it into personalized units.
            </p>
            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>
      )}

      {step === "reveal" && result && motivation && timeLabel && (
        <HskPlanReveal
          result={result}
          targetLevel={targetLevel}
          currentLevel={currentLevel}
          timeLabel={timeLabel}
          motivation={motivation}
          testDate={examPlanned && testDate ? testDate : null}
          returnPath={FLOW_PATH}
          autoCheckout={searchParams.get("autoCheckout") === "1"}
          initialPlan={
            searchParams.get("plan") === "yearly"
              ? "yearly"
              : searchParams.get("plan") === "monthly"
                ? "monthly"
                : undefined
          }
        />
      )}
      </div>
    </div>
  );
}

function TargetLevelPicker({
  targetLevel,
  onTargetLevelChange,
  onContinue,
}: {
  targetLevel: number;
  onTargetLevelChange: (level: number) => void;
  onContinue: () => void;
}) {
  return (
    <div className="mt-4">
      <label
        className="block text-sm font-medium"
        style={{ color: NAVY, fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        Which HSK level are you preparing for?
      </label>
      <select
        className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
        style={{ borderColor: CARD_BORDER, color: NAVY }}
        value={targetLevel}
        onChange={(e) => onTargetLevelChange(Number(e.target.value))}
      >
        {LEVEL_OPTIONS.map((lvl) => (
          <option key={lvl} value={lvl}>
            {formatHskLevel(lvl)}
          </option>
        ))}
      </select>
      <button
        className={`${BTN_PRIMARY} mt-4`}
        style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
        onClick={onContinue}
      >
        Continue
      </button>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-xl font-bold"
      style={{ fontFamily: "'Lora', Georgia, serif", color: NAVY }}
    >
      {children}
    </h2>
  );
}

/**
 * Progress bar: quick climb to ~80%, then a slow crawl while waiting,
 * then a fast finish to 100% once generation is done.
 */
function GeneratingProgressBar({
  active,
  complete,
  onFinished,
}: {
  active: boolean;
  complete: boolean;
  onFinished: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const completeRef = useRef(complete);
  const finishedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  const startRef = useRef(0);

  completeRef.current = complete;
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!active) {
      progressRef.current = 0;
      setProgress(0);
      finishedRef.current = false;
      return;
    }

    startRef.current = performance.now();
    finishedRef.current = false;
    let raf = 0;

    const tick = (now: number) => {
      let next = progressRef.current;

      if (completeRef.current) {
        // Fast finish to 100 once the API is done.
        next = Math.min(100, next + Math.max(2.5, (100 - next) * 0.18));
        if (next >= 99.5) next = 100;
      } else {
        const elapsed = (now - startRef.current) / 1000;
        if (elapsed < 1.8) {
          // Fast ease-out toward 80%.
          const u = elapsed / 1.8;
          const eased = 1 - Math.pow(1 - u, 2.4);
          next = eased * 80;
        } else {
          // Slow crawl from 80 → ~92 while waiting.
          const creep = Math.min(12, (elapsed - 1.8) * 0.9);
          next = 80 + creep;
        }
      }

      progressRef.current = next;
      setProgress(next);

      if (next >= 100) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          onFinishedRef.current();
        }
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <div className="w-full max-w-xs">
      <div
        className="h-2.5 w-full overflow-hidden rounded-full"
        style={{ background: "#E0F0F8" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${BLUE}, #59C6DE)`,
            boxShadow: "0 0 12px rgba(33,118,174,0.35)",
            transition: "width 80ms linear",
          }}
        />
      </div>
    </div>
  );
}
