import { HSK_FEATURE_HIGHLIGHTS } from "@/lib/hskprep-content";

function feature(title: string) {
  const item = HSK_FEATURE_HIGHLIGHTS.find((f) => f.title === title);
  if (!item) throw new Error(`Missing HSK feature: ${title}`);
  return item;
}

const vocabulary = feature("Official HSK Vocabulary");
const review = feature("Self-Paced Review");
const tests = feature("150+ Practice Tests");

/** Shared copy for HSK Prep app navigation and page headers — sourced from /hskprep. */
export const HSK_APP_LABELS = {
  home: {
    nav: "Home",
    title: "Home",
    description: "Your HSK prep dashboard.",
  },
  journey: {
    nav: "My HSK Path",
    title: "My HSK Path",
    description: "Official HSK vocabulary, organized into personalized units.",
    eyebrow: "Your curriculum",
  },
  vocabulary: {
    nav: vocabulary.title,
    title: vocabulary.title,
    description: vocabulary.description,
  },
  tests: {
    nav: tests.title,
    title: tests.title,
    description: tests.description,
  },
  flashcards: {
    nav: review.title,
    title: review.title,
    description: review.description,
  },
} as const;
