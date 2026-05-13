export type BlogCategory =
  | "Learning Strategy"
  | "Vocabulary"
  | "Culture & Vocab"
  | "Getting Started";

export type BlogSlug =
  | "hsk-levels-guide"
  | "how-to-learn-mandarin"
  | "mandarin-numbers-complete-guide"
  | "chinese-numbers-1-100"
  | "counting-in-chinese"
  | "gratitude-in-chinese"
  | "bubble-tea-in-chinese"
  | "horoscope-in-chinese"
  | "zodiac-signs-in-chinese"
  | "polite-mandarin"
  | "how-to-read-chinese"
  | "what-is-mandarin"
  | "meaningful-chinese-tattoos";

export type BlogCalloutConfig = {
  hook: string;
  line: string;
  cta: string;
  href: string;
};

export type BlogPost = {
  slug: BlogSlug;
  title: string;
  category: BlogCategory;
  excerpt: string;
  readTimeMinutes: number;
  midCallout: BlogCalloutConfig;
  endCallout: BlogCalloutConfig;
  /** Mid callout includes an Island screenshot (topic posts). */
  midIslandScreenshot?: boolean;
};
