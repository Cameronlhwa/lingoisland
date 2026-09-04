/**
 * Copy for the A4 (bucket) + A5 (adaptive written prompt) onboarding step.
 * A5's headline/subtext/placeholder/chips all switch on the A4 bucket — one
 * shared component with four content variants, not four components.
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  Briefcase,
  Building2,
  Camera,
  Clapperboard,
  Code2,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  Languages,
  Music,
  Palette,
  PartyPopper,
  ScrollText,
  Sparkles,
  TrendingUp,
  Users,
  UtensilsCrossed,
} from "lucide-react";

export type HskMotivation = "school" | "job" | "heritage" | "hobby";

/**
 * Structured interests collected right after the free-text personalization
 * step. Each curriculum unit leans on one of these (cycling), so the roadmap
 * feels varied. Stored on user_profiles.interests (text[]).
 */
export type HskInterestOption = { value: string; icon: LucideIcon };

export const HSK_INTEREST_CATEGORIES: {
  label: string;
  options: HskInterestOption[];
}[] = [
  {
    label: "Entertainment & culture",
    options: [
      { value: "Film & TV / C-dramas", icon: Clapperboard },
      { value: "Music", icon: Music },
      { value: "Gaming", icon: PartyPopper },
      { value: "Art & design", icon: Palette },
      { value: "Books & reading", icon: BookOpen },
      { value: "History & culture", icon: Landmark },
    ],
  },
  {
    label: "Travel & everyday life",
    options: [
      { value: "Travel", icon: Globe },
      { value: "Food & cooking", icon: UtensilsCrossed },
      { value: "Home & living", icon: Home },
      { value: "Health & wellness", icon: Heart },
      { value: "Relationships & family", icon: Users },
      { value: "Fashion & beauty", icon: Palette },
    ],
  },
  {
    label: "Work & learning",
    options: [
      { value: "Business & career", icon: Briefcase },
      { value: "Technology", icon: Code2 },
      { value: "Entrepreneurship", icon: TrendingUp },
      { value: "School & study", icon: GraduationCap },
      { value: "Finance & economics", icon: Building2 },
      { value: "Languages & linguistics", icon: Languages },
    ],
  },
  {
    label: "Science, nature & ideas",
    options: [
      { value: "Science & nature", icon: BookOpen },
      { value: "News & current events", icon: ScrollText },
      { value: "Space & the future", icon: Sparkles },
      { value: "Psychology & self-development", icon: Heart },
      { value: "Animals & pets", icon: Home },
      { value: "Environment & sustainability", icon: Globe },
    ],
  },
  {
    label: "Active & social",
    options: [
      { value: "Sports & fitness", icon: Activity },
      { value: "Photography", icon: Camera },
      { value: "Social life", icon: Users },
      { value: "Personal style", icon: Palette },
    ],
  },
];

export const HSK_INTEREST_OPTIONS = HSK_INTEREST_CATEGORIES.flatMap(
  (category) => category.options,
);

const HSK_LEVEL_VOCABULARY_THEMES: Record<number, HskInterestOption[]> = {
  1: [
    { value: "Getting to know people", icon: Users },
    { value: "Eating out & favorite foods", icon: UtensilsCrossed },
    { value: "Everyday errands & shopping", icon: Building2 },
    { value: "Home, family & routines", icon: Home },
    { value: "Feeling well & getting help", icon: Heart },
  ],
  2: [
    { value: "Planning a busy week", icon: Home },
    { value: "Trying something new", icon: Sparkles },
    { value: "School, classes & learning", icon: GraduationCap },
    { value: "Getting around & making plans", icon: Globe },
    { value: "Catching up with friends", icon: Users },
  ],
  3: [
    { value: "Big choices & life decisions", icon: TrendingUp },
    { value: "Conversations that go somewhere", icon: Users },
    { value: "Workdays, meetings & goals", icon: Briefcase },
    { value: "Travel mishaps & problem-solving", icon: Globe },
    { value: "Explaining what you mean", icon: BookOpen },
  ],
  4: [
    { value: "Health, habits & self-care", icon: Heart },
    { value: "Relationships, feelings & confidence", icon: Users },
    { value: "Personal goals & career wins", icon: TrendingUp },
    { value: "What is happening in the world", icon: ScrollText },
    { value: "Hosting, manners & showing appreciation", icon: Home },
  ],
  5: [
    { value: "Wellness, medicine & looking after yourself", icon: Heart },
    { value: "Startups, ideas & the future", icon: Sparkles },
    { value: "Work wins, setbacks & problem-solving", icon: Briefcase },
    { value: "Making a home your own", icon: Home },
    { value: "Cooking, tea & hosting friends", icon: UtensilsCrossed },
  ],
  6: [
    { value: "Society, borders & belonging", icon: Landmark },
    { value: "Trust, conflict & complicated relationships", icon: Users },
    { value: "Stories, writing & vivid language", icon: BookOpen },
    { value: "Politics, power & global issues", icon: Globe },
    { value: "Culture, ideas & thoughtful opinions", icon: Languages },
  ],
};

/** Adds familiar themes that align with the learner's next vocabulary level. */
export function getHskInterestCategories(
  targetLevel: number,
): { label: string; options: HskInterestOption[] }[] {
  const level = Math.min(6, Math.max(1, Math.round(targetLevel)));
  return [
    {
      label: "Ideas for your next chapter",
      options: HSK_LEVEL_VOCABULARY_THEMES[level],
    },
    ...HSK_INTEREST_CATEGORIES,
  ];
}

export const MOTIVATION_BUCKETS: {
  value: HskMotivation;
  icon: LucideIcon;
  label: string;
}[] = [
  { value: "school", icon: GraduationCap, label: "School" },
  { value: "job", icon: Briefcase, label: "Work" },
  { value: "heritage", icon: Landmark, label: "Heritage" },
  { value: "hobby", icon: Sparkles, label: "Just for fun" },
];

export type PersonalizationVariant = {
  headline: string;
  subtext: string;
  placeholder: string;
  chips: { icon: LucideIcon; label: string; phrase: string }[];
};

export const PERSONALIZATION_CONTENT: Record<HskMotivation, PersonalizationVariant> = {
  hobby: {
    headline: "What draws you to Chinese culture?",
    subtext:
      "Dramas, music, food, history — tell us what hooks you, and we'll teach the words through it, not textbook filler.",
    placeholder:
      "I'm obsessed with C-dramas and want to catch what's lost in the subs... not just get the gist.",
    chips: [
      { icon: Clapperboard, label: "C-dramas & shows", phrase: "C-dramas and shows" },
      { icon: Music, label: "Music", phrase: "music" },
      { icon: UtensilsCrossed, label: "Food", phrase: "food" },
      { icon: ScrollText, label: "History & mythology", phrase: "history and mythology" },
    ],
  },
  school: {
    headline: "Besides Mandarin, what pulls your attention?",
    subtext:
      "A subject, a field, a random rabbit hole — tell us, and we'll teach the words through topics you'd actually talk about, not textbook filler.",
    placeholder:
      "I'm studying international relations and want to follow the news in Chinese... not just order food.",
    chips: [
      { icon: BookOpen, label: "A subject I'm studying", phrase: "a subject I'm studying" },
      { icon: Globe, label: "Current events", phrase: "current events" },
      { icon: Palette, label: "A creative hobby", phrase: "a creative hobby" },
      { icon: Activity, label: "Sports & fitness", phrase: "sports and fitness" },
    ],
  },
  job: {
    headline: "Besides Mandarin, what's your world?",
    subtext:
      "What you do, what you're building, what you geek out on outside the office — we'll teach the words through topics you'd actually talk about, not textbook filler.",
    placeholder:
      "I work in sales and want to build trust with clients over dinner, not just close deals... small talk matters more than the pitch.",
    chips: [
      { icon: Building2, label: "My industry", phrase: "my industry" },
      { icon: UtensilsCrossed, label: "Business dinners & small talk", phrase: "business dinners and small talk" },
      { icon: Sparkles, label: "A hobby I geek out on", phrase: "a hobby I geek out on" },
      { icon: TrendingUp, label: "Career goals", phrase: "career goals" },
    ],
  },
  heritage: {
    headline: "What's the connection?",
    subtext:
      "Family, food, holidays, a place you're from — tell us so the words show up where you'll actually use them, not just a textbook chapter.",
    placeholder:
      "I want to understand my grandma's stories and cook alongside her without translating... she tells the best ones in Chinese.",
    chips: [
      { icon: Users, label: "Talking with family", phrase: "talking with family" },
      { icon: UtensilsCrossed, label: "Food & traditions", phrase: "food and traditions" },
      { icon: PartyPopper, label: "Holidays & customs", phrase: "holidays and customs" },
      { icon: Home, label: "A place I'm connected to", phrase: "a place I'm connected to" },
    ],
  },
};
