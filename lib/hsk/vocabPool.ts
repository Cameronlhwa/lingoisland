import type { SupabaseClient } from "@supabase/supabase-js";
import type { HskStandard } from "@/lib/utils/hsk";

export type HskWordRow = {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string | null;
  level: number;
  sort_order: number | null;
  part_of_speech: string | null;
  interest_tags?: string[];
  is_functional?: boolean;
};

export type UnlearnedHskWordsArgs = {
  userId: string;
  standard: HskStandard;
  level: number;
  excludeWordIds?: string[];
  limit?: number;
  /** Prefer words whose interest_tags overlap this list. */
  interestTags?: string[];
  /** Only return is_functional = true words. */
  functionalOnly?: boolean;
};

/**
 * Words a user still needs to learn at a given HSK level.
 *
 * "Learned / introduced" is derived from the universal SRS card system: a word
 * counts as learned once a `cards` row exists with source_type='hsk_word' and
 * source_ref_id = hsk_words.id for that user.
 */
export async function getUnlearnedHskWords(
  supabase: SupabaseClient,
  {
    userId,
    standard,
    level,
    excludeWordIds = [],
    limit,
    interestTags,
    functionalOnly,
  }: UnlearnedHskWordsArgs,
): Promise<HskWordRow[]> {
  let query = supabase
    .from("hsk_words")
    .select(
      "id, hanzi, pinyin, english, level, sort_order, part_of_speech, interest_tags, is_functional",
    )
    .eq("standard", standard)
    .eq("level", level)
    .eq("is_placeholder", false)
    .order("sort_order", { ascending: true, nullsFirst: false });

  if (functionalOnly) {
    query = query.eq("is_functional", true);
  }
  if (interestTags && interestTags.length > 0) {
    query = query.overlaps("interest_tags", interestTags);
  }

  const { data: words, error } = await query;

  if (error || !words) {
    console.error("[vocabPool] hsk_words fetch failed", error);
    return [];
  }

  const learned = new Set<string>();
  const { data: cards, error: cardsErr } = await supabase
    .from("cards")
    .select("source_ref_id")
    .eq("user_id", userId)
    .eq("source_type", "hsk_word");
  if (cardsErr) {
    console.warn("[vocabPool] cards fetch failed", cardsErr);
  }
  for (const c of cards ?? []) {
    if (c.source_ref_id) learned.add(c.source_ref_id as string);
  }

  const excluded = new Set(excludeWordIds);
  const out = (words as HskWordRow[]).filter(
    (w) => !learned.has(w.id) && !excluded.has(w.id),
  );
  return typeof limit === "number" ? out.slice(0, limit) : out;
}

export async function countUnlearnedHskWords(
  supabase: SupabaseClient,
  args: Omit<UnlearnedHskWordsArgs, "limit">,
): Promise<number> {
  const rows = await getUnlearnedHskWords(supabase, args);
  return rows.length;
}

/**
 * Themed unit pool: pull the assigned interest first, cascade through the
 * learner's remaining interests, then an unfiltered fallback. Sprinkle a few
 * functional words when the unit is themed.
 */
export async function getWordsForCurriculumUnit(
  supabase: SupabaseClient,
  {
    userId,
    standard,
    level,
    excludeWordIds = [],
    interestTag,
    userInterests,
    foundations,
    targetCount = 32,
    functionalSprinkle = 2,
  }: {
    userId: string;
    standard: HskStandard;
    level: number;
    excludeWordIds?: string[];
    interestTag: string | null;
    userInterests: string[];
    foundations: boolean;
    targetCount?: number;
    functionalSprinkle?: number;
  },
): Promise<HskWordRow[]> {
  const picked: HskWordRow[] = [];
  const seen = new Set<string>(excludeWordIds);

  const take = (rows: HskWordRow[], n: number) => {
    const out: HskWordRow[] = [];
    for (const row of rows) {
      if (out.length >= n) break;
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    return out;
  };

  if (foundations) {
    const functional = await getUnlearnedHskWords(supabase, {
      userId,
      standard,
      level,
      excludeWordIds: Array.from(seen),
      functionalOnly: true,
    });
    picked.push(...take(functional, targetCount));
    if (picked.length < targetCount) {
      const fallback = await getUnlearnedHskWords(supabase, {
        userId,
        standard,
        level,
        excludeWordIds: Array.from(seen),
      });
      picked.push(...take(fallback, targetCount - picked.length));
    }
    return picked.slice(0, targetCount);
  }

  const themedTarget = Math.max(1, targetCount - functionalSprinkle);
  const cascade = [
    ...(interestTag ? [interestTag] : []),
    ...userInterests.filter((t) => t && t !== interestTag),
  ];

  for (const tag of cascade) {
    if (picked.length >= themedTarget) break;
    const rows = await getUnlearnedHskWords(supabase, {
      userId,
      standard,
      level,
      excludeWordIds: Array.from(seen),
      interestTags: [tag],
    });
    picked.push(...take(rows, themedTarget - picked.length));
  }

  if (picked.length < themedTarget) {
    const fallback = await getUnlearnedHskWords(supabase, {
      userId,
      standard,
      level,
      excludeWordIds: Array.from(seen),
    });
    picked.push(...take(fallback, themedTarget - picked.length));
  }

  if (functionalSprinkle > 0) {
    const functional = await getUnlearnedHskWords(supabase, {
      userId,
      standard,
      level,
      excludeWordIds: Array.from(seen),
      functionalOnly: true,
    });
    picked.push(...take(functional, functionalSprinkle));
  }

  if (picked.length < targetCount) {
    const rest = await getUnlearnedHskWords(supabase, {
      userId,
      standard,
      level,
      excludeWordIds: Array.from(seen),
    });
    picked.push(...take(rest, targetCount - picked.length));
  }

  return picked.slice(0, targetCount);
}
