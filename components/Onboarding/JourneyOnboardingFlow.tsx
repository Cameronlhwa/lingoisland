"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import AppLogo from "@/components/app/AppLogo";
import { BookOpen, Loader2, Lock } from "lucide-react";

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

const POPULAR_CHIPS = [
  "Travel in China",
  "Chinese cuisine",
  "Business Mandarin",
  "Dating & relationships",
  "Technology & AI",
  "Going to the gym",
];

const TOPIC_TYPING_SAMPLES = [
  "Travel in China",
  "Chinese street food",
  "Business Mandarin",
  "Dating & relationships",
  "Technology & AI",
  "conversations with my boss",
  "Coffee shop chats",
  "Startup meetings",
  "Weekend plans",
  "Living in Shanghai",
] as const;

const TIME_OPTIONS = [
  { label: "5min", value: "5min", mins: 5 },
  { label: "15min", value: "15min", mins: 15 },
  { label: "30min", value: "30min", mins: 30 },
  { label: "1h+", value: "1h+", mins: 60 },
] as const;

/** Minutes per time-label option — module scope so hooks deps stay stable */
const MINS_MAP: Record<string, number> = {
  "5min": 5,
  "15min": 15,
  "30min": 30,
  "1h+": 60,
};

const DAY_OPTIONS = [
  { label: "2x / week", value: 2 },
  { label: "3x / week", value: 3 },
  { label: "4x / week", value: 4 },
  { label: "5x / week", value: 5 },
  { label: "6x / week", value: 6 },
  { label: "Every day", value: 7 },
] as const;

const WHY_OPTIONS = [
  { key: "travel", emoji: "✈️", label: "Planning a trip to China / Taiwan" },
  {
    key: "work",
    emoji: "💼",
    label: "Work with Chinese colleagues or clients",
  },
  { key: "media", emoji: "🎬", label: "Enjoy Chinese media, music, or shows" },
  { key: "heritage", emoji: "🏠", label: "Connect with family or heritage" },
  { key: "fluency", emoji: "📈", label: "General fluency improvement" },
] as const;

const BASE_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
type CefrLevel = (typeof BASE_CEFR_LEVELS)[number];

const LEVEL_GROUPS: {
  base: CefrLevel;
  label: string;
  description: string;
}[] = [
  {
    base: "A1",
    label: "Beginner",
    description:
      "Just starting out with basic phrases and survival vocabulary (HSK 1–2).",
  },
  {
    base: "A2",
    label: "Upper beginner",
    description:
      "You can handle basics but still need support in conversations (HSK 3).",
  },
  {
    base: "B1",
    label: "Intermediate",
    description:
      "You can talk about everyday topics but struggle with nuance (HSK 4–5).",
  },
  {
    base: "B2",
    label: "Upper intermediate",
    description:
      "You follow most native content but miss some details (HSK 5–6).",
  },
  {
    base: "C1",
    label: "Advanced",
    description:
      "You're fluent but still learning sophisticated vocabulary and idioms.",
  },
];

/** Maps stored profile values (including legacy A1-/A1+ style) to a base band. */
function cefrFromProfile(raw: string | null | undefined): CefrLevel {
  if (!raw) return "B1";
  const t = raw.trim();
  if (BASE_CEFR_LEVELS.includes(t as CefrLevel)) return t as CefrLevel;
  const m = t.toUpperCase().match(/^(A1|A2|B1|B2|C1)/);
  if (m) return m[1] as CefrLevel;
  return "B1";
}

const GEN_STEPS = [
  "Analyzing your topic…",
  "Finding sub-topics…",
  "Building your island path…",
  "Writing story ideas…",
  "Finalizing your plan…",
];

const JOURNEY_TOTAL_WORDS = 45; // Island 1 has 5 words, islands 2-5 have 10 each.

const JOURNEY_ONBOARDING_DRAFT_KEY = "journey_onboarding_draft_v1";
const JOURNEY_RESUME_PATH = "/onboarding/journey";

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
  timeLabel: string;
  daysPerWeek: number;
  whyKey: (typeof WHY_OPTIONS)[number]["key"];
  cefrLevel: CefrLevel | "";
  /** Pre-generated plan nodes saved so post-login resume skips DeepSeek */
  savedNodes?: SavedNode[];
};

type Step =
  | "welcome"
  | "topic"
  | "level"
  | "time"
  | "why"
  | "generating"
  | "preview"
  | "starting-island";

function timeLabelFromMinutes(
  mins: number | null | undefined,
): (typeof TIME_OPTIONS)[number]["value"] | "" {
  if (typeof mins !== "number" || mins <= 0) return "";
  if (mins <= 5) return "5min";
  if (mins <= 15) return "15min";
  if (mins <= 30) return "30min";
  return "1h+";
}

function whyKeyFromProfile(
  goal: string | null | undefined,
): (typeof WHY_OPTIONS)[number]["key"] | "" {
  const g = (goal ?? "").toLowerCase();
  if (!g) return "";
  if (g.includes("work")) return "work";
  if (g.includes("travel") || g.includes("trip")) return "travel";
  if (g.includes("family") || g.includes("heritage")) return "heritage";
  if (g.includes("media") || g.includes("show") || g.includes("music"))
    return "media";
  return "fluency";
}

/**
 * Journey setup wizard. When `publicSurface` is true (e.g. `/onboarding/journey`), the flow
 * runs outside `/app` auth; the user signs in at the "Build my journey" step.
 */
export default function JourneyOnboardingFlow({
  skipWelcome = false,
  publicSurface = false,
  smartProfileSkip = false,
  collectProfileQuestions = true,
}: {
  skipWelcome?: boolean;
  publicSurface?: boolean;
  smartProfileSkip?: boolean;
  collectProfileQuestions?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const urlTopicSynced = useRef(false);
  const [step, setStep] = useState<Step>(skipWelcome ? "topic" : "welcome");
  const [topic, setTopic] = useState("");
  const [timeLabel, setTimeLabel] = useState<
    (typeof TIME_OPTIONS)[number]["value"] | ""
  >("");
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel | "">("");
  const [levelSaving, setLevelSaving] = useState(false);
  const [whyKey, setWhyKey] = useState<
    (typeof WHY_OPTIONS)[number]["key"] | ""
  >("");
  const [generatingStep, setGeneratingStep] = useState(0);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [journeyRow, setJourneyRow] = useState<{
    topic: string;
    words_per_week: number | null;
  } | null>(null);
  const [journeyIslands, setJourneyIslands] = useState<
    Array<{
      id: string;
      order: number;
      position?: number;
      node_type?: "island" | "story";
      name: string;
      zh: string | null;
      story_idea: string | null;
      hint?: string | null;
      word_count?: number | null;
    }>
  >([]);
  const generateStartedRef = useRef(false);
  const draftResumeRef = useRef(false);
  const savedNodesRef = useRef<SavedNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [profileLoaded, setProfileLoaded] = useState(!smartProfileSkip);
  const [needsLevel, setNeedsLevel] = useState(!smartProfileSkip);
  const [needsTime, setNeedsTime] = useState(!smartProfileSkip);
  const [needsWhy, setNeedsWhy] = useState(!smartProfileSkip);
  const [profileLearningGoal, setProfileLearningGoal] = useState("");
  const [topicPlaceholder, setTopicPlaceholder] = useState(
    "Teach me words related to movies and…",
  );

  const persistDraft = () => {
    try {
      // Persist the pre-generated plan nodes so that after login the generation
      // step can reuse them directly instead of calling DeepSeek a second time.
      const savedNodes: SavedNode[] =
        journeyIslands.length > 0
          ? journeyIslands.map((n) => ({
              node_type: n.node_type ?? "island",
              // preview nodes expose step_order; DB nodes expose order (mapped from step_order)
              position: n.position ?? n.order ?? 0,
              step_order: (n as unknown as { step_order?: number }).step_order ?? n.order ?? 0,
              name: n.name,
              zh: n.zh ?? null,
              hint: n.hint ?? null,
              word_count: n.word_count ?? null,
            }))
          : [];

      const draft: JourneyOnboardingDraft = {
        topic: topic.trim(),
        timeLabel: timeLabel || "15min",
        daysPerWeek: daysPerWeek ?? 4,
        whyKey: whyKey as JourneyOnboardingDraft["whyKey"],
        cefrLevel,
        savedNodes: savedNodes.length > 0 ? savedNodes : undefined,
      };
      sessionStorage.setItem(
        JOURNEY_ONBOARDING_DRAFT_KEY,
        JSON.stringify(draft),
      );
    } catch {
      // sessionStorage blocked — caller can still continue without persisted draft
    }
  };

  // After login: restore draft and jump to generation (see publicSurface + sessionStorage).
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
      if (d.timeLabel)
        setTimeLabel(d.timeLabel as (typeof TIME_OPTIONS)[number]["value"]);
      if (typeof d.daysPerWeek === "number") setDaysPerWeek(d.daysPerWeek);
      if (d.whyKey && WHY_OPTIONS.some((o) => o.key === d.whyKey))
        setWhyKey(d.whyKey);
      if (d.cefrLevel) setCefrLevel(cefrFromProfile(String(d.cefrLevel)));
      // Restore pre-generated plan so the second generate call can skip DeepSeek.
      if (Array.isArray(d.savedNodes) && d.savedNodes.length > 0) {
        savedNodesRef.current = d.savedNodes;
      }
      // Keep draft in sessionStorage until /api/journey/generate succeeds so React Strict
      // Mode remounts and navigation do not strand users with an empty draft.
      draftResumeRef.current = true;
      setStep("generating");
      router.replace(JOURNEY_RESUME_PATH);
    } catch {
      sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
      router.replace(JOURNEY_RESUME_PATH);
    }
  }, [searchParams, router]);

  // Deep link: ?topic=… skips welcome and prefills topic (e.g. from marketing / topics)
  useEffect(() => {
    if (urlTopicSynced.current) return;
    const t = searchParams.get("topic")?.trim();
    if (t) {
      urlTopicSynced.current = true;
      setTopic(t);
      if (!skipWelcome) setStep("topic");
    }
  }, [searchParams, skipWelcome]);

  // Typewriter placeholder for popular topics when topic input is empty.
  useEffect(() => {
    if (topic.trim().length > 0) {
      setTopicPlaceholder("Teach me words related to movies and…");
      return;
    }
    let cancelled = false;
    let sampleIndex = Math.floor(Math.random() * TOPIC_TYPING_SAMPLES.length);
    let charIndex = 0;
    let deleting = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const nextSampleIndex = (current: number) => {
      if (TOPIC_TYPING_SAMPLES.length <= 1) return 0;
      const jump =
        1 + Math.floor(Math.random() * (TOPIC_TYPING_SAMPLES.length - 1));
      return (current + jump) % TOPIC_TYPING_SAMPLES.length;
    };

    const tick = () => {
      if (cancelled) return;
      const sample = TOPIC_TYPING_SAMPLES[sampleIndex];
      const prefix = "Teach me words related to ";
      if (!deleting) {
        charIndex = Math.min(sample.length, charIndex + 1);
        setTopicPlaceholder(`${prefix}${sample.slice(0, charIndex)}…`);
        if (charIndex >= sample.length) {
          deleting = true;
          timeout = setTimeout(tick, 1100);
          return;
        }
        timeout = setTimeout(tick, 55 + Math.floor(Math.random() * 35));
        return;
      }
      charIndex = Math.max(0, charIndex - 1);
      setTopicPlaceholder(`${prefix}${sample.slice(0, charIndex)}…`);
      if (charIndex === 0) {
        deleting = false;
        sampleIndex = nextSampleIndex(sampleIndex);
        timeout = setTimeout(tick, 260);
        return;
      }
      timeout = setTimeout(tick, 28 + Math.floor(Math.random() * 24));
    };

    setTopicPlaceholder("Teach me words related to …");
    timeout = setTimeout(tick, 260);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [topic]);

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
        .select("cefr_level, daily_time_minutes, learning_goal")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const levelExists = !!up?.cefr_level;
      const timeExists = typeof up?.daily_time_minutes === "number";
      const whyExists =
        typeof up?.learning_goal === "string" && up.learning_goal.length > 0;
      setNeedsLevel(!levelExists);
      setNeedsTime(!timeExists);
      setNeedsWhy(!whyExists);
      if (levelExists) setCefrLevel(cefrFromProfile(up?.cefr_level));
      if (timeExists)
        setTimeLabel(timeLabelFromMinutes(up?.daily_time_minutes));
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

  const wordsPerWeek = useMemo(() => {
    if (!timeLabel || daysPerWeek == null) return 0;
    const m = MINS_MAP[timeLabel] ?? 15;
    return Math.round((m / 15) * daysPerWeek * 10);
  }, [timeLabel, daysPerWeek]);

  const whyText = useMemo(() => {
    const w = WHY_OPTIONS.find((o) => o.key === whyKey);
    return w?.label ?? profileLearningGoal;
  }, [whyKey, profileLearningGoal]);

  const effectiveWhyText =
    whyText ||
    WHY_OPTIONS.find((o) => o.key === whyKey)?.label ||
    "General fluency improvement";

  useEffect(() => {
    if (step !== "generating") return;
    setGeneratingStep(0);
    generateStartedRef.current = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < GEN_STEPS.length; i++) {
      timers.push(setTimeout(() => setGeneratingStep(i + 1), 550 * (i + 1)));
    }
    return () => timers.forEach(clearTimeout);
  }, [step]);

  useEffect(() => {
    if (step !== "generating" || generatingStep < GEN_STEPS.length) return;
    if (generateStartedRef.current) return;
    generateStartedRef.current = true;

    const run = async () => {
      setError(null);
      try {
        if (smartProfileSkip) {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const updates: Record<string, unknown> = {};
            if (needsLevel && cefrLevel) updates.cefr_level = cefrLevel;
            if (needsTime)
              updates.daily_time_minutes = MINS_MAP[timeLabel || "15min"];
            if (needsWhy && effectiveWhyText)
              updates.learning_goal = effectiveWhyText;
            if (Object.keys(updates).length > 0) {
              await supabase
                .from("user_profiles")
                .update(updates)
                .eq("user_id", user.id);
            }
          }
        }

        const res = await fetch("/api/journey/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: topic.trim(),
            why: effectiveWhyText,
            level: cefrLevel || "B1",
            cefrLevel: cefrLevel || "B1",
            dailyMinutes: MINS_MAP[timeLabel || "15min"],
            learningGoal: effectiveWhyText,
            timeLabel: timeLabel || "15min",
            daysPerWeek: daysPerWeek ?? 4,
            // Pass pre-generated nodes so the API can skip DeepSeek after login.
            savedNodes: savedNodesRef.current.length > 0 ? savedNodesRef.current : undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Could not create journey");
        }
        if (data?.preview?.journey && Array.isArray(data?.preview?.islands)) {
          setJourneyId(null);
          setJourneyRow(data.preview.journey);
          setJourneyIslands(data.preview.nodes ?? data.preview.islands);
          setStep("preview");
          return;
        }
        setJourneyId(data.journeyId);

        // Post-login resume: user already saw the preview before signing in.
        // Skip straight to island 1 — no second preview needed.
        if (draftResumeRef.current) {
          setStep("starting-island");
          sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
          const isRes = await fetch(
            `/api/journey/${data.journeyId}/start-island`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order: 1 }),
            },
          );
          const isData = await isRes.json().catch(() => ({}));
          if (!isRes.ok)
            throw new Error(isData.error || "Could not start island");
          router.push(
            `/app/topic-islands/${isData.islandId}?journeyFirst=1`,
          );
          return;
        }

        // In-app authenticated creation: skip preview, go straight to the journey page.
        if (!publicSurface) {
          sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
          router.push("/app/journey");
          return;
        }

        // Public surface (unauthenticated preview then logged in via email/magic link):
        // show journey preview so the user can confirm before starting island 1.
        try {
          const jr = await fetch(`/api/journey/${data.journeyId}`).then(
            (r) => r.json(),
          );
          if (jr.journey) {
            setJourneyRow(jr.journey);
            setJourneyIslands(jr.nodes ?? jr.islands ?? []);
          } else {
            setJourneyRow({ topic: topic.trim(), words_per_week: wordsPerWeek });
          }
        } catch {
          setJourneyRow({ topic: topic.trim(), words_per_week: wordsPerWeek });
        }
        setStep("preview");
        sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Something went wrong";
        setError(msg);
        sessionStorage.removeItem(JOURNEY_ONBOARDING_DRAFT_KEY);
        if (draftResumeRef.current) {
          // Post-login resume failed — show preview as a fallback for manual retry.
          setJourneyRow({ topic: topic.trim(), words_per_week: wordsPerWeek });
          setStep("preview");
        } else {
          // Go back to topic for in-app, or why for public surface.
          setStep(publicSurface && collectProfileQuestions ? "why" : "topic");
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
    needsTime,
    needsWhy,
    cefrLevel,
    timeLabel,
    effectiveWhyText,
    topic,
    daysPerWeek,
    collectProfileQuestions,
  ]);

  useEffect(() => {
    if (step !== "preview" || !journeyId) return;
    const mark = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ onboarding_complete: true })
        .eq("id", user.id);
    };
    void mark();
  }, [step, journeyId, supabase]);

  const weeksToComplete =
    journeyRow?.words_per_week && journeyRow.words_per_week > 0
      ? Math.ceil(JOURNEY_TOTAL_WORDS / journeyRow.words_per_week)
      : 1;

  const handleStartIsland1 = async () => {
    if (!journeyId) {
      persistDraft();
      router.push(
        `/login?next=${encodeURIComponent(`${JOURNEY_RESUME_PATH}?resume=1`)}`,
      );
      return;
    }
    setStep("starting-island");
    setError(null);
    try {
      const res = await fetch(`/api/journey/${journeyId}/start-island`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: 1 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not start island");
      }
      router.push(`/app/topic-islands/${data.islandId}?journeyFirst=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start island");
      setStep("preview");
    }
  };

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

  if (step === "welcome") {
    return shell(
      <>
        <div className="mb-8 flex items-center gap-2">
          <AppLogo textClassName="text-xl font-black text-gray-900" />
          <span className="text-2xl" aria-hidden>
            🦫
          </span>
        </div>
        <h1 className="text-3xl font-black text-gray-900">
          Welcome to LingoIsland
        </h1>
        <p className="mt-3 text-lg text-gray-600">
          Mandarin vocabulary built around topics you actually care about — not
          textbook lists.
        </p>
        <ul className="mt-8 space-y-3 text-gray-800">
          <li>→ Tell us your goal</li>
          <li>→ Build a personalised journey</li>
          <li>→ Get your first island free</li>
        </ul>
        <button
          type="button"
          onClick={() => setStep("topic")}
          className={`mt-10 ${BTN_PRIMARY}`}
        >
          Let&apos;s go →
        </button>
        <p className="mt-4 text-center text-sm text-gray-500">
          Takes 2 minutes · No credit card needed
        </p>
      </>,
    );
  }

  if (step === "topic") {
    return shell(
      <>
        {progressDash(0)}
        <h2 className="mt-8 text-2xl font-black text-gray-900">
          What topic do you want to learn?
        </h2>
        <p className="mt-2 text-gray-600">
          Choose something you&apos;re interested in, like work, travel, food,
          anything~
        </p>
        <label className="mt-6 block text-sm font-medium text-gray-700">
          <span className="sr-only">Topic</span>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={topicPlaceholder}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {POPULAR_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTopic(c)}
              className={CHIP_OFF}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!topic.trim()}
          onClick={() => {
            if (!collectProfileQuestions) {
              if (!timeLabel) setTimeLabel("15min");
              if (daysPerWeek == null) setDaysPerWeek(4);
              if (!whyKey) setWhyKey("fluency");
              setStep("generating");
              return;
            }
            if (!smartProfileSkip) {
              setStep("level");
              return;
            }
            if (needsLevel) setStep("level");
            else if (needsTime) setStep("time");
            else if (needsWhy) setStep("why");
            else setStep("generating");
          }}
          className={`mt-10 ${BTN_PRIMARY}`}
        >
          Continue
        </button>
      </>,
    );
  }

  if (step === "level") {
    return shell(
      <>
        {progressDash(1)}
        <h2 className="mt-8 text-2xl font-black text-gray-900">
          What best describes your level?
        </h2>
        <p className="mt-2 text-gray-600">
          Vocabulary and sentence difficulty will match this. You can change it
          anytime in settings.
        </p>
        <div className="mt-6 space-y-2">
          {LEVEL_GROUPS.map((group) => (
            <button
              key={group.base}
              type="button"
              onClick={() => setCefrLevel(group.base)}
              className={`${OPTION_ROW} flex-col items-stretch gap-1 sm:flex-row sm:items-start ${
                cefrLevel === group.base ? OPTION_ROW_ON : ""
              }`}
            >
              <div className="text-left">
                <h3 className="text-sm font-bold text-gray-900">
                  {group.label}{" "}
                  <span className="font-normal text-gray-500">
                    ({group.base})
                  </span>
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {group.description}
                </p>
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
              if (!smartProfileSkip) setStep("time");
              else if (needsTime) setStep("time");
              else if (needsWhy) setStep("why");
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

  if (step === "time") {
    return shell(
      <>
        {progressDash(2)}
        <h2 className="mt-8 text-2xl font-black text-gray-900">
          How much time can you put in?
        </h2>
        <p className="mt-2 text-gray-600">
          Be realistic — 10 minutes consistently beats 60 minutes once a week.
        </p>
        <p className="mt-6 text-sm font-medium text-gray-700">Time per day</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIME_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTimeLabel(t.value)}
              className={timeLabel === t.value ? CHIP_ON : CHIP_OFF}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-6 text-sm font-medium text-gray-700">Days per week</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setDaysPerWeek(d.value)}
              className={daysPerWeek === d.value ? CHIP_ON : CHIP_OFF}
            >
              {d.label}
            </button>
          ))}
        </div>
        {timeLabel && daysPerWeek != null && wordsPerWeek > 0 && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-gray-900 shadow-sm">
            <p className="text-lg font-bold">
              🧠 {wordsPerWeek} new words this week
            </p>
            <p className="mt-1 text-sm text-gray-700">
              ~{wordsPerWeek * 4} words in your first month at your pace
            </p>
          </div>
        )}
        <button
          type="button"
          disabled={!timeLabel || daysPerWeek == null}
          onClick={() => {
            if (!smartProfileSkip || needsWhy) setStep("why");
            else setStep("generating");
          }}
          className={`mt-10 ${BTN_PRIMARY}`}
        >
          Continue
        </button>
      </>,
    );
  }

  if (step === "why") {
    return shell(
      <>
        {progressDash(3)}
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
              className={`${OPTION_ROW} ${
                whyKey === o.key ? OPTION_ROW_ON : ""
              }`}
            >
              <span>{o.emoji}</span>
              <span className="font-medium">{o.label}</span>
            </button>
          ))}
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={!whyKey}
          onClick={async () => {
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
    const progressPct = Math.min(
      100,
      Math.round((generatingStep / GEN_STEPS.length) * 100),
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
              Building your journey — you&apos;ll be taken there in a moment
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
          {GEN_STEPS.map((s, i) => (
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
          Building your first island…
        </h2>
        <p className="mt-3 text-gray-600">
          We&apos;re generating 5 words tailored to your level and topic.
          <br />
          This only takes a moment.
        </p>
        <div className="mx-auto mt-8 h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray-200">
          <div className="h-full animate-pulse rounded-full bg-gray-900" style={{ width: "60%" }} />
        </div>
        {error && (
          <p className="mt-6 text-sm text-red-600">{error}</p>
        )}
      </div>,
      "lg",
    );
  }

  if (step === "preview" && journeyRow) {
    const wpw = journeyRow.words_per_week ?? wordsPerWeek;
    return shell(
      <>
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
          YOUR PERSONALISED JOURNEY
        </p>
        <h1 className="mt-2 text-3xl font-black text-gray-900">
          {journeyRow.topic}
        </h1>
        <p className="mt-2 text-gray-600">
          5 islands · 2 stories · {JOURNEY_TOTAL_WORDS} words · ~
          {weeksToComplete} week
          {weeksToComplete === 1 ? "" : "s"} at your pace
        </p>

        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="font-semibold text-gray-900">
            🧠 Learn {wpw} words in your first week
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Based on your {timeLabel || "15min"}/day, {daysPerWeek ?? 4}x/week
            plan
          </p>
        </div>

        <div className="mt-8 max-h-[380px] overflow-y-auto pr-1">
          <ul className="space-y-3">
            {journeyIslands.map((row, idx) => (
              <li
                key={row.id}
                data-node-type={row.node_type ?? "island"}
                className={`flex flex-col gap-1 rounded-xl border bg-white px-4 py-3 shadow-sm ${
                  idx === 0 && (row.node_type ?? "island") === "island"
                    ? "border-2 border-gray-900"
                    : (row.node_type ?? "island") === "story"
                      ? "border-amber-200 bg-amber-50/40"
                      : "border-gray-200 opacity-90"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold text-gray-900">
                    {(row.node_type ?? "island") === "story" ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-sm text-white">
                        <BookOpen className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm text-white">
                      {row.order}
                      </span>
                    )}
                    <span>
                      {row.name}
                      {row.zh ? (
                        <span className="ml-2 font-normal text-gray-500">
                          {row.zh}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {idx === 0 && (row.node_type ?? "island") === "island" ? (
                    <span className="shrink-0 rounded-full bg-teal-500 px-2 py-0.5 text-xs font-bold text-white">
                      FREE
                    </span>
                  ) : (
                    <Lock className="h-4 w-4 shrink-0 text-gray-400" />
                  )}
                </div>
                {row.story_idea ? (
                  <p className="pl-10 text-sm text-gray-600">
                    {row.story_idea}
                  </p>
                ) : row.hint ? (
                  <p className="pl-10 text-sm text-amber-700">{row.hint}</p>
                ) : null}
                {(row.node_type ?? "island") === "story" ? (
                  <span className="pl-10 text-sm text-gray-500">
                    Locked story checkpoint
                  </span>
                ) : (
                  <span className="pl-10 text-sm text-gray-500">
                  {row.word_count ?? (row.order === 1 ? 5 : 10)} words
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-sm text-gray-600">
          🔒 Islands 2–5 unlock when you subscribe
        </p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={handleStartIsland1}
          className={`mt-8 ${BTN_PRIMARY}`}
        >
          {journeyId ? "Start Island 1 — free →" : "Continue with email →"}
        </button>
        <p className="mt-2 text-center text-sm text-gray-500">
          {journeyId
            ? "No credit card needed for island 1"
            : "Save your plan and unlock island 1 after sign in"}
        </p>
      </>,
      "2xl",
    );
  }

  return null;
}
