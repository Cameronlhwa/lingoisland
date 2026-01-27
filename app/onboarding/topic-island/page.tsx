"use client";

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

type CEFRLevel =
  | "A2-"
  | "A2"
  | "A2+"
  | "B1-"
  | "B1"
  | "B1+"
  | "B2-"
  | "B2"
  | "B2+";

const LEVEL_GROUPS: {
  base: "A2" | "B1" | "B2";
  label: string;
  description: string;
  levels: CEFRLevel[];
}[] = [
  {
    base: "A2",
    label: "Upper beginner",
    description:
      "You can handle basics but still need support in most conversations (equivalent to HSK 3).",
    levels: ["A2-", "A2", "A2+"],
  },
  {
    base: "B1",
    label: "Intermediate",
    description:
      "You can talk about everyday topics but struggle with nuance and speed (equivalent to HSK 4-5).",
    levels: ["B1-", "B1", "B1+"],
  },
  {
    base: "B2",
    label: "Upper intermediate",
    description:
      "You follow most native content but still miss details and complex ideas (equivalent to HSK 5-6).",
    levels: ["B2-", "B2", "B2+"],
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

  const [state, setState] = useState<WizardState>({
    step: 1,
    cefrLevel: null,
    topic: "",
    wordCount: 12,
    grammarCount: 0,
    wantsGrammar: false,
  });

  const [displayedText, setDisplayedText] = useState("");
  const [currentPlaceholderIndex, setCurrentPlaceholderIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if user is already authenticated - if so, redirect to app
  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setCheckingAuth(false);

    // If user is authenticated and has a pending request, redirect to /app
    // so it can be processed
    if (user) {
      const pendingRequest = localStorage.getItem(STORAGE_KEY);
      if (pendingRequest) {
        router.replace("/app");
      }
    }
  };

  useEffect(() => {
    // Only animate placeholder when on step 2 and input is empty
    if (state.step !== 2 || state.topic.trim() !== "") {
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
          (prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length
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

  const handleLevelSelect = (level: CEFRLevel) => {
    // Check if there's a topic in the URL query params
    const topicFromUrl = searchParams.get("topic");
    setState({
      ...state,
      cefrLevel: level,
      step: 2,
      topic: topicFromUrl || state.topic,
    });
  };

  const handleTopicSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (state.topic.trim()) {
      setState({ ...state, step: 3 });
    }
  };

  const handleStartAuth = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    // Save wizard state to localStorage
    const pendingRequest = {
      cefrLevel: state.cefrLevel,
      topic: state.topic.trim(),
      wordCount: state.wordCount,
      grammarCount: 0,
      wantsGrammar: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingRequest));

    const { origin, redirectTo, cookieOptions } = getOAuthRedirectConfig();

    // Always redirect to /app after auth - it will handle the pending request
    const nextPath = "/app";
    localStorage.setItem("oauth_next", nextPath);
    document.cookie = `oauth_next=${nextPath}; ${cookieOptions}`;

    // Store the origin in both localStorage AND cookie (cookie is more reliable across redirects)
    localStorage.setItem("oauth_origin", origin);
    // Set cookie that expires in 10 minutes (enough for OAuth flow)
    document.cookie = `oauth_origin=${origin}; ${cookieOptions}`;

    // Start Google OAuth
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error("Error signing in:", error);
      setErrorMessage("Failed to sign in. Please try again.");
    }
  };

  const ensureUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error loading user profile:", error);
      return;
    }

    if (!data) {
      const { error: insertError } = await supabase
        .from("user_profiles")
        .insert({
          user_id: userId,
          cefr_level: "B1",
        });

      if (insertError) {
        console.error("Error creating user profile:", insertError);
      }
    }
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);

    const pendingRequest = {
      cefrLevel: state.cefrLevel,
      topic: state.topic.trim(),
      wordCount: state.wordCount,
      grammarCount: 0,
      wantsGrammar: false,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingRequest));

    try {
      const { data, error } = isSignUp
        ? await supabase.auth.signUp({
            email,
            password,
          })
        : await supabase.auth.signInWithPassword({
            email,
            password,
          });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.user?.id) {
        await ensureUserProfile(data.user.id);
      }

      if (!data.session && isSignUp) {
        setStatusMessage("Check your email to confirm your account.");
        return;
      }

      router.replace("/app");
    } finally {
      setIsSubmitting(false);
    }
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
          {[1, 2, 3].map((stepNum) => (
            <div
              key={stepNum}
              className={`h-1 w-16 ${
                state.step >= stepNum ? "bg-gray-900" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Level Selection */}
        {state.step === 1 && (
          <div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              What best describes your level?
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              Choose the row that feels closest. You can always change this
              later.
            </p>

            <div className="space-y-4">
              {LEVEL_GROUPS.map((group) => (
                <div
                  key={group.base}
                  className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between"
                >
                  <div className="max-w-sm">
                    <h2 className="text-base font-semibold text-gray-900">
                      {group.label} ({group.base})
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {group.description}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.levels.map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => handleLevelSelect(level)}
                        className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-900 hover:bg-gray-50"
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Topic + Word Count */}
        {state.step === 2 && (
          <div>
            <button
              onClick={() => setState({ ...state, step: 1 })}
              className="mb-8 text-sm text-gray-600 underline hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              What topic do you want to learn?
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              Choose something are interested in, like work, travel, food,
              anything~
            </p>
            <form onSubmit={handleTopicSubmit}>
              <div className="mb-8 relative">
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

              <div className="mb-8">
                <p className="mb-3 text-md text-black font-semibold">
                  How many new words related to this topic would you like to
                  learn?
                </p>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Word count: {state.wordCount} words
                </label>
                <input
                  type="range"
                  min="10"
                  max="20"
                  value={state.wordCount}
                  onChange={(e) =>
                    setState({ ...state, wordCount: parseInt(e.target.value) })
                  }
                  className="w-full"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-500">
                  <span>10</span>
                  <span>20</span>
                </div>
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

        {/* Step 3: Account Required */}
        {state.step === 3 && (
          <div>
            <button
              onClick={() => setState({ ...state, step: 2 })}
              className="mb-8 text-sm text-gray-600 underline hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              Create your account
            </h1>
            <p className="mb-8 text-lg leading-relaxed text-gray-600">
              We need an account to save your progress, avoid repeating topics,
              and enable daily review that adapts to your learning pace.
            </p>

            <div className="mb-8 space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-8 w-1 rounded-full bg-gray-900" />
                <div>
                  <div className="font-medium text-gray-900">
                    Save your progress
                  </div>
                  <div className="text-sm text-gray-600">
                    Your topic islands and review history stay with you
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-8 w-1 rounded-full bg-gray-900" />
                <div>
                  <div className="font-medium text-gray-900">
                    Personalized daily review
                  </div>
                  <div className="text-sm text-gray-600">
                    Spaced repetition that knows when you are about to forget
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-8 w-1 rounded-full bg-gray-900" />
                <div>
                  <div className="font-medium text-gray-900">
                    Track what you&apos;ve learned
                  </div>
                  <div className="text-sm text-gray-600">
                    Never repeat topics or lose your vocabulary
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartAuth}
              className="w-full rounded-lg border border-gray-900 bg-white px-6 py-4 text-base font-medium uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50"
            >
              Continue with Google
            </button>

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-sm font-medium uppercase tracking-wide text-gray-400">
                Or
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              {errorMessage ? (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}
              {statusMessage ? (
                <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  {statusMessage}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-gray-900 px-6 py-4 text-base font-medium uppercase tracking-wide text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isSubmitting
                  ? "Please wait..."
                  : isSignUp
                  ? "Create account"
                  : "Sign in with email"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setIsSignUp((prev) => !prev);
                setStatusMessage(null);
                setErrorMessage(null);
              }}
              className="mt-4 w-full text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              {isSignUp
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </button>
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
