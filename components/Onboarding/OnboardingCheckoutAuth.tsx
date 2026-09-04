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
    const sep = returnPath.includes("?") ? "&" : "?";
    const next = `${returnPath}${sep}resume=1&autoCheckout=1&plan=${plan}`;
    // Encode so query `&` in the path survive the cookie round-trip.
    document.cookie = `oauth_next=${encodeURIComponent(next)}; ${cookieOptions}`;
    localStorage.setItem("oauth_next", next);

    // Always sign OUT of the guest session first, then sign INTO Google.
    // linkIdentity fails when that Google identity already belongs to an
    // existing Pro account, and can leave the anonymous JWT in place after
    // a "successful" callback — which is what trapped users on the paywall.
    await supabase.auth.signOut({ scope: "local" }).catch(() => null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setErrorMessage(error.message || "Google sign-in failed.");
      setLinking(false);
    }
  };

  const confirmEmailForCheckout = async (
    userId: string,
    accountEmail: string,
  ): Promise<{ email: string; tokenHash?: string }> => {
    const res = await fetch("/api/auth/confirm-for-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email: accountEmail }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || "Could not finish account setup");
    }
    return {
      email: typeof data.email === "string" ? data.email : accountEmail,
      tokenHash:
        typeof data.tokenHash === "string" ? data.tokenHash : undefined,
    };
  };

  /** Confirm email and open a real non-anonymous session, then continue checkout. */
  const completeSignup = async (userId: string, accountEmail: string) => {
    const confirmed = await confirmEmailForCheckout(userId, accountEmail);

    if (confirmed.tokenHash) {
      const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: confirmed.tokenHash,
        type: "email",
      });
      if (!otpErr && otpData.user && !otpData.user.is_anonymous) {
        await ensureProfiles(otpData.user.id);
        onComplete();
        return;
      }
    }

    await supabase.auth.refreshSession().catch(() => null);
    const {
      data: { user: refreshed },
    } = await supabase.auth.getUser();
    if (refreshed && !refreshed.is_anonymous) {
      await ensureProfiles(refreshed.id);
      onComplete();
      return;
    }

    // Clear guest JWT, then password sign-in against the confirmed account.
    await supabase.auth.signOut({ scope: "local" }).catch(() => null);
    const { data: signedIn, error } = await supabase.auth.signInWithPassword({
      email: confirmed.email || accountEmail,
      password,
    });
    if (error || !signedIn.user || signedIn.user.is_anonymous) {
      throw new Error(
        error?.message ||
          "Account created, but we could not start your session. Please try Google, or refresh and try again.",
      );
    }
    await ensureProfiles(signedIn.user.id);
    onComplete();
  };

  /** Primary path: create an account (sign up), not log in. */
  const signUpWithEmail = async () => {
    const trimmedEmail = email.trim();

    const { data: signedUp, error: signUpErr } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (signUpErr) {
      // Only fall back to login when signup says the email is taken.
      if (/already|registered|exists/i.test(signUpErr.message)) {
        const { data: signedIn, error: signInErr } =
          await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });
        if (!signInErr && signedIn.user) {
          await ensureProfiles(signedIn.user.id);
          if (signedIn.user.is_anonymous) {
            await completeSignup(signedIn.user.id, trimmedEmail);
            return;
          }
          onComplete();
          return;
        }
        setErrorMessage(
          "That email is already registered. Use the same password, or continue with Google.",
        );
        return;
      }
      setErrorMessage(signUpErr.message);
      return;
    }

    const newUser = signedUp.user;
    if (!newUser?.id) {
      setErrorMessage("Could not create your account. Please try again.");
      return;
    }

    // Supabase anti-enumeration: existing email can return a user with no identities.
    if (Array.isArray(newUser.identities) && newUser.identities.length === 0) {
      const { data: signedIn, error: signInErr } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
      if (!signInErr && signedIn.user) {
        await ensureProfiles(signedIn.user.id);
        onComplete();
        return;
      }
      setErrorMessage(
        "That email is already registered. Use the same password, or continue with Google.",
      );
      return;
    }

    if (signedUp.session && !newUser.is_anonymous) {
      await ensureProfiles(newUser.id);
      onComplete();
      return;
    }

    await completeSignup(newUser.id, trimmedEmail);
  };

  /** Guest onboarding: attach email/password to the anonymous user (still a signup). */
  const convertGuestToAccount = async () => {
    const trimmedEmail = email.trim();
    const { error: updateErr } = await supabase.auth.updateUser({
      email: trimmedEmail,
      password,
    });

    if (!updateErr) {
      await supabase.auth.refreshSession().catch(() => null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage("Could not finish account setup. Please try again.");
        return;
      }
      if (!user.is_anonymous) {
        await ensureProfiles(user.id);
        onComplete();
        return;
      }
      await completeSignup(user.id, trimmedEmail);
      return;
    }

    const msg = updateErr.message || "";

    // Password already set on this guest — just attach email / confirm.
    if (/different from the old password/i.test(msg)) {
      const { error: emailOnlyErr } = await supabase.auth.updateUser({
        email: trimmedEmail,
      });
      if (!emailOnlyErr) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await completeSignup(user.id, trimmedEmail);
          return;
        }
      }
    }

    // Email already used on another account — fall back to signup/login helpers.
    if (/already|registered|exists/i.test(msg)) {
      await supabase.auth.signOut().catch(() => null);
      await signUpWithEmail();
      return;
    }

    setErrorMessage(msg);
  };

  const handleEmail = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (isAnonymous) {
        await convertGuestToAccount();
      } else {
        await signUpWithEmail();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
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
          Sign in to continue
        </h3>
        <p
          className="mt-2 text-sm text-[#5A7A90]"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Create an account or sign in with an existing one to unlock your
          personalized path. You&apos;ll go to secure checkout right after — or
          straight into the app if you already have Pro.
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
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#2176AE] focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-[#2176AE] focus:outline-none"
          />
          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-[#2176AE] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? "Continuing…" : "Continue with email"}
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
