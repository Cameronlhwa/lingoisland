import fs from "node:fs";
import path from "node:path";

import type { BlogSlug } from "./types";

const CALLOUT_SPLIT = "{{CALLOUT_MID}}";

export function readBlogMarkdownFile(slug: BlogSlug): string {
  const file = path.join(process.cwd(), "content/blog", `${slug}.md`);
  return fs.readFileSync(file, "utf8");
}

export function splitBlogMarkdown(raw: string): { before: string; after: string } {
  const idx = raw.indexOf(CALLOUT_SPLIT);
  if (idx === -1) {
    return { before: raw.trim(), after: "" };
  }
  const before = raw.slice(0, idx).trim();
  const after = raw.slice(idx + CALLOUT_SPLIT.length).trim();
  return { before, after };
}
