"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { resolveLearnLevel } from "./levels";
import type { LearnIsland } from "./types";

export function useLearnLevel(
  island: LearnIsland | null,
  profileLevel?: string | null,
): string {
  const [learnLevel, setLearnLevel] = useState(() =>
    resolveLearnLevel(island?.level, profileLevel),
  );

  useEffect(() => {
    if (!island) return;

    if (profileLevel !== undefined) {
      setLearnLevel(resolveLearnLevel(island.level, profileLevel));
      return;
    }

    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("cefr_level")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setLearnLevel(resolveLearnLevel(island.level, profile?.cefr_level));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [island?.id, island?.level, profileLevel]);

  return learnLevel;
}
