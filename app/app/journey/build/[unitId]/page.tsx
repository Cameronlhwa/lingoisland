"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import AppLogo from "@/components/app/AppLogo";

const STEPS = [
  "Picking the HSK words you still need…",
  "Grouping them around your interests…",
  "Naming your islands…",
  "Writing the story checkpoints…",
];

export default function BuildUnitPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname() ?? "";
  const appBase = pathname.startsWith("/hsk/app") ? "/hsk/app" : "/app";
  const unitId = String(params.unitId ?? "");
  const startedRef = useRef(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setStepIndex(i + 1), 900 * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!unitId || startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/hsk/curriculum/${unitId}/build`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.journeyId) {
          throw new Error(data?.error || "Couldn't build this unit");
        }
        router.replace(`${appBase}/journey/${data.journeyId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
  }, [unitId, appBase, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <div className="animate-bounce" aria-hidden>
        <AppLogo size="md" />
      </div>
      <h1 className="lingo-display mt-6 text-2xl text-[var(--lingo-navy)]">
        Building your unit…
      </h1>
      <ul className="mt-6 w-full max-w-sm space-y-2 text-left">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className="text-sm transition-opacity"
            style={{
              color: "var(--lingo-navy)",
              opacity: i < stepIndex ? 1 : 0.3,
            }}
          >
            {s}
          </li>
        ))}
      </ul>
      {error && (
        <div className="mt-6">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => {
              startedRef.current = false;
              setError(null);
              router.refresh();
            }}
            className="mt-3 rounded-lg bg-[var(--lingo-navy)] px-5 py-2.5 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
