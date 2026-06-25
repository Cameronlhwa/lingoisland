import type { Metadata } from "next";
import Link from "next/link";

import { blogPosts } from "@/lib/blog/posts";
import { getCanonicalUrl } from "@/lib/utils/site-url";

export const metadata: Metadata = {
  title: {
    absolute: "Blog | LingoIsland — Mandarin Tips & Vocabulary Guides",
  },
  description:
    "Honest takes on learning Mandarin, vocabulary deep-dives, and tips for getting past the intermediate plateau. Written by a real Mandarin learner.",
  alternates: {
    canonical: getCanonicalUrl("blog"),
  },
  openGraph: {
    title: "Blog | LingoIsland — Mandarin Tips & Vocabulary Guides",
    description:
      "Honest takes on learning Mandarin, vocabulary deep-dives, and tips for getting past the intermediate plateau. Written by a real Mandarin learner.",
    url: getCanonicalUrl("blog"),
    siteName: "LingoIsland",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog | LingoIsland — Mandarin Tips & Vocabulary Guides",
    description:
      "Honest takes on learning Mandarin, vocabulary deep-dives, and tips for getting past the intermediate plateau. Written by a real Mandarin learner.",
  },
};

export default function BlogIndexPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-6 pb-16 pt-10 md:px-10 md:pt-14">
      <header className="max-w-[820px]">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{
            color: "#2176AE",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          LingoIsland
        </p>
        <h1
          className="mt-3 text-3xl font-semibold leading-tight md:text-[2.35rem]"
          style={{ color: "#071E2E", fontFamily: "'Lora', Georgia, serif" }}
        >
          The LingoIsland Blog
        </h1>
        <p
          className="mt-4 text-lg leading-relaxed md:text-[1.125rem]"
          style={{
            color: "#071E2E",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            opacity: 0.92,
          }}
        >
          The LingoIsland Blog — Mandarin tips, vocab deep-dives, and honest
          takes on learning.
        </p>
      </header>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {blogPosts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex h-full flex-col rounded-2xl border border-[#2176AE]/12 bg-white/85 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#2176AE]/25 hover:shadow-md"
            style={{ textDecoration: "none", color: "#071E2E" }}
          >
            <span
              className="mb-3 inline-flex w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                background: "#EAF5FB",
                color: "#2176AE",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {post.category}
            </span>
            <h2
              className="text-xl font-semibold leading-snug group-hover:underline md:text-[1.35rem]"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              {post.title}
            </h2>
            <p
              className="mt-3 line-clamp-2 text-[15px] leading-relaxed"
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                opacity: 0.85,
              }}
            >
              {post.excerpt}
            </p>
            <div
              className="mt-auto flex items-center justify-between pt-5 text-xs font-semibold"
              style={{
                color: "#2176AE",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              <span>{post.readTimeMinutes} min read</span>
              <span className="transition group-hover:translate-x-0.5">
                Read →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
