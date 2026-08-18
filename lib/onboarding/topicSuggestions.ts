/**
 * Hardcoded topic suggestions for the onboarding wizard.
 * Keyed by whyKey → branchKey → string[]
 */
export const TOPIC_SUGGESTIONS: Record<string, Record<string, string[]>> = {
  work: {
    meeting: [
      "Client Dinner",
      "Business Introductions",
      "Meeting Vocabulary",
      "Office Small Talk",
      "Negotiation Phrases",
    ],
    clients: [
      "Client Relationships",
      "Business Dining",
      "Formal Greetings",
      "Presentations",
      "Following Up",
    ],
    documents: [
      "Emails & Messaging",
      "Reports & Documents",
      "Business Writing",
      "Technical Terms",
      "Office Basics",
    ],
    impress: [
      "Business Small Talk",
      "Chinese Business Culture",
      "Formal Introductions",
      "Client Entertainment",
      "Toasting & Dining",
    ],
  },
  travel: {
    getaround: [
      "Restaurant Ordering",
      "Taxi & Rideshare",
      "Hotel Check-in",
      "Asking for Directions",
      "Market Shopping",
    ],
    converse: [
      "Making Friends",
      "Small Talk",
      "Local Recommendations",
      "Talking About Yourself",
      "Opinions & Feelings",
    ],
    navigate: [
      "Transport & Metro",
      "Getting Around",
      "Accommodation",
      "Maps & Directions",
      "Travel Phrases",
    ],
    connect: [
      "Daily Life Conversations",
      "Local Culture",
      "Food & Eating Out",
      "Neighbourhood Life",
      "Casual Chat",
    ],
  },
  heritage: {
    grandparents: [
      "Family Conversation",
      "Food at Home",
      "Expressing Feelings",
      "Daily Routines",
      "Memories & Stories",
    ],
    family: [
      "Family Gatherings",
      "Festivals & Holidays",
      "Food Together",
      "Home & Daily Life",
      "Talking About Family",
    ],
    community: [
      "Community Life",
      "Neighbourhood Chat",
      "Local Events",
      "Food & Markets",
      "Introductions",
    ],
    roots: [
      "Chinese Culture",
      "Festivals & Traditions",
      "History & Heritage",
      "Food & Customs",
      "Language & Identity",
    ],
  },
  media: {
    food: [
      "Restaurant Ordering",
      "Describing Food",
      "Cooking at Home",
      "Street Food",
      "Food Culture",
    ],
    tv: [
      "Drama Vocabulary",
      "Emotions & Reactions",
      "Relationships",
      "Daily Life",
      "Pop Culture",
    ],
    music: [
      "Music & Performance",
      "Emotions & Feelings",
      "Relationships",
      "Concerts & Events",
      "Pop Culture",
    ],
    history: [
      "Chinese History",
      "Culture & Traditions",
      "Festivals",
      "Philosophy & Values",
      "Famous Places",
    ],
  },
  fluency: {
    visiting: [
      "Getting Around",
      "Restaurant Ordering",
      "Hotel & Accommodation",
      "Shopping",
      "Meeting People",
    ],
    friends: [
      "Making Friends",
      "Daily Life",
      "Food & Eating",
      "Hobbies & Interests",
      "Casual Conversation",
    ],
    curious: [
      "Daily Life in China",
      "Food Culture",
      "Popular Culture",
      "Chinese Holidays",
      "City Life",
    ],
    someone: [
      "Family Conversation",
      "Daily Routines",
      "Expressing Feelings",
      "Food Together",
      "Weekend Plans",
    ],
  },
};

export function getTopicSuggestions(
  whyKey: string,
  branchKey: string,
): string[] {
  return (
    TOPIC_SUGGESTIONS[whyKey]?.[branchKey] ?? [
      "Daily Conversation",
      "Food & Eating",
      "Getting Around",
      "Making Friends",
      "Work & Study",
    ]
  );
}
