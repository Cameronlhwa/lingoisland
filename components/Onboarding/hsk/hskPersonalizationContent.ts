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
  Clapperboard,
  Globe,
  GraduationCap,
  Home,
  Landmark,
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
export const HSK_INTEREST_OPTIONS: { value: string; icon: LucideIcon }[] = [
  { value: "Food & cooking", icon: UtensilsCrossed },
  { value: "Film & TV / C-dramas", icon: Clapperboard },
  { value: "Music", icon: Music },
  { value: "Travel", icon: Globe },
  { value: "Business & career", icon: Briefcase },
  { value: "Technology", icon: Sparkles },
  { value: "Sports & fitness", icon: Activity },
  { value: "History & culture", icon: Landmark },
  { value: "Gaming", icon: PartyPopper },
  { value: "Art & design", icon: Palette },
  { value: "Science & nature", icon: BookOpen },
  { value: "News & current events", icon: ScrollText },
  { value: "Health & wellness", icon: Home },
  { value: "Relationships & family", icon: Users },
];

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
