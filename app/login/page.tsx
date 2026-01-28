"use client";

import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import { useRouter, usePathname } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const { origin, redirectTo, cookieOptions } = getOAuthRedirectConfig();

    // Store the next path separately (will be read from cookie in callback)
    // Don't redirect back to /login - default to /app instead
    const nextPath = pathname && pathname !== "/login" ? pathname : "/app";
    localStorage.setItem("oauth_next", nextPath);
    document.cookie = `oauth_next=${nextPath}; ${cookieOptions}`;

    // Store the origin in both localStorage AND cookie (cookie is more reliable across redirects)
    localStorage.setItem("oauth_origin", origin);
    // Set cookie that expires in 10 minutes (enough for OAuth flow)
    document.cookie = `oauth_origin=${origin}; ${cookieOptions}`;

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

      router.push("/app");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-md">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Welcome to LingoIsland
          </h1>
          <p className="text-lg text-gray-600">
            Sign in to start building your vocabulary
          </p>
        </div>

        <button
          onClick={handleGoogleLogin}
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
    </main>
  );
}
