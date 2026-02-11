"use client";

import { useState, createContext, useContext, useMemo, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/app/Sidebar";
import AppLogo from "@/components/app/AppLogo";
import { OnboardingProvider, useOnboarding } from "@/contexts/OnboardingContext";
import OnboardingNudgeCard from "@/components/Onboarding/OnboardingNudgeCard";
import type { EntrySource } from "@/types/onboarding";

// Create a context for sidebar state
const SidebarContext = createContext<{
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openAccountModal: (tab?: "subscription" | "profile") => void;
}>({
  isOpen: false,
  setIsOpen: () => {},
  openAccountModal: () => {},
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
  document.cookie =
    "onboarding_entry=; path=/; max-age=0; SameSite=Lax";
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
  const pathname = usePathname();
  const isIslandPage = pathname?.startsWith("/app/topic-islands/") && pathname !== "/app/topic-islands";

  if (!currentNudge) return null;
  
  // Match wrapper background to page: gray-50 on islands, transparent on ocean
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
          />
        </AnimatePresence>
      </div>
    </div>
  );
}

function PersistentSettingsNudge() {
  const { persistentSettingsNudge, dismissNudge, completeNudge } = useOnboarding();
  const { openAccountModal } = useSidebar();
  
  if (!persistentSettingsNudge) return null;
  
  const handleOpenSettings = () => {
    openAccountModal("profile"); // Open Profile tab for onboarding
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalInitialTab, setAccountModalInitialTab] = useState<"subscription" | "profile">("subscription");
  
  const sidebarContextValue = useMemo(
    () => ({ 
      isOpen: sidebarOpen, 
      setIsOpen: setSidebarOpen,
      openAccountModal: (tab: "subscription" | "profile" = "subscription") => {
        setAccountModalInitialTab(tab);
        setAccountModalOpen(true);
      },
    }),
    [sidebarOpen]
  );

  return (
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
  );
}
