# SEO crawl & indexing audit

This doc defines how public, thin, and private pages are handled so robots.ts, sitemap, and meta robots stay consistent.

## 1. Public marketing & SEO pages (indexable)

| Path | Meta robots | In sitemap | Notes |
|------|-------------|------------|--------|
| `/` | index, follow | ✅ | Home |
| `/pricing` | index, follow | ✅ | Pricing |
| `/founder` | index, follow | ✅ | About founder |
| `/topics` | index, follow | ✅ | Topics hub |
| `/topics/[slug]` | index, follow **only if** content meets minimum (150–300 words intro, 12–25 vocab, 6–12 sentences) | ✅ only when indexable | Topic pages; noindex when thin |

**Canonical:** Each has `alternates.canonical` to the canonical origin (e.g. `https://lingoisland.com/...`). One URL per page; no duplicate variants.

---

## 2. Thin pages (crawlable, noindex)

Crawlers are **allowed** to request these so they can see the noindex directive and not index them.

| Path | Meta robots | In sitemap |
|------|-------------|------------|
| `/login` | noindex, follow | ❌ |
| `/onboarding/*` | noindex, follow | ❌ |

**robots.txt:** Does **not** disallow these paths so Google can crawl and respect noindex.

---

## 3. Private / waste (disallow and/or noindex)

| Path | robots.txt | Meta robots | In sitemap |
|------|------------|-------------|------------|
| `/api/*` | disallow | N/A | ❌ |
| `/app/*` | disallow | noindex, nofollow | ❌ |
| `/auth/*` | disallow | noindex, follow | ❌ |

**robots.txt** disallows these so crawlers don’t waste budget. `/app` layout also sets noindex,nofollow for defense in depth.

---

## 4. Sitemap

- **Contains only indexable pages.** No thin (noindex) or private (disallow) URLs.
- **Topic slugs:** A `/topics/[slug]` URL is added only when `meetsIndexingMinimum(content)` is true for that slug. If a topic page is ever noindex (e.g. content removed), it is not listed in the sitemap.
- **URLs included:** `/`, `/pricing`, `/founder`, `/topics`, and each indexable `/topics/[slug]`.

---

## 5. No contradictions

- **robots.ts:** Disallow only `/api/`, `/app/`, `/auth/`. Everything in the sitemap is allowed.
- **Sitemap:** Only lists pages that are (1) allowed by robots.txt and (2) indexable (meta robots index: true).
- **Meta robots:** Indexable pages explicitly set `index: true, follow: true`. Thin pages set `index: false, follow: true`. Private `/app` sets `index: false, follow: false`.

---

## 6. Topics hub SEO (rankings)

- **Structured data:** `/topics` includes a `CollectionPage` + `ItemList` JSON-LD so search engines understand the hub and the 100 topics.
- **Copy:** H1 and intro target “Mandarin vocabulary by topic”, “intermediate Chinese”, “HSK vocabulary”, “learn Mandarin by topic”, “Chinese vocabulary lists by theme”, “pinyin”, “example sentences”, “spaced repetition”.
- **Topic page titles** avoid “How to say … in Chinese” to reduce low-intent translation traffic.

---

*Last updated: audit implemented with sitemap (founder + indexable-only topic slugs), explicit robots on public pages, robots.ts comments, and topics hub JSON-LD + intro.*
