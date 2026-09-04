export type CheckoutPlan = "monthly" | "yearly";

export type JourneyNodeSnapshot = {
  order: number;
  name: string;
  zh: string | null;
  node_type: "island" | "story";
  hint: string | null;
};

export type OnboardingUpgradeSnapshot = {
  v: 1;
  islandId: string;
  topic: string;
  journeyTopic?: string;
  islandLevel?: string;
  islandName?: string;
  wordsLearned?: number;
  wordsPerWeek?: number;
  lockedIslands?: JourneyNodeSnapshot[];
  plan: CheckoutPlan;
  /** e.g. Work / Travel — shown on the Mandarin plan reveal */
  motivationLabel?: string;
};

const SNAPSHOT_KEY = "lingo_onboarding_checkout_v1";
const PENDING_KEY = "lingo_onboarding_upgrade_pending";

export function markUpgradePending(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_KEY, "1");
}

export function clearUpgradePending(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_KEY);
}

export function isUpgradePending(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PENDING_KEY) === "1";
}

export function writeUpgradeSnapshot(
  snapshot: OnboardingUpgradeSnapshot,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function readUpgradeSnapshot(): OnboardingUpgradeSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OnboardingUpgradeSnapshot;
    if (parsed?.v !== 1 || !parsed.islandId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function updateSnapshotPlan(plan: CheckoutPlan): void {
  const existing = readUpgradeSnapshot();
  if (!existing) return;
  writeUpgradeSnapshot({ ...existing, plan });
}

export function buildUpgradePageUrl(
  islandId: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({ islandId, ...extra });
  return `/onboarding/upgrade?${params.toString()}`;
}
