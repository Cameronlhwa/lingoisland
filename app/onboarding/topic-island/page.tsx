"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAnalytics } from "@/lib/posthog/client";

// Base CEFR levels for onboarding (simplified)
type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1";

// Extended levels are still valid for existing users
type ExtendedCEFRLevel =
  | "A1-"
  | "A1"
  | "A1+"
  | "A2-"
  | "A2"
  | "A2+"
  | "B1-"
  | "B1"
  | "B1+"
  | "B2-"
  | "B2"
  | "B2+"
  | "C1-"
  | "C1"
  | "C1+";

const LEVEL_GROUPS: {
  base: CEFRLevel;
  label: string;
  description: string;
}[] = [
  {
    base: "A1",
    label: "Beginner",
    description:
      "Just starting out with basic phrases and survival vocabulary (equivalent to HSK 1-2).",
  },
  {
    base: "A2",
    label: "Upper beginner",
    description:
      "You can handle basics but still need support in most conversations (equivalent to HSK 3).",
  },
  {
    base: "B1",
    label: "Intermediate",
    description:
      "You can talk about everyday topics but struggle with nuance and speed (equivalent to HSK 4-5).",
  },
  {
    base: "B2",
    label: "Upper intermediate",
    description:
      "You follow most native content but still miss details and complex ideas (equivalent to HSK 5-6).",
  },
  {
    base: "C1",
    label: "Advanced",
    description:
      "You're fluent with nuanced expression but still learning sophisticated vocabulary and idioms.",
  },
];

interface WizardState {
  step: number;
  cefrLevel: CEFRLevel | null;
  topic: string;
  wordCount: number;
  grammarCount: 0 | 1 | 2 | 3;
  wantsGrammar: boolean;
}

const STORAGE_KEY = "pending_topic_island_request";

const ROTATING_PLACEHOLDERS = [
  "Teach me words related to movies and music",
  "Teach me business vocabulary",
  "Teach me cooking terms",
  "Teach me travel phrases",
];

function OnboardingTopicIslandContent() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const { captureEvent } = useAnalytics();

  const [state, setState] = useState<WizardState>({
    step: 1,
    cefrLevel: null,
    topic: "",
    wordCount: 5,
    grammarCount: 0,
    wantsGrammar: false,
  });

  const [displayedText, setDisplayedText] = useState("");
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [levelError, setLevelError] = useState<string | null>(null);
  const [levelSubmitting, setLevelSubmitting] = useState(false);

  // Prefill topic from URL so it's there as soon as user reaches step 1 (and keep editable)
  useEffect(() => {
    const topicFromUrl = searchParams.get("topic");
    if (topicFromUrl?.trim()) {
      setState((prev) => ({ ...prev, topic: topicFromUrl.trim() }));
      captureEvent("onboarding_start_from_topics", {
        topic: topicFromUrl.trim(),
      });
    }
  }, [searchParams, captureEvent]);

  // Check if user is already authenticated - if so, redirect to processing page
  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCheckingAuth(false);

    if (user) {
      const pendingRequest = localStorage.getItem(STORAGE_KEY);
      if (pendingRequest) {
        // Has a pending island request — process it
        router.replace("/app/topic-islands/loading");
      }
      // Otherwise stay on the page so they can build a new island
    }
  };

  useEffect(() => {
    // Only animate placeholder when on step 1 (topic) and input is empty
    if (state.step !== 1 || state.topic.trim() !== "") {
      setDisplayedText("");
      return;
    }

    const currentText = ROTATING_PLACEHOLDERS[currentPlaceholderIndex];
    let timeout: NodeJS.Timeout;

    if (isDeleting) {
      // Delete characters
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText((prev) => prev.slice(0, -1));
        }, 30);
      } else {
        // Finished deleting, move to next placeholder
        setIsDeleting(false);
        setCurrentPlaceholderIndex(
          (prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length,
        );
      }
    } else {
      // Type characters
      if (displayedText.length < currentText.length) {
        timeout = setTimeout(() => {
          setDisplayedText(currentText.slice(0, displayedText.length + 1));
        }, 60);
      } else {
        // Finished typing, wait then start deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      }
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [
    state.step,
    state.topic,
    displayedText,
    currentPlaceholderIndex,
    isDeleting,
  ]);

  const handleTopicSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (state.topic.trim()) {
      setState({ ...state, step: 2 });
    }
  };

  const handleLevelSelect = async (level: CEFRLevel) => {
    setLevelError(null);
    setLevelSubmitting(true);
    setState((prev) => ({ ...prev, cefrLevel: level }));

    const pendingRequest = {
      cefrLevel: level,
      topic: state.topic.trim(),
      wordCount: state.wordCount,
      grammarCount: 0,
      wantsGrammar: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingRequest));

    // Check if already authenticated (anonymous or permanent) — skip signInAnonymously
    const { data: { user: existingUser } } = await supabase.auth.getUser();

    if (!existingUser) {
      // Not signed in at all — create an anonymous session
      const { error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("Error signing in anonymously:", error);
        // 422 means Anonymous sign-in is disabled in Supabase (Auth → Providers → Anonymous)
        const is422 = (error as { status?: number }).status === 422;
        setLevelError(
          is422
            ? "Try without account isn’t available right now. Please sign up with Google or email to continue."
            : "Something went wrong. Please try again."
        );
        setLevelSubmitting(false);
        return;
      }
    }

    // Full page navigation so session cookies are sent and server layout sees the user
    window.location.href = "/app/topic-islands/loading";
  };

  // Show loading while checking auth
  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
        <div className="text-gray-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-12 flex justify-center gap-4">
          {[1, 2].map((stepNum) => (
            <div
              key={stepNum}
              className={`h-1 w-16 ${
                state.step >= stepNum ? "bg-gray-900" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Topic (onboarding: 5 words fixed) */}
        {state.step === 1 && (
          <div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              What topic do you want to learn?
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              Choose something you're interested in, like work, travel, food,
              anything~
            </p>
            <form onSubmit={handleTopicSubmit}>
              <div className="mb-4 relative">
                <input
                  type="text"
                  value={state.topic}
                  onChange={(e) =>
                    setState({ ...state, topic: e.target.value })
                  }
                  className="w-full border border-gray-300 bg-white px-4 py-3 text-base transition-all focus:border-gray-900 focus:outline-none"
                  required
                />
                {state.topic.trim() === "" && (
                  <div className="absolute left-4 top-3 pointer-events-none text-gray-400">
                    <span>
                      {displayedText}
                      <span className="animate-pulse">|</span>
                    </span>
                  </div>
                )}
              </div>
              <p className="mb-2 text-sm text-gray-500">Most popular topics:</p>
              <div className="mb-8 flex flex-wrap gap-2">
                {[
                  "Going to the cafe",
                  "Asking the Doctor",
                  "Finance and investing",
                  "Watching soccer",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() =>
                      setState((prev) => ({ ...prev, topic: suggestion }))
                    }
                    className="rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:border-gray-900 hover:bg-gray-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                className="w-full border border-gray-900 bg-white px-6 py-4 text-base font-medium uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 md:w-auto"
              >
                Continue
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Level Selection */}
        {state.step === 2 && (
          <div>
            <button
              onClick={() => setState({ ...state, step: 1 })}
              className="mb-8 text-sm text-gray-600 underline hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              What best describes your level?
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              Choose the row that feels closest. You can always change this
              later.
            </p>
            {levelError ? (
              <div className="mb-4 space-y-3">
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {levelError}
                </p>
                <p className="text-center text-sm text-gray-600">
                  <a
                    href="/login?next=/app/topic-islands"
                    className="font-medium text-gray-900 underline hover:no-underline"
                  >
                    Sign up with Google or email instead
                  </a>
                </p>
              </div>
            ) : null}
            <div className="space-y-4">
              {LEVEL_GROUPS.map((group) => (
                <button
                  key={group.base}
                  type="button"
                  onClick={() => handleLevelSelect(group.base)}
                  disabled={levelSubmitting}
                  className="flex w-full flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <h2 className="text-base font-semibold text-gray-900">
                    {group.label} ({group.base})
                  </h2>
                  <p className="text-sm text-gray-600">{group.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function OnboardingTopicIslandPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
          <div className="text-gray-600">Loading...</div>
        </main>
      }
    >
      <OnboardingTopicIslandContent />
    </Suspense>
  );
}
