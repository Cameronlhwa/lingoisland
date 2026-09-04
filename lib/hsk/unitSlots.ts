import { FOUNDATIONS_INTEREST_TAG } from "@/lib/hsk/pathStandard";

export type CurriculumUnitKind = "themed" | "foundations";

export type CurriculumSlot = {
  unit_number: number;
  kind: CurriculumUnitKind;
  interest_tag: string;
};

const HSK_PER_THEMED_UNIT = 32;
/** Cap themed units so adding Foundations still keeps the path finite. */
const MAX_THEMED_UNITS = 16;
/** Insert a Foundations unit after every N themed units. */
const THEMED_PER_FOUNDATIONS = 3;

export function themedUnitCountFromRemaining(remaining: number): number {
  return Math.max(1, Math.min(MAX_THEMED_UNITS, Math.ceil(remaining / HSK_PER_THEMED_UNIT)));
}

/**
 * Round-robin interest tags onto themed slots; insert a Foundations unit after
 * every 3 themed units so the path is ~1 foundations per 3–4 themed.
 */
export function buildCurriculumSlots(
  themedCount: number,
  interests: string[],
): CurriculumSlot[] {
  const tags = interests.filter((t) => t.trim().length > 0);
  if (tags.length === 0) {
    throw new Error("at least one interest is required to assign unit slots");
  }

  const slots: CurriculumSlot[] = [];
  let themed = 0;
  let unitNumber = 1;

  while (themed < themedCount) {
    slots.push({
      unit_number: unitNumber++,
      kind: "themed",
      interest_tag: tags[themed % tags.length],
    });
    themed += 1;
    if (themed % THEMED_PER_FOUNDATIONS === 0) {
      slots.push({
        unit_number: unitNumber++,
        kind: "foundations",
        interest_tag: FOUNDATIONS_INTEREST_TAG,
      });
    }
  }

  return slots;
}

export function isFoundationsTag(tag: string | null | undefined): boolean {
  return tag === FOUNDATIONS_INTEREST_TAG;
}
