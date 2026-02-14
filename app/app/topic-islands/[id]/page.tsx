"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGlossary } from "@/contexts/GlossaryContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import IslandSideChat, {
  type IslandChatSelectedWord,
} from "@/components/IslandSideChat";
import SpeakerButton from "@/components/app/SpeakerButton";
import AccountModal from "@/components/app/AccountModal";
import UpgradeModal from "@/components/app/UpgradeModal";
import AddAllWordsModal from "@/components/app/AddAllWordsModal";

interface Sentence {
  id: string;
  tier: "easy" | "same" | "hard";
  hanzi: string;
  pinyin: string;
  english: string;
}

interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  position?: number;
  sentences: Sentence[];
}

interface GrammarExample {
  id: string;
  grammar_focus_id: string;
  tier: "warmup" | "target";
  hanzi: string;
  pinyin: string;
  english: string;
}

interface GrammarFocus {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  pattern: string;
  when_to_use?: string | null;
  position: number;
  examples: GrammarExample[];
}

interface Island {
  id: string;
  topic: string;
  level: string;
  word_target: number;
  grammar_target: number;
  status: string;
  words_selected?: number;
  sentences_generated?: number;
  sentence_attempts?: number;
  sentence_tasks?: number;
  image_url?: string | null;
  cover_key?: string | null;
}

export default function TopicIslandDetailPage() {
  const router = useRouter();
  const params = useParams();
  const islandId = params.id as string;
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();

  const [island, setIsland] = useState<Island | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [grammarFocus, setGrammarFocus] = useState<GrammarFocus[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<"free" | "pro">("free");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | undefined>();
  const [markingKnown, setMarkingKnown] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [quizIslands, setQuizIslands] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showAddToQuizModal, setShowAddToQuizModal] = useState(false);
  const [selectedQuizIslandId, setSelectedQuizIslandId] = useState<string>("");
  const [addingToQuiz, setAddingToQuiz] = useState(false);
  const [addToQuizContext, setAddToQuizContext] = useState<{
    type: "word" | "sentence";
    sourceId: string;
  } | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newQuizIslandName, setNewQuizIslandName] = useState("");
  const [creatingQuizIsland, setCreatingQuizIsland] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set()); // Track added items
  const [askAIWord, setAskAIWord] = useState<IslandChatSelectedWord | null>(
    null,
  );
  const [addCount, setAddCount] = useState(7);
  const [suggestionsInput, setSuggestionsInput] = useState("");
  const [recycleOldWords, setRecycleOldWords] = useState(true);
  const [addingWords, setAddingWords] = useState(false);
  const [addWordsLevel, setAddWordsLevel] = useState<string>("");
  const [addToast, setAddToast] = useState<string | null>(null);
  const [pendingScrollWordId, setPendingScrollWordId] = useState<string | null>(
    null,
  );
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const activeWordIdRef = useRef<string | null>(null);
  const { setEntries, setActiveWordId: setGlossaryActiveWordId } =
    useGlossary();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [showAddAllWordsModal, setShowAddAllWordsModal] = useState(false);
  // Image generation disabled - using pre-generated library images
  // Keeping these for legacy support during migration
  const [imageProgress, setImageProgress] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageRequestedRef = useRef(false);
  const imageLoggedRef = useRef(false);
  
  // Quiz tab state
  const [activeTab, setActiveTab] = useState<"add" | "quiz">("add");
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [quizMode, setQuizMode] = useState<"drag-drop" | "flashcard" | null>(null);
  const [quizWords, setQuizWords] = useState<Word[]>([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, boolean>>({});
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [flashcardDirection, setFlashcardDirection] = useState<("zh-en" | "en-zh")[]>([]);
  const [recentlyQuizzedIds, setRecentlyQuizzedIds] = useState<Set<string>>(new Set());
  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dropMatches, setDropMatches] = useState<Record<string, string>>({});
  const [shuffledEnglishWords, setShuffledEnglishWords] = useState<Word[]>([]);

  useEffect(() => {
    loadIsland();
    loadQuizIslands();
    // Load last used quiz island from localStorage
    const lastUsed = localStorage.getItem("lastUsedQuizIslandId");
    if (lastUsed) {
      setSelectedQuizIslandId(lastUsed);
    }
    // Poll for updates if status is selecting or generating
    const interval = setInterval(() => {
      if (
        island?.status === "generating" ||
        island?.status === "selecting"
      ) {
        loadIsland();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [islandId, island?.status]);
  
  // Initialize selectedWordIds when words load (all checked by default)
  useEffect(() => {
    if (words.length > 0 && selectedWordIds.size === 0) {
      setSelectedWordIds(new Set(words.map(w => w.id)));
    }
  }, [words]);

  useEffect(() => {
    setImageProgress(0);
    setImageError(null);
    imageRequestedRef.current = false;
    imageLoggedRef.current = false;
  }, [islandId]);

  // Image generation disabled - using pre-generated library images for cost savings
  // Islands now use cover_key which is assigned at creation time
  useEffect(() => {
    if (!island) return;

    // All new islands have cover_key assigned at creation
    // Legacy islands may still have image_url
    if (island.cover_key || island.image_url) {
      if (!imageLoggedRef.current) {
        imageLoggedRef.current = true;
        setImageProgress(100);
        setImageError(null);
      }
    }
  }, [island?.id, island?.cover_key, island?.image_url]);

  const loadQuizIslands = async () => {
    try {
      const response = await fetch("/api/quiz-islands");
      if (!response.ok) throw new Error("Failed to load quiz islands");
      const data = await response.json();
      setQuizIslands(data.quizIslands || []);

      // If we have a last used ID, check if it still exists
      const lastUsed = localStorage.getItem("lastUsedQuizIslandId");
      if (
        lastUsed &&
        data.quizIslands?.some((qi: { id: string }) => qi.id === lastUsed)
      ) {
        setSelectedQuizIslandId(lastUsed);
      } else if (data.quizIslands && data.quizIslands.length > 0) {
        // Default to first quiz island if no last used or it doesn't exist
        setSelectedQuizIslandId(data.quizIslands[0].id);
      }
    } catch (error) {
      console.error("Error loading quiz islands:", error);
    }
  };

  const loadIsland = async () => {
    try {
      const response = await fetch(`/api/topic-islands/${islandId}`);
      if (!response.ok) {
        throw new Error("Failed to load island");
      }

      const data = await response.json();
      const previousStatus = island?.status;
      setIsland(data.island);
      setWords(data.words);
      setGrammarFocus(data.grammarFocus || []);
      setUserPlan(data.user_plan || "free");
      setLoading(false);
      
      // Set default level for adding words if not already set
      if (!addWordsLevel && data.island?.level) {
        setAddWordsLevel(data.island.level);
      }

      // If island just became ready, check for missing sentences
      if (previousStatus === "generating" && data.island.status === "ready") {
        checkAndRegenerateSentences();
      }
    } catch (error) {
      console.error("Error loading island:", error);
      setLoading(false);
    }
  };

  const checkAndRegenerateSentences = async () => {
    try {
      console.log("Checking for missing sentences...");
      const response = await fetch(
        `/api/topic-islands/${islandId}/regenerate-sentences`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        console.error("Failed to check sentences");
        return;
      }

      const result = await response.json();
      console.log("Sentence check result:", result);

      if (result.regenerated > 0) {
        console.log(`Regenerated ${result.regenerated} word(s) with missing sentences`);
        // Reload island to show new sentences
        setTimeout(() => loadIsland(), 1000);
      }
    } catch (error) {
      console.error("Error checking sentences:", error);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this topic island? This will delete all words and sentences.",
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/topic-islands/${islandId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete island");
      }

      // Redirect to islands list
      router.push("/app/topic-islands");
    } catch (error) {
      console.error("Error deleting island:", error);
      alert("Failed to delete island. Please try again.");
      setDeleting(false);
    }
  };

  const handleMarkKnown = async (wordId: string) => {
    setMarkingKnown(wordId);
    try {
      const response = await fetch(`/api/island-words/${wordId}/mark-known`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if it's a paywall error
        if (response.status === 403 && errorData.requiresUpgrade) {
          setUpgradeFeature('"Already know" button');
          setShowUpgradeModal(true);
          setMarkingKnown(null);
          return;
        }
        
        throw new Error(
          errorData.message ||
            errorData.error ||
            "Failed to mark word as known",
        );
      }

      const data = await response.json();

      // Replace only the specific word card
      if (data.newWord) {
        setWords((prevWords) => {
          // Find and replace the word with the same ID, or remove deleted and add new
          const filtered = prevWords.filter((w) => w.id !== data.deletedWordId);
          // Add new word in the same position if possible, otherwise at the end
          const deletedIndex = prevWords.findIndex(
            (w) => w.id === data.deletedWordId,
          );
          if (deletedIndex >= 0) {
            return [
              ...filtered.slice(0, deletedIndex),
              data.newWord,
              ...filtered.slice(deletedIndex),
            ];
          }
          return [...filtered, data.newWord];
        });
      }
    } catch (error) {
      console.error("Error marking word as known:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update word. Please try again.";
      alert(errorMessage);
    } finally {
      setMarkingKnown(null);
    }
  };

  const handleAddToQuizClick = (
    type: "word" | "sentence",
    sourceId: string,
  ) => {
    // Check if already added
    if (addedItems.has(`${type}-${sourceId}`)) {
      return; // Already added, don't show modal
    }

    if (quizIslands.length === 0) {
      // Show create modal if no quiz islands exist
      setShowCreateNew(true);
      setAddToQuizContext({ type, sourceId });
      setShowAddToQuizModal(true);
      return;
    }

    setAddToQuizContext({ type, sourceId });
    setShowAddToQuizModal(true);
  };

  const handleCreateNewQuizIsland = async () => {
    if (!newQuizIslandName.trim()) return;

    setCreatingQuizIsland(true);
    try {
      const response = await fetch("/api/quiz-islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newQuizIslandName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quiz island");
      }

      const data = await response.json();
      const newQuizIsland = data.quizIsland;

      // Add to list and select it
      setQuizIslands((prev) => [newQuizIsland, ...prev]);
      setSelectedQuizIslandId(newQuizIsland.id);
      setShowCreateNew(false);
      setNewQuizIslandName("");

      // Save to localStorage
      localStorage.setItem("lastUsedQuizIslandId", newQuizIsland.id);

      // Now proceed to add the item
      await handleAddToQuizConfirm(newQuizIsland.id);
    } catch (error) {
      console.error("Error creating quiz island:", error);
      alert(
        error instanceof Error ? error.message : "Failed to create quiz island",
      );
    } finally {
      setCreatingQuizIsland(false);
    }
  };

  const handleAddToQuizConfirm = async (quizIslandIdOverride?: string) => {
    const quizIslandId = quizIslandIdOverride || selectedQuizIslandId;
    if (!quizIslandId || !addToQuizContext) return;

    setAddingToQuiz(true);
    try {
      const response = await fetch("/api/quiz-islands/add-from-topic-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizIslandId,
          type: addToQuizContext.type,
          sourceId: addToQuizContext.sourceId,
          createReverse: addToQuizContext.type === "word", // Words create reverse by default
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add to quiz");
      }

      const data = await response.json();

      // Mark as added
      const itemKey = `${addToQuizContext.type}-${addToQuizContext.sourceId}`;
      setAddedItems((prev) => {
        const newSet = new Set(prev);
        newSet.add(itemKey);
        return newSet;
      });

      // Save last used quiz island to localStorage
      localStorage.setItem("lastUsedQuizIslandId", quizIslandId);

      // Show success (non-blocking, subtle)
      // The button state will update automatically via addedItems

      setShowAddToQuizModal(false);
      setSelectedQuizIslandId(quizIslandId);
      setAddToQuizContext(null);
      setShowCreateNew(false);
    } catch (error) {
      console.error("Error adding to quiz:", error);
      alert(error instanceof Error ? error.message : "Failed to add to quiz");
    } finally {
      setAddingToQuiz(false);
    }
  };

  const glossaryEntries = useMemo(
    () =>
      words.map((word, index) => ({
        word,
        anchorId: `word-${word.id || index}`,
      })),
    [words],
  );

  const suggestionList = useMemo(() => {
    const raw = suggestionsInput.split(",").map((value) => value.trim());
    const deduped = Array.from(
      new Set(raw.filter((value) => value.length > 0)),
    );
    return deduped;
  }, [suggestionsInput]);

  const existingWordsSet = useMemo(() => {
    return new Set(words.map((word) => word.hanzi.trim()));
  }, [words]);

  const alreadyInIslandSuggestions = useMemo(() => {
    return suggestionList.filter((word) => existingWordsSet.has(word));
  }, [existingWordsSet, suggestionList]);

  useEffect(() => {
    if (words.length === 0) return;
    const entriesMap = new Map<string, IntersectionObserverEntry>();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entriesMap.set(entry.target.id, entry);
        });
        const visible = Array.from(entriesMap.values()).filter(
          (entry) => entry.isIntersecting,
        );
        if (visible.length === 0) return;
        const viewportCenter = window.innerHeight / 2;
        visible.sort((a, b) => {
          const aCenter =
            a.boundingClientRect.top + a.boundingClientRect.height / 2;
          const bCenter =
            b.boundingClientRect.top + b.boundingClientRect.height / 2;
          const aDistance = Math.abs(aCenter - viewportCenter);
          const bDistance = Math.abs(bCenter - viewportCenter);
          if (aDistance === bDistance) {
            return b.intersectionRatio - a.intersectionRatio;
          }
          return aDistance - bDistance;
        });
        const nextId = visible[0]?.target.id;
        if (nextId && nextId !== activeWordIdRef.current) {
          activeWordIdRef.current = nextId;
          setActiveWordId(nextId);
        }
      },
      {
        root: null,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    const elements = document.querySelectorAll<HTMLElement>(
      "[data-word-anchor='true']",
    );
    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      entriesMap.clear();
    };
  }, [words]);

  useEffect(() => {
    setEntries(
      glossaryEntries.map(({ word, anchorId }) => ({
        anchorId,
        hanzi: word.hanzi,
        english: word.english,
      })),
    );
  }, [glossaryEntries, setEntries]);

  useEffect(() => {
    setGlossaryActiveWordId(activeWordId);
  }, [activeWordId, setGlossaryActiveWordId]);

  useEffect(() => {
    if (!pendingScrollWordId) return;
    const anchorId = `word-${pendingScrollWordId}`;
    const element = document.getElementById(anchorId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollWordId(null);
    }
  }, [pendingScrollWordId, words]);

  useEffect(() => {
    if (!addToast) return;
    const timeout = setTimeout(() => setAddToast(null), 2500);
    return () => clearTimeout(timeout);
  }, [addToast]);

  useEffect(() => {
    return () => {
      setEntries([]);
      setGlossaryActiveWordId(null);
    };
  }, [setEntries, setGlossaryActiveWordId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <svg
            className="h-5 w-5 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>Loading topic island...</span>
        </div>
      </div>
    );
  }

  if (!island) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Island not found</div>
      </div>
    );
  }

  const totalSentenceTasks =
    island.sentence_tasks || Math.max(island.word_target * 3, 1);
  const wordsSelected = Math.min(
    island.words_selected ?? words.length,
    island.word_target,
  );
  const sentenceAttempts = Math.min(
    island.sentence_attempts ??
      words.reduce((total, word) => total + word.sentences.length, 0),
    totalSentenceTasks,
  );

  const wordProgress = island.word_target
    ? Math.min(wordsSelected / island.word_target, 1)
    : 0;
  const sentenceProgress = Math.min(sentenceAttempts / totalSentenceTasks, 1);

  const progressPercentage =
    island.status === "ready"
      ? 100
      : wordProgress < 1
        ? Math.round(30 * wordProgress)
        : Math.round(30 + 70 * sentenceProgress);

  const progressLabel =
    island.status === "ready"
      ? "Ready"
      : wordProgress < 1
        ? `Selecting words (${wordsSelected}/${island.word_target})`
        : `Generating sentences (${sentenceAttempts}/${totalSentenceTasks})`;
  // Islands use pre-generated cover images now
  const imageProgressPercentage = (island.cover_key || island.image_url) ? 100 : 0;
  const imageProgressLabel = (island.cover_key || island.image_url) ? "Ready" : "Loading...";

  const handleAddWords = async () => {
    if (addingWords) return;
    setAddingWords(true);
    try {
      const response = await fetch(`/api/islands/${islandId}/add-words`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: addCount,
          suggestions: suggestionList.filter(
            (word) => !existingWordsSet.has(word),
          ),
          recycleOldWords,
          level: addWordsLevel || island?.level,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to add words");
      }

      const data = await response.json();
      const insertedCount = data.insertedCount || 0;
      setAddToast(`Added ${insertedCount} words`);

      const firstInserted = data.insertedWords?.[0];
      if (firstInserted?.id) {
        setPendingScrollWordId(firstInserted.id);
      }

      await loadIsland();
      setSuggestionsInput("");
    } catch (error) {
      console.error("Error adding words:", error);
      alert(error instanceof Error ? error.message : "Failed to add words");
    } finally {
      setAddingWords(false);
    }
  };

  const handleStartEditTitle = () => {
    setEditedTitle(island?.topic || "");
    setIsEditingTitle(true);
  };

  const handleCancelEditTitle = () => {
    setIsEditingTitle(false);
    setEditedTitle("");
  };

  const handleSaveTitle = async () => {
    if (!editedTitle.trim() || editedTitle === island?.topic) {
      handleCancelEditTitle();
      return;
    }

    setSavingTitle(true);
    try {
      const response = await fetch(`/api/topic-islands/${islandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: editedTitle.trim() }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update title");
      }

      // Update local state
      if (island) {
        setIsland({ ...island, topic: editedTitle.trim() });
      }
      setIsEditingTitle(false);
      setEditedTitle("");
    } catch (error) {
      console.error("Error updating title:", error);
      alert(error instanceof Error ? error.message : "Failed to update title");
    } finally {
      setSavingTitle(false);
    }
  };

  // Quiz functions
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const handleStartQuiz = (mode: "drag-drop" | "flashcard") => {
    const selectedWords = words.filter(w => selectedWordIds.has(w.id));
    if (selectedWords.length < 5) {
      alert("Please select at least 5 words to start a quiz");
      return;
    }

    // Smart selection: prioritize words that haven't been quizzed recently
    const notRecentlyQuizzed = selectedWords.filter(w => !recentlyQuizzedIds.has(w.id));
    const recentlyQuizzed = selectedWords.filter(w => recentlyQuizzedIds.has(w.id));
    
    // If we have enough fresh words, use those; otherwise mix in some recent ones
    let quizPool: Word[];
    if (notRecentlyQuizzed.length >= 10) {
      // Plenty of fresh words - use only those
      quizPool = shuffleArray(notRecentlyQuizzed);
    } else if (notRecentlyQuizzed.length > 0) {
      // Mix fresh words with some recent ones
      const freshCount = Math.min(notRecentlyQuizzed.length, 7);
      const recentCount = Math.min(10 - freshCount, recentlyQuizzed.length);
      quizPool = [
        ...shuffleArray(notRecentlyQuizzed).slice(0, freshCount),
        ...shuffleArray(recentlyQuizzed).slice(0, recentCount),
      ];
      quizPool = shuffleArray(quizPool); // Shuffle the combined set
    } else {
      // All words have been quizzed recently - reset and use all
      quizPool = shuffleArray(selectedWords);
      setRecentlyQuizzedIds(new Set()); // Clear the recently quizzed set
    }

    // Take up to 10 words
    const quizSet = quizPool.slice(0, Math.min(10, quizPool.length));
    
    // Mark these words as recently quizzed
    setRecentlyQuizzedIds(prev => {
      const newSet = new Set(prev);
      quizSet.forEach(w => newSet.add(w.id));
      
      // Keep only last 20 quizzed IDs to prevent the set from growing forever
      if (newSet.size > 20) {
        const arr = Array.from(newSet);
        return new Set(arr.slice(-20));
      }
      return newSet;
    });

    setQuizWords(quizSet);
    setQuizMode(mode);
    setCurrentQuizIndex(0);
    setQuizAnswers({});
    setShowQuizResults(false);
    setShowFlashcardAnswer(false);

    if (mode === "flashcard") {
      // Randomly assign directions for each card
      setFlashcardDirection(quizSet.map(() => Math.random() > 0.5 ? "zh-en" : "en-zh"));
    } else {
      // Reset drag-drop state and shuffle English words once
      setDropMatches({});
      setDraggedItem(null);
      setShuffledEnglishWords(shuffleArray([...quizSet]));
    }
  };

  const handleFlashcardGrade = (correct: boolean) => {
    const currentWord = quizWords[currentQuizIndex];
    setQuizAnswers(prev => ({ ...prev, [currentWord.id]: correct }));
    
    if (currentQuizIndex < quizWords.length - 1) {
      setCurrentQuizIndex(currentQuizIndex + 1);
      setShowFlashcardAnswer(false);
    } else {
      setShowQuizResults(true);
    }
  };

  const handleDragDropSubmit = () => {
    const answers: Record<string, boolean> = {};
    quizWords.forEach(word => {
      const match = dropMatches[word.hanzi];
      answers[word.id] = match === word.english;
    });
    setQuizAnswers(answers);
    setShowQuizResults(true);
  };

  const handleResetQuiz = () => {
    setQuizMode(null);
    setQuizWords([]);
    setCurrentQuizIndex(0);
    setQuizAnswers({});
    setShowQuizResults(false);
    setShowFlashcardAnswer(false);
    setDropMatches({});
  };

  const toggleWordSelection = (wordId: string) => {
    setSelectedWordIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(wordId)) {
        newSet.delete(wordId);
      } else {
        newSet.add(wordId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedWordIds.size === words.length) {
      setSelectedWordIds(new Set());
    } else {
      setSelectedWordIds(new Set(words.map(w => w.id)));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex w-full">
        <div className="flex w-full px-8 py-8">
          <div className="flex-1 min-w-0">
            <div className="mx-auto max-w-4xl">
              {/* Header */}
              <div className="mb-10">
                <div className="mb-6 flex items-center justify-between">
                  <button
                    onClick={() => router.push("/app/topic-islands")}
                    className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                  >
                    ← Back to Topic Islands
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-sm font-medium text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
                  >
                    {deleting ? "Deleting..." : "Delete Island"}
                  </button>
                </div>
                {isEditingTitle ? (
                  <div className="mb-4 flex items-center gap-2">
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveTitle();
                        } else if (e.key === "Escape") {
                          handleCancelEditTitle();
                        }
                      }}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-4xl font-bold tracking-tight text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
                      autoFocus
                      disabled={savingTitle}
                    />
                    <button
                      onClick={handleSaveTitle}
                      disabled={savingTitle || !editedTitle.trim()}
                      className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      {savingTitle ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancelEditTitle}
                      disabled={savingTitle}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="mb-4 flex items-center gap-3 group">
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                      {island.topic}
                    </h1>
                    <button
                      onClick={handleStartEditTitle}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 opacity-0 transition-all hover:border-gray-300 hover:text-gray-900 group-hover:opacity-100"
                      title="Edit title"
                    >
                      Edit
                    </button>
                  </div>
                )}
                <div className="mb-6 flex items-center justify-between">
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Level: {island.level}</p>
                    <p className="capitalize">Status: {island.status}</p>
                  </div>
                  {island.status === "ready" && words.length > 0 && (
                    <button
                      onClick={() => setShowAddAllWordsModal(true)}
                      className="rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 shadow-sm"
                    >
                      Add all words to quiz
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-2">
                  <div className="mb-2 flex justify-between text-sm font-medium text-gray-600">
                    <span>Progress</span>
                    <span>{progressLabel}</span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-gray-900 transition-all"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Grammar Focus - Sleek Design */}
              {grammarFocus.length > 0 && (
                <div className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <h2 className="text-xl font-semibold text-gray-900">
                      Grammar Focus
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {grammarFocus.length} pattern{grammarFocus.length > 1 ? 's' : ''} to practice
                    </p>
                  </div>
                  
                  <div className="space-y-6">
                    {grammarFocus.map((point) => {
                      const warmupExample = point.examples.find(ex => ex.tier === 'warmup');
                      const targetExample = point.examples.find(ex => ex.tier === 'target');
                      
                      return (
                        <div
                          key={point.id}
                          className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                        >
                          {/* Header Row: Hanzi + Pinyin chip + English */}
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">
                              {convertText(point.hanzi)}
                            </h3>
                            <span className="rounded-full border border-gray-300 bg-white px-2.5 py-0.5 text-xs font-medium text-gray-600">
                              {point.pinyin}
                            </span>
                            <span className="text-sm text-gray-600">
                              {point.english}
                            </span>
                          </div>

                          {/* Pattern Line */}
                          <div className="mb-3 text-sm text-gray-700">
                            <span className="font-medium">Pattern:</span> {convertText(point.pattern)}
                          </div>

                          {/* When to Use (optional) */}
                          {point.when_to_use && (
                            <div className="mb-3 text-sm italic text-gray-600">
                              {point.when_to_use}
                            </div>
                          )}

                          {/* Examples: Warmup + Target */}
                          <div className="space-y-3">
                            {/* Warmup Example */}
                            {warmupExample && (
                              <div className="rounded-md border border-gray-200 bg-white p-3">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Warmup
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <div className="mb-1 text-base text-gray-900">
                                      {convertText(warmupExample.hanzi)}
                                    </div>
                                    <div className="mb-0.5 text-sm text-gray-600">
                                      {warmupExample.pinyin}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {warmupExample.english}
                                    </div>
                                  </div>
                                  <SpeakerButton
                                    text={warmupExample.hanzi}
                                    type="sentence"
                                    size="sm"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Target Level Example */}
                            {targetExample && (
                              <div className="rounded-md border border-gray-200 bg-white p-3">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Your level
                                </div>
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <div className="mb-1 text-base text-gray-900">
                                      {convertText(targetExample.hanzi)}
                                    </div>
                                    <div className="mb-0.5 text-sm text-gray-600">
                                      {targetExample.pinyin}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {targetExample.english}
                                    </div>
                                  </div>
                                  <SpeakerButton
                                    text={targetExample.hanzi}
                                    type="sentence"
                                    size="sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Generating Message */}
              {(island.status === "generating" ||
                island.status === "selecting") && (
                <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-3">
                    <p className="text-base font-medium text-gray-900">
                      Generating {island.word_target} words
                      {island.grammar_target > 0 &&
                        ` and ${island.grammar_target} grammar pattern${
                          island.grammar_target > 1 ? "s" : ""
                        }`}{" "}
                      for "{island.topic}" at {island.level}...
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {progressLabel}
                    </p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full bg-gray-900 transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {island.status === "error" && (
                <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
                  <div className="mb-4">
                    <p className="mb-2 text-base font-medium text-red-900">
                      Error generating words
                    </p>
                    <p className="text-sm text-red-700">
                      There was an issue generating words for this topic island.
                      You can try again or create a new island.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        try {
                          // Reset status to draft and retry generation
                          const response = await fetch(
                            `/api/topic-islands/${islandId}/generate-batch`,
                            {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ batchSize: 5 }),
                            },
                          );

                          if (!response.ok) {
                            const errorData = await response
                              .json()
                              .catch(() => ({}));
                            throw new Error(
                              errorData.message ||
                                errorData.error ||
                                "Failed to retry generation",
                            );
                          }

                          // Reload island to show updated status
                          await loadIsland();
                        } catch (error) {
                          console.error("Error retrying generation:", error);
                          alert(
                            error instanceof Error
                              ? error.message
                              : "Failed to retry generation. Please try again.",
                          );
                        }
                      }}
                      className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
                    >
                      Retry Generation
                    </button>
                    <button
                      onClick={() => router.push("/app/topic-islands")}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Create New Island
                    </button>
                  </div>
                </div>
              )}

              {/* Words List / Loading State */}
              {words.length > 0 ? (
                <div className="space-y-6">
                  {words.map((word, index) => {
                    const anchorId = `word-${word.id || index}`;
                    
                    return (
                      <div
                        key={anchorId}
                        id={anchorId}
                        data-word-anchor="true"
                        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
                      >
                        {/* All words visible; no blur or position-based paywall */}
                        <div className="mb-6">
                          {/* Desktop: side-by-side, Mobile: stacked */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="flex-1">
                              <div className="mb-2 flex items-center gap-3">
                                <div className="text-3xl font-bold text-gray-900">
                                  {convertText(word.hanzi)}
                                </div>
                                <SpeakerButton text={word.hanzi} type="word" size="lg" />
                              </div>
                              <div className="mb-2 text-lg text-gray-700">
                                {word.pinyin}
                              </div>
                              <div className="text-base text-gray-600">
                                {word.english}
                              </div>
                            </div>
                            {/* Buttons - stack on mobile, horizontal on desktop */}
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAskAIWord({
                                    hanzi: word.hanzi,
                                    pinyin: word.pinyin,
                                    english: word.english,
                                  });
                                }}
                                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md flex items-center gap-1.5"
                                title="Ask 华华 about this word"
                              >
                                <img 
                                  src="/capybara-face.png" 
                                  alt="Huáhuá" 
                                  className="h-5 w-5 rounded-full"
                                />
                                <span>Ask for help</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToQuizClick("word", word.id);
                                }}
                                disabled={addedItems.has(`word-${word.id}`)}
                                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                              >
                                {addedItems.has(`word-${word.id}`)
                                  ? "✓ In quiz"
                                  : t("Add to quiz")}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkKnown(word.id);
                                }}
                                disabled={markingKnown === word.id}
                                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {markingKnown === word.id
                                  ? "Updating..."
                                  : "Already know"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Sentences */}
                        <div className="space-y-4 border-t border-gray-200 pt-6">
                          {word.sentences.length === 0 ? (
                            <div className="flex items-center gap-3 py-4 text-gray-600">
                              <svg
                                className="h-5 w-5 animate-spin text-gray-400"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                              <span className="text-sm">Example sentences loading...</span>
                            </div>
                          ) : word.sentences.length < 3 ? (
                            <div className="flex items-center gap-3 py-4 text-amber-600">
                              <svg
                                className="h-5 w-5 animate-spin text-amber-500"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                />
                              </svg>
                              <span className="text-sm">Some sentences missing...</span>
                            </div>
                          ) : (
                            word.sentences
                              .sort((a, b) => {
                                const order = { easy: 0, same: 1, hard: 2 };
                                return order[a.tier] - order[b.tier];
                              })
                              .map((sentence) => (
                                <div key={sentence.id} className="space-y-2">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        {sentence.tier}
                                      </div>
                                      <div className="mb-1 flex items-center gap-2">
                                        <div className="text-base font-medium text-gray-900">
                                          {convertText(sentence.hanzi)}
                                        </div>
                                        <SpeakerButton
                                          text={sentence.hanzi}
                                          type="sentence"
                                          size="sm"
                                        />
                                      </div>
                                      <div className="mb-1 text-sm text-gray-700">
                                        {sentence.pinyin}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {sentence.english}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddToQuizClick("sentence", sentence.id);
                                      }}
                                      disabled={addedItems.has(`sentence-${sentence.id}`)}
                                      className="ml-4 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                                    >
                                      {addedItems.has(`sentence-${sentence.id}`)
                                        ? "✓ In quiz"
                                        : t("Add to quiz")}
                                    </button>
                                  </div>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : island.status === "generating" ? (
                <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
                    <p className="text-gray-700">
                      Generating words and example sentences for this topic...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
                  <div className="flex flex-col items-center gap-3 text-gray-500">
                    <svg
                      className="h-6 w-6 animate-spin text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    <p>
                      Generating words and example sentences for this topic...
                    </p>
                  </div>
                </div>
              )}

              {/* Tabbed Card for Add Words and Quiz */}
              <div className="mt-10 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab("add")}
                    className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "add"
                        ? "border-gray-900 text-gray-900 bg-white"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    Add more words
                  </button>
                  <button
                    onClick={() => setActiveTab("quiz")}
                    className={`flex-1 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "quiz"
                        ? "border-gray-900 text-gray-900 bg-white"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    Quiz me on this island
                  </button>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                {activeTab === "add" ? (
                  /* Add More Words Tab */
                  <div>
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Add more words
                        </h3>
                        <p className="text-sm text-gray-600">
                          Add more vocabulary that fits this island.
                        </p>
                      </div>
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
                        Add {addCount} words
                      </span>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-900">
                          Count
                        </label>
                        <input
                          type="range"
                          min={5}
                          max={10}
                          step={1}
                          value={addCount}
                          onChange={(e) => setAddCount(Number(e.target.value))}
                          className="w-full accent-gray-900"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-900">
                          Level
                        </label>
                        <select
                          value={addWordsLevel}
                          onChange={(e) => setAddWordsLevel(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                        >
                          <option value="A1">A1 - Beginner</option>
                          <option value="A2">A2 - Elementary</option>
                          <option value="B1">B1 - Intermediate</option>
                          <option value="B2">B2 - Upper Intermediate</option>
                          <option value="C1">C1 - Advanced</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-900">
                          Suggested words
                        </label>
                        <input
                          type="text"
                          value={suggestionsInput}
                          onChange={(e) => setSuggestionsInput(e.target.value)}
                          placeholder="Describe the type of words you want (optional)"
                          className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                        />
                        {alreadyInIslandSuggestions.length > 0 && (
                          <p className="mt-2 text-xs text-gray-500">
                            Already in island:{" "}
                            {alreadyInIslandSuggestions.join(", ")}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-3 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={recycleOldWords}
                            onChange={(e) => setRecycleOldWords(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-gray-900 accent-gray-900 focus:ring-gray-200"
                          />
                          Recycle existing words from this island into the sentence
                          examples of the new words
                        </label>
                        <button
                          onClick={
                            userPlan === "free"
                              ? () => {
                                  setUpgradeFeature("Add More Words");
                                  setShowUpgradeModal(true);
                                }
                              : handleAddWords
                          }
                          disabled={
                            userPlan === "pro" && (addingWords || island.status !== "ready" || addCount < 5)
                          }
                          className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {addingWords ? "Generating..." : `Add ${addCount} words`}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : quizMode === null ? (
                  /* Quiz Tab - Mode Selection */
                  <div>
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Select words to quiz
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Choose which words you want to practice. At least 5 words required.
                      </p>

                      {recentlyQuizzedIds.size > 0 && (
                        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                          <p className="text-sm text-blue-900">
                            <span className="font-medium">Smart Quiz Active:</span> Prioritizing words you haven't seen recently ({words.length - recentlyQuizzedIds.size} fresh words available).{" "}
                            <button
                              onClick={() => setRecentlyQuizzedIds(new Set())}
                              className="font-medium underline hover:no-underline"
                            >
                              Reset history
                            </button>
                          </p>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                        <span className="text-sm font-medium text-gray-700">
                          {selectedWordIds.size} of {words.length} words selected
                        </span>
                        <button
                          onClick={toggleSelectAll}
                          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          {selectedWordIds.size === words.length ? "Deselect all" : "Select all"}
                        </button>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2 mb-6">
                        {words.map(word => (
                          <label
                            key={word.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedWordIds.has(word.id)}
                              onChange={() => toggleWordSelection(word.id)}
                              className="h-4 w-4 rounded border-gray-300 text-gray-900 accent-gray-900 focus:ring-gray-200"
                            />
                            <div className="flex-1 flex items-center gap-2">
                              <span className="font-medium text-gray-900">{convertText(word.hanzi)}</span>
                              <span className="text-gray-600">•</span>
                              <span className="text-gray-600">{word.english}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Choose quiz type
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Drag & Drop Quiz Card */}
                        <button
                          onClick={() => handleStartQuiz("drag-drop")}
                          disabled={selectedWordIds.size < 5}
                          className="group text-left p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-gray-900 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none"
                        >
                          <div className="mb-3">
                            <svg className="h-10 w-10 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">
                            Drag & Drop Matching
                          </h4>
                          <p className="text-sm text-gray-600">
                            Match up to 10 English words with their Chinese translations
                          </p>
                        </button>

                        {/* Flashcard Quiz Card */}
                        <button
                          onClick={() => handleStartQuiz("flashcard")}
                          disabled={selectedWordIds.size < 5}
                          className="group text-left p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-gray-900 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:shadow-none"
                        >
                          <div className="mb-3">
                            <svg className="h-10 w-10 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">
                            Flashcards
                          </h4>
                          <p className="text-sm text-gray-600">
                            Flip through cards and test your memory in both directions
                          </p>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : !showQuizResults ? (
                  /* Active Quiz */
                  quizMode === "flashcard" ? (
                    /* Flashcard Quiz */
                    <div>
                      <div className="mb-6 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-600">
                          Card {currentQuizIndex + 1} of {quizWords.length}
                        </span>
                        <button
                          onClick={handleResetQuiz}
                          className="text-sm font-medium text-gray-600 hover:text-gray-900"
                        >
                          Exit Quiz
                        </button>
                      </div>

                      <div className="mb-8">
                        <div className="h-2 w-full rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-gray-900 transition-all"
                            style={{ width: `${((currentQuizIndex + 1) / quizWords.length) * 100}%` }}
                          />
                        </div>
                      </div>

                      {quizWords[currentQuizIndex] && (
                        <div className="flex flex-col items-center">
                          <div className="w-full max-w-md">
                            <div className="mb-8 rounded-2xl border-2 border-gray-200 bg-gray-50 p-12 text-center">
                              <div className="mb-4 text-sm font-medium uppercase tracking-wide text-gray-500">
                                {flashcardDirection[currentQuizIndex] === "zh-en" ? "Chinese" : "English"}
                              </div>
                              <div className="flex items-center justify-center gap-3 mb-8">
                                <div className="text-4xl font-bold text-gray-900">
                                  {flashcardDirection[currentQuizIndex] === "zh-en"
                                    ? convertText(quizWords[currentQuizIndex].hanzi)
                                    : quizWords[currentQuizIndex].english}
                                </div>
                                {flashcardDirection[currentQuizIndex] === "zh-en" && (
                                  <SpeakerButton text={quizWords[currentQuizIndex].hanzi} type="word" size="lg" />
                                )}
                              </div>

                              {flashcardDirection[currentQuizIndex] === "zh-en" && (
                                <div className="text-lg text-gray-600 mb-8">
                                  {quizWords[currentQuizIndex].pinyin}
                                </div>
                              )}

                              {showFlashcardAnswer && (
                                <div className="border-t-2 border-gray-300 pt-8 mt-8">
                                  <div className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-500">
                                    Answer
                                  </div>
                                  <div className="text-2xl font-semibold text-gray-900">
                                    {flashcardDirection[currentQuizIndex] === "zh-en"
                                      ? quizWords[currentQuizIndex].english
                                      : convertText(quizWords[currentQuizIndex].hanzi)}
                                  </div>
                                  {flashcardDirection[currentQuizIndex] === "en-zh" && (
                                    <>
                                      <div className="mt-2 text-lg text-gray-600">
                                        {quizWords[currentQuizIndex].pinyin}
                                      </div>
                                      <div className="mt-4">
                                        <SpeakerButton text={quizWords[currentQuizIndex].hanzi} type="word" size="lg" />
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {!showFlashcardAnswer ? (
                              <button
                                onClick={() => setShowFlashcardAnswer(true)}
                                className="w-full rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
                              >
                                Show Answer
                              </button>
                            ) : (
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleFlashcardGrade(false)}
                                  className="flex-1 rounded-lg border-2 border-red-500 bg-white px-6 py-3 text-base font-medium text-red-700 transition-colors hover:bg-red-50"
                                >
                                  I didn't know it
                                </button>
                                <button
                                  onClick={() => handleFlashcardGrade(true)}
                                  className="flex-1 rounded-lg border-2 border-green-500 bg-white px-6 py-3 text-base font-medium text-green-700 transition-colors hover:bg-green-50"
                                >
                                  I knew it
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Drag & Drop Quiz */
                    <div>
                      <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Match the pairs
                        </h3>
                        <button
                          onClick={handleResetQuiz}
                          className="text-sm font-medium text-gray-600 hover:text-gray-900"
                        >
                          Exit Quiz
                        </button>
                      </div>

                      <p className="mb-6 text-sm text-gray-600">
                        Drag English words to match with their Chinese translations
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        {/* Left column - Draggable English words */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">English</h4>
                          {shuffledEnglishWords.map(word => {
                            const isUsed = Object.values(dropMatches).includes(word.english);
                            return (
                              <div
                                key={`en-${word.id}`}
                                draggable={!isUsed}
                                onDragStart={() => !isUsed && setDraggedItem(word.english)}
                                onDragEnd={() => setDraggedItem(null)}
                                className={`p-4 rounded-lg border-2 transition-all ${
                                  isUsed
                                    ? "border-cyan-300 bg-cyan-50 text-cyan-900 opacity-60 cursor-not-allowed"
                                    : draggedItem === word.english
                                      ? "border-gray-900 bg-gray-900 text-white shadow-lg cursor-grabbing"
                                      : "border-gray-200 bg-white text-gray-900 hover:border-gray-400 hover:shadow-md cursor-grab"
                                }`}
                              >
                                {word.english}
                              </div>
                            );
                          })}
                        </div>

                        {/* Right column - Drop zones with Chinese words */}
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Chinese</h4>
                          {quizWords.map(word => {
                            const hasMatch = !!dropMatches[word.hanzi];
                            return (
                              <div
                                key={`zh-${word.id}`}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (draggedItem) {
                                    setDropMatches(prev => ({ ...prev, [word.hanzi]: draggedItem }));
                                    setDraggedItem(null);
                                  }
                                }}
                                className={`p-4 rounded-lg border-2 min-h-[56px] flex items-center justify-between transition-all ${
                                  hasMatch
                                    ? "border-cyan-300 bg-cyan-50 border-solid"
                                    : "border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`font-medium ${hasMatch ? "text-cyan-900" : "text-gray-900"}`}>
                                    {convertText(word.hanzi)}
                                  </span>
                                  <SpeakerButton text={word.hanzi} type="word" size="sm" />
                                  <span className={`text-sm ${hasMatch ? "text-cyan-700" : "text-gray-600"}`}>
                                    ({word.pinyin})
                                  </span>
                                </div>
                                {dropMatches[word.hanzi] && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-cyan-800">{dropMatches[word.hanzi]}</span>
                                    <button
                                      onClick={() => {
                                        setDropMatches(prev => {
                                          const newMatches = { ...prev };
                                          delete newMatches[word.hanzi];
                                          return newMatches;
                                        });
                                      }}
                                      className="ml-1 text-cyan-600 hover:text-cyan-800 font-semibold"
                                      title="Remove match"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleDragDropSubmit}
                          disabled={Object.keys(dropMatches).length !== quizWords.length}
                          className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Submit Answers
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  /* Quiz Results */
                  <div>
                    <div className="text-center mb-8">
                      <h3 className="text-3xl font-bold text-gray-900 mb-2">
                        Quiz Complete!
                      </h3>
                      {(() => {
                        const correctCount = Object.values(quizAnswers).filter(Boolean).length;
                        const totalCount = Object.keys(quizAnswers).length;
                        const percentage = Math.round((correctCount / totalCount) * 100);
                        return (
                          <>
                            <p className="text-5xl font-bold text-gray-900 my-6">
                              {percentage}%
                            </p>
                            <p className="text-lg text-gray-600">
                              You got {correctCount} out of {totalCount} correct
                            </p>
                          </>
                        );
                      })()}
                    </div>

                    <div className="mb-8 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4">Breakdown:</h4>
                      {quizWords.map(word => {
                        const isCorrect = quizAnswers[word.id];
                        return (
                          <div
                            key={word.id}
                            className={`p-4 rounded-lg border-2 ${
                              isCorrect
                                ? "border-green-200 bg-green-50"
                                : "border-red-200 bg-red-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">
                                  {isCorrect ? "✓" : "✗"}
                                </span>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {convertText(word.hanzi)} ({word.pinyin})
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    {word.english}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={handleResetQuiz}
                        className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        Back to Island
                      </button>
                      <button
                        onClick={() => {
                          setShowQuizResults(false);
                          setQuizMode(null);
                        }}
                        className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </div>

              {/* Add to Quiz Modal */}
              {showAddToQuizModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
                    <h3 className="mb-2 text-xl font-semibold text-gray-900">
                      Add to Quiz
                    </h3>
                    <p className="mb-6 text-sm text-gray-600">
                      {addToQuizContext?.type === "word"
                        ? "This will create 2 cards: Chinese → English and English → Chinese."
                        : "This will create 1 card: Chinese → English."}
                    </p>

                    {showCreateNew ? (
                      /* Create New Quiz Island Inline */
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-900">
                            Quiz Island Name
                          </label>
                          <input
                            type="text"
                            value={newQuizIslandName}
                            onChange={(e) =>
                              setNewQuizIslandName(e.target.value)
                            }
                            placeholder="e.g., Basic Vocabulary"
                            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                            autoFocus
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Quiz islands are for Chinese practice only
                          </p>
                        </div>
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => {
                              setShowCreateNew(false);
                              setNewQuizIslandName("");
                              if (quizIslands.length > 0) {
                                // Show select existing instead
                              } else {
                                setShowAddToQuizModal(false);
                                setAddToQuizContext(null);
                              }
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleCreateNewQuizIsland}
                            disabled={
                              creatingQuizIsland || !newQuizIslandName.trim()
                            }
                            className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                          >
                            {creatingQuizIsland
                              ? "Creating..."
                              : "Create & Add"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Select Existing Quiz Island */
                      <>
                        <div className="mb-6">
                          <select
                            value={selectedQuizIslandId}
                            onChange={(e) =>
                              setSelectedQuizIslandId(e.target.value)
                            }
                            className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                          >
                            {quizIslands.length === 0 ? (
                              <option value="">No quiz islands yet</option>
                            ) : (
                              quizIslands.map((island) => (
                                <option key={island.id} value={island.id}>
                                  {island.name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                        {quizIslands.length > 0 && (
                          <button
                            onClick={() => setShowCreateNew(true)}
                            className="mb-6 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            + Create new quiz island
                          </button>
                        )}
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => {
                              setShowAddToQuizModal(false);
                              setSelectedQuizIslandId(
                                localStorage.getItem("lastUsedQuizIslandId") ||
                                  "",
                              );
                              setAddToQuizContext(null);
                              setShowCreateNew(false);
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleAddToQuizConfirm()}
                            disabled={addingToQuiz || !selectedQuizIslandId}
                            className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                          >
                            {addingToQuiz ? "Adding..." : "Add"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {addToast && (
          <div className="fixed bottom-6 right-6 z-50 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-lg">
            {addToast}
          </div>
        )}

        <IslandSideChat
          islandId={islandId}
          askAIWord={askAIWord}
          onAskAIHandled={() => setAskAIWord(null)}
        />
        
        {/* Account/Upgrade Modals */}
        <AccountModal open={showAccountModal} onClose={() => setShowAccountModal(false)} />
        <UpgradeModal 
          open={showUpgradeModal} 
          onClose={() => {
            setShowUpgradeModal(false);
            setUpgradeFeature(undefined);
          }}
          feature={upgradeFeature}
        />

        {/* Add All Words Modal */}
        <AddAllWordsModal
          open={showAddAllWordsModal}
          onClose={() => setShowAddAllWordsModal(false)}
          words={words}
          islandId={islandId}
        />
      </div>
    </div>
  );
}
