import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/utils/site-url";

/**
 * Only truly private paths are disallowed so crawlers never waste budget on API/app/auth.
 * We do NOT disallow /login or /onboarding/ so Google can crawl them, discover the noindex
 * directive, and avoid indexing those thin pages without blocking discovery.
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

