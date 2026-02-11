"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import { useRouter } from "next/navigation";

// Base CEFR levels for onboarding (simplified)
type Level = "A1" | "A2" | "B1" | "B2" | "C1";

// Extended levels are still valid for existing users
type ExtendedLevel =
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
  base: Level;
  label: string;
  description: string;
}[] = [
  {
    base: "A1",
    label: "Beginner",
    description:
      "Just starting out with basic phrases and survival vocabulary (HSK 1-2).",
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
      "You can talk about everyday topics but struggle with nuance (HSK 4-5).",
  },
  {
    base: "B2",
    label: "Upper intermediate",
    description:
      "You follow most native content but miss some details (HSK 5-6).",
  },
  {
    base: "C1",
    label: "Advanced",
    description:
      "You're fluent but still learning sophisticated vocabulary and idioms.",
  },
];

const STORAGE_KEY = "pending_story_request";

const TOPIC_SUGGESTIONS = [
  "A rainy day coffee shop conversation",
  "Missing the last train home",
  "Planning a surprise birthday",
  "Getting lost in a new city",
];

export default function OnboardingStoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [requestedWords, setRequestedWords] = useState<string[]>([]);
  const [wordInput, setWordInput] = useState("");
  const [lengthChars, setLengthChars] = useState(200);
  const [level, setLevel] = useState<Level>("B1");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setCheckingAuth(false);

      if (user) {
        const pendingRequest = localStorage.getItem(STORAGE_KEY);
        if (pendingRequest) {
          router.replace("/app/stories/new");
        }
      }
    };

    checkAuthAndRedirect();
  }, [router, supabase]);

  const addRequestedWords = (value: string) => {
    const next = value
      .split(/[,，\n]/g)
      .map((item) => item.trim())
      .filter(Boolean);
    if (next.length === 0) return;
    setRequestedWords((prev) => Array.from(new Set([...prev, ...next])));
    setWordInput("");
  };

  const handleStartAuth = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const pendingRequest = {
      topic: topic.trim(),
      requested_words: requestedWords,
      level,
      length_chars: lengthChars,
      auto_submit: true,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingRequest));

    const { origin, redirectTo, cookieOptions } = getOAuthRedirectConfig();

    const nextPath = "/app/stories/new";
    localStorage.setItem("oauth_next", nextPath);
    document.cookie = `oauth_next=${nextPath}; ${cookieOptions}`;

    localStorage.setItem("oauth_origin", origin);
    document.cookie = `oauth_origin=${origin}; ${cookieOptions}`;

    // Track entry source for onboarding nudges (first-time experience)
    document.cookie = `onboarding_entry=story; ${cookieOptions}`;

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
      topic: topic.trim(),
      requested_words: requestedWords,
      level,
      length_chars: lengthChars,
      auto_submit: true,
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

      router.replace("/app/stories/new");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canContinue =
    step === 1 || // Level selection (auto-advances)
    (step === 2 && topic.trim().length > 0) ||
    (step === 3 && lengthChars >= 50 && lengthChars <= 500);

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
        <div className="mb-12 flex justify-center gap-4">
          {[1, 2, 3, 4].map((stepNum) => (
            <div
              key={stepNum}
              className={`h-1 w-16 ${
                step >= stepNum ? "bg-gray-900" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
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
                <button
                  key={group.base}
                  type="button"
                  onClick={() => {
                    setLevel(group.base);
                    setStep(2);
                  }}
                  className="flex w-full flex-col gap-2 rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-gray-900 hover:bg-gray-50"
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

        {step === 2 && (
          <div>
            <button
              onClick={() => setStep(1)}
              className="mb-8 text-sm text-gray-600 underline hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              What do you want the story to be about?
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              Describe the scene or situation. We&apos;ll build a story around it.
            </p>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={4}
              placeholder="Describe the vibe, setting, or scenario..."
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base focus:border-gray-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() =>
                setTopic(
                  TOPIC_SUGGESTIONS[
                    Math.floor(Math.random() * TOPIC_SUGGESTIONS.length)
                  ]
                )
              }
              className="mt-4 rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
            >
              Random suggestion
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8">
            <button
              onClick={() => setStep(2)}
              className="mb-4 text-sm text-gray-600 underline hover:text-gray-900"
            >
              ← Back
            </button>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Specific words (optional)
              </label>
              <div className="flex gap-2">
                <input
                  value={wordInput}
                  onChange={(e) => setWordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addRequestedWords(wordInput);
                    }
                  }}
                  placeholder="Type hanzi, pinyin, or English..."
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => addRequestedWords(wordInput)}
                  className="rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
                >
                  Add
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Separate words with commas or new lines.
              </p>
              {requestedWords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {requestedWords.map((word) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {word}
                      <button
                        type="button"
                        onClick={() =>
                          setRequestedWords((prev) =>
                            prev.filter((item) => item !== word)
                          )
                        }
                        className="text-gray-500 hover:text-gray-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Length (characters)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  min={50}
                  max={500}
                  value={lengthChars}
                  onChange={(e) => setLengthChars(Number(e.target.value))}
                  className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                />
                <input
                  type="range"
                  min={50}
                  max={500}
                  value={lengthChars}
                  onChange={(e) => setLengthChars(Number(e.target.value))}
                  className="flex-1"
                />
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-600">
                Current level: <span className="font-medium text-gray-900">{level}</span>
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <button
              onClick={() => setStep(3)}
              className="mb-8 text-sm text-gray-600 underline hover:text-gray-900"
            >
              ← Back
            </button>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              Create your account
            </h1>
            <p className="mb-8 text-lg leading-relaxed text-gray-600">
              We need an account to save your stories and keep your learning
              history synced across devices.
            </p>
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
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 text-base text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="h-5 w-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
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

        {step === 2 && (
          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!canContinue}
              className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}
        
        {step === 3 && (
          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={!canContinue}
              className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

