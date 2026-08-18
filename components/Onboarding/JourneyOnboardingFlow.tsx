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
import { Loader2 } from "lucide-react";
import { getTopicSuggestions } from "@/lib/onboarding/topicSuggestions";

/** Primary actions — same language as /onboarding/story & StoryWizard */
const BTN_PRIMARY =
  "flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg border border-gray-900 bg-gray-900 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:bg-gray-900 sm:text-base";

/** Outline / chip — unselected */
const CHIP_OFF =
  "rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-900 hover:bg-gray-50";

/** Chip — selected */
const CHIP_ON =
  "rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800";

/** “Why” & similar option rows */
const OPTION_ROW =
  "flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-gray-900 hover:bg-gray-50";

const OPTION_ROW_ON =
  "border-2 border-gray-900 bg-gray-50 shadow-sm ring-1 ring-gray-900/10";

const LEVEL_OPTIONS = [
  {
    value: "A0",
    label: "Just starting out",
    sublabel: "I don't know any Mandarin yet",
    note: "Everyone starts here. LingoIsland is built for this.",
  },
  {
    value: "A1",
    label: "I know a little",
    sublabel: "Greetings, numbers, basic phrases",
  },
  {
    value: "A2",
    label: "Getting the basics",
    sublabel: "Simple exchanges, some characters",
  },
  {
    value: "B1",
    label: "Simple conversations",
    sublabel: "I get by but have big gaps",
  },
  {
    value: "B2",
    label: "Conversational",
    sublabel: "I speak but vocabulary holds me back",
  },
  {
    value: "C1",
    label: "Pretty fluent",
    sublabel: "Filling specific areas",
  },
] as const;

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

const BASE_CEFR_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;
type CefrLevel = (typeof BASE_CEFR_LEVELS)[number];
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

const JOURNEY_ONBOARDING_DRAFT_KEY = "journey_onboarding_draft_v1";
const JOURNEY_RESUME_PATH = "/onboarding/journey";

const HARDCODED_TIME_LABEL = "15min";
const HARDCODED_DAILY_MINUTES = 15;
const HARDCODED_DAYS_PER_WEEK = 4;

type SavedNode = {
  node_type: string;
  position: number;
  step_order: number;
  name: string;
  zh: string | null;
  hint: string | null;
  word_count: number | null;
};

type JourneyOnboardingDraft = {
  topic: string;
  whyKey: WhyKey | "";
  branchAnswer: string;
  cefrLevel: CefrLevel | "";
  savedNodes?: SavedNode[];
};

type Step =
  | "level"
  | "why"
  | "branch"
  | "topic"
  | "generating"
  | "starting-island";

/** Maps stored profile values (including legacy A1-/A1+ style) to a base band. */
function cefrFromProfile(raw: string | null | undefined): CefrLevel {
  if (!raw) return "B1";
  const t = raw.trim();
  if (BASE_CEFR_LEVELS.includes(t as CefrLevel)) return t as CefrLevel;
  const m = t.toUpperCase().match(/^(A0|A1|A2|B1|B2|C1)/);
  if (m) return m[1] as CefrLevel;
  return "B1";
}

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

/**
 * Journey setup wizard. When `publicSurface` is true (e.g. `/onboarding/journey`), the flow
 * runs outside `/app` auth; anonymous sign-in happens silently before generation.
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
  const supabase = useMemo(() => createClient(), []);
  const urlTopicSynced = useRef(false);
  const [step, setStep] = useState<Step>("level");
  const [topic, setTopic] = useState("");
  const [cefrLevel, setCefrLevel] = useState<CefrLevel | "">("");
  const [levelSaving, setLevelSaving] = useState(false);
  const [whyKey, setWhyKey] = useState<WhyKey | "">("");
  const [branchAnswer, setBranchAnswer] = useState("");
  const [generatingStep, setGeneratingStep] = useState(0);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const generateStartedRef = useRef(false);
  const draftResumeRef = useRef(false);
  const savedNodesRef = useRef<SavedNode[]>([]);
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

  const persistDraft = () => {
    try {
      const draft: JourneyOnboardingDraft = {
        topic: topic.trim(),
        whyKey,
        branchAnswer,
        cefrLevel,
        savedNodes:
          savedNodesRef.current.length > 0
            ? savedNodesRef.current
            : undefined,
      };
      sessionStorage.setItem(
        JOURNEY_ONBOARDING_DRAFT_KEY,
        JSON.stringify(draft),
      );
    } catch {
      // sessionStorage blocked
    }
  };

  // After login: restore draft and jump to generation.
  useEffect(() => {
    if (typeof window === "undefined" || draftResumeRef.current) return;
    if (searchParams.get("resume") !== "1") return;
    const raw = sessionStorage.getItem(JOURNEY_ONBOARDING_DRAFT_KEY);
    if (!raw) {
      router.replace(JOURNEY_RESUME_PATH);
      return;
    }
    try {
      const d = JSON.parse(raw) as JourneyOnboardingDraft;
      if (d.topic) setTopic(d.topic);
      if (d.whyKey && WHY_OPTIONS.some((o) => o.key === d.whyKey))
        setWhyKey(d.whyKey);
      if (d.branchAnswer) setBranchAnswer(d.branchAnswer);
      if (d.cefrLevel) setCefrLevel(cefrFromProfile(String(d.cefrLevel)));
      if (Array.isArray(d.savedNodes) && d.savedNodes.length > 0) {
        savedNodesRef.current = d.savedNodes;
      }
      draftResumeRef.current = true;
      setStep("generating");
      router.replace(JOURNEY_RESUME_PATH);
    } catch {
      sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
      router.replace(JOURNEY_RESUME_PATH);
    }
  }, [searchParams, router]);

  // Deep link: ?topic=… prefills topic and starts at why (skip level only if we already have level from profile later)
  useEffect(() => {
    if (urlTopicSynced.current) return;
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
      if (levelExists) setCefrLevel(cefrFromProfile(up?.cefr_level));
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: up } = await supabase
        .from("user_profiles")
        .select("cefr_level")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled && up?.cefr_level) {
        setCefrLevel(cefrFromProfile(up.cefr_level));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

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

  const startIslandAndRedirect = async (
    id: string,
    level: string,
  ): Promise<void> => {
    setStep("starting-island");
    const isRes = await fetch(`/api/journey/${id}/start-island`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: 1, cefrLevel: level }),
    });
    const isData = await isRes.json().catch(() => ({}));
    if (!isRes.ok) {
      throw new Error(isData.error || "Could not start island");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ onboarding_complete: true })
        .eq("id", user.id);
    }

    sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
    router.push(
      `/app/topic-islands/${isData.islandId}?journeyFirst=1&learn=true`,
    );
  };

  useEffect(() => {
    // The A0 course is fixed and seeded directly into the user's island, so
    // start immediately. Other levels wait for their existing progress UI.
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
        // Silent anonymous auth so island generation works without email/password.
        let {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          const { data: anonData, error: anonErr } =
            await supabase.auth.signInAnonymously();
          if (anonErr) {
            throw new Error(
              anonErr.message || "Could not start a guest session",
            );
          }
          user = anonData.user;
        }
        if (!user) {
          throw new Error("Could not start a guest session");
        }

        if (smartProfileSkip) {
          const updates: Record<string, unknown> = {};
          if (needsLevel && cefrLevel) updates.cefr_level = cefrLevel;
          if (needsWhy && effectiveWhyText)
            updates.learning_goal = effectiveWhyText;
          if (Object.keys(updates).length > 0) {
            await supabase
              .from("user_profiles")
              .update(updates)
              .eq("user_id", user.id);
          }
        }

        persistDraft();

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
            savedNodes:
              savedNodesRef.current.length > 0
                ? savedNodesRef.current
                : undefined,
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

        const id = data.journeyId as string;
        if (!id) {
          throw new Error("Could not create journey");
        }
        setJourneyId(id);

        // In-app authenticated creation (non-public): go to journey page.
        if (!publicSurface && !draftResumeRef.current) {
          sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
          await supabase
            .from("profiles")
            .update({ onboarding_complete: true })
            .eq("id", user.id);
          router.push("/app/journey");
          return;
        }

        await startIslandAndRedirect(id, cefrLevel || "B1");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
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

  const shell = (inner: ReactNode, maxWidth: "lg" | "2xl" = "lg") => (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-6 py-10 sm:py-14">
      <div
        className={`w-full ${maxWidth === "2xl" ? "max-w-2xl" : "max-w-lg"}`}
      >
        {inner}
      </div>
    </div>
  );

  const progressDash = (active: number) => (
    <div className="flex justify-center gap-2 sm:gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1 w-12 rounded-full sm:w-16 ${
            i <= active ? "bg-gray-900" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );

  if (!profileLoaded) {
    return shell(
      <p className="text-sm text-gray-500">Loading your learning profile…</p>,
      "lg",
    );
  }

  if (step === "level") {
    return shell(
      <>
        {progressDash(0)}
        <h2 className="mt-8 text-2xl font-black text-gray-900">
          What best describes your level?
        </h2>
        <p className="mt-2 text-gray-600">
          Vocabulary and sentence difficulty will match this. You can change it
          anytime in settings.
        </p>
        <div className="mt-6 space-y-2">
          {LEVEL_OPTIONS.map((group) => (
            <button
              key={group.value}
              type="button"
              onClick={() => setCefrLevel(group.value)}
              className={`${OPTION_ROW} flex-col items-stretch gap-1 sm:flex-row sm:items-start ${
                cefrLevel === group.value ? OPTION_ROW_ON : ""
              }`}
            >
              <div className="text-left">
                <h3 className="text-sm font-bold text-gray-900">
                  {group.label}{" "}
                  <span className="font-normal text-gray-500">
                    ({group.value})
                  </span>
                </h3>
                <p className="mt-1 text-sm text-gray-600">{group.sublabel}</p>
                {"note" in group && group.note ? (
                  <p className="mt-1 text-xs font-medium text-teal-600">
                    {group.note}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
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
                    .update({ cefr_level: selectedLevel })
                    .eq("user_id", user.id);
                } else {
                  await supabase.from("user_profiles").insert({
                    user_id: user.id,
                    cefr_level: selectedLevel,
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
          className={`mt-10 ${BTN_PRIMARY}`}
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
        <h2 className="mt-8 text-2xl font-black text-gray-900">
          Why are you learning Mandarin?
        </h2>
        <p className="mt-2 text-gray-600">
          We&apos;ll tailor your vocabulary and stories around your real goals.
        </p>
        <div className="mt-6 space-y-2">
          {WHY_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setWhyKey(o.key)}
              className={`${OPTION_ROW} flex-col items-stretch gap-1 ${
                whyKey === o.key ? OPTION_ROW_ON : ""
              }`}
            >
              <span className="font-medium text-gray-900">{o.label}</span>
              <span className="text-sm text-gray-600">{o.sublabel}</span>
            </button>
          ))}
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
          className={`mt-10 ${BTN_PRIMARY}`}
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
        <h2 className="mt-8 text-2xl font-black text-gray-900">
          {branch.question}
        </h2>
        <div className="mt-6 space-y-2">
          {branch.options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setBranchAnswer(o.key)}
              className={`${OPTION_ROW} ${
                branchAnswer === o.key ? OPTION_ROW_ON : ""
              }`}
            >
              <span className="font-medium text-gray-900">{o.label}</span>
            </button>
          ))}
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
          className={`mt-10 ${BTN_PRIMARY}`}
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
          <div className="mt-8 rounded-2xl border-2 border-gray-900 bg-white p-8 text-center shadow-sm">
            <img
              src="/capybara-waving.png"
              alt=""
              className="mx-auto h-20 w-20 rounded-full object-cover"
              aria-hidden
            />
            <h2 className="mt-4 text-2xl font-black text-gray-900">
              {A0_TOPIC}
            </h2>
            <p className="mt-3 text-gray-600">
              Your first five Mandarin words — greetings and introducing
              yourself. No prior knowledge needed.
            </p>
            <button
              type="button"
              onClick={() => {
                setTopic(A0_TOPIC);
                setError(null);
                setStep("generating");
              }}
              className={`mt-8 ${BTN_PRIMARY}`}
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
        <h2 className="mt-8 text-2xl font-black text-gray-900">
          What topic do you want to learn?
        </h2>
        <p className="mt-2 text-gray-600">
          Pick a suggestion or type your own topic.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {topicSuggestions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTopic(c)}
              className={topic === c ? CHIP_ON : CHIP_OFF}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="mt-6 block text-sm font-medium text-gray-700">
          <span className="sr-only">Topic</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={topicPlaceholder}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
          />
        </label>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <button
          type="button"
          disabled={!topic.trim()}
          onClick={() => {
            setError(null);
            setStep("generating");
          }}
          className={`mt-10 ${BTN_PRIMARY}`}
        >
          Build my journey →
        </button>
      </>,
    );
  }

  if (step === "generating") {
    if (isA0) {
      return shell(
        <div className="flex flex-col items-center text-center">
          <div className="animate-bounce" aria-hidden>
            <AppLogo size="md" textClassName="text-xl font-black text-gray-900" />
          </div>
          <p className="mt-6 text-sm text-gray-500">
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
            <AppLogo
              size="md"
              textClassName="text-xl font-black text-gray-900"
            />
          </div>
          {!publicSurface && (
            <p className="mt-4 text-sm text-gray-500">
              Building your journey — you'll be taken there in a moment
            </p>
          )}
        </div>
        <div className="mx-auto mt-6 h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gray-900 transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs font-medium text-gray-500">
          {progressPct}% complete
        </p>
        <ul className="mt-10 w-full space-y-3 text-left">
          {genSteps.map((s, i) => (
            <li
              key={s}
              className={`text-gray-800 transition-opacity ${
                i < generatingStep ? "opacity-100" : "opacity-30"
              }`}
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

  if (step === "starting-island") {
    return shell(
      <div className="flex flex-col items-center text-center">
        <div className="animate-bounce" aria-hidden>
          <AppLogo size="md" textClassName="text-xl font-black text-gray-900" />
        </div>
        <h2 className="mt-8 text-2xl font-black text-gray-900">
          {isA0 ? "Getting your first words ready…" : "Building your first island…"}
        </h2>
        <p className="mt-3 text-gray-600">
          {isA0 ? (
            <>
              Loading greetings and introductions for absolute beginners.
              <br />
              This only takes a moment.
            </>
          ) : (
            <>
              We&apos;re generating 3 words tailored to your level and topic.
              <br />
              This only takes a moment.
            </>
          )}
        </p>
        <div className="mx-auto mt-8 h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full animate-pulse rounded-full bg-gray-900"
            style={{ width: "60%" }}
          />
        </div>
        {error && <p className="mt-6 text-sm text-red-600">{error}</p>}
        {journeyId && error ? (
          <button
            type="button"
            className={`mt-6 ${BTN_PRIMARY}`}
            onClick={() => {
              void startIslandAndRedirect(journeyId, cefrLevel || "B1").catch(
                (e) => {
                  setError(
                    e instanceof Error ? e.message : "Could not start island",
                  );
                },
              );
            }}
          >
            Try again
          </button>
        ) : null}
      </div>,
      "lg",
    );
  }

  return null;
}
