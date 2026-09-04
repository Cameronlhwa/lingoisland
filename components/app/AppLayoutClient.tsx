"use client";

import { useState, createContext, useContext, useMemo, useEffect, useCallback } from "react";
import { TbMap2 } from "react-icons/tb";
import { PiBookOpenTextLight } from "react-icons/pi";
import { BsCardChecklist } from "react-icons/bs";
import { TbRobot } from "react-icons/tb";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Sidebar from "@/components/app/Sidebar";
import SideUpgradeModal from "@/components/app/SideUpgradeModal";
import MobileTabBar from "@/components/app/MobileTabBar";
import AppLogo from "@/components/app/AppLogo";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/contexts/OnboardingContext";
import { ProgressIslandUpgradeProvider } from "@/contexts/ProgressIslandUpgradeContext";
import OnboardingNudgeCard from "@/components/Onboarding/OnboardingNudgeCard";
import OnboardingNudgeBanner from "@/components/Onboarding/OnboardingNudgeBanner";
import ProgressIslandUpgradePopup from "@/components/app/ProgressIslandUpgradePopup";
import type { EntrySource } from "@/types/onboarding";
import { createClient } from "@/lib/supabase/browser";
import {
  evaluateJourneyOnboardingGate,
  markJourneyOnboardingComplete,
} from "@/lib/onboarding/journeyOnboardingGate";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";
import {
  buildUpgradePageUrl,
  clearUpgradePending,
  isUpgradePending,
  readUpgradeSnapshot,
} from "@/lib/onboarding/onboardingCheckoutStorage";
import {
  invalidateSubscriptionCache,
  useSubscription,
} from "@/hooks/useSubscription";

const SIGNUP_FEATURES = [
  {
    icon: TbMap2,
    title: "Topic Islands",
    desc: "Vocab + native example sentences for any topic",
  },
  {
    icon: PiBookOpenTextLight,
    title: "Stories",
    desc: "Short stories built from words you're learning",
  },
  {
    icon: BsCardChecklist,
    title: "Quizzes",
    desc: "Flashcards and matching to lock in what you know",
  },
  {
    icon: TbRobot,
    title: "Mandarin Assistant",
    desc: "Ask 华华 anything — grammar, usage, pronunciation",
  },
];

// Create a context for sidebar + global signup modal state
const SidebarContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openAccountModal: (tab?: "subscription" | "profile") => void;
  openSignupModal: (feature?: string) => void;
  isAnonymous: boolean;
  productTrack: "core" | "hsk";
}>({
  isOpen: false,
  setIsOpen: () => {},
  openAccountModal: () => {},
  openSignupModal: () => {},
  isAnonymous: false,
  productTrack: "core",
});

export const useSidebar = () => useContext(SidebarContext);

function getOnboardingEntrySource(): EntrySource {
  if (typeof document === "undefined") return "unknown";
  const match = document.cookie.match(/onboarding_entry=(\w+)/);
  if (match) {
    const v = match[1];
    if (v === "topic_island" || v === "story") return v;
  }
  return "unknown";
}

function clearOnboardingEntryCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "onboarding_entry=; path=/; max-age=0; SameSite=Lax";
}

function OnboardingRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!pathname?.startsWith("/app")) return;
    if (pathname.startsWith("/app/topic-islands/")) return;

    const onOnboardingPage = pathname.startsWith("/app/onboarding");

    let cancelled = false;
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const gate = await evaluateJourneyOnboardingGate(supabase, user.id);
      if (cancelled) return;
      if (gate.shouldMarkOnboardingComplete) {
        await markJourneyOnboardingComplete(supabase, user.id);
      }
      if (gate.needsJourneyWizard) {
        if (!onOnboardingPage) router.replace("/app/onboarding");
        return;
      }
      if (onOnboardingPage) {
        router.replace("/app");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, supabase]);

  return null;
}

/** Opens the same upgrade UX after a server-side direct-URL redirect. */
function ProductAccessUpgradeGate() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedProduct = searchParams.get("upgradeProduct");
  const product =
    requestedProduct === "core" || requestedProduct === "hsk"
      ? requestedProduct
      : null;

  if (!product) return null;

  return (
    <SideUpgradeModal
      open
      product={product}
      onClose={() => router.replace(pathname)}
    />
  );
}

function OnboardingUpgradeGate() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { isPro, isLoading } = useSubscription();

  useEffect(() => {
    if (isLoading) return;
    if (isPro) {
      clearUpgradePending();
      return;
    }
    if (!pathname?.startsWith("/app")) return;
    if (!isUpgradePending()) return;

    // Only trap anonymous guests mid-onboarding. A permanent signed-in account
    // (even free) must not be bounced back to /onboarding/upgrade after login —
    // that was sending existing users to the paywall forever.
    let cancelled = false;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      if (!user?.is_anonymous) {
        clearUpgradePending();
        return;
      }
      const snap = readUpgradeSnapshot();
      router.replace(buildUpgradePageUrl(snap?.islandId ?? ""));
    });

    return () => {
      cancelled = true;
    };
  }, [isLoading, isPro, pathname, router, supabase]);

  return null;
}

function CheckoutSuccessHandler() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const isIslandsHome = pathname === "/app";
    const isHskHome = pathname === "/hsk/app";
    if ((!isIslandsHome && !isHskHome) || typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    const snap = readUpgradeSnapshot();
    clearUpgradePending();
    invalidateSubscriptionCache();
    sessionStorage.removeItem("lingo_stripe_reconcile_v1");

    if (isHskHome) {
      window.history.replaceState({}, "", "/hsk/app");
      router.refresh();
      return;
    }

    // After journey onboarding purchase, open the first island so learning
    // starts immediately (island may still be generating — PreCourseLoading handles that).
    if (snap?.islandId) {
      router.replace(`/app/topic-islands/${snap.islandId}`);
      return;
    }

    window.history.replaceState({}, "", "/app");
  }, [pathname, router]);

  return null;
}

function OnboardingBootstrap() {
  const { startOnboardingIfNeeded } = useOnboarding();
  useEffect(() => {
    const source = getOnboardingEntrySource();
    startOnboardingIfNeeded(source).then(() => clearOnboardingEntryCookie());
  }, [startOnboardingIfNeeded]);
  return null;
}

function OnboardingNudgeSlot() {
  const { currentNudge } = useOnboarding();
  const { productTrack } = useSidebar();
  const pathname = usePathname();
  const isHome = pathname === "/app";
  const isIslandPage =
    pathname?.startsWith("/app/topic-islands/") &&
    pathname !== "/app/topic-islands";

  // Home renders the nudge below TopBar inside HomeDashboard.
  if (isHome || productTrack !== "core" || !currentNudge || !isIslandPage) {
    return null;
  }

  return (
    <div className="relative z-40 w-full bg-gray-50 px-4 pt-4 pb-3 md:px-8">
      <div className="mx-auto max-w-[1060px]">
        <OnboardingNudgeBanner />
      </div>
    </div>
  );
}

function PersistentSettingsNudge() {
  const { persistentSettingsNudge, dismissNudge, completeNudge } =
    useOnboarding();
  const { openAccountModal, isAnonymous, productTrack } = useSidebar();

  if (!persistentSettingsNudge || isAnonymous || productTrack !== "core") {
    return null;
  }

  const handleOpenSettings = () => {
    openAccountModal("profile");
    completeNudge(persistentSettingsNudge.key);
  };

  return (
    <div className="pointer-events-none fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] right-4 z-40 max-w-sm md:bottom-6 md:right-8">
      <div className="pointer-events-auto">
        <OnboardingNudgeCard
          key={persistentSettingsNudge.key}
          nudge={persistentSettingsNudge}
          onDismiss={() => dismissNudge(persistentSettingsNudge.key)}
          onComplete={() => completeNudge(persistentSettingsNudge.key)}
          onCtaClick={handleOpenSettings}
        />
      </div>
    </div>
  );
}

export default function AppLayoutClient({
  children,
  productTrack = "core",
  hskAppTheme = false,
}: {
  children: React.ReactNode;
  productTrack?: "core" | "hsk";
  /** Applies the HSK Prep typography only to the standalone /hsk/app preview. */
  hskAppTheme?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalInitialTab, setAccountModalInitialTab] = useState<
    "subscription" | "profile"
  >("subscription");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupModalFeature, setSignupModalFeature] = useState("");
  const [oauthLinking, setOauthLinking] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Read initial session synchronously from cookies (no network call)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAnonymous(session?.user?.is_anonymous ?? false);
    });

    // Subscribe to auth state changes so is_anonymous updates in real-time:
    //  - after linkIdentity (OAuth) completes and session is refreshed
    //  - after email verification
    //  - after sign-out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAnonymous(session?.user?.is_anonymous ?? false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const openSignupModal = useCallback((feature = "") => {
    setSignupModalFeature(feature);
    setShowSignupModal(true);
  }, []);

  const handleGoogleSignup = async () => {
    setOauthLinking(true);
    const { redirectTo, cookieOptions } = getOAuthRedirectConfig();
    document.cookie = `oauth_next=/app; ${cookieOptions}`;
    localStorage.setItem("oauth_next", "/app");
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      console.error(error);
      setOauthLinking(false);
    }
  };

  const openAccountModal = useCallback((tab: "subscription" | "profile" = "subscription") => {
    setAccountModalInitialTab(tab);
    setAccountModalOpen(true);
  }, []);

  const pathname = usePathname();
  /** Journey onboarding: full-page like legacy /onboarding — no sidebar, tab bar, or app chrome */
  const isFullscreenOnboarding = pathname === "/app/onboarding";

  const sidebarContextValue = useMemo(
    () => ({
      isOpen: sidebarOpen,
      setIsOpen: setSidebarOpen,
      openAccountModal,
      openSignupModal,
      isAnonymous,
      productTrack,
    }),
    [sidebarOpen, openAccountModal, openSignupModal, isAnonymous, productTrack],
  );

  return (
    <ProgressIslandUpgradeProvider
      PopupSlot={({ show, stage, onClose }) => (
        <ProgressIslandUpgradePopup
          show={show}
          stage={stage}
          onClose={onClose}
        />
      )}
    >
      {/* Progress Island upgrade modal: global across all app pages; auto-appears when quiz or topic-island actions hit a 10-review milestone */}
      <OnboardingProvider>
        <SidebarContext.Provider value={sidebarContextValue}>
          <OnboardingRedirect />
          <OnboardingUpgradeGate />
          <CheckoutSuccessHandler />
          <OnboardingBootstrap />
          <ProductAccessUpgradeGate />
          {isFullscreenOnboarding ? (
            <div className={`min-h-screen bg-white ${hskAppTheme ? "hsk-app-theme lingo-body" : ""}`}>
              <main className="flex min-h-screen w-full flex-col bg-white">
                {children}
              </main>
            </div>
          ) : (
            <div className="min-h-screen bg-white">
              {/* Mobile Header with Menu Button */}
              <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 md:hidden">
                <AppLogo
                  size="sm"
                  textClassName="text-lg font-bold text-gray-900"
                />
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="flex flex-col gap-1.5 p-2"
                  aria-label="Toggle sidebar"
                >
                  <span
                    className={`h-0.5 w-6 bg-gray-900 transition-all ${sidebarOpen ? "rotate-45 translate-y-2" : ""}`}
                  />
                  <span
                    className={`h-0.5 w-6 bg-gray-900 transition-all ${sidebarOpen ? "opacity-0" : ""}`}
                  />
                  <span
                    className={`h-0.5 w-6 bg-gray-900 transition-all ${sidebarOpen ? "-rotate-45 -translate-y-2" : ""}`}
                  />
                </button>
              </div>

              {/* Backdrop for mobile */}
              {sidebarOpen && (
                <div
                  className="fixed inset-0 z-40 bg-black/50 md:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
              )}

              <Sidebar
                isAccountModalOpen={accountModalOpen}
                setIsAccountModalOpen={setAccountModalOpen}
                accountModalInitialTab={accountModalInitialTab}
              />
              <main className="min-h-0 pt-16 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:ml-64 md:pb-0 md:pt-0">
                <OnboardingNudgeSlot />
                {children}
              </main>
              <MobileTabBar
                sidebarOpen={sidebarOpen}
                onOpenSidebar={() => setSidebarOpen(true)}
              />
              <PersistentSettingsNudge />
            </div>
          )}
        </SidebarContext.Provider>
      </OnboardingProvider>

      {/* Global anonymous signup modal */}
      {mounted &&
        showSignupModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowSignupModal(false)}
          >
            <div
              className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowSignupModal(false)}
                className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <h2 className="mb-2 text-2xl font-bold text-gray-900">
                {signupModalFeature &&
                signupModalFeature !== "Account & Settings"
                  ? `Unlock ${signupModalFeature}`
                  : "Try everything for free"}
              </h2>
              <p className="mb-6 text-sm text-gray-500">
                Create a free account — no credit card needed.
              </p>

              <div className="mb-6 grid grid-cols-2 gap-2">
                {SIGNUP_FEATURES.map((f) => (
                  <div
                    key={f.title}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                  >
                    <f.icon className="mb-1.5 h-5 w-5 text-gray-700" />
                    <div className="mb-0.5 text-xs font-semibold text-gray-900">
                      {f.title}
                    </div>
                    <div className="text-xs leading-snug text-gray-500">
                      {f.desc}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={oauthLinking}
                className="mb-3 w-full rounded-lg border border-gray-900 bg-white px-5 py-3 text-sm font-medium uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-70"
              >
                {oauthLinking ? "Redirecting…" : "Sign up with Google"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSignupModal(false);
                  router.push("/signup?next=/app&from=sidebar");
                }}
                className="w-full rounded-lg bg-gray-900 px-5 py-3 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-gray-800"
              >
                Sign up with email
              </button>

              <p className="mt-4 text-center text-xs text-gray-500">
                Already have an account?{" "}
                <a
                  href="/login?next=/app"
                  className="font-medium text-gray-900 underline hover:no-underline"
                >
                  Sign in
                </a>
              </p>
            </div>
          </div>,
          document.body,
        )}
    </ProgressIslandUpgradeProvider>
  );
}
