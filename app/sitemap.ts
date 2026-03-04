import type { MetadataRoute } from "next";
import { getCanonicalUrl } from "@/lib/utils/site-url";
import { PRIORITY_TOPIC_SLUGS } from "@/data/topics";
import {
  getTopicPageContent,
  meetsIndexingMinimum,
} from "@/data/topic-page-content";

/**
 * Sitemap includes only indexable pages (no thin or private URLs).
 * Matches robots.ts (allow /) and page-level meta robots (noindex pages excluded).
 * All URLs use canonical origin. No trailing slashes.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const indexableTopicSlugs = Array.from(PRIORITY_TOPIC_SLUGS).filter(
    (slug) => {
      const content = getTopicPageContent(slug);
      return content && meetsIndexingMinimum(content);
    }
  );

  const topicPages: MetadataRoute.Sitemap = indexableTopicSlugs.map(
    (slug) => ({
      url: getCanonicalUrl(`topics/${slug}`),
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })
  );

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
    {
      url: getCanonicalUrl("founder"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: getCanonicalUrl("topics"),
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...topicPages,
  ];
}

