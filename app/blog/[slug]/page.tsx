import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleHero } from "@/components/blog/ArticleHero";
import { BlogAuthorBio, BlogRelatedArticles } from "@/components/blog/BlogArticleFooter";
import { BlogCallout } from "@/components/blog/BlogCallout";
import { BlogMarkdown } from "@/components/blog/BlogMarkdown";
import { BlogReadingProgress } from "@/components/blog/BlogReadingProgress";
import { IslandScreenshot } from "@/components/blog/IslandScreenshot";
import { readBlogMarkdownFile, splitBlogMarkdown } from "@/lib/blog/get-markdown";
import { getAllBlogSlugs, getBlogPost, getRelatedPosts } from "@/lib/blog/posts";
import type { BlogSlug } from "@/lib/blog/types";
import { getCanonicalUrl } from "@/lib/utils/site-url";

type Props = { params: { slug: string } };

export function generateStaticParams() {
  return getAllBlogSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getBlogPost(params.slug);
  if (!post) {
    return { title: "Not found" };
  }
  return {
    title: { absolute: `${post.title} | LingoIsland` },
    description: post.excerpt,
    alternates: {
      canonical: getCanonicalUrl(`blog/${post.slug}`),
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: getCanonicalUrl(`blog/${post.slug}`),
      siteName: "LingoIsland",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

const islandLabel: Partial<Record<BlogSlug, string>> = {
  "gratitude-in-chinese": "Gratitude",
  "bubble-tea-in-chinese": "Bubble Tea",
  "horoscope-in-chinese": "Horoscope",
  "zodiac-signs-in-chinese": "Zodiac",
};

export default function BlogArticlePage({ params }: Props) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  const raw = readBlogMarkdownFile(post.slug);
  const { before, after } = splitBlogMarkdown(raw);
  const related = getRelatedPosts(post.slug);

  const midIsland = post.midIslandScreenshot;
  const topic = islandLabel[post.slug];

  return (
    <>
      <BlogReadingProgress />
      <article className="mx-auto w-full max-w-[720px] px-6 pb-20 pt-8 md:px-8 md:pt-10">
        <nav
          className="text-sm"
          style={{ color: "#071E2E", fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          <Link href="/" className="font-medium hover:underline" style={{ color: "#2176AE" }}>
            Home
          </Link>
          <span className="mx-2 opacity-40">/</span>
          <Link href="/blog" className="font-medium hover:underline" style={{ color: "#2176AE" }}>
            Blog
          </Link>
          <span className="mx-2 opacity-40">/</span>
          <span className="opacity-70">{post.title}</span>
        </nav>

        <p
          className="mt-6 text-xs font-semibold uppercase tracking-wide"
          style={{ color: "#2176AE", fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          {post.category}
        </p>
        <h1
          className="mt-2 text-3xl font-semibold leading-tight md:text-[2.15rem]"
          style={{ color: "#071E2E", fontFamily: "'Lora', Georgia, serif" }}
        >
          {post.title}
        </h1>
        <p
          className="mt-3 text-sm font-medium opacity-70"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif", color: "#071E2E" }}
        >
          {post.readTimeMinutes} min read
        </p>

        <div className="mt-8">
          <ArticleHero src={`/blog/images/${post.slug}-hero.jpg`} alt={post.title} />
        </div>

        <BlogMarkdown markdown={before} />

        <BlogCallout {...post.midCallout}>
          {midIsland && topic ? (
            <IslandScreenshot src={`/blog/images/${post.slug}-island.jpg`} topic={topic} />
          ) : null}
        </BlogCallout>

        {after ? <BlogMarkdown markdown={after} /> : null}

        <BlogCallout {...post.endCallout} />

        <BlogAuthorBio />
        <BlogRelatedArticles posts={related} />
      </article>
    </>
  );
}
