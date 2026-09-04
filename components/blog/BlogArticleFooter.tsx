import Link from "next/link";

import type { BlogPost } from "@/lib/blog/types";

export function BlogAuthorBio() {
  return (
    <section
      className="mt-12 rounded-xl border border-[#2176AE]/15 bg-white/70 p-6"
      style={{ color: "#071E2E" }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "#2176AE", fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        About the author
      </p>
      <p
        className="mt-2 text-[18px] leading-relaxed"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        <span className="font-semibold">Cameron</span> — Founder of LingoIsland & Mandarin learner
        (HSK 5).{" "}
        <Link href="/founder" className="font-semibold underline-offset-2 hover:underline" style={{ color: "#2176AE" }}>
          Read Cameron&apos;s story
        </Link>
        .
      </p>
    </section>
  );
}

export function BlogRelatedArticles({ posts }: { posts: BlogPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section className="mt-14">
      <h2
        className="text-2xl font-semibold md:text-[1.75rem]"
        style={{ color: "#071E2E", fontFamily: "'Lora', Georgia, serif" }}
      >
        Related articles
      </h2>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="group flex h-full flex-col rounded-xl border border-[#2176AE]/12 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#2176AE]/25 hover:shadow-md"
            style={{ color: "#071E2E", textDecoration: "none" }}
          >
            <span
              className="mb-2 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                background: "#EAF5FB",
                color: "#2176AE",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {p.category}
            </span>
            <span
              className="text-lg font-semibold leading-snug group-hover:underline"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              {p.title}
            </span>
            <span
              className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#071E2E]/75"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              {p.excerpt}
            </span>
            <span
              className="mt-auto pt-4 text-xs font-semibold"
              style={{ color: "#2176AE", fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              {p.readTimeMinutes} min read
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
