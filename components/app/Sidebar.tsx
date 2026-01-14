"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const { isChineseMode, toggleChineseMode, t } = useLanguage();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const navItems = [
    { href: "/app", label: "Daily Review" },
    { href: "/app/topic-islands", label: "Topic Islands" },
    { href: "/app/quiz", label: "Quiz" },
    { href: "/app/chat", label: "Chat" },
  ];

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-8">
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
                className={`block rounded-lg border px-4 py-3 text-left text-base font-medium text-gray-900 transition-colors ${
                  isActive
                    ? "border-gray-900 bg-white"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                {t(item.label)}
              </Link>
            );
          })}
        </nav>
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
    </aside>
  );
}
