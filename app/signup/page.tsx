"use client";

import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import { useAnalytics } from "@/lib/posthog/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, type FormEvent } from "react";

const FEATURES = [
  { emoji: "🗺️", title: "Topic Islands", desc: "Get vocab + native example sentences for any topic you care about" },
  { emoji: "📖", title: "Stories", desc: "Read short stories built from the words you're learning" },
  { emoji: "🃏", title: "Quizzes", desc: "Flashcards and drag-and-drop matching to lock in what you've learned" },
  { emoji: "🤖", title: "AI Tutor", desc: "Ask 华华 anything — grammar, usage, pronunciation — instantly" },
];

function SignupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { captureEvent } = useAnalytics();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [linking, setLinking] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(null);

  const nextPath = (() => {
    const candidate = searchParams.get("next") ?? searchParams.get("redirect");
    const isSafeInternal =
      typeof candidate === "string" &&
      candidate.startsWith("/") &&
      !candidate.startsWith("//") &&
      !candidate.includes("\\");
    const base = isSafeInternal ? candidate : "/app";
    if (searchParams.get("checkout") !== "1") return base;
    const plan = searchParams.get("plan");
    if (plan !== "monthly" && plan !== "yearly") return base;
    const url = new URL(base, "http://local");
    url.searchParams.set("autoCheckout", "1");
    url.searchParams.set("plan", plan);
    return `${url.pathname}${url.search}`;
  })();
  const fromSidebar = searchParams.get("from") === "sidebar";
  const featureName = searchParams.get("feature") ?? "";

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAnonymous(user?.is_anonymous ?? false);
      if (user && !user.is_anonymous) {
        router.replace(nextPath);
      }
    });
  }, [nextPath, router]);

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
      await supabase.from("user_profiles").insert({
        user_id: userId,
        cefr_level: "B1",
      });
    }
    const { data: billingData, error: billingError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!billingError && !billingData) {
      await supabase.from("profiles").insert({ id: userId, plan: "free" });
    }
  };

  const handleGoogleSignup = async () => {
    setErrorMessage(null);
    setLinking(true);
    captureEvent("signup_initiated", { method: "google", from: fromSidebar ? "sidebar" : "direct", feature: featureName || undefined });
    const { redirectTo, cookieOptions } = getOAuthRedirectConfig();
    document.cookie = `oauth_next=${nextPath}; ${cookieOptions}`;
    localStorage.setItem("oauth_next", nextPath);

    if (isAnonymous) {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setErrorMessage(error.message || "Could not link Google. Try again.");
        setLinking(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setErrorMessage(error.message || "Failed to sign in with Google.");
        setLinking(false);
        return;
      }
    }
    setLinking(false);
  };

  const handleEmailSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    captureEvent("signup_initiated", { method: "email", from: fromSidebar ? "sidebar" : "direct", feature: featureName || undefined });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (data.user?.id) {
        await ensureUserProfile(data.user.id);
      }
      if (!data.session && data.user) {
        captureEvent("signup_completed", { method: "email", requires_verification: true });
        setStatusMessage(
          "Check your email! We sent you a verification link. Click it to complete your signup."
        );
        return;
      }
      captureEvent("signup_completed", { method: "email", requires_verification: false });
      router.push(nextPath);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAnonymous === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6">
        <div className="text-gray-600">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <div className="w-full max-w-md">
        {fromSidebar ? (
          <div className="mb-10 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-gray-400">Free forever</p>
            <h1 className="mb-3 text-4xl font-bold text-gray-900">
              {featureName ? `Unlock ${featureName}` : "Try everything for free"}
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              Create a free account and get instant access to every feature — no credit card needed.
            </p>
            <div className="mb-8 grid grid-cols-2 gap-3 text-left">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-1 text-xl">{f.emoji}</div>
                  <div className="mb-0.5 text-sm font-semibold text-gray-900">{f.title}</div>
                  <div className="text-xs text-gray-500 leading-snug">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-12 text-center">
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              Create your account
            </h1>
            <p className="text-lg text-gray-600">
              Sign up with Google or email to save your progress
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={linking}
          className="w-full rounded-lg border-2 border-gray-900 bg-gray-900 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-70"
        >
          {linking ? "Redirecting…" : "Continue with Google"}
        </button>

        <div className="my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-sm font-medium uppercase tracking-wide text-gray-400">
            Or
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleEmailSignup} className="space-y-4">
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
              onChange={(e) => setEmail(e.target.value)}
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
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 pr-12 text-base text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
          {errorMessage && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          {statusMessage && (
            <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              {statusMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-gray-900 px-6 py-4 text-base font-medium uppercase tracking-wide text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Please wait…" : "Create account with email"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <a
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-gray-900 underline hover:no-underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white px-6">
          <div className="text-gray-600">Loading...</div>
        </main>
      }
    >
      <SignupPageContent />
    </Suspense>
  );
}
