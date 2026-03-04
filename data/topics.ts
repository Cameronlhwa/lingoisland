/**
 * Hard-coded topic list for the public /topics hub.
 * Slug: lowercase, spaces and slashes → single hyphen.
 */

export function topicToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\/\s*/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function slugToTopicName(slugsToNames: Map<string, string>, slug: string): string | null {
  return slugsToNames.get(slug) ?? null;
}

export const TOPICS_BY_CATEGORY: { category: string; topics: string[] }[] = [
  {
    category: "Travel & getting around",
    topics: [
      "Airport & immigration",
      "Checking into a hotel",
      "Ordering bubble tea",
      "Ordering at a restaurant",
      "Street food & night markets",
      "Asking for directions",
      "Taking the subway",
      "Taking a taxi / Didi",
      "Renting a scooter / bike",
      "Shopping at a convenience store",
      "Shopping at a supermarket",
      "Buying tickets (train / bus)",
      "Going to a tourist attraction",
      "Dealing with lost items",
      "Emergencies while traveling",
    ],
  },
  {
    category: "Everyday life",
    topics: [
      "Introducing yourself",
      "Making small talk",
      "Talking about your day",
      "Weather & seasons",
      "Time, dates, schedules",
      "Numbers & prices",
      "Phone calls & texting",
      "Asking for help politely",
      "Complaining (politely)",
      "Apologizing naturally",
      "Making plans with friends",
      "Canceling plans / rescheduling",
      "Giving opinions",
      "Agreeing / disagreeing",
      "Saying something more \"native\"",
    ],
  },
  {
    category: "Relationships & dating",
    topics: [
      "Flirting & teasing (safe / normal)",
      "First date conversation",
      "Talking about personality",
      "Relationship status",
      "Meeting your partner's friends",
      "Meeting parents / family dinner",
      "Giving compliments",
      "Expressing feelings",
      "Setting boundaries",
      "Talking through conflict",
      "Long-distance relationship talk",
      "Talking about future plans",
      "Gift-giving & holidays",
      "Saying \"I miss you\" naturally",
      "Breakup / closure language (non-drama)",
    ],
  },
  {
    category: "Work & office Mandarin",
    topics: [
      "Introducing yourself at work",
      "Office small talk",
      "Meetings & agendas",
      "Project updates",
      "Deadlines & urgency",
      "Asking for clarification",
      "Giving feedback politely",
      "Writing professional messages",
      "Scheduling a call",
      "Hiring / interviews",
      "Talking about your job role",
      "Talking to your manager",
      "Asking for help at work",
      "Negotiation basics",
      "Business travel",
    ],
  },
  {
    category: "School & student life",
    topics: [
      "In-class participation",
      "Asking questions in class",
      "Homework & assignments",
      "Study routines",
      "Group projects",
      "Office hours / tutoring",
      "Exams & stress",
      "Presentations",
      "Campus life & clubs",
      "Talking about majors & careers",
    ],
  },
  {
    category: "Food & cooking",
    topics: [
      "Ordering coffee",
      "Ordering at a bakery",
      "Dietary restrictions (veg, allergies)",
      "Spicy level / preferences",
      "Cooking at home",
      "Kitchen tools & ingredients",
      "Hosting friends for dinner",
      "Asking for recommendations",
      "Food reviews (tasty / bland / etc.)",
      "Paying the bill & splitting",
    ],
  },
  {
    category: "Health & practical life",
    topics: [
      "Pharmacy & medicine",
      "Going to a clinic",
      "Describing symptoms",
      "Mental health (basic, safe language)",
      "Gym & fitness",
      "Sleep & fatigue",
      "Dental / dentist visit",
      "Personal safety",
      "Insurance & paperwork basics",
      "Emergency contact / hospital basics",
    ],
  },
  {
    category: "Internet culture & modern life",
    topics: [
      "Social media comments",
      "Online shopping (Taobao / JD)",
      "Customer service chat",
      "Tech problems / troubleshooting",
      "Making a complaint / refund",
      "Delivery / takeout apps",
      "Chinese slang (realistic, not cringe)",
      "Memes & internet phrases",
      "Talking about AI / tech",
      "Making friends online / communities",
    ],
  },
];

/** Slugs that have a dedicated /topics/[slug] page (indexable). All others link straight to onboarding. */
export const PRIORITY_TOPIC_SLUGS = new Set([
  "ordering-at-a-restaurant",
  "ordering-bubble-tea",
  "checking-into-a-hotel",
  "airport-immigration",
  "asking-for-directions",
  "taking-a-taxi-didi",
  "taking-the-subway",
  "shopping-at-a-supermarket",
  "shopping-at-a-convenience-store",
  "buying-tickets-train-bus",
  "introducing-yourself",
  "making-small-talk",
  "making-plans-with-friends",
  "apologizing-naturally",
  "numbers-prices",
  "time-dates-schedules",
  "phone-calls-texting",
  "asking-for-help-politely",
  "customer-service-chat",
  "delivery-takeout-apps",
]);

/** Topic slugs to show a "Trending" badge (popular picks for learners). */
export const TRENDING_TOPIC_SLUGS = new Set([
  "ordering-at-a-restaurant",
  "making-small-talk",
  "ordering-bubble-tea",
]);

/** All topic names flattened with their slug for lookup. */
const allTopicEntries = TOPICS_BY_CATEGORY.flatMap(({ category, topics }) =>
  topics.map((name) => ({ category, name, slug: topicToSlug(name) }))
);

export const ALL_TOPICS = allTopicEntries;

export const SLUG_TO_TOPIC: Map<string, string> = new Map(
  allTopicEntries.map((t) => [t.slug, t.name])
);

export const SLUG_TO_CATEGORY: Map<string, string> = new Map(
  allTopicEntries.map((t) => [t.slug, t.category])
);

/** Get 3–6 related topic slugs for a given slug (same category preferred, then others). */
export function getRelatedSlugs(slug: string, count: number = 5): string[] {
  const category = SLUG_TO_CATEGORY.get(slug);
  const sameCategory = allTopicEntries.filter((t) => t.category === category && t.slug !== slug);
  const other = allTopicEntries.filter((t) => t.slug !== slug && t.category !== category);
  const combined = [...sameCategory, ...other];
  return combined.slice(0, count).map((t) => t.slug);
}
