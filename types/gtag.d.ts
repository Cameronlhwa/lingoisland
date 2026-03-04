/**
 * Google tag (gtag.js) global for Google Ads conversion tracking.
 * See https://developers.google.com/tag-platform/gtagjs/reference
 */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (
      command: "config" | "event" | "js",
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
  }
}

export {};
