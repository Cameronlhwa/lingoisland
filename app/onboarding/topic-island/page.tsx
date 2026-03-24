"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy marketing URL → public journey wizard (no login until “Build my journey”).
 */
function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const fullQuery = searchParams.toString();
    const dest =
      fullQuery.length > 0
        ? `/onboarding/journey?${fullQuery}`
        : "/onboarding/journey";
    router.replace(dest);
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
      <p className="text-slate-600">Taking you to onboarding…</p>
    </main>
  );
}

export default function OnboardingTopicIslandPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12">
          <p className="text-slate-600">Loading…</p>
        </main>
      }
    >
      <RedirectInner />
    </Suspense>
  );
}
