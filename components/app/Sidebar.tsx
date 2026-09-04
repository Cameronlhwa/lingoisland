"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppLogo from "@/components/app/AppLogo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { useGlossary } from "@/contexts/GlossaryContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { sidebarItems, hskSidebarItems } from "@/components/app/sidebar-items";
import AccountModal from "@/components/app/AccountModal";
import SideUpgradeModal from "@/components/app/SideUpgradeModal";
import { useSidebar } from "@/components/app/AppLayoutClient";
import PaywallGuard from "@/components/PaywallGuard";
import { useSubscription } from "@/hooks/useSubscription";
import {
  type BillableProduct,
} from "@/lib/product-plans";
import type { AppSide } from "@/lib/utils/app-side";

export default function Sidebar({
  isAccountModalOpen,
  setIsAccountModalOpen,
  accountModalInitialTab = "subscription",
}: {
  isAccountModalOpen?: boolean;
  setIsAccountModalOpen?: (open: boolean) => void;
  accountModalInitialTab?: "subscription" | "profile";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Topic island opened from a journey → highlight "Journey" in the nav
  const isJourneyIsland =
    (pathname.startsWith("/app/topic-islands/") ||
      pathname.startsWith("/hsk/app/topic-islands/")) &&
    searchParams.get("journeyFirst") === "1";
  const supabase = createClient();
  const { isChineseMode, toggleChineseMode, t } = useLanguage();
  const { convertText } = useCharacterSet();
  const { entries, activeWordId } = useGlossary();
  const { completeNudge } = useOnboarding();
  const glossaryListRef = useRef<HTMLDivElement | null>(null);
  const isTopicIslandDetail =
    pathname.startsWith("/app/topic-islands/") ||
    pathname.startsWith("/hsk/app/topic-islands/");
  const [localIsAccountOpen, setLocalIsAccountOpen] = useState(false);
  const [sideUpgradeProduct, setSideUpgradeProduct] =
    useState<BillableProduct | null>(null);
  const { isOpen: sidebarOpen, setIsOpen: setSidebarOpen, isAnonymous, openSignupModal, productTrack } = useSidebar();
  const { isHskPro, isLoading: subscriptionLoading } =
    useSubscription();

  // Use parent-controlled state if provided, otherwise use local state
  const isAccountOpen = isAccountModalOpen ?? localIsAccountOpen;
  const setIsAccountOpen = setIsAccountModalOpen ?? setLocalIsAccountOpen;

  useEffect(() => {
    if (!isTopicIslandDetail || !activeWordId || !glossaryListRef.current) {
      return;
    }
    const target = glossaryListRef.current.querySelector<HTMLElement>(
      `[data-glossary-id="${activeWordId}"]`,
    );
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeWordId, isTopicIslandDetail]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  // /hsk/app previews the HSK track for any account, without requiring
  // product_track === "hsk" on the signed-in user.
  const isHskPreview = pathname === "/hsk/app" || pathname.startsWith("/hsk/app/");
  const isHskSide = productTrack === "hsk" || isHskPreview;
  const appBase = isHskPreview ? "/hsk/app" : "/app";
  const navItems = (isHskSide ? hskSidebarItems : sidebarItems).map((item) =>
    isHskPreview ? { ...item, href: item.href.replace(/^\/app/, "/hsk/app") } : item,
  );
  const sidebarFeatureHints: Record<string, string> = {
    "/app/topic-islands": "Topic Islands",
    "/app/stories": "Daily Stories",
    "/app/quiz": "Quiz Islands",
  };

  const switchSide = async (side: AppSide) => {
    if (isAnonymous) {
      openSignupModal(side === "hsk" ? "HSK Prep" : "Islands");
      return;
    }

    // Already on the requested side — no-op.
    if (side === "hsk" && isHskSide) return;
    if (side === "islands" && !isHskSide) return;

    // Topic Islands has a signed-in free tier; HSK Prep is paid-only.
    if (!subscriptionLoading) {
      if (side === "hsk" && !isHskPro) {
        setSideUpgradeProduct("hsk");
        return;
      }
    }

    try {
      const response = await fetch("/api/app-side", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side }),
      });
      if (response.status === 403) {
        setSideUpgradeProduct("hsk");
        return;
      }
      if (!response.ok) return;
      const { destination } = (await response.json()) as {
        destination: string;
      };
      router.push(destination);
      router.refresh();
    } catch {
      // Do not switch optimistically; server authorization must succeed first.
    }
  };

  // Close mobile sidebar when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 md:translate-x-0 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        <div className="mb-8">
          {/* Hide logo on mobile since it's in the header */}
          <div className="hidden md:block">
            <AppLogo textClassName="text-xl font-bold text-gray-900" />
          </div>
          <div
            className="grid grid-cols-2 rounded-lg bg-gray-100 p-0.5 md:mt-3"
            role="tablist"
            aria-label="App mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isHskSide}
              onClick={() => switchSide("islands")}
              className={`rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                !isHskSide
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Islands
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isHskSide}
              onClick={() => switchSide("hsk")}
              className={`rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
                isHskSide
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              HSK Prep
            </button>
          </div>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            // Home is the app root — never treat nested routes as active
            // (e.g. /hsk/app/journey must not match Home href /hsk/app).
            let isActive = false;
            if (item.href === appBase) {
              isActive = pathname === item.href;
            } else if (
              item.href === `${appBase}/journey` ||
              item.href === "/app/journey"
            ) {
              isActive =
                pathname === item.href ||
                pathname.startsWith(item.href + "/") ||
                isJourneyIsland;
            } else if (
              item.href === `${appBase}/topic-islands` ||
              item.href === "/app/topic-islands"
            ) {
              isActive =
                !isJourneyIsland &&
                (pathname === item.href ||
                  pathname.startsWith(item.href + "/"));
            } else {
              isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
            }

            const iconClass = isActive
              ? "h-5 w-5 text-white"
              : "h-5 w-5 text-gray-500";

            const btnClass = isActive
              ? "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold bg-gray-900 text-white transition-colors"
              : "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900";

            if (isAnonymous) {
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => openSignupModal(item.label)}
                  className={btnClass}
                >
                  {item.icon(iconClass)}
                  {convertText(t(item.label))}
                </button>
              );
            }

            return (
              <PaywallGuard
                key={item.href}
                enabled={Boolean(sidebarFeatureHints[item.href])}
                featureHint={sidebarFeatureHints[item.href]}
              >
                <Link href={item.href} className={btnClass}>
                  {item.icon(iconClass)}
                  {convertText(t(item.label))}
                </Link>
              </PaywallGuard>
            );
          })}
        </nav>

        {isTopicIslandDetail && entries.length > 0 && (
          <>
            <div className="-mx-6 my-6 border-t border-gray-200" />
            <div className="flex min-h-0 flex-1 flex-col justify-center">
              <div
                ref={glossaryListRef}
                className="glossary-scrollbar-hide flex min-h-0 flex-col space-y-2 overflow-y-auto pr-1"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {entries.map((entry) => {
                  const isActive = activeWordId === entry.anchorId;
                  return (
                    <button
                      key={entry.anchorId}
                      type="button"
                      onClick={() => {
                        if (entry.blur) return;
                        const target = document.getElementById(entry.anchorId);
                        if (target) {
                          target.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }
                      }}
                      data-glossary-id={entry.anchorId}
                      className={`w-full rounded-lg border px-2 text-center transition-colors ${
                        entry.blur
                          ? "pointer-events-none cursor-default border-gray-200 bg-gray-50 py-2 text-sm"
                          : isActive
                            ? "border-gray-200 bg-gray-50 py-2 text-sm font-semibold text-gray-900"
                            : "border-gray-200 bg-white py-1.5 text-xs text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className={entry.blur ? "blur-sm select-none" : ""}>
                        {convertText(entry.hanzi)}
                      </div>
                      {entry.english && (
                        <div
                          className={`truncate text-[10px] ${entry.blur ? "blur-sm select-none" : "text-gray-500"}`}
                        >
                          {entry.english}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer with settings and sign out */}
      <div className="border-t border-gray-200 bg-white p-6">
        {/* Chinese Mode Toggle */}
        <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
          <span className="text-sm font-medium text-gray-700">
            {convertText(t("Chinese Mode"))}
          </span>
          <button
            onClick={toggleChineseMode}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isChineseMode ? "bg-gray-900" : "bg-gray-300"
            }`}
            aria-label="Toggle Chinese Mode"
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isChineseMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <button
          onClick={() => {
            if (isAnonymous) {
              openSignupModal("Account & Settings");
              return;
            }
            setIsAccountOpen(true);
            completeNudge("customize_settings");
          }}
          className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
        >
          {convertText(t(isAnonymous ? "Create Account" : "Account & Settings"))}
        </button>
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          {convertText(t("Sign Out"))}
        </button>
      </div>
      <style jsx>{`
        .glossary-scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <AccountModal
        open={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        initialTab={accountModalInitialTab}
        hideDecorativeImages={isHskPreview}
      />
      <SideUpgradeModal
        open={sideUpgradeProduct !== null}
        product={sideUpgradeProduct ?? "core"}
        onClose={() => setSideUpgradeProduct(null)}
      />
    </aside>
  );
}
