import type { MetadataRoute } from "next";
import { getCanonicalUrl } from "@/lib/utils/site-url";

/**
 * Public indexable pages only. Excludes /login, /onboarding/*, /auth/*, /app/*, /api/*.
 * All URLs use canonical origin (https://lingoisland.com). No trailing slashes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getCanonicalUrl(""),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getCanonicalUrl("pricing"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];
}

