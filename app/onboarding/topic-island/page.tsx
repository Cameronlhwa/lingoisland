"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter, usePathname } from "next/navigation";

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
  grammarCount: 1 | 2 | 3;
  wantsGrammar: boolean;
}

const STORAGE_KEY = "pending_topic_island_request";

export default function OnboardingTopicIslandPage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [state, setState] = useState<WizardState>({
    step: 1,
    cefrLevel: null,
    topic: "",
    wordCount: 12,
    grammarCount: 2,
    wantsGrammar: true,
  });

  const handleLevelSelect = (level: CEFRLevel) => {
    setState({ ...state, cefrLevel: level, step: 2 });
  };

  const handleTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.topic.trim()) {
      setState({ ...state, step: 3 });
    }
  };

  const handleStartAuth = async () => {
    // Save wizard state to localStorage
    const pendingRequest = {
      cefrLevel: state.cefrLevel,
      topic: state.topic.trim(),
      wordCount: state.wordCount,
      grammarCount: state.grammarCount,
      wantsGrammar: state.wantsGrammar,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingRequest));

    // Pass redirectTo WITHOUT query parameters (Supabase validates exact match)
    const redirectTo = `${location.origin}/auth/callback`;

    // Store the next path separately (will be read from cookie in callback)
    const nextPath = pathname || "/app";
    localStorage.setItem("oauth_next", nextPath);
    document.cookie = `oauth_next=${nextPath}; path=/; max-age=600; SameSite=Lax`;

    // Store the origin in both localStorage AND cookie (cookie is more reliable across redirects)
    localStorage.setItem("oauth_origin", location.origin);
    // Set cookie that expires in 10 minutes (enough for OAuth flow)
    document.cookie = `oauth_origin=${location.origin}; path=/; max-age=600; SameSite=Lax`;

    // Start Google OAuth
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });

    if (error) {
      console.error("Error signing in:", error);
      alert("Failed to sign in. Please try again.");
    }
  };

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
              Choose something you&apos;re interested in—work, travel, food,
              anything
            </p>
            <form onSubmit={handleTopicSubmit}>
              <div className="mb-8">
                <input
                  type="text"
                  value={state.topic}
                  onChange={(e) =>
                    setState({ ...state, topic: e.target.value })
                  }
                  placeholder="e.g., Cooking, Travel, Business"
                  className="w-full border border-gray-300 bg-white px-4 py-3 text-base focus:border-gray-900 focus:outline-none"
                  required
                />
              </div>

              <div className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <label className="block text-sm font-medium text-gray-900">
                      Focus on new grammar?
                    </label>
                    <p className="mt-1 text-sm text-gray-600">
                      If enabled, some example sentences will highlight new
                      patterns.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setState({ ...state, wantsGrammar: !state.wantsGrammar })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      state.wantsGrammar ? "bg-gray-900" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        state.wantsGrammar ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {state.wantsGrammar && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium text-gray-900">
                      How many grammar patterns to focus on?
                    </p>
                    <p className="mb-3 text-sm text-gray-600">
                      Grammar patterns will appear naturally in some example
                      sentences.
                    </p>
                    <div className="flex gap-3">
                      {([1, 2, 3] as const).map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() =>
                            setState({ ...state, grammarCount: count })
                          }
                          className={`flex-1 rounded-lg border px-6 py-3 text-base font-medium transition-colors ${
                            state.grammarCount === count
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-300 bg-white text-gray-900 hover:border-gray-900"
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-8">
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
                    Spaced repetition that knows when you&apos;re about to
                    forget
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
          </div>
        )}
      </div>
    </main>
  );
}
