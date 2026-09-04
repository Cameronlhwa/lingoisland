"use client";

import { usePathname } from "next/navigation";

/** True when browsing the standalone HSK preview at `/hsk/app`. */
export function useIsHskAppPreview() {
  const pathname = usePathname() ?? "";
  return pathname.startsWith("/hsk/app");
}

/** Base path for HSK flashcards: `/app` or `/hsk/app` preview. */
export function useHskFlashcardsBasePath() {
  return useIsHskAppPreview() ? "/hsk/app" : "/app";
}

export function hskFlashcardsRoot(basePath: string) {
  return `${basePath}/hsk-flashcards`;
}

export function hskFlashcardsDeck(basePath: string, deckId: string) {
  return `${basePath}/hsk-flashcards/${deckId}`;
}
