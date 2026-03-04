import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCanonicalUrl } from "@/lib/utils/site-url";
import { SLUG_TO_TOPIC, getRelatedSlugs, PRIORITY_TOPIC_SLUGS } from "@/data/topics";
import {
  getTopicPageContent,
  meetsIndexingMinimum,
} from "@/data/topic-page-content";
import { TopicPageCTAs } from "./TopicPageCTAs";

type Props = { params: { slug: string } };

export async function generateStaticParams() {
  return Array.from(PRIORITY_TOPIC_SLUGS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = params.slug;
  const topicName = SLUG_TO_TOPIC.get(slug);
  const content = getTopicPageContent(slug);

  if (!topicName) {
    return { title: "Topic Not Found | LingoIsland" };
  }

  const title = `${topicName} in Chinese (Vocabulary + Sentences) | LingoIsland`;
  const description = `Learn Chinese vocabulary for ${topicName} with pinyin, example sentences, and intermediate-friendly phrases (A2–B2 / HSK 3–6). Start your Topic Island in minutes.`;

  const indexable = content && meetsIndexingMinimum(content);

  return {
    title,
    description,
    alternates: {
      canonical: getCanonicalUrl(`topics/${slug}`),
    },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: getCanonicalUrl(`topics/${slug}`),
    },
  };
}

export default async function TopicSlugPage({ params }: Props) {
  const slug = params.slug;
  const topicName = SLUG_TO_TOPIC.get(slug);
  const content = getTopicPageContent(slug);

  if (!topicName) notFound();

  const indexable = content && meetsIndexingMinimum(content);
  const relatedSlugs = getRelatedSlugs(slug, 6);

  return (
    <main className="min-h-screen bg-gray-50">
      <article className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <h1 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
          Chinese Vocabulary for: {topicName}
        </h1>

        {content ? (
          <>
            <p className="mb-6 text-lg leading-relaxed text-gray-700">
              {content.intro}
            </p>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                When you&apos;d use this
              </h2>
              <p className="text-gray-700">{content.whenUse}</p>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Key vocabulary
              </h2>
              <ul className="space-y-2">
                {content.vocab.map((item) => (
                  <li
                    key={item.chinese}
                    className="flex flex-wrap items-baseline gap-2 text-gray-800"
                  >
                    <span className="font-medium text-gray-900">
                      {item.chinese}
                    </span>
                    <span className="text-sm text-gray-600">
                      {item.pinyin}
                    </span>
                    <span className="text-sm text-gray-500">• {item.english}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Example sentences
              </h2>
              <ul className="space-y-4">
                {content.sentences.map((s, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <p className="font-medium text-gray-900">{s.chinese}</p>
                    <p className="text-sm text-gray-600">{s.pinyin}</p>
                    <p className="text-sm text-gray-500">{s.english}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">
                Common mistakes / natural phrasing
              </h2>
              <p className="text-gray-700">{content.commonMistakes}</p>
            </section>
          </>
        ) : (
          <p className="mb-6 text-gray-700">
            This topic doesn&apos;t have a full page yet. You can still start a
            Topic Island with this topic—we&apos;ll generate vocabulary and
            sentences for you.
          </p>
        )}

        <TopicPageCTAs topicName={topicName} slug={slug} />

        <nav className="mt-12 border-t border-gray-200 pt-8">
          <p className="mb-3 text-sm font-medium text-gray-600">
            Related topics
          </p>
          <ul className="mb-6 flex flex-wrap gap-2">
            {relatedSlugs.map((s) => {
              const name = SLUG_TO_TOPIC.get(s);
              if (!name) return null;
              return (
                <li key={s}>
                  <Link
                    href={`/topics/${s}`}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {name}
                  </Link>
                </li>
              );
            })}
          </ul>
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
            <li>
              <Link href="/topics" className="text-gray-700 underline hover:text-gray-900">
                Browse all topics
              </Link>
            </li>
          </ul>
        </nav>
      </article>
    </main>
  );
}
