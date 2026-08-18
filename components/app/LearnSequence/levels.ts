import type { LearnSentence } from "./types";

export function isBeginnerLearnLevel(level: string | null | undefined): boolean {
  if (!level || typeof level !== "string") return false;
  const t = level.trim().toUpperCase();
  return t.startsWith("A0") || t.startsWith("A1") || t.startsWith("A2");
}

/** A1/A2 islands use fill-in word chips; B1+ islands use free-text chat. */
export function useExerciseChatForIsland(
  islandLevel: string | null | undefined,
): boolean {
  return isBeginnerLearnLevel(islandLevel);
}

/** Island level first; profile CEFR as fallback when the island was created at the wrong band. */
export function resolveLearnLevel(
  islandLevel: string | null | undefined,
  profileLevel?: string | null,
): string {
  const island =
    typeof islandLevel === "string" ? islandLevel.trim() : "";
  const profile =
    typeof profileLevel === "string" ? profileLevel.trim() : "";
  if (isBeginnerLearnLevel(island)) return island;
  if (isBeginnerLearnLevel(profile)) return profile;
  return island || profile || "B1";
}

export function getSentenceForLevel(
  sentences: LearnSentence[],
  level: string,
): LearnSentence | undefined {
  const tierMap: Record<string, "easy" | "same" | "hard"> = {
    A0: "easy",
    A1: "easy",
    A2: "easy",
    B1: "same",
    B2: "same",
    C1: "hard",
  };
  const upper = level.trim().toUpperCase();
  const levelKey = upper.startsWith("A0") ? "A0" : upper.slice(0, 2);
  const targetTier = tierMap[levelKey] ?? "same";
  return (
    sentences.find((s) => s.tier === targetTier) ??
    sentences.find((s) => s.tier === "same") ??
    sentences[0]
  );
}
