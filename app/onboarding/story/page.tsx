"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import { useRouter } from "next/navigation";

type Level = "A2" | "B1" | "B2" | "C1";

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

  const canContinue =
    (step === 1 && topic.trim().length > 0) ||
    (step === 2 && lengthChars >= 50 && lengthChars <= 500);

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
          {[1, 2, 3].map((stepNum) => (
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

        {step === 2 && (
          <div className="space-y-8">
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
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-gray-900 focus:outline-none"
              >
                <option value="A2">A2 - Upper Beginner</option>
                <option value="B1">B1 - Intermediate</option>
                <option value="B2">B2 - Upper Intermediate</option>
                <option value="C1">C1 - Advanced</option>
              </select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <button
              onClick={() => setStep(2)}
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
          </div>
        )}

        {step < 3 && (
          <div className="mt-10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              disabled={step === 1}
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep((prev) => Math.min(3, prev + 1))}
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

