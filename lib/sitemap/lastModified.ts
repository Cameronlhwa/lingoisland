import fs from "node:fs";
import path from "node:path";

/**
 * Best-effort lastModified for sitemap.xml from source file mtimes.
 * Falls back to `new Date()` only when no tracked files exist (should not happen in repo).
 */
function safeMtime(absPath: string): Date | undefined {
  try {
    return fs.statSync(absPath).mtime;
  } catch {
    return undefined;
  }
}

function abs(rel: string): string {
  return path.join(process.cwd(), rel);
}

/** Newest mtime among existing relative paths (repo root). */
export function maxMtime(relPaths: string[]): Date {
  let maxMs = 0;
  for (const rel of relPaths) {
    const t = safeMtime(abs(rel))?.getTime() ?? 0;
    if (t > maxMs) maxMs = t;
  }
  return maxMs > 0 ? new Date(maxMs) : new Date();
}

export function blogMarkdownMtime(slug: string): Date {
  return maxMtime([`content/blog/${slug}.md`]);
}

export function blogHubMtime(mdSlugs: readonly string[]): Date {
  const mdPaths = mdSlugs.map((slug) => `content/blog/${slug}.md`);
  return maxMtime([
    ...mdPaths,
    "app/blog/page.tsx",
    "app/blog/layout.tsx",
    "lib/blog/posts.ts",
  ]);
}

export function topicListingMtime(): Date {
  return maxMtime([
    "app/topics/page.tsx",
    "data/topics.ts",
    "data/topic-page-content.ts",
  ]);
}

/** Topic URLs share one content module; template changes bump all together. */
export function topicDetailTemplateMtime(): Date {
  return maxMtime(["data/topic-page-content.ts", "app/topics/[slug]/page.tsx"]);
}
