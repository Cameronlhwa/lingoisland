"use client";

import { useState, createContext, useContext, useMemo, useEffect, useCallback } from "react";
import { TbMap2 } from "react-icons/tb";
import { PiBookOpenTextLight } from "react-icons/pi";
import { BsCardChecklist } from "react-icons/bs";
import { TbRobot } from "react-icons/tb";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/app/Sidebar";
import AppLogo from "@/components/app/AppLogo";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/contexts/OnboardingContext";
import { ProgressIslandUpgradeProvider } from "@/contexts/ProgressIslandUpgradeContext";
import OnboardingNudgeCard from "@/components/Onboarding/OnboardingNudgeCard";
import ProgressIslandUpgradePopup from "@/components/app/ProgressIslandUpgradePopup";
import type { EntrySource } from "@/types/onboarding";
import { createClient } from "@/lib/supabase/browser";
import { getOAuthRedirectConfig } from "@/lib/utils/oauth";

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
}>({
  isOpen: false,
  setIsOpen: () => {},
  openAccountModal: () => {},
  openSignupModal: () => {},
  isAnonymous: false,
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

function OnboardingBootstrap() {
  const { startOnboardingIfNeeded } = useOnboarding();
  useEffect(() => {
    const source = getOnboardingEntrySource();
    startOnboardingIfNeeded(source).then(() => clearOnboardingEntryCookie());
  }, [startOnboardingIfNeeded]);
  return null;
}

function OnboardingNudgeSlot() {
  const { currentNudge, dismissNudge, completeNudge } = useOnboarding();
  const { isAnonymous, openSignupModal } = useSidebar();
  const pathname = usePathname();
  const isIslandPage =
    pathname?.startsWith("/app/topic-islands/") &&
    pathname !== "/app/topic-islands";

  if (!currentNudge) return null;

  const wrapperBg = isIslandPage ? "bg-gray-50" : "";

  return (
    <div className={`relative z-50 w-full ${wrapperBg} pt-4 pb-2`}>
      <div className="mx-auto max-w-3xl px-4">
        <AnimatePresence mode="wait">
          <OnboardingNudgeCard
            key={currentNudge.key}
            nudge={currentNudge}
            onDismiss={() => dismissNudge(currentNudge.key)}
            onComplete={() => completeNudge(currentNudge.key)}
            onCtaClick={
              isAnonymous
                ? () => {
                    openSignupModal(currentNudge.title);
                  }
                : undefined
            }
          />
        </AnimatePresence>
      </div>
    </div>
  );
}

function PersistentSettingsNudge() {
  const { persistentSettingsNudge, dismissNudge, completeNudge } =
    useOnboarding();
  const { openAccountModal, isAnonymous } = useSidebar();

  if (!persistentSettingsNudge || isAnonymous) return null;

  const handleOpenSettings = () => {
    openAccountModal("profile");
    completeNudge(persistentSettingsNudge.key);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 md:left-[272px] max-w-sm">
      <OnboardingNudgeCard
        key={persistentSettingsNudge.key}
        nudge={persistentSettingsNudge}
        onDismiss={() => dismissNudge(persistentSettingsNudge.key)}
        onComplete={() => completeNudge(persistentSettingsNudge.key)}
        onCtaClick={handleOpenSettings}
      />
    </div>
  );
}

export default function AppLayoutClient({
  children,
}: {
  children: React.ReactNode;
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

  const sidebarContextValue = useMemo(
    () => ({
      isOpen: sidebarOpen,
      setIsOpen: setSidebarOpen,
      openAccountModal,
      openSignupModal,
      isAnonymous,
    }),
    [sidebarOpen, openAccountModal, openSignupModal, isAnonymous],
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
          <OnboardingBootstrap />
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
            <main className="pt-16 md:pt-0 md:ml-64">
              <OnboardingNudgeSlot />
              {children}
            </main>
            <PersistentSettingsNudge />
          </div>
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
