import type { Metadata } from "next";
import { getCanonicalUrl, getSiteUrl } from "@/lib/utils/site-url";
import {
  TOPICS_BY_CATEGORY,
  topicToSlug,
  PRIORITY_TOPIC_SLUGS,
  TRENDING_TOPIC_SLUGS,
  ALL_TOPICS,
} from "@/data/topics";
import { TopicsHubClient } from "@/app/topics/TopicsHubClient";
import { BackButton } from "@/app/topics/BackButton";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mandarin Vocabulary by Topic (A2–B2) | 100 Real-Life Topics – LingoIsland",
  description:
    "Browse 100 real-life Mandarin topics (HSK 3–6). Learn vocabulary in context with pinyin, example sentences, and a review loop that helps it stick.",
  alternates: {
    canonical: getCanonicalUrl("topics"),
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Mandarin Vocabulary by Topic (A2–B2) | 100 Real-Life Topics – LingoIsland",
    description:
      "Browse 100 real-life Mandarin topics (HSK 3–6). Learn vocabulary in context with pinyin, example sentences, and a review loop that helps it stick.",
    url: getCanonicalUrl("topics"),
  },
};

const INTRO =
  "Pick a topic below to start. You’ll get vocabulary in context with pinyin and example sentences.";

function buildTopicsHubStructuredData() {
  const siteUrl = getSiteUrl();
  const listItems = ALL_TOPICS.slice(0, 100).map((t, i) => ({
    "@type": "ListItem" as const,
    position: i + 1,
    name: t.name,
    url: PRIORITY_TOPIC_SLUGS.has(t.slug)
      ? `${siteUrl}/topics/${t.slug}`
      : undefined,
  }));
  return {
    "@context": "https://schema.org" as const,
    "@type": "CollectionPage" as const,
    name: "Mandarin Vocabulary by Topic — 100 Real-Life Topics",
    description:
      "Browse 100 real-life Mandarin topics for intermediate learners (A2–B2 / HSK 3–6). Chinese vocabulary in context with pinyin and example sentences.",
    url: `${siteUrl}/topics`,
    mainEntity: {
      "@type": "ItemList" as const,
      numberOfItems: 100,
      itemListElement: listItems,
    },
  };
}

export default function TopicsHubPage() {
  const structuredData = buildTopicsHubStructuredData();

  return (
    <main className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <BackButton />
        <h1 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
          Browse Our Most Popular Real-Life Mandarin Topics
        </h1>
        <p className="mb-8 text-gray-700">
          {INTRO}
        </p>

        <TopicsHubClient>
          {TOPICS_BY_CATEGORY.map(({ category, topics }) => (
            <section
              key={category}
              className="mb-10"
              data-topic-category={category}
            >
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                {category}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {topics.map((name) => {
                  const slug = topicToSlug(name);
                  const isPriority = PRIORITY_TOPIC_SLUGS.has(slug);
                  const isTrending = TRENDING_TOPIC_SLUGS.has(slug);
                  const href = isPriority
                    ? `/topics/${slug}`
                    : `/onboarding/journey?topic=${encodeURIComponent(name)}`;
                  return (
                    <li key={slug} data-topic-name={name} data-topic-slug={slug}>
                      <Link
                        href={href}
                        className="group flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50"
                        data-topics-link
                        data-source="hub"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="font-medium">{name}</span>
                          {isTrending && (
                            <span className="shrink-0 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-700">
                              Trending
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-sm font-medium text-gray-500 group-hover:text-gray-900">
                          Start →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </TopicsHubClient>

        <nav className="mt-12 border-t border-gray-200 pt-8">
          <p className="mb-2 text-sm font-medium text-gray-600">
            More from LingoIsland
          </p>
          <ul className="flex flex-wrap gap-4 text-sm">
            <li>
              <Link href="/" className="text-gray-700 underline hover:text-gray-900">
                Home
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-gray-700 underline hover:text-gray-900">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/founder" className="text-gray-700 underline hover:text-gray-900">
                Founder
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </main>
  );
}
