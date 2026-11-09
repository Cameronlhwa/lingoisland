// Browser persistence for onboarding. Before an account exists the answers
// live only here; once signed in they are also synced to the server.

import { LOCAL_STORAGE_KEY, parseState, type OnboardingState } from "./flow";

const ACTIVATION_KEY = "lingo_onboarding_activate_v1";

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function readLocalState(): OnboardingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return parseState(JSON.parse(raw), browserTimeZone());
  } catch {
    return null;
  }
}

export function writeLocalState(state: OnboardingState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (private mode): the flow still works, it just won't resume.
  }
}

export function clearLocalState() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVATION_KEY);
  } catch {
    // ignore
  }
}

/** Set when a committed learner leaves for Checkout, so the purchase can finish setting up their plan. */
export function markActivationPending() {
  try {
    window.localStorage.setItem(ACTIVATION_KEY, "1");
  } catch {
    // ignore
  }
}

export function isActivationPending() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ACTIVATION_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearActivationPending() {
  try {
    window.localStorage.removeItem(ACTIVATION_KEY);
  } catch {
    // ignore
  }
}

export type AccountKind = "guest" | "anonymous" | "user";

export type RemoteProgress = {
  account: { kind: AccountKind; firstName: string | null };
  state: OnboardingState | null;
  activatedAt: string | null;
};

export async function fetchRemoteProgress(): Promise<RemoteProgress> {
  const response = await fetch(`/api/onboarding/progress?tz=${encodeURIComponent(browserTimeZone())}`, { cache: "no-store" });
  const data = (await response.json().catch(() => null)) as {
    account?: { kind?: AccountKind; firstName?: string | null };
    progress?: Record<string, unknown> | null;
  } | null;
  const kind = data?.account?.kind;
  const account = {
    kind: kind === "user" || kind === "anonymous" ? kind : ("guest" as AccountKind),
    firstName: typeof data?.account?.firstName === "string" ? data.account.firstName : null,
  };
  if (!response.ok || !data?.progress) return { account, state: null, activatedAt: null };
  return {
    account,
    state: parseState(data.progress, browserTimeZone()),
    activatedAt: typeof data.progress.activatedAt === "string" ? data.progress.activatedAt : null,
  };
}

export async function resetRemoteProgress() {
  const response = await fetch("/api/onboarding/progress", { method: "DELETE" });
  if (response.status === 401) return { status: "guest" as const };
  if (!response.ok) return { status: "error" as const };
  return { status: "reset" as const };
}

export type SaveOutcome =
  | { status: "saved"; state: OnboardingState }
  | { status: "conflict"; state: OnboardingState | null }
  | { status: "error" };

export async function saveRemoteProgress(
  state: OnboardingState,
  currentStep: string,
  opts: { recordAssessment?: boolean; keepalive?: boolean } = {},
): Promise<SaveOutcome> {
  try {
    const response = await fetch("/api/onboarding/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      keepalive: opts.keepalive,
      body: JSON.stringify({
        state,
        currentStep,
        expectedRevision: state.revision,
        timezone: browserTimeZone(),
        recordAssessment: opts.recordAssessment === true,
      }),
    });
    const data = (await response.json().catch(() => null)) as { progress?: unknown } | null;
    if (response.status === 409) {
      return { status: "conflict", state: data?.progress ? parseState(data.progress, browserTimeZone()) : null };
    }
    if (!response.ok || !data?.progress) return { status: "error" };
    const saved = parseState(data.progress, browserTimeZone());
    return saved ? { status: "saved", state: saved } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

/** Fire-and-forget abandonment ping while the page is being hidden. */
export function sendAbandonBeacon(step: string, lastCompletedStep: string | null) {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
  const body = new Blob([JSON.stringify({ step, lastCompletedStep })], { type: "application/json" });
  navigator.sendBeacon("/api/onboarding/abandon", body);
}
