"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface LanguageContextType {
  isChineseMode: boolean;
  toggleChineseMode: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

const translations: Record<string, { en: string; zh: string }> = {
  // Navigation
  Home: { en: "Home", zh: "首页" },
  "Daily Review": { en: "Daily Review", zh: "每日复习" },
  "Topic Islands": { en: "Topic Islands", zh: "主题岛" },
  "Decks & Quiz": { en: "Decks & Quiz", zh: "卡片组与测验" },
  Stories: { en: "Stories", zh: "故事" },
  Chat: { en: "Chat", zh: "聊天" },
  "Sign Out": { en: "Sign Out", zh: "登出" },
  "Chinese Mode": { en: "Chinese Mode", zh: "中文模式" },
  Quiz: { en: "Quiz", zh: "测验" },
  "Start Quiz": { en: "Start Quiz", zh: "开始测验" },

  // Page Titles
  "Deck Manager": { en: "Deck Manager", zh: "卡片组管理" },
  "Your Topic Islands": { en: "Your Topic Islands", zh: "您的主题岛" },
  "Create your first Topic Island": {
    en: "Create your first Topic Island",
    zh: "创建您的第一个主题岛",
  },
  "Start building vocabulary around topics you care about": {
    en: "Start building vocabulary around topics you care about",
    zh: "开始围绕您关心的主题构建词汇",
  },
  "Create a Topic Island": { en: "Create a Topic Island", zh: "创建主题岛" },
  "Create Topic Island": { en: "Create Topic Island", zh: "创建主题岛" },
  "View Island Details": { en: "View Island Details", zh: "查看岛屿详情" },

  // Deck Manager
  Folders: { en: "Folders", zh: "文件夹" },
  Decks: { en: "Decks", zh: "卡片组" },
  "New Folder": { en: "New Folder", zh: "新建文件夹" },
  "New Deck": { en: "New Deck", zh: "新建卡片组" },
  "No folder (uncategorized)": {
    en: "No folder (uncategorized)",
    zh: "无文件夹（未分类）",
  },
  Uncategorized: { en: "Uncategorized", zh: "未分类" },

  // Deck Detail
  "Back to Decks": { en: "Back to Decks", zh: "返回卡片组" },
  "Add Card": { en: "Add Card", zh: "添加卡片" },
  "Front (Hanzi)": { en: "Front (Hanzi)", zh: "正面（汉字）" },
  "Back (English)": { en: "Back (English)", zh: "背面（英文）" },
  "Pinyin (optional)": { en: "Pinyin (optional)", zh: "拼音（可选）" },
  "Create Card": { en: "Create Card", zh: "创建卡片" },
  Cards: { en: "Cards", zh: "卡片" },
  "No cards yet. Add your first card above.": {
    en: "No cards yet. Add your first card above.",
    zh: "还没有卡片。在上面添加您的第一张卡片。",
  },

  // Quiz
  "Select Deck (optional)": {
    en: "Select Deck (optional)",
    zh: "选择卡片组（可选）",
  },
  "All decks": { en: "All decks", zh: "所有卡片组" },
  "Loading...": { en: "Loading...", zh: "加载中..." },
  Done: { en: "Done!", zh: "完成！" },
  "You reviewed": { en: "You reviewed", zh: "您复习了" },
  of: { en: "of", zh: "共" },
  "cards.": { en: "cards.", zh: "张卡片。" },
  "Review Again": { en: "Review Again", zh: "再次复习" },
  "Show Answer": { en: "Show Answer", zh: "显示答案" },
  "Show Pinyin": { en: "Show Pinyin", zh: "显示拼音" },
  "Hide Pinyin": { en: "Hide Pinyin", zh: "隐藏拼音" },
  Again: { en: "Again", zh: "重来" },
  Hard: { en: "Hard", zh: "困难" },
  Good: { en: "Good", zh: "良好" },
  "No cards available.": { en: "No cards available.", zh: "没有可用的卡片。" },

  // Activity Calendar
  "Activity Calendar": { en: "Activity Calendar", zh: "活动日历" },
  Less: { en: "Less", zh: "少" },
  More: { en: "More", zh: "多" },
  "reviews in": { en: "reviews in", zh: "次复习，共" },
  days: { en: "days", zh: "天" },

  // Topic Islands
  Level: { en: "Level", zh: "级别" },
  "Word target": { en: "Word target", zh: "目标单词数" },
  Status: { en: "Status", zh: "状态" },
  Created: { en: "Created", zh: "创建时间" },
  Ready: { en: "Ready", zh: "就绪" },
  Generating: { en: "Generating", zh: "生成中" },
  Draft: { en: "Draft", zh: "草稿" },

  // Common
  Next: { en: "Next", zh: "接下来" },
  "Daily story": { en: "Daily story", zh: "每日故事" },
  Today: { en: "Today", zh: "今天" },
  Story: { en: "Story", zh: "故事" },
  Flashcards: { en: "Flashcards", zh: "闪卡" },
  Island: { en: "Island", zh: "岛屿" },
  due: { en: "due", zh: "到期" },
  min: { en: "min", zh: "分钟" },
  cards: { en: "cards", zh: "张卡片" },
  words: { en: "words", zh: "个单词" },
  trees: { en: "trees", zh: "棵树" },
  Start: { en: "Start", zh: "开始" },
  Choose: { en: "Choose", zh: "选择" },
  Read: { en: "Read", zh: "阅读" },
  Review: { en: "Review", zh: "复习" },
  Reviewed: { en: "Reviewed", zh: "已复习" },
  today: { en: "today", zh: "今天" },
  Practice: { en: "Practice", zh: "练习" },
  New: { en: "New", zh: "新卡" },
  "Due soon": { en: "Due soon", zh: "即将到期" },
  "On track": { en: "On track", zh: "进度正常" },
  "Last reviewed": { en: "Last reviewed", zh: "上次复习" },
  "day short": { en: "d", zh: "天" },
  "View All": { en: "View All", zh: "查看全部" },
  "View Decks": { en: "View Decks", zh: "查看卡片组" },
  "Review Deck": { en: "Review Deck", zh: "复习卡片组" },
  "Review your islands": { en: "Review your islands", zh: "复习你的主题岛" },
  "Quick refreshes.": { en: "Quick refreshes.", zh: "快速复习。" },
  "Create your first island to start reviewing words.": {
    en: "Create your first island to start reviewing words.",
    zh: "创建你的第一个主题岛，开始复习单词。",
  },
  "Decks ready.": { en: "Decks ready.", zh: "卡片组已准备好。" },
  "Add a deck to start reviewing flashcards.": {
    en: "Add a deck to start reviewing flashcards.",
    zh: "添加一个卡片组以开始复习闪卡。",
  },
  "Your island": { en: "Your island", zh: "你的岛屿" },
  "Counting today's reviews...": {
    en: "Counting today's reviews...",
    zh: "正在统计今日复习...",
  },
  "The island is thriving!": {
    en: "The island is thriving!",
    zh: "岛屿繁荣茂盛！",
  },
  "The island is growing, but still needs help...": {
    en: "The island is growing, but still needs help...",
    zh: "岛屿正在成长，但仍需要帮助...",
  },
  "The island is dry with no resources": {
    en: "The island is dry with no resources",
    zh: "岛屿干涸，没有资源",
  },
  "Creating your topic island...": {
    en: "Creating your topic island...",
    zh: "正在创建你的主题岛...",
  },
  "Scroll islands left": { en: "Scroll islands left", zh: "向左滚动主题岛" },
  "Scroll islands right": { en: "Scroll islands right", zh: "向右滚动主题岛" },
  "Scroll decks left": { en: "Scroll decks left", zh: "向左滚动卡片组" },
  "Scroll decks right": { en: "Scroll decks right", zh: "向右滚动卡片组" },
  reviews: { en: "reviews", zh: "次复习" },
  Activity: { en: "Activity", zh: "活动" },
  "Keep a steady learning rhythm.": {
    en: "Keep a steady learning rhythm.",
    zh: "保持稳定的学习节奏。",
  },
  "Previous month": { en: "Previous month", zh: "上个月" },
  "Next month": { en: "Next month", zh: "下个月" },
  "No activity": { en: "No activity", zh: "暂无活动" },
  "Days studied": { en: "Days studied", zh: "学习天数" },
  "Current streak": { en: "Current streak", zh: "当前连续" },
  "Best streak": { en: "Best streak", zh: "最佳连续" },
  "Continue learning": { en: "Continue learning", zh: "继续学习" },
  "A quick session to keep your streak going.": {
    en: "A quick session to keep your streak going.",
    zh: "快速学习，保持连续记录。",
  },
  "2 min setup → instant vocab + examples": {
    en: "2 min setup → instant vocab + examples",
    zh: "2分钟设置 → 立即获取词汇与例句",
  },
  "Pick a topic. Learn words you'll actually use.": {
    en: "Pick a topic. Learn words you'll actually use.",
    zh: "选择一个主题，学习你真正会用到的单词。",
  },
  "Suggested topics": { en: "Suggested topics", zh: "推荐主题" },
  Dating: { en: "Dating", zh: "约会" },
  Driving: { en: "Driving", zh: "驾驶" },
  Work: { en: "Work", zh: "工作" },
  "Review your vocab in a short story.": {
    en: "Review your vocab in a short story.",
    zh: "在短故事中复习词汇。",
  },
  "Today's story is on the way.": {
    en: "Today's story is on the way.",
    zh: "今日故事正在路上。",
  },
  "Generating...": { en: "Generating...", zh: "生成中..." },
  January: { en: "January", zh: "1月" },
  February: { en: "February", zh: "2月" },
  March: { en: "March", zh: "3月" },
  April: { en: "April", zh: "4月" },
  May: { en: "May", zh: "5月" },
  June: { en: "June", zh: "6月" },
  July: { en: "July", zh: "7月" },
  August: { en: "August", zh: "8月" },
  September: { en: "September", zh: "9月" },
  October: { en: "October", zh: "10月" },
  November: { en: "November", zh: "11月" },
  December: { en: "December", zh: "12月" },
  Sun: { en: "S", zh: "日" },
  Mon: { en: "M", zh: "一" },
  Tue: { en: "T", zh: "二" },
  Wed: { en: "W", zh: "三" },
  Thu: { en: "T", zh: "四" },
  Fri: { en: "F", zh: "五" },
  Sat: { en: "S", zh: "六" },
  Cancel: { en: "Cancel", zh: "取消" },
  Create: { en: "Create", zh: "创建" },
  "Creating...": { en: "Creating...", zh: "创建中..." },
  "Create Folder": { en: "Create Folder", zh: "创建文件夹" },
  "Create Deck": { en: "Create Deck", zh: "创建卡片组" },
  "Folder name": { en: "Folder name", zh: "文件夹名称" },
  "Deck name": { en: "Deck name", zh: "卡片组名称" },
  "No folders yet. Create one to organize your decks.": {
    en: "No folders yet. Create one to organize your decks.",
    zh: "还没有文件夹。创建一个来整理您的卡片组。",
  },
  "No decks yet. Create one to start adding flashcards.": {
    en: "No decks yet. Create one to start adding flashcards.",
    zh: "还没有卡片组。创建一个来开始添加卡片。",
  },
  "Add to deck": { en: "Add to deck", zh: "添加到卡片组" },
  "Add to Deck": { en: "Add to Deck", zh: "添加到卡片组" },
  "Select a deck...": { en: "Select a deck...", zh: "选择卡片组..." },
  Add: { en: "Add", zh: "添加" },
  "Adding...": { en: "Adding...", zh: "添加中..." },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [isChineseMode, setIsChineseMode] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem("chinese_mode");
    if (saved === "true") {
      setIsChineseMode(true);
    }
  }, []);

  const toggleChineseMode = () => {
    const newMode = !isChineseMode;
    setIsChineseMode(newMode);
    localStorage.setItem("chinese_mode", newMode.toString());
  };

  const t = (key: string): string => {
    if (!isChineseMode) return translations[key]?.en || key;
    return translations[key]?.zh || key;
  };

  return (
    <LanguageContext.Provider value={{ isChineseMode, toggleChineseMode, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    return {
      isChineseMode: false,
      toggleChineseMode: () => {},
      t: (key: string) => key,
    };
  }
  return context;
}
