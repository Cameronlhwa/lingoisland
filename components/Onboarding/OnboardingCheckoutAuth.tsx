"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import type { CheckoutPlan } from "@/lib/onboarding/onboardingCheckoutStorage";

interface OnboardingCheckoutAuthProps {
  plan: CheckoutPlan;
  returnPath: string;
  onComplete: () => void;
  onCancel: () => void;
}

export default function OnboardingCheckoutAuth({
  plan,
  returnPath,
  onComplete,
  onCancel,
}: OnboardingCheckoutAuthProps) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAnonymous(user?.is_anonymous ?? false);
    });
  }, [supabase]);

  const ensureProfiles = async (userId: string) => {
    const { data: up } = await supabase
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!up) {
      await supabase.from("user_profiles").insert({
        user_id: userId,
        cefr_level: "B1",
      });
    }
    const { data: billing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();
    if (!billing) {
      await supabase.from("profiles").insert({ id: userId, plan: "free" });
    }
  };

  const handleGoogle = async () => {
    setErrorMessage(null);
    setLinking(true);
    const { redirectTo, cookieOptions } = getOAuthRedirectConfig();
    const next = `${returnPath}${returnPath.includes("?") ? "&" : "?"}autoCheckout=1&plan=${plan}`;
    document.cookie = `oauth_next=${next}; ${cookieOptions}`;
    localStorage.setItem("oauth_next", next);

    if (isAnonymous) {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setErrorMessage(error.message || "Could not link Google account.");
        setLinking(false);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setErrorMessage(error.message || "Google sign-in failed.");
      setLinking(false);
    }
  };

  const handleEmail = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      if (isAnonymous) {
        const { error: updateErr } = await supabase.auth.updateUser({
          email,
          password,
        });
        if (updateErr) {
          setErrorMessage(updateErr.message);
          return;
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) await ensureProfiles(user.id);
        onComplete();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      if (data.user?.id) await ensureProfiles(data.user.id);
      if (!data.session) {
        setStatusMessage("Check your email to confirm, then return here.");
        return;
      }
      onComplete();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#071E2E]/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#C2DCF0] bg-white p-6 shadow-xl">
        <h3
          className="text-xl font-bold text-[#071E2E]"
          style={{ fontFamily: "'Lora', Georgia, serif" }}
        >
          Create your account to continue
        </h3>
        <p
          className="mt-2 text-sm text-[#5A7A90]"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Save your journey and unlock the full path. You&apos;ll go to secure
          checkout right after sign-up.
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={linking}
          className="mt-5 flex w-full items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60"
        >
          {linking ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#2176AE] focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#2176AE] focus:outline-none"
          />
          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          {statusMessage ? (
            <p className="text-sm text-emerald-700">{statusMessage}</p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#2176AE] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? "Creating account…" : "Create account & continue"}
          </button>
        </form>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 w-full text-center text-xs text-[#8AABBF] hover:text-[#5A7A90]"
        >
          Back to plan selection
        </button>
      </div>
    </div>
  );
}
