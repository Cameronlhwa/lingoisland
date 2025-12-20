"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import Link from "next/link";

export default function HeroCTA() {
  const supabase = createClient();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setIsAuthenticated(!!user);
  };

  // Show loading state briefly
  if (isAuthenticated === null) {
    return (
      <Link
        href="/onboarding/topic-island"
        className="group rounded-xl border border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
      >
        <h2 className="mb-3 text-2xl font-bold text-gray-900">
          Create a Topic Island
        </h2>
        <p className="text-base leading-relaxed text-gray-600">
          Build vocabulary around topics you care about. 10–20 words with
          pinyin, examples, and translations.
        </p>
      </Link>
    );
  }

  // If authenticated, go directly to topic islands page
  // If not, go to onboarding
  const href = isAuthenticated
    ? "/app/topic-islands"
    : "/onboarding/topic-island";

  return (
    <Link
      href={href}
      className="group rounded-xl border border-gray-200 bg-white p-8 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      <h2 className="mb-3 text-2xl font-bold text-gray-900">
        Create a Topic Island
      </h2>
      <p className="text-base leading-relaxed text-gray-600">
        Build vocabulary around topics you care about. 10–20 words with pinyin,
        examples, and translations.
      </p>
    </Link>
  );
}
