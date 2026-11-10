// Goals and interests for the personalized onboarding flow. Keys are stored
// and sent to analytics; labels are display-only and may change.

export type GoalKey = "work" | "school" | "heritage" | "travel" | "everyday" | "other";

/** Topic families shared by the assessment bank, pronunciation words, and plans. */
export type TopicFamily = "work" | "school" | "family" | "travel" | "everyday";

export type GoalOption = {
  key: GoalKey;
  label: string;
  description: string;
  family: TopicFamily;
};

export const GOALS: readonly GoalOption[] = [
  { key: "work", label: "Work or business", description: "Clients, colleagues, and professional situations", family: "work" },
  { key: "school", label: "School or studies", description: "Classes, subjects, and campus life", family: "school" },
  { key: "heritage", label: "Family or heritage", description: "Talk with family and connect with your roots", family: "family" },
  { key: "travel", label: "Travel", description: "Get around, eat well, and meet people", family: "travel" },
  { key: "everyday", label: "Everyday life", description: "Friends, hobbies, and daily conversations", family: "everyday" },
  { key: "other", label: "Something else", description: "Tell us in a few words if you like", family: "everyday" },
];

export type InterestOption = { key: string; label: string; family: TopicFamily };

const WORK: InterestOption[] = [
  { key: "clients", label: "Clients", family: "work" },
  { key: "finance", label: "Finance", family: "work" },
  { key: "meetings", label: "Meetings", family: "work" },
  { key: "networking", label: "Networking", family: "work" },
  { key: "sales", label: "Sales", family: "work" },
  { key: "technology", label: "Technology", family: "work" },
  { key: "entrepreneurship", label: "Entrepreneurship", family: "work" },
];

const SCHOOL: InterestOption[] = [
  { key: "school_life", label: "School life", family: "school" },
  { key: "presentations", label: "Presentations", family: "school" },
  { key: "science", label: "Science", family: "school" },
  { key: "engineering", label: "Engineering", family: "school" },
  { key: "medicine", label: "Medicine", family: "school" },
  { key: "current_events", label: "Current events", family: "everyday" },
];

const HERITAGE: InterestOption[] = [
  { key: "family_conversations", label: "Family conversations", family: "family" },
  { key: "food", label: "Food", family: "everyday" },
  { key: "traditions", label: "Traditions", family: "family" },
  { key: "childhood", label: "Childhood", family: "family" },
  { key: "everyday_life", label: "Everyday life", family: "everyday" },
];

const TRAVEL: InterestOption[] = [
  { key: "restaurants", label: "Restaurants", family: "travel" },
  { key: "transportation", label: "Transportation", family: "travel" },
  { key: "hotels", label: "Hotels", family: "travel" },
  { key: "shopping", label: "Shopping", family: "travel" },
  { key: "sightseeing", label: "Sightseeing", family: "travel" },
  { key: "meeting_locals", label: "Meeting locals", family: "travel" },
];

const EVERYDAY: InterestOption[] = [
  { key: "friends", label: "Friends", family: "everyday" },
  { key: "entertainment", label: "Entertainment", family: "everyday" },
  { key: "hobbies", label: "Hobbies", family: "everyday" },
  { key: "food", label: "Food", family: "everyday" },
  { key: "relationships", label: "Relationships", family: "everyday" },
  { key: "current_events", label: "Current events", family: "everyday" },
];

export const INTERESTS_BY_GOAL: Record<GoalKey, readonly InterestOption[]> = {
  work: WORK,
  school: SCHOOL,
  heritage: HERITAGE,
  travel: TRAVEL,
  everyday: EVERYDAY,
  other: EVERYDAY,
};

const ALL_INTERESTS = new Map<string, InterestOption>();
[WORK, SCHOOL, HERITAGE, TRAVEL, EVERYDAY].forEach((list) =>
  list.forEach((item) => {
    if (!ALL_INTERESTS.has(item.key)) ALL_INTERESTS.set(item.key, item);
  }),
);

export function getGoal(key: string | null | undefined): GoalOption | null {
  return GOALS.find((goal) => goal.key === key) ?? null;
}

export function isGoalKey(value: unknown): value is GoalKey {
  return typeof value === "string" && GOALS.some((goal) => goal.key === value);
}

export function getInterest(key: string): InterestOption | null {
  return ALL_INTERESTS.get(key) ?? null;
}

export function isInterestKey(value: unknown): value is string {
  return typeof value === "string" && ALL_INTERESTS.has(value);
}

/** Chips for a goal, keeping any already-selected keys from another goal visible. */
export function interestOptionsFor(goal: GoalKey | null, selected: readonly string[] = []): InterestOption[] {
  const base = [...INTERESTS_BY_GOAL[goal ?? "everyday"]];
  selected.forEach((key) => {
    const option = getInterest(key);
    if (option && !base.some((item) => item.key === key)) base.push(option);
  });
  return base;
}

export const CUSTOM_TEXT_MAX = 40;

/**
 * Normalizes free text (custom interest, "something else" goal): strips
 * control characters and markup, collapses whitespace, and caps the length.
 * Returns null when nothing meaningful remains.
 */
export function normalizeCustomText(value: unknown, max = CUSTOM_TEXT_MAX): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, " ")
    .replace(/[<>{}[\]\\`|^~$]/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const chars = Array.from(cleaned).slice(0, max).join("").trim();
  return chars.length >= 2 ? chars : null;
}

export function goalLabel(key: GoalKey | null | undefined, otherText?: string | null) {
  if (key === "other") return otherText || "your own goals";
  return getGoal(key)?.label ?? "your goals";
}

/** Lower-case goal phrase used inside sentences ("Mandarin for work or business"). */
export function goalPhrase(key: GoalKey | null | undefined, otherText?: string | null) {
  if (key === "other") return otherText || "your own goals";
  const label = getGoal(key)?.label;
  return label ? label.toLowerCase() : "your goals";
}

export function interestLabels(keys: readonly string[], custom?: string | null): string[] {
  const labels = keys.map((key) => getInterest(key)?.label).filter((label): label is string => Boolean(label));
  if (custom) labels.push(custom);
  return labels;
}

/** "clients, meetings, and sales" */
export function joinList(items: readonly string[], conjunction = "and"): string {
  const list = items.filter(Boolean);
  if (list.length === 0) return "";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} ${conjunction} ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, ${conjunction} ${list[list.length - 1]}`;
}

export function topicFamilyFor(goal: GoalKey | null, interestKeys: readonly string[]): TopicFamily {
  const first = interestKeys.map((key) => getInterest(key)).find(Boolean);
  if (first) return first.family;
  return getGoal(goal)?.family ?? "everyday";
}
