"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import AppLogo from "@/components/app/AppLogo";
import OnboardingUpgradeClient from "@/app/onboarding/upgrade/OnboardingUpgradeClient";
import { Loader2 } from "lucide-react";
import { getTopicSuggestions } from "@/lib/onboarding/topicSuggestions";
import {
  buildUpgradePageUrl,
} from "@/lib/onboarding/onboardingCheckoutStorage";
import {
  HSK_CARD_SHADOW,
  HSK_BTN_GRADIENT,
  HSK_BTN_SHADOW,
  LINGO_ACCENT_GRADIENT_GLOSSY,
  LINGO_ACCENT_CHIP_SHADOW,
} from "@/lib/glossy-theme";
import {
  JOURNEY_LEVEL_OPTIONS,
  cefrFromProfile,
  hskProfileFieldsFromCefr,
  type CefrLevel,
} from "@/lib/levelBands";

const NAVY = "#071E2E";
const BLUE = "#2176AE";
const MUTED = "#5A7A90";
const CARD_BORDER = "#C2DCF0";
const FONT_BODY = "'DM Sans', system-ui, sans-serif";
const FONT_DISPLAY = "'Lora', Georgia, serif";

const CARD = "w-full rounded-3xl bg-white p-6 sm:p-8";

/** Primary actions — glossy navy CTA (shared with HSK onboarding / landing) */
const BTN_PRIMARY =
  "flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100 sm:text-base";

/** Outline / chip — unselected */
const CHIP_OFF =
  "rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-[#F4FAFD]";

/** Chip — selected */
const CHIP_ON =
  "rounded-full border-0 px-4 py-2 text-sm font-medium text-white transition-colors";

/** “Why” & similar option rows */
const OPTION_ROW =
  "flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left transition-all hover:bg-[#F4FAFD]";

const WHY_OPTIONS = [
  {
    key: "work",
    label: "Work",
    sublabel: "Chinese colleagues, clients, or a Chinese market",
  },
  {
    key: "travel",
    label: "Travel",
    sublabel: "I'm going somewhere Mandarin is spoken",
  },
  {
    key: "heritage",
    label: "Heritage",
    sublabel: "Connect with family or my roots",
  },
  {
    key: "media",
    label: "Culture",
    sublabel: "Food, film, music, or history",
  },
  {
    key: "fluency",
    label: "Just curious",
    sublabel: "I want to see if I like it",
  },
] as const;

const BRANCH_OPTIONS: Record<
  string,
  { question: string; options: { key: string; label: string }[] }
> = {
  work: {
    question: "What would feel like a real win for you at work?",
    options: [
      {
        key: "meeting",
        label: "Hold my own in a meeting with Chinese colleagues",
      },
      {
        key: "clients",
        label: "Build better relationships with Chinese clients",
      },
      {
        key: "documents",
        label: "Read emails or documents without Google Translate",
      },
      {
        key: "impress",
        label: "Impress someone — a boss, a partner, a client",
      },
    ],
  },
  travel: {
    question: "What do you want to feel confident doing when you're there?",
    options: [
      {
        key: "getaround",
        label:
          "Order food and get around without relying on translation apps",
      },
      {
        key: "converse",
        label: "Have real conversations with locals, not just transactions",
      },
      {
        key: "navigate",
        label:
          "Navigate cities, transport, and accommodation independently",
      },
      {
        key: "connect",
        label:
          "Actually connect with people and understand what's happening around me",
      },
    ],
  },
  heritage: {
    question: "Who are you hoping to connect with more?",
    options: [
      { key: "grandparents", label: "My parents or grandparents" },
      { key: "family", label: "Extended family at gatherings" },
      { key: "community", label: "A wider community or neighbourhood" },
      {
        key: "roots",
        label: "I want to understand my roots, not just communicate",
      },
    ],
  },
  media: {
    question: "What draws you most?",
    options: [
      { key: "food", label: "Food — menus, recipes, food culture" },
      {
        key: "tv",
        label:
          "Film and TV — I watch Chinese content and want to follow along",
      },
      { key: "music", label: "Music — Mandopop or C-pop" },
      {
        key: "history",
        label: "History and culture — I want to go deeper",
      },
    ],
  },
  fluency: {
    question: "What sparked your curiosity?",
    options: [
      { key: "visiting", label: "I'm visiting China or Taiwan soon" },
      {
        key: "friends",
        label:
          "I have Chinese friends or colleagues I want to connect with",
      },
      {
        key: "curious",
        label: "I've always been curious about the language",
      },
      { key: "someone", label: "Someone close to me speaks it" },
    ],
  },
};

type WhyKey = (typeof WHY_OPTIONS)[number]["key"];

const A0_TOPIC = "Introducing Yourself";

const TOPIC_PLACEHOLDER_TEXT = "Type any topic you want here!";

const GEN_STEPS = [
  "Analyzing your topic…",
  "Finding sub-topics…",
  "Building your island path…",
  "Writing story ideas…",
  "Finalizing your plan…",
];

const HARDCODED_TIME_LABEL = "15min";
const HARDCODED_DAILY_MINUTES = 15;
const HARDCODED_DAYS_PER_WEEK = 4;

type Step =
  | "level"
  | "why"
  | "branch"
  | "topic"
  | "generating"
  | "upgrade";

function whyKeyFromProfile(
  goal: string | null | undefined,
): WhyKey | "" {
  const g = (goal ?? "").toLowerCase();
  if (!g) return "";
  if (g.includes("work")) return "work";
  if (g.includes("travel") || g.includes("trip")) return "travel";
  if (g.includes("family") || g.includes("heritage")) return "heritage";
  if (g.includes("media") || g.includes("show") || g.includes("music") || g.includes("culture"))
    return "media";
  return "fluency";
}

function whyLabel(whyKey: WhyKey | ""): string {
  return WHY_OPTIONS.find((o) => o.key === whyKey)?.label ?? "General fluency improvement";
}

function branchLabel(whyKey: WhyKey | "", branchAnswer: string): string {
  const branch = BRANCH_OPTIONS[whyKey || "fluency"];
  return branch?.options.find((option) => option.key === branchAnswer)?.label ?? "";
}

/**
 * Journey setup wizard. On the public surface (`/onboarding/journey`), the
 * answers personalize the subscription screen instead of creating a journey.
 */
export default function JourneyOnboardingFlow({
  publicSurface = false,
  smartProfileSkip = false,
  collectProfileQuestions = true,
}: {
  publicSurface?: boolean;
  smartProfileSkip?: boolean;
  collectProfileQuestions?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Stub HSK entry point (?track=hsk from /app/hskprep's CTA) — writes just
  // enough to user_profiles to make the in-app HSK track reachable for
  // testing. Not the real HSK onboarding UX, which is a separate prompt.
  const hskTrack = searchParams.get("track") === "hsk";
  const supabase = useMemo(() => createClient(), []);
  const urlTopicSynced = useRef(false);
  const islandFromUrl = searchParams.get("islandId")?.trim() || null;
  const [step, setStep] = useState<Step>("level");
  const [topic, setTopic] = useState("");
  const [cefrLevel, setCefrLevel] = useState<CefrLevel | "">("");
  const [levelSaving, setLevelSaving] = useState(false);
  const [whyKey, setWhyKey] = useState<WhyKey | "">("");
  const [branchAnswer, setBranchAnswer] = useState("");
  const [generatingStep, setGeneratingStep] = useState(0);
  const generateStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const [profileLoaded, setProfileLoaded] = useState(!smartProfileSkip);
  const [needsLevel, setNeedsLevel] = useState(!smartProfileSkip);
  const [needsWhy, setNeedsWhy] = useState(!smartProfileSkip);
  const [profileLearningGoal, setProfileLearningGoal] = useState("");

  const topicSuggestions = useMemo(
    () => getTopicSuggestions(whyKey || "fluency", branchAnswer || "curious"),
    [whyKey, branchAnswer],
  );

  const isA0 = cefrLevel === "A0";
  const [topicPlaceholder, setTopicPlaceholder] = useState(TOPIC_PLACEHOLDER_TEXT);

  const effectiveWhyText =
    whyLabel(whyKey) ||
    profileLearningGoal ||
    "General fluency improvement";

  const upgradePersonalization = useMemo(
    () => ({
      topic: topic.trim() || A0_TOPIC,
      journeyTopic: topic.trim() || A0_TOPIC,
      islandLevel: cefrLevel || "B1",
      wordsLearned: 0,
      wordsPerWeek: 40,
      motivationLabel: whyKey
        ? [whyLabel(whyKey), branchLabel(whyKey, branchAnswer)]
            .filter(Boolean)
            .join(" · ")
        : undefined,
    }),
    [branchAnswer, cefrLevel, topic, whyKey],
  );

  // Legacy ?islandId= links used to resume the free first lesson — send them
  // to the plan reveal / upgrade instead.
  useEffect(() => {
    if (!islandFromUrl || !publicSurface) return;
    router.replace(buildUpgradePageUrl(islandFromUrl));
  }, [islandFromUrl, publicSurface, router]);

  // Deep link: ?topic=… prefills topic and starts at why (skip level only if we already have level from profile later)
  useEffect(() => {
    if (urlTopicSynced.current) return;
    if (searchParams.get("islandId")) return;
    const t = searchParams.get("topic")?.trim();
    if (t) {
      urlTopicSynced.current = true;
      setTopic(t);
      // Entry from landing topic chips: still start at level, topic is pre-filled for later.
      // Spec: "If ?topic= is in the URL, pre-fill topic and skip to why step."
      setStep("why");
    }
  }, [searchParams]);

  // Typewriter placeholder when topic input is empty.
  useEffect(() => {
    if (step !== "topic" || isA0 || topic.trim().length > 0) {
      setTopicPlaceholder(TOPIC_PLACEHOLDER_TEXT);
      return;
    }
    let cancelled = false;
    let charIndex = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelled) return;
      if (!deleting) {
        charIndex = Math.min(TOPIC_PLACEHOLDER_TEXT.length, charIndex + 1);
        setTopicPlaceholder(TOPIC_PLACEHOLDER_TEXT.slice(0, charIndex));
        if (charIndex >= TOPIC_PLACEHOLDER_TEXT.length) {
          deleting = true;
          timeout = setTimeout(tick, 1400);
          return;
        }
        timeout = setTimeout(tick, 45 + Math.floor(Math.random() * 25));
        return;
      }
      charIndex = Math.max(0, charIndex - 1);
      setTopicPlaceholder(TOPIC_PLACEHOLDER_TEXT.slice(0, charIndex));
      if (charIndex === 0) {
        deleting = false;
        timeout = setTimeout(tick, 400);
        return;
      }
      timeout = setTimeout(tick, 22);
    };

    setTopicPlaceholder("");
    timeout = setTimeout(tick, 300);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [step, isA0, topic]);

  useEffect(() => {
    if (!smartProfileSkip) return;
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: up } = await supabase
        .from("user_profiles")
        .select("cefr_level, learning_goal")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const levelExists = !!up?.cefr_level;
      const whyExists =
        typeof up?.learning_goal === "string" && up.learning_goal.length > 0;
      setNeedsLevel(!levelExists);
      setNeedsWhy(!whyExists);
      if (levelExists) {
        setCefrLevel(cefrFromProfile(up?.cefr_level));
      }
      if (whyExists) {
        setProfileLearningGoal(up?.learning_goal ?? "");
        setWhyKey(whyKeyFromProfile(up?.learning_goal));
      }
      setProfileLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [smartProfileSkip, supabase]);

  // When profile already has a level, skip the level question instead of
  // showing it pre-selected (e.g. a stored C1 band).
  useEffect(() => {
    if (!smartProfileSkip || !profileLoaded || step !== "level" || needsLevel) {
      return;
    }
    if (!collectProfileQuestions) {
      if (!whyKey) setWhyKey("fluency");
      if (!branchAnswer) setBranchAnswer("curious");
      setStep("generating");
      return;
    }
    if (needsWhy) setStep("why");
    else setStep("generating");
  }, [
    smartProfileSkip,
    profileLoaded,
    step,
    needsLevel,
    needsWhy,
    collectProfileQuestions,
    whyKey,
    branchAnswer,
  ]);

  useLayoutEffect(() => {
    if (step !== "generating") return;
    setGeneratingStep(0);
    generateStartedRef.current = false;
  }, [step]);

  useEffect(() => {
    // A0 uses fixed backend content, so it does not need simulated
    // generation progress. A1–C1 retain the existing journey animation.
    if (step !== "generating" || isA0) return;
    const steps = GEN_STEPS;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < steps.length; i++) {
      timers.push(setTimeout(() => setGeneratingStep(i + 1), 550 * (i + 1)));
    }
    return () => timers.forEach(clearTimeout);
  }, [step, isA0]);

  useEffect(() => {
    // A0 needs no simulated progress; other levels retain the in-app animation.
    if (
      step !== "generating" ||
      (!isA0 && generatingStep < GEN_STEPS.length)
    )
      return;
    if (generateStartedRef.current) return;
    generateStartedRef.current = true;

    const run = async () => {
      setError(null);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          throw new Error("Could not load your account. Please try again.");
        }

        if (smartProfileSkip) {
          const updates: Record<string, unknown> = {};
          if (needsLevel && cefrLevel) {
            updates.cefr_level = cefrLevel;
            Object.assign(
              updates,
              hskProfileFieldsFromCefr(cefrLevel, { setTarget: hskTrack }),
            );
            if (hskTrack) updates.product_track = "hsk";
          }
          if (needsWhy && effectiveWhyText)
            updates.learning_goal = effectiveWhyText;
          if (Object.keys(updates).length > 0) {
            await supabase
              .from("user_profiles")
              .update(updates)
              .eq("user_id", user.id);
          }
        }

        const res = await fetch("/api/journey/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.trim() || A0_TOPIC,
            why: effectiveWhyText,
            level: cefrLevel || "B1",
            cefrLevel: cefrLevel || "B1",
            dailyMinutes: HARDCODED_DAILY_MINUTES,
            learningGoal: effectiveWhyText,
            timeLabel: HARDCODED_TIME_LABEL,
            daysPerWeek: HARDCODED_DAYS_PER_WEEK,
            track: hskTrack ? "hsk" : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not create journey");
        }

        // Unauthenticated preview path should not happen after anonymous auth,
        // but if it does, treat as error and retry.
        if (data?.preview?.journey && !data.journeyId) {
          throw new Error("Please try again — session not ready");
        }

        if (!data.journeyId) {
          throw new Error("Could not create journey");
        }

        await supabase
          .from("profiles")
          .update({ onboarding_complete: true })
          .eq("id", user.id);
        router.push("/app/journey");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        if (isA0) {
          setStep("topic");
        } else if (whyKey) {
          setStep("topic");
        } else {
          setStep("level");
        }
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step,
    generatingStep,
    smartProfileSkip,
    supabase,
    needsLevel,
    needsWhy,
    cefrLevel,
    effectiveWhyText,
    topic,
    collectProfileQuestions,
    publicSurface,
    isA0,
    whyKey,
  ]);

  const optionStyle = (selected: boolean) => ({
    boxShadow: HSK_CARD_SHADOW,
    borderColor: selected ? NAVY : CARD_BORDER,
    borderWidth: selected ? 2 : 1,
    borderStyle: "solid" as const,
  });

  const shell = (
    inner: ReactNode,
    maxWidth: "lg" | "2xl" = "lg",
    opts?: { bounceLogo?: boolean; hideLogo?: boolean },
  ) => (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{ fontFamily: FONT_BODY, background: "#EAF6FB" }}
    >
      <div
        aria-hidden
        className="hsk-onboarding-bg absolute inset-0"
        style={{
          backgroundImage: "url(/hskprep/hsk-onboarding-bg.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 38%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.22) 45%, transparent 72%)",
        }}
      />
      <div className="relative z-10 flex w-full flex-col items-center">
        {!opts?.hideLogo && (
          <div className={`mb-6 ${opts?.bounceLogo ? "animate-bounce" : ""}`}>
            <AppLogo />
          </div>
        )}
        <div
          className={`${CARD} ${maxWidth === "2xl" ? "max-w-2xl" : "max-w-lg"}`}
          style={{ boxShadow: HSK_CARD_SHADOW }}
        >
          {inner}
        </div>
      </div>
    </div>
  );

  const progressDash = (active: number) => (
    <div className="flex justify-center gap-2 sm:gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-1 w-12 rounded-full sm:w-16"
          style={{
            background: i <= active ? BLUE : "rgba(194, 220, 240, 0.9)",
          }}
        />
      ))}
    </div>
  );

  const heading = (text: string) => (
    <h2
      className="mt-6 text-xl font-bold sm:text-2xl"
      style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
    >
      {text}
    </h2>
  );

  const subcopy = (text: ReactNode) => (
    <p className="mt-2 text-sm" style={{ color: MUTED }}>
      {text}
    </p>
  );

  const primaryBtnStyle = {
    background: HSK_BTN_GRADIENT,
    boxShadow: HSK_BTN_SHADOW,
  };

  if (!profileLoaded) {
    return shell(
      <p className="text-sm" style={{ color: MUTED }}>
        Loading your learning profile…
      </p>,
      "lg",
    );
  }

  if (step === "upgrade") {
    return <OnboardingUpgradeClient personalization={upgradePersonalization} />;
  }

  if (step === "level") {
    return shell(
      <>
        {progressDash(0)}
        {heading("What best describes your level?")}
        {subcopy(
          "Vocabulary and sentence difficulty will match this. You can change it anytime in settings.",
        )}
        <div className="mt-6 space-y-3">
          {JOURNEY_LEVEL_OPTIONS.map((group) => {
            const selected = cefrLevel === group.cefr;
            return (
              <button
                key={group.cefr}
                type="button"
                onClick={() => setCefrLevel(group.cefr)}
                className={`${OPTION_ROW} flex-col items-stretch gap-1 sm:flex-row sm:items-start`}
                style={optionStyle(selected)}
              >
                <div className="text-left">
                  <h3 className="text-sm font-bold" style={{ color: NAVY }}>
                    {group.label}{" "}
                    <span className="font-normal" style={{ color: MUTED }}>
                      (HSK {group.hsk})
                    </span>
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: MUTED }}>
                    {group.sublabel}
                  </p>
                  {group.note ? (
                    <p
                      className="mt-1 text-xs font-medium"
                      style={{ color: BLUE }}
                    >
                      {group.note}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={levelSaving || !cefrLevel}
          onClick={async () => {
            if (!cefrLevel) return;
            setLevelSaving(true);
            setError(null);
            try {
              const selectedLevel = cefrLevel;
              const hskFields = hskProfileFieldsFromCefr(selectedLevel, {
                setTarget: hskTrack,
              });
              const profilePatch = hskTrack
                ? { product_track: "hsk" as const, ...hskFields }
                : hskFields;
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                const { data: existing } = await supabase
                  .from("user_profiles")
                  .select("user_id")
                  .eq("user_id", user.id)
                  .maybeSingle();
                if (existing) {
                  await supabase
                    .from("user_profiles")
                    .update({ cefr_level: selectedLevel, ...profilePatch })
                    .eq("user_id", user.id);
                } else {
                  await supabase.from("user_profiles").insert({
                    user_id: user.id,
                    cefr_level: selectedLevel,
                    ...profilePatch,
                  });
                }
              }

              if (selectedLevel === "A0") {
                setTopic(A0_TOPIC);
                setWhyKey("fluency");
                setBranchAnswer("curious");
                setStep("topic");
                return;
              }

              if (!collectProfileQuestions) {
                if (!whyKey) setWhyKey("fluency");
                if (!branchAnswer) setBranchAnswer("curious");
                setStep("generating");
                return;
              }

              if (!smartProfileSkip || needsWhy) setStep("why");
              else setStep("generating");
            } catch {
              setError("Could not save your level. Try again.");
            } finally {
              setLevelSaving(false);
            }
          }}
          className={`mt-8 ${BTN_PRIMARY}`}
          style={primaryBtnStyle}
        >
          {levelSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          Continue
        </button>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </>,
      "2xl",
    );
  }

  if (step === "why") {
    return shell(
      <>
        {progressDash(1)}
        {heading("Why are you learning Mandarin?")}
        {subcopy(
          "We'll tailor your vocabulary and stories around your real goals.",
        )}
        <div className="mt-6 space-y-3">
          {WHY_OPTIONS.map((o) => {
            const selected = whyKey === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setWhyKey(o.key)}
                className={`${OPTION_ROW} flex-col items-stretch gap-1`}
                style={optionStyle(selected)}
              >
                <span className="font-medium" style={{ color: NAVY }}>
                  {o.label}
                </span>
                <span className="text-sm" style={{ color: MUTED }}>
                  {o.sublabel}
                </span>
              </button>
            );
          })}
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={!whyKey}
          onClick={() => {
            setError(null);
            setBranchAnswer("");
            setStep("branch");
          }}
          className={`mt-8 ${BTN_PRIMARY}`}
          style={primaryBtnStyle}
        >
          Continue
        </button>
      </>,
    );
  }

  if (step === "branch") {
    const branch = BRANCH_OPTIONS[whyKey || "fluency"] ?? BRANCH_OPTIONS.fluency;
    return shell(
      <>
        {progressDash(2)}
        {heading(branch.question)}
        <div className="mt-6 space-y-3">
          {branch.options.map((o) => {
            const selected = branchAnswer === o.key;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setBranchAnswer(o.key)}
                className={OPTION_ROW}
                style={optionStyle(selected)}
              >
                <span className="font-medium" style={{ color: NAVY }}>
                  {o.label}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          disabled={!branchAnswer}
          onClick={() => {
            setError(null);
            // Reset topic so first chip pre-selects for this branch.
            setTopic("");
            setStep("topic");
          }}
          className={`mt-8 ${BTN_PRIMARY}`}
          style={primaryBtnStyle}
        >
          Continue
        </button>
      </>,
      "2xl",
    );
  }

  if (step === "topic") {
    if (isA0) {
      return shell(
        <>
          {progressDash(3)}
          <div className="mt-6 text-center">
            <img
              src="/capybara-waving.png"
              alt=""
              className="mx-auto h-20 w-20 rounded-full object-cover"
              aria-hidden
            />
            <h2
              className="mt-4 text-xl font-bold sm:text-2xl"
              style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
            >
              {A0_TOPIC}
            </h2>
            <p className="mt-3 text-sm" style={{ color: MUTED }}>
              Your first five Mandarin words — greetings and introducing
              yourself. No prior knowledge needed.
            </p>
            <button
              type="button"
              onClick={() => {
                setTopic(A0_TOPIC);
                setError(null);
                setStep(publicSurface ? "upgrade" : "generating");
              }}
              className={`mt-8 ${BTN_PRIMARY}`}
              style={primaryBtnStyle}
            >
              Let&apos;s start →
            </button>
          </div>
          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        </>,
      );
    }

    return shell(
      <>
        {progressDash(3)}
        {heading("What topic do you want to learn?")}
        {subcopy("Pick a suggestion or type your own topic.")}
        <div className="mt-6 flex flex-wrap gap-2">
          {topicSuggestions.map((c) => {
            const selected = topic === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setTopic(c)}
                className={selected ? CHIP_ON : CHIP_OFF}
                style={
                  selected
                    ? {
                        background: LINGO_ACCENT_GRADIENT_GLOSSY,
                        boxShadow: LINGO_ACCENT_CHIP_SHADOW,
                      }
                    : {
                        borderColor: CARD_BORDER,
                        color: NAVY,
                        background: "white",
                      }
                }
              >
                {c}
              </button>
            );
          })}
        </div>
        <label className="mt-6 block text-sm font-medium" style={{ color: NAVY }}>
          <span className="sr-only">Topic</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={topicPlaceholder}
            className="w-full rounded-lg border px-4 py-3 text-base shadow-sm focus:outline-none"
            style={{
              borderColor: CARD_BORDER,
              color: NAVY,
              background: "white",
            }}
          />
        </label>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={!topic.trim()}
          onClick={() => {
            setError(null);
            setStep(publicSurface ? "upgrade" : "generating");
          }}
          className={`mt-8 ${BTN_PRIMARY}`}
          style={primaryBtnStyle}
        >
          {publicSurface ? "See my personalized plan →" : "Build my journey →"}
        </button>
      </>,
    );
  }

  if (step === "generating") {
    if (isA0) {
      return shell(
        <div className="flex flex-col items-center py-4 text-center">
          <div className="animate-bounce" aria-hidden>
            <AppLogo size="md" />
          </div>
          <p className="mt-6 text-sm" style={{ color: MUTED }}>
            Starting your first lesson…
          </p>
          {error ? (
            <p className="mt-6 text-center text-sm text-red-600">{error}</p>
          ) : null}
        </div>,
      );
    }

    const genSteps = GEN_STEPS;
    const progressPct = Math.min(
      100,
      Math.round((generatingStep / genSteps.length) * 100),
    );
    return shell(
      <>
        <div className="flex flex-col items-center text-center">
          <div className="animate-bounce" aria-hidden>
            <AppLogo size="md" />
          </div>
          {!publicSurface && (
            <p className="mt-4 text-sm" style={{ color: MUTED }}>
              Building your journey — you&apos;ll be taken there in a moment
            </p>
          )}
        </div>
        <div
          className="mx-auto mt-6 h-2.5 w-full max-w-md overflow-hidden rounded-full"
          style={{ background: "#E0F0F8" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${BLUE}, #59C6DE)`,
              boxShadow: "0 0 12px rgba(33,118,174,0.35)",
            }}
          />
        </div>
        <p
          className="mt-2 text-center text-xs font-medium"
          style={{ color: MUTED }}
        >
          {progressPct}% complete
        </p>
        <ul className="mt-8 w-full space-y-3 text-left">
          {genSteps.map((s, i) => (
            <li
              key={s}
              className="transition-opacity"
              style={{
                color: NAVY,
                opacity: i < generatingStep ? 1 : 0.3,
              }}
            >
              {s}
            </li>
          ))}
        </ul>
        {error && (
          <p className="mt-6 text-center text-sm text-red-600">{error}</p>
        )}
      </>,
    );
  }

  return null;
}
