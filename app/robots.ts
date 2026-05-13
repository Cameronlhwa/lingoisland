import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/utils/site-url";

/**
 * SEO crawl/indexing rules (must align with sitemap and page-level meta robots).
 *
 * ALLOW (crawlable):
 *   - /         Home, indexable
 *   - /pricing  Indexable
 *   - /founder  Indexable
 *   - /blog     Blog hub, indexable
 *   - /blog/[slug]  Article pages, indexable
 *   - /contact  Indexable
 *   - /privacy  Indexable
 *   - /terms    Indexable
 *   - /topics   Indexable hub
 *   - /topics/[slug]  Indexable when page has full content; noindex set in metadata otherwise
 *   - /login    Crawlable but noindex (thin)
 *   - /onboarding/*   Crawlable but noindex (thin)
 *
 * DISALLOW (do not crawl):
 *   - /api/     Backend only
 *   - /app/     Logged-in app (noindex,nofollow in layout)
 *   - /auth/     OAuth callbacks, not useful to index
 *
 * Sitemap lists only indexable URLs; no URL in sitemap is disallowed or noindex.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/auth/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

