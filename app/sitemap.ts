import type { MetadataRoute } from "next";
import { blogPosts } from "@/lib/blog/posts";
import {
  blogHubMtime,
  blogMarkdownMtime,
  maxMtime,
  topicDetailTemplateMtime,
  topicListingMtime,
} from "@/lib/sitemap/lastModified";
import { PRIORITY_TOPIC_SLUGS } from "@/data/topics";
import {
  getTopicPageContent,
  meetsIndexingMinimum,
} from "@/data/topic-page-content";
import { getCanonicalUrl } from "@/lib/utils/site-url";

/**
 * Sitemap includes only indexable pages (no thin or private URLs).
 * Matches robots.ts (allow /) and page-level meta robots (noindex pages excluded).
 * All URLs use canonical origin. No trailing slashes.
 *
 * lastModified uses source file mtimes where possible (not build time) so
 * Google gets meaningful change signals.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const indexableTopicSlugs = Array.from(PRIORITY_TOPIC_SLUGS).filter(
    (slug) => {
      const content = getTopicPageContent(slug);
      return content && meetsIndexingMinimum(content);
    }
  );

  const topicContentMtime = topicDetailTemplateMtime();

  const topicPages: MetadataRoute.Sitemap = indexableTopicSlugs.map(
    (slug) => ({
      url: getCanonicalUrl(`topics/${slug}`),
      lastModified: topicContentMtime,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })
  );

  return [
    {
      url: getCanonicalUrl(""),
      lastModified: maxMtime(["app/page.tsx", "lib/landing-content.ts"]),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: getCanonicalUrl("pricing"),
      lastModified: maxMtime(["app/pricing/page.tsx", "app/pricing/layout.tsx"]),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: getCanonicalUrl("founder"),
      lastModified: maxMtime(["app/founder/page.tsx", "app/founder/layout.tsx"]),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: getCanonicalUrl("blog"),
      lastModified: blogHubMtime(blogPosts.map((p) => p.slug)),
      changeFrequency: "weekly",
      priority: 0.75,
    },
    ...blogPosts.map((post) => ({
      url: getCanonicalUrl(`blog/${post.slug}`),
      lastModified: blogMarkdownMtime(post.slug),
      changeFrequency: "monthly" as const,
      priority: 0.65,
    })),
    {
      url: getCanonicalUrl("contact"),
      lastModified: maxMtime(["app/contact/page.tsx", "app/contact/layout.tsx"]),
      changeFrequency: "monthly",
      priority: 0.55,
    },
    {
      url: getCanonicalUrl("privacy"),
      lastModified: maxMtime(["app/privacy/page.tsx", "app/privacy/layout.tsx"]),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: getCanonicalUrl("terms"),
      lastModified: maxMtime(["app/terms/page.tsx", "app/terms/layout.tsx"]),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: getCanonicalUrl("topics"),
      lastModified: topicListingMtime(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...topicPages,
  ];
}
