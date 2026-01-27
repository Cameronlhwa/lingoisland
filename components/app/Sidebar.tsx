"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGlossary } from "@/contexts/GlossaryContext";
import { sidebarItems } from "@/components/app/sidebar-items";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { isChineseMode, toggleChineseMode, t } = useLanguage();
  const { entries, activeWordId } = useGlossary();
  const glossaryListRef = useRef<HTMLDivElement | null>(null);
  const isTopicIslandDetail = pathname.startsWith("/app/topic-islands/");

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

  const navItems = sidebarItems;

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex flex-1 flex-col overflow-y-auto p-6">
        <div className="mb-8 flex items-center gap-1.5">
          <Image
            src="/logo.png"
            alt="Lingo Island Logo"
            width={40}
            height={40}
            className="rounded-lg"
          />
          <h2 className="text-xl font-bold text-gray-900">Lingo Island</h2>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            // More precise active state detection
            let isActive = false;
            if (item.href === "/app") {
              // For home, only match exactly or if no other routes match
              isActive = pathname === "/app";
            } else {
              // For other routes, check if pathname starts with the href
              isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-base font-medium text-gray-900 transition-colors ${
                  isActive
                    ? "border-gray-900 bg-white"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                {item.icon()}
                {t(item.label)}
              </Link>
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
                        isActive
                          ? "border-gray-900 bg-gray-50 py-2 text-sm font-semibold text-gray-900"
                          : "border-gray-200 bg-white py-1.5 text-xs text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div>{entry.hanzi}</div>
                      {entry.english && (
                        <div className="truncate text-[10px] text-gray-500">
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

      {/* Always visible footer with settings and sign out */}
      <div className="border-t border-gray-200 bg-white p-6">
        {/* Chinese Mode Toggle */}
        <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
          <span className="text-sm font-medium text-gray-700">
            {t("Chinese Mode")}
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
          onClick={handleSignOut}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50"
        >
          {t("Sign Out")}
        </button>
      </div>
      <style jsx>{`
        .glossary-scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </aside>
  );
}
