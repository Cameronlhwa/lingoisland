"use client";

import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense, type FormEvent } from "react";

function LoginPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Handle error from URL params (e.g., from failed OAuth)
  useEffect(() => {
    const error = searchParams.get("error");
    const nextFromQuery = searchParams.get("next");
    const autoGoogle = searchParams.get("autogoogle") === "1";
    if (!error && !autoGoogle) return;

    const keepNext =
      nextFromQuery && nextFromQuery.startsWith("/")
        ? `?next=${encodeURIComponent(nextFromQuery)}`
        : "";

    if (error === "identity_exists" || autoGoogle) {
      setStatusMessage(
        "That Google account already exists — signing you in…",
      );
      // Clear guest session, then OAuth-sign into the existing Google account.
      void (async () => {
        const { redirectTo, cookieOptions, origin } = getOAuthRedirectConfig();
        const nextPath =
          nextFromQuery && nextFromQuery.startsWith("/")
            ? nextFromQuery
            : "/app";
        localStorage.setItem("oauth_next", nextPath);
        document.cookie = `oauth_next=${encodeURIComponent(nextPath)}; ${cookieOptions}`;
        localStorage.setItem("oauth_origin", origin);
        document.cookie = `oauth_origin=${origin}; ${cookieOptions}`;

        await supabase.auth.signOut({ scope: "local" }).catch(() => null);
        const { error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (oauthErr) {
          setStatusMessage(null);
          setErrorMessage(
            "Could not continue with Google. Please try signing in below.",
          );
          router.replace(`/login${keepNext}`);
        }
      })();
      return;
    }

    if (error) {
      switch (error) {
        case "auth_failed":
          setErrorMessage("Authentication failed. Please try again.");
          break;
        case "oauth_expired":
          setErrorMessage("OAuth session expired. Please sign in again.");
          break;
        case "oauth_failed":
          setErrorMessage("Sign-in failed. Please try again.");
          break;
        case "verification_failed":
          setErrorMessage("Verification failed. Please try again.");
          break;
        default:
          setErrorMessage("An error occurred. Please try again.");
      }
      // Preserve ?next= when clearing the error flag
      router.replace(`/login${keepNext}`);
    }
  }, [searchParams, router, supabase]);

  const handleGoogleLogin = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const { origin, redirectTo, cookieOptions } = getOAuthRedirectConfig();

    // Prefer ?next= query (e.g. from onboarding), then pathname, else /app
    const nextFromQuery = searchParams.get("next");
    const nextPath =
      nextFromQuery && nextFromQuery.startsWith("/")
        ? nextFromQuery
        : pathname && pathname !== "/login"
          ? pathname
          : "/app";
    localStorage.setItem("oauth_next", nextPath);
    document.cookie = `oauth_next=${encodeURIComponent(nextPath)}; ${cookieOptions}`;

    localStorage.setItem("oauth_origin", origin);
    document.cookie = `oauth_origin=${origin}; ${cookieOptions}`;

    // Drop any lingering guest session so Google signs into the real account.
    await supabase.auth.signOut({ scope: "local" }).catch(() => null);

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
    // Create user_profiles (app settings)
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

    // Create profiles (billing)
    const { data: billingData, error: billingError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (billingError) {
      console.error("Error loading billing profile:", billingError);
      return;
    }

    if (!billingData) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          plan: "free",
        });

      if (insertError) {
        console.error("Error creating billing profile:", insertError);
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
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
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
        setStatusMessage(
          "Check your email! We sent you a verification link. Click it to complete your signup."
        );
        return;
      }

      const nextFromQuery = searchParams.get("next");
      const allowedOnboarding =
        nextFromQuery?.startsWith("/onboarding/topic-island") ||
        nextFromQuery?.startsWith("/onboarding/journey") ||
        nextFromQuery?.startsWith("/onboarding/upgrade") ||
        nextFromQuery?.startsWith("/onboarding/hsk");
      const isUnsafe =
        !nextFromQuery ||
        !nextFromQuery.startsWith("/") ||
        nextFromQuery === "/login" ||
        (nextFromQuery.startsWith("/onboarding") && !allowedOnboarding);
      const nextPath = isUnsafe ? "/app" : nextFromQuery;
      router.push(nextPath);
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
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white px-6">
          <div className="text-gray-600">Loading...</div>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
