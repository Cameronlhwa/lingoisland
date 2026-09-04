"use client";

import { useCallback, useEffect, useState } from "react";
import HskCurriculumOverview from "@/components/hsk/HskCurriculumOverview";
import HskPathSetupModal from "@/components/hsk/HskPathSetupModal";

/**
 * "My HSK Path" surface. Renders the curriculum overview, or a blocking setup
 * modal when the user is HSK-Pro but has never answered the curriculum
 * questions (e.g. existing accounts that skipped onboarding).
 */
export default function HskCurriculumSection({
  basePath = "/app",
}: {
  basePath?: string;
}) {
  const [state, setState] = useState<"loading" | "needs-setup" | "ready">(
    "loading",
  );
  const [reloadKey, setReloadKey] = useState(0);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/hsk/curriculum", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as {
        curriculum?: unknown;
      };
      setState(res.ok && json.curriculum ? "ready" : "needs-setup");
    } catch {
      setState("needs-setup");
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-[var(--lingo-text-muted)]">
        Loading your path…
      </div>
    );
  }

  if (state === "needs-setup") {
    return (
      <HskPathSetupModal
        onComplete={() => {
          setState("ready");
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  return <HskCurriculumOverview key={reloadKey} basePath={basePath} />;
}
