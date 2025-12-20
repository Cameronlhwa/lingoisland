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
  "Daily Review": { en: "Daily Review", zh: "每日复习" },
  "Topic Islands": { en: "Topic Islands", zh: "主题岛" },
  "Decks & Quiz": { en: "Decks & Quiz", zh: "卡片组与测验" },
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
  words: { en: "words", zh: "个单词" },
  Status: { en: "Status", zh: "状态" },
  Created: { en: "Created", zh: "创建时间" },
  Ready: { en: "Ready", zh: "就绪" },
  Generating: { en: "Generating", zh: "生成中" },
  Draft: { en: "Draft", zh: "草稿" },

  // Common
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
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
