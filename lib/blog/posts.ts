import type { BlogPost, BlogSlug } from "./types";

const ONBOARD = "/onboarding/journey";

export const blogPosts: BlogPost[] = [
  {
    slug: "hsk-levels-guide",
    title: "What Are HSK Levels — and Should You Actually Care?",
    category: "Learning Strategy",
    excerpt:
      "HSK can be motivating, but chasing levels might be keeping you stuck. Here's an honest take from someone who's been there.",
    readTimeMinutes: 7,
    midCallout: {
      hook: "If HSK lists feel random, it's because relevance to your life was never the goal of the exam design.",
      line: "Try building a Learning Strategy island on LingoIsland — free to start, no experience needed.",
      cta: "Try it free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "Want to build vocabulary around the topics that actually matter to your life — not a generic test list?",
      line: "LingoIsland lets you pick any topic and generates a personalised vocabulary set with Hanzi, Pinyin, and real example sentences at your level.",
      cta: "Start your first island free",
      href: ONBOARD,
    },
  },
  {
    slug: "how-to-learn-mandarin",
    title: "How to Actually Learn Mandarin (Personalize Everything)",
    category: "Learning Strategy",
    excerpt:
      'Every piece of advice says "be consistent." Almost none of it tells you how to make Mandarin feel worth being consistent about. Here\'s what actually worked.',
    readTimeMinutes: 8,
    midCallout: {
      hook: "Personalised topics are what turn \"I'll study later\" into \"I actually want to look this up now.\"",
      line: "Try building a Mandarin Habits island on LingoIsland — free to start, no experience needed.",
      cta: "Try it free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "LingoIsland is built around exactly this idea — pick any topic that matters to your life, get a personalised vocabulary set with example sentences at your level, and quiz yourself until it sticks.",
      line: "Pick any topic and start in a few minutes.",
      cta: "Build your first island free — pick any topic",
      href: ONBOARD,
    },
  },
  {
    slug: "mandarin-numbers-complete-guide",
    title: "Mandarin Numbers: The Complete Guide",
    category: "Vocabulary",
    excerpt:
      "Mandarin numbers are one of the most logical systems in any language — once you understand the pattern, everything clicks.",
    readTimeMinutes: 6,
    midCallout: {
      hook: "Once numbers feel easy, the fun part is weaving them into real sentences — prices, plans, small talk.",
      line: "Try building a Numbers island on LingoIsland — free to start, no experience needed.",
      cta: "Try it free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "Numbers alone won't carry a conversation — but they come up in almost every topic. If you're building vocabulary around a specific area of your life (work, food, travel), LingoIsland generates the words you actually need alongside real example sentences.",
      line: "Start with a topic you already talk about every week.",
      cta: "Build your first vocabulary island free",
      href: ONBOARD,
    },
  },
  {
    slug: "chinese-numbers-1-100",
    title: "Chinese Numbers 1–100: Hanzi, Pinyin, and How to Actually Use Them",
    category: "Vocabulary",
    excerpt:
      "The complete reference table for Chinese numbers 1 to 100 — plus the two rules that make the whole system make sense.",
    readTimeMinutes: 5,
    midCallout: {
      hook: "Tables are useful — but retention comes from hearing yourself say numbers in realistic mini-scripts.",
      line: "Try building a Numbers island on LingoIsland — free to start, no experience needed.",
      cta: "Try it free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "Numbers are just the start. Once you can count, the next step is building vocabulary around the topics you actually talk about — food, work, travel, whatever your life looks like in Mandarin.",
      line: "Pick a topic and let the examples do the heavy lifting.",
      cta: "Build a topic-based vocabulary island free",
      href: ONBOARD,
    },
  },
  {
    slug: "counting-in-chinese",
    title: "Counting in Chinese: Numbers, Measure Words, and Real Usage",
    category: "Vocabulary",
    excerpt:
      "Counting in Chinese isn't just about numbers — measure words are the piece most learners miss. Here's how it actually works.",
    readTimeMinutes: 5,
    midCallout: {
      hook: "Measure words are the bridge between \"I know digits\" and \"I sound natural in a shop or cafe.\"",
      line: "Try building a Counting & Classifiers island on LingoIsland — free to start, no experience needed.",
      cta: "Try it free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "Measure words come up in almost every topic-specific conversation — ordering food, shopping, talking about your pets. If you want to build vocabulary around a specific area of your life, LingoIsland generates real example sentences that show measure words in natural context.",
      line: "Pick any topic and practise in context.",
      cta: "Try it free — pick any topic",
      href: ONBOARD,
    },
  },
  {
    slug: "gratitude-in-chinese",
    title: "How to Express Gratitude in Chinese (Beyond 谢谢)",
    category: "Vocabulary",
    excerpt:
      "谢谢 will take you far. But if you want to sound natural — and warm — there's a lot more to learn. Here's the vocabulary that actually gets used.",
    readTimeMinutes: 5,
    midCallout: {
      hook: "Gratitude is one of LingoIsland's ready-to-build topic islands — meaning you can generate a full set of vocabulary around thanks, compliments, and polite small talk in seconds.",
      line: "Try building a Gratitude island on LingoIsland — free to start, no experience needed.",
      cta: "Build a Gratitude island free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "If you want a tight set of polite phrases you can rehearse until they feel automatic, pick Gratitude (or a broader Social Mandarin topic) and quiz yourself in short sessions.",
      line: "Free to start — no experience needed.",
      cta: "Start your first island free",
      href: ONBOARD,
    },
    midIslandScreenshot: true,
  },
  {
    slug: "bubble-tea-in-chinese",
    title: "Bubble Tea in Chinese: Order Like a Local 🧋",
    category: "Culture & Vocab",
    excerpt:
      "Boba has its own vocabulary in Mandarin — and knowing it makes ordering way more fun. Here's everything you need to order like you've done it a thousand times.",
    readTimeMinutes: 4,
    midCallout: {
      hook: "Bubble tea vocabulary is a perfect example of a LingoIsland Topic Island — specific, fun, and immediately usable. We actually have one ready to go.",
      line: "Try building a Bubble Tea island on LingoIsland — free to start, no experience needed.",
      cta: "Build a Bubble Tea island and start quizzing",
      href: ONBOARD,
    },
    endCallout: {
      hook: "Next time you're role-playing an order out loud, turn it into a tiny island so the sweetness/ice phrases stick for real trips — not just for the one cafe you memorised.",
      line: "Pick Bubble Tea (or any food topic) and practise with sentences at your level.",
      cta: "Try it free",
      href: ONBOARD,
    },
    midIslandScreenshot: true,
  },
  {
    slug: "horoscope-in-chinese",
    title: "Your Chinese Horoscope: All 12 Signs in Mandarin 🔮",
    category: "Culture & Vocab",
    excerpt:
      "Whether you believe in horoscopes or not, the Chinese zodiac comes up constantly in conversation. Here's every sign with vocabulary and cultural context.",
    readTimeMinutes: 5,
    midCallout: {
      hook: "Horoscope and zodiac vocabulary is a great LingoIsland topic — fun words you'll actually use in casual conversation. Here's what a Horoscope island looks like:",
      line: "Try building a Horoscope island on LingoIsland — free to start, no experience needed.",
      cta: "Build a Horoscope island free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "If you liked this table, you'll like pairing it with the Chinese zodiac article — the two topics show up together in real chats all the time.",
      line: "Build both as islands and you'll never be stuck for an icebreaker.",
      cta: "Start free",
      href: ONBOARD,
    },
    midIslandScreenshot: true,
  },
  {
    slug: "zodiac-signs-in-chinese",
    title: "Chinese Zodiac Signs: What's Yours and How to Talk About It",
    category: "Culture & Vocab",
    excerpt:
      "The 12 Chinese zodiac animals — their names, years, and personality traits in Mandarin. Plus how to actually bring it up in conversation.",
    readTimeMinutes: 5,
    midCallout: {
      hook: "Chinese zodiac vocabulary is the kind of topic that opens up real conversations. Want to go deeper — compatibility terms, personality traits, festival vocabulary? Build a Zodiac island on LingoIsland and get the full set.",
      line: "Free to start, no experience needed.",
      cta: "Build a Zodiac island free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "Western horoscope vocab pairs naturally with zodiac years — learners often practise both in one sitting.",
      line: "Try building both topic islands and rotate quizzes on whichever you hear more in your friend group.",
      cta: "Try it free",
      href: ONBOARD,
    },
    midIslandScreenshot: true,
  },
  {
    slug: "polite-mandarin",
    title: "Polite Mandarin: Please, Thank You, Sorry — and When to Use Each",
    category: "Vocabulary",
    excerpt:
      "Mandarin politeness works differently than English. The words exist — but knowing when and how to use them is what actually makes you sound natural.",
    readTimeMinutes: 5,
    midCallout: {
      hook: "Polite phrases come up in every single conversation. If you want to build out a full set of social and conversational Mandarin around a specific context — restaurant, workplace, travel — LingoIsland can build that island for you.",
      line: "Try building a Conversation island on LingoIsland — free to start, no experience needed.",
      cta: "Build a Conversation island free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "If 麻烦你 and 不好意思 still feel stiff, short quizzes on real mini-dialogues usually fix that faster than more grammar rules.",
      line: "Pick a social topic and rehearse until it feels automatic.",
      cta: "Start your first island free",
      href: ONBOARD,
    },
  },
  {
    slug: "how-to-read-chinese",
    title: "How to Read Chinese: Where Intermediate Learners Actually Get Stuck",
    category: "Learning Strategy",
    excerpt:
      "Reading Chinese isn't just about knowing characters — it's about building a mental model that makes unknown characters guessable. Here's what actually helps.",
    readTimeMinutes: 7,
    midCallout: {
      hook: "Topic depth is what turns \"I know characters\" into \"I can skim an article about something I care about.\"",
      line: "Try building a Reading Skills island on LingoIsland — free to start, no experience needed.",
      cta: "Try it free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "One of the best ways to make Chinese texts more readable is to build deep vocabulary around specific topics before you read about them. LingoIsland generates vocabulary sets for any topic you choose — with example sentences that prime you for reading in context.",
      line: "Pick a topic you already want to read about in Chinese.",
      cta: "Build a reading-ready vocabulary island free",
      href: ONBOARD,
    },
  },
  {
    slug: "what-is-mandarin",
    title: "What Is Mandarin? (And Why It's Worth Learning)",
    category: "Getting Started",
    excerpt:
      "Mandarin is the most spoken language on earth. Here's what it actually is, what makes it different, and who should learn it.",
    readTimeMinutes: 6,
    midCallout: {
      hook: "Once the \"what is Mandarin\" question clicks, the next practical step is picking one domain of vocabulary you'll actually use this month.",
      line: "Try building a Getting Started island on LingoIsland — free to start, no experience needed.",
      cta: "Try it free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "If you're past the absolute beginner stage and ready to build vocabulary around topics you actually care about, LingoIsland was built for exactly that moment. Pick any topic, generate a personalised island, and start building.",
      line: "No experience needed — start free.",
      cta: "Try LingoIsland free — no experience needed",
      href: ONBOARD,
    },
  },
  {
    slug: "meaningful-chinese-tattoos",
    title: "Meaningful Chinese Tattoos: What They Actually Say",
    category: "Culture & Vocab",
    excerpt:
      "Chinese character tattoos are everywhere — and so are the mistranslations. Here's an honest guide to what common tattoo characters actually mean, and how to avoid getting it wrong.",
    readTimeMinutes: 5,
    midCallout: {
      hook: "Characters make more sense when you've seen them inside sentences — not as isolated flash sheet glyphs.",
      line: "Try building a Culture & Symbols island on LingoIsland — free to start, no experience needed.",
      cta: "Try it free",
      href: ONBOARD,
    },
    endCallout: {
      hook: "Learning Mandarin changes how you relate to Chinese characters entirely. Once you know what characters actually mean in context — in sentences, in conversation — the culture opens up in a different way.",
      line: "Start with a topic you care about and learn in context.",
      cta: "Start learning Mandarin your way — free",
      href: ONBOARD,
    },
  },
];

const bySlug = new Map<BlogSlug, BlogPost>(
  blogPosts.map((p) => [p.slug, p])
);

export function getBlogPost(slug: string): BlogPost | undefined {
  return bySlug.get(slug as BlogSlug);
}

export function getAllBlogSlugs(): BlogSlug[] {
  return blogPosts.map((p) => p.slug);
}

export function getRelatedPosts(slug: BlogSlug, limit = 3): BlogPost[] {
  const current = bySlug.get(slug);
  if (!current) return [];

  const same = blogPosts.filter(
    (p) => p.slug !== slug && p.category === current.category
  );
  const rest = blogPosts.filter(
    (p) => p.slug !== slug && p.category !== current.category
  );
  return [...same, ...rest].slice(0, limit);
}
