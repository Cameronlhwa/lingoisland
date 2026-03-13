"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react";

const STORAGE_KEY = "progress_island_last_seen_stage";

type ProgressIslandUpgradeContextType = {
  showUpgrade: (stage: number) => void;
};

const ProgressIslandUpgradeContext =
  createContext<ProgressIslandUpgradeContextType | null>(null);

export function useProgressIslandUpgrade() {
  const ctx = useContext(ProgressIslandUpgradeContext);
  return ctx;
}

/**
 * Call this when you have the user's current todayCount (or progressStage) and want to
 * show the upgrade popup if they just crossed a 10-review milestone.
 * Persists last-seen stage per day in sessionStorage so we only show once per stage per day.
 * @returns true if the upgrade popup was shown
 */
export function checkAndShowUpgrade(
  todayCount: number,
  showUpgrade: (stage: number) => void
): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const dateKey = new Date().toISOString().split("T")[0];
  const storageKey = `${STORAGE_KEY}_${dateKey}`;
  const lastSeenRaw = sessionStorage.getItem(storageKey);
  // Use -1 as the "never seen" sentinel so any stage >= 1 triggers the popup
  const lastSeen = lastSeenRaw !== null ? parseInt(lastSeenRaw, 10) : -1;
  if (lastSeenRaw === null) {
    sessionStorage.setItem(storageKey, "-1");
  }
  const stage = Math.min(5, Math.floor(todayCount / 10));
  if (stage > lastSeen && stage >= 1) {
    sessionStorage.setItem(storageKey, String(stage));
    showUpgrade(stage + 1); // display 1–6
    return true;
  }
  return false;
}

export function ProgressIslandUpgradeProvider({
  children,
  PopupSlot,
}: {
  children: ReactNode;
  PopupSlot: (props: {
    show: boolean;
    stage: number;
    onClose: () => void;
  }) => ReactNode;
}) {
  const [show, setShow] = useState(false);
  const [stage, setStage] = useState(1);

  const showUpgrade = useCallback((newStage: number) => {
    setStage(newStage);
    setShow(true);
  }, []);

  const contextValue = useMemo(() => ({ showUpgrade }), [showUpgrade]);

  const onClose = useCallback(() => {
    setShow(false);
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    if (pathname === "/app" || pathname === "/app/") {
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      document.getElementById("progress-island-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.href = "/app";
    }
  }, []);

  return (
    <ProgressIslandUpgradeContext.Provider value={contextValue}>
      {children}
      {PopupSlot({ show, stage, onClose })}
    </ProgressIslandUpgradeContext.Provider>
  );
}
