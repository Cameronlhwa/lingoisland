"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BsCardChecklist } from "react-icons/bs";
import { TbHome, TbMenu2 } from "react-icons/tb";
import { Map } from "lucide-react";

const iconClass = "h-6 w-6 shrink-0";

function tabStyles(active: boolean) {
  return `flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium transition-colors ${
    active ? "text-[#121926]" : "text-gray-500"
  }`;
}

export default function MobileTabBar({
  sidebarOpen,
  onOpenSidebar,
}: {
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isJourneyIsland =
    pathname.startsWith("/app/topic-islands/") &&
    searchParams.get("journeyFirst") === "1";

  const homeActive = pathname === "/app";
  const reviewActive =
    pathname === "/app/quiz" || pathname.startsWith("/app/quiz/");
  const journeyActive =
    pathname === "/app/journey" ||
    pathname.startsWith("/app/journey/") ||
    isJourneyIsland;
  const moreActive = sidebarOpen;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[48] border-t border-gray-200 bg-white md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-2xl items-stretch">
        <Link href="/app" className={tabStyles(homeActive)}>
          <TbHome className={iconClass} aria-hidden />
          <span>Home</span>
        </Link>
        <Link href="/app/quiz" className={tabStyles(reviewActive)}>
          <BsCardChecklist className={iconClass} aria-hidden />
          <span>Review</span>
        </Link>
        <Link href="/app/journey" className={tabStyles(journeyActive)}>
          <Map className={iconClass} aria-hidden strokeWidth={2} />
          <span>Journey</span>
        </Link>
        <button
          type="button"
          onClick={onOpenSidebar}
          className={tabStyles(moreActive)}
        >
          <TbMenu2 className={iconClass} aria-hidden />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}
