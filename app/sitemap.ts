import fs from "node:fs";
import path from "node:path";

import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog/posts";
import { PRIORITY_TOPIC_SLUGS } from "@/data/topics";
import {
  getTopicPageContent,
  meetsIndexingMinimum,
} from "@/data/topic-page-content";
import { getCanonicalUrl } from "@/lib/utils/site-url";

function safeMtime(absPath: string): Date | undefined {
  try {
    return fs.statSync(absPath).mtime;
  } catch {
    return undefined;
  }
}

function blogMarkdownPath(slug: string): string {
  return path.join(process.cwd(), "content/blog", `${slug}.md`);
}

function blogPostLastModified(slug: string): Date {
  return safeMtime(blogMarkdownPath(slug)) ?? new Date();
}

function blogHubLastModified(): Date {
  let newest = 0;
  for (const post of blogPosts) {
    const t = safeMtime(blogMarkdownPath(post.slug))?.getTime() ?? 0;
    if (t > newest) newest = t;
  }
  return newest > 0 ? new Date(newest) : new Date();
}

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
      url: getCanonicalUrl("blog"),
      lastModified: blogHubLastModified(),
      changeFrequency: "weekly",
      priority: 0.75,
    },
    ...blogPosts.map((post) => ({
      url: getCanonicalUrl(`blog/${post.slug}`),
      lastModified: blogPostLastModified(post.slug),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    {
      url: getCanonicalUrl("contact"),
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: getCanonicalUrl("privacy"),
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: getCanonicalUrl("terms"),
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
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

