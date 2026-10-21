"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import AppLogo from "@/components/app/AppLogo";
import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import type { CheckoutPlan } from "@/lib/onboarding/onboardingCheckoutStorage";

interface OnboardingCheckoutAuthProps {
  plan: CheckoutPlan;
  returnPath: string;
  onComplete: () => void;
  onCancel: () => void;
  /** Cover the page until Stripe opens, so auth state changes cannot swap screens. */
  onHandoffStart?: () => void;
  onHandoffEnd?: () => void;
}

export function CheckoutHandoff() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#5F3119]/50 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[22px] border border-[#C2DCF0] bg-white px-6 py-8 text-center shadow-xl"
        style={{ boxShadow: "0 20px 48px -20px rgba(7,30,46,0.45)" }}
      >
        <p
          className="text-lg font-bold text-[#5F3119]"
          style={{ fontFamily: "var(--font-home-display), Nunito, system-ui, sans-serif" }}
        >
          Taking you to checkout…
        </p>
        <p
          className="mt-2 text-sm text-[#5A7A90]"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          This only takes a moment.
        </p>
      </div>
    </div>
  );
}

export default function OnboardingCheckoutAuth({
  plan,
  returnPath,
  onComplete,
  onCancel,
  onHandoffStart,
  onHandoffEnd,
}: OnboardingCheckoutAuthProps) {
  const supabase = createClient();
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const handedOffRef = useRef(false);
  const finish = () => {
    handedOffRef.current = true;
    onCompleteRef.current();
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linking, setLinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"signup" | "signin">("signup");

  const switchMode = (next: "signup" | "signin") => {
    setMode(next);
    setErrorMessage(null);
  };

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
    onHandoffStart?.();
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
      onHandoffEnd?.();
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
      body: JSON.stringify({ userId, email: accountEmail, password }),
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
        finish();
        return;
      }
    }

    await supabase.auth.refreshSession().catch(() => null);
    const {
      data: { user: refreshed },
    } = await supabase.auth.getUser();
    if (refreshed && !refreshed.is_anonymous) {
      await ensureProfiles(refreshed.id);
      finish();
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
    finish();
  };

  /** Primary path: create an account (sign up), not log in. */
  const signUpWithEmail = async () => {
    const trimmedEmail = email.trim();

    const { data: signedUp, error: signUpErr } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
    });

    if (signUpErr) {
      if (/already|registered|exists/i.test(signUpErr.message)) {
        await continueExistingEmail(trimmedEmail);
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
    // That includes the unconfirmed account created on a previous attempt.
    if (Array.isArray(newUser.identities) && newUser.identities.length === 0) {
      await continueExistingEmail(trimmedEmail);
      return;
    }

    if (signedUp.session && !newUser.is_anonymous) {
      await ensureProfiles(newUser.id);
      finish();
      return;
    }

    await completeSignup(newUser.id, trimmedEmail);
  };

  /**
   * Email is already registered. If this is the unconfirmed signup from a
   * moment ago, finish it and continue to checkout. Otherwise open sign-in.
   */
  const continueExistingEmail = async (accountEmail: string) => {
    try {
      await supabase.auth.signOut({ scope: "local" }).catch(() => null);
      await completeSignup("", accountEmail);
    } catch {
      setMode("signin");
      setErrorMessage(
        "That email already has an account. Sign in to continue.",
      );
    }
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
        finish();
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

    // Email already used on another account — finish an unconfirmed signup, or
    // open the sign-in modal when the password does not match.
    if (/already|registered|exists/i.test(msg)) {
      await continueExistingEmail(trimmedEmail);
      return;
    }

    setErrorMessage(msg);
  };

  /** Existing account: replace the guest session, then continue to checkout. */
  const signInWithEmail = async () => {
    const trimmedEmail = email.trim();
    await supabase.auth.signOut({ scope: "local" }).catch(() => null);
    const { data: signedIn, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (error || !signedIn.user || signedIn.user.is_anonymous) {
      const code = (error as { code?: string } | null)?.code ?? "";
      if (
        code === "email_not_confirmed" ||
        /not confirmed/i.test(error?.message ?? "")
      ) {
        await completeSignup("", trimmedEmail);
        return;
      }
      setErrorMessage(
        error?.message || "Could not sign in. Check your email and password.",
      );
      return;
    }
    await ensureProfiles(signedIn.user.id);
    finish();
  };

  const handleEmail = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    handedOffRef.current = false;
    onHandoffStart?.();
    try {
      if (mode === "signin") {
        await signInWithEmail();
      } else if (isAnonymous) {
        await convertGuestToAccount();
      } else {
        await signUpWithEmail();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      if (!handedOffRef.current) onHandoffEnd?.();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#5F3119]/50 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[22px] border border-[#C2DCF0] bg-white p-6 shadow-xl sm:p-7"
        style={{ boxShadow: "0 20px 48px -20px rgba(7,30,46,0.45)" }}
      >
        <AppLogo
          size="sm"
          showMark={false}
          textClassName="text-sm font-bold text-[#5F3119]"
        />
        <h3
          className="mt-5 text-2xl font-bold text-[#5F3119]"
          style={{ fontFamily: 'var(--font-home-display), Nunito, system-ui, sans-serif' }}
        >
          {mode === "signin" ? "Sign in" : "Create an account"}
        </h3>
        <p
          className="mt-2 text-sm text-[#5A7A90]"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {mode === "signin"
            ? "Sign in with your existing account. You'll continue to secure checkout, or straight into the app if you already have Pro."
            : "Create an account to unlock your personalized plan. You'll go to secure checkout right after."}
        </p>
        <p
          className="mt-2 text-xs text-[#8AABBF]"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {mode === "signin" ? (
            <>
              New here?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className="font-semibold text-[#5F3119] underline decoration-[#C2DCF0] underline-offset-2 hover:text-[#20674F]"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="font-semibold text-[#5F3119] underline decoration-[#C2DCF0] underline-offset-2 hover:text-[#20674F]"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={linking}
          className="mt-5 flex w-full items-center justify-center rounded-xl border border-[#C2DCF0] bg-white px-4 py-3 text-sm font-semibold text-[#5F3119] transition-colors hover:bg-[#EAF6FB] disabled:opacity-60"
        >
          {linking
            ? "Connecting…"
            : mode === "signin"
              ? "Sign in with Google"
              : "Continue with Google"}
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#C2DCF0]" />
          <span className="text-xs text-[#8AABBF]">or</span>
          <div className="h-px flex-1 bg-[#C2DCF0]" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-[#C2DCF0] px-4 py-3 text-sm text-[#5F3119] focus:border-[#20674F] focus:outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (6+ characters)"
            className="w-full rounded-xl border border-[#C2DCF0] px-4 py-3 text-sm text-[#5F3119] focus:border-[#20674F] focus:outline-none"
          />
          {errorMessage ? (
            <p className="text-sm text-red-600">{errorMessage}</p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#5F3119] py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
          >
            {isSubmitting
              ? mode === "signin"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
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
