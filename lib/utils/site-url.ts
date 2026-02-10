const CANONICAL_ORIGIN = "https://lingoisland.com";

const normalizeSiteUrl = (url: string) => {
  let normalized = url.replace(/\/+$/, "");
  normalized = normalized.replace(/^https?:\/\//, "https://").replace(/\/\/www\./, "//");
  return normalized;
};

/**
 * Returns the canonical site origin for sitemap, robots, and metadata.
 * In production always returns https://lingoisland.com (non-www) so env cannot
 * accidentally expose www or http.
 */
export const getSiteUrl = (): string => {
  if (process.env.NODE_ENV === "production") {
    return CANONICAL_ORIGIN;
  }
  const rawUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    CANONICAL_ORIGIN;
  return normalizeSiteUrl(rawUrl);
};

/**
 * Builds a canonical absolute URL with no double slashes. Use for alternates.canonical and sitemap.
 * @param path - Path with or without leading slash (e.g. "" or "/" for homepage, "/pricing")
 */
export const getCanonicalUrl = (path: string = ""): string => {
  const base = getSiteUrl();
  const cleanPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
  return cleanPath ? `${base}/${cleanPath}` : base;
};

