export type TopicTile = {
  slug: string;
  title: string;
  description: string;
  sampleWords: Array<{
    hanzi: string;
    pinyin: string;
    meaning: string;
  }>;
  sampleSentence: string;
};

export const TOPIC_TILES: TopicTile[] = [
  {
    slug: "work",
    title: "Work",
    description: "Meetings, colleagues, and everyday office talk.",
    sampleWords: [
      { hanzi: "会议", pinyin: "huì yì", meaning: "meeting" },
      { hanzi: "同事", pinyin: "tóng shì", meaning: "coworker" },
      { hanzi: "加班", pinyin: "jiā bān", meaning: "work overtime" },
    ],
    sampleSentence: "我和同事在会议上讨论新项目。",
  },
  {
    slug: "travel",
    title: "Travel",
    description: "Directions, transport, and getting around.",
    sampleWords: [
      { hanzi: "车票", pinyin: "chē piào", meaning: "ticket" },
      { hanzi: "地铁", pinyin: "dì tiě", meaning: "subway" },
      { hanzi: "换乘", pinyin: "huàn chéng", meaning: "transfer" },
    ],
    sampleSentence: "我需要买一张去机场的地铁车票。",
  },
  {
    slug: "dating",
    title: "Dating",
    description: "Real-life phrases for getting to know someone.",
    sampleWords: [
      { hanzi: "约会", pinyin: "yuē huì", meaning: "date" },
      { hanzi: "聊天", pinyin: "liáo tiān", meaning: "chat" },
      { hanzi: "印象", pinyin: "yìn xiàng", meaning: "impression" },
    ],
    sampleSentence: "我们第一次约会就聊了很多。",
  },
  {
    slug: "food",
    title: "Food",
    description: "Order confidently and talk about taste.",
    sampleWords: [
      { hanzi: "点菜", pinyin: "diǎn cài", meaning: "order food" },
      { hanzi: "辣", pinyin: "là", meaning: "spicy" },
      { hanzi: "味道", pinyin: "wèi dào", meaning: "flavor" },
    ],
    sampleSentence: "这道菜有点辣，但味道很好。",
  },
  {
    slug: "school",
    title: "School",
    description: "Classes, homework, and campus life.",
    sampleWords: [
      { hanzi: "作业", pinyin: "zuò yè", meaning: "homework" },
      { hanzi: "考试", pinyin: "kǎo shì", meaning: "exam" },
      { hanzi: "课堂", pinyin: "kè táng", meaning: "classroom" },
    ],
    sampleSentence: "这周的作业很多，考试也快到了。",
  },
  {
    slug: "family",
    title: "Family",
    description: "Talk about relatives and daily routines.",
    sampleWords: [
      { hanzi: "家人", pinyin: "jiā rén", meaning: "family" },
      { hanzi: "照顾", pinyin: "zhào gù", meaning: "take care of" },
      { hanzi: "周末", pinyin: "zhōu mò", meaning: "weekend" },
    ],
    sampleSentence: "周末我会回家照顾家人。",
  },
  {
    slug: "fitness",
    title: "Fitness",
    description: "Gym, routines, and staying healthy.",
    sampleWords: [
      { hanzi: "锻炼", pinyin: "duàn liàn", meaning: "exercise" },
      { hanzi: "力量", pinyin: "lì liàng", meaning: "strength" },
      { hanzi: "计划", pinyin: "jì huà", meaning: "plan" },
    ],
    sampleSentence: "我每周三次去健身房锻炼。",
  },
  {
    slug: "money",
    title: "Money",
    description: "Spending, saving, and payments.",
    sampleWords: [
      { hanzi: "预算", pinyin: "yù suàn", meaning: "budget" },
      { hanzi: "付款", pinyin: "fù kuǎn", meaning: "payment" },
      { hanzi: "省钱", pinyin: "shěng qián", meaning: "save money" },
    ],
    sampleSentence: "这个月我想省钱，所以控制预算。",
  },
  {
    slug: "hobbies",
    title: "Hobbies",
    description: "Activities, interests, and free time.",
    sampleWords: [
      { hanzi: "爱好", pinyin: "ài hào", meaning: "hobby" },
      { hanzi: "兴趣", pinyin: "xìng qù", meaning: "interest" },
      { hanzi: "空闲", pinyin: "kòng xián", meaning: "free time" },
    ],
    sampleSentence: "我的爱好是看书和听音乐。",
  },
];

export const FAQ_ITEMS = [
  {
    question: "What makes LingoIsland different?",
    answer:
      "Every Topic Island is tuned to your level with real-life sentences, so you learn vocabulary that you can actually use in conversation.",
  },
  {
    question: "How does the level tuning work?",
    answer:
      "You choose a level, and we generate words and sentences that stay readable while still stretching you with new vocabulary.",
  },
  {
    question: "Is this only for intermediate learners?",
    answer:
      "It is designed to help learners break the intermediate plateau, but anyone who wants topic-based vocabulary with real context can use it.",
  },
  {
    question: "Do you support speaking practice?",
    answer:
      "Not yet. LingoIsland currently focuses on reading, vocabulary, and text chat practice.",
  },
  {
    question: "Can I review with flashcards?",
    answer:
      "Yes. You can create flashcard decks with progress tracking, and spaced repetition, all built in to the website.",
  },
];

export const FEATURE_HIGHLIGHTS = [
  {
    title: "Authentic sentences",
    description:
      "Real usage examples show how words work in daily life, not textbook fragments.",
  },
  {
    title: "Level tuning",
    description:
      "Comprehensible input keeps the story readable while introducing new vocabulary.",
  },
  {
    title: "Story reinforcement",
    description:
      "Turn each Topic Island into a short story that reuses your new words.",
  },
  {
    title: "Quizzing + SRS",
    description:
      "Spaced repetition schedules reviews at the right moment to lock in memory.",
  },
  {
    title: "Flashcard decks",
    description:
      "Organized decks show due counts and progress so you always know what to review.",
  },
  {
    title: "Streak + activity",
    description:
      "Track your consistency with a calendar and streak reminders.",
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    title: "Create a Topic Island",
    description:
      "Pick a topic and level, then get 10–20 practical words with real-life examples.",
  },
  {
    title: "Turn it into a story",
    description:
      "Generate a short story using those words so you read them in context.",
  },
  {
    title: "Quiz and review",
    description:
      "Use spaced repetition quizzes and flashcards to make the words stick.",
  },
];

export const LEARNER_BULLETS = [
  "Learners who can comfortably talk about certain topics, but not others.",
  "Busy professionals who need practical Mandarin fast.",
  "Students stuck in the intermediate plateau.",
  "Self-learners who want real sentences, not lists.",
];

