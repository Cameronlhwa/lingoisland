"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pinyin } from "pinyin-pro";
import PrimaryButton from "@/components/landing/PrimaryButton";
import SecondaryButton from "@/components/landing/SecondaryButton";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import {
  HSK_CARD_SHADOW,
  LINGO_ACCENT_BORDER,
  LINGO_ACCENT_GRADIENT_GLOSSY,
  LINGO_ACCENT_TINT,
} from "@/lib/glossy-theme";
import ExerciseChat from "./ExerciseChat";
import {
  resolveLearnLevel,
  useExerciseChatForIsland,
} from "./levels";
import { LearnSequenceCard } from "./shell";
import type { LearnIsland, LearnWord } from "./types";

interface LearnChatProps {
  words: LearnWord[];
  island: LearnIsland;
  learnLevel?: string;
  onComplete: () => void;
  onBack?: () => void;
  fillContainer?: boolean;
  allIslandWords?: LearnWord[];
}

type ChatMessage = { role: "user" | "assistant"; content: string };

type MessageExtras = {
  english?: string;
  englishLoading?: boolean;
};

function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

function toPinyinLine(text: string): string {
  if (!hasChinese(text)) return "";
  return pinyin(text, {
    toneType: "symbol",
    separator: " ",
    nonZh: "removed",
  }).trim();
}

function PracticeWordStrip({ words }: { words: LearnWord[] }) {
  const { convertText } = useCharacterSet();

  return (
    <div className="mb-4">
      <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
        Words to practice
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {words.map((w) => (
          <div key={w.id} className="group relative">
            <div
              className="cursor-default rounded-full border border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)] px-3.5 py-1.5 text-sm font-bold text-[var(--lingo-navy)] transition-colors group-hover:bg-white"
            >
              {convertText(w.hanzi)}
            </div>
            <div
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[200px] -translate-x-1/2 rounded-lg border border-[#C2DCF0] bg-white px-3 py-2 text-center opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              <p className="text-xs font-medium text-[var(--lingo-text-muted)]">{w.pinyin}</p>
              <p className="mt-0.5 text-xs italic text-[#8AABBF]">{w.english}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  showPinyin,
  showEnglish,
  extras,
}: {
  message: ChatMessage;
  showPinyin: boolean;
  showEnglish: boolean;
  extras?: MessageExtras;
}) {
  const { convertText } = useCharacterSet();
  const pinyinLine = showPinyin ? toPinyinLine(message.content) : "";
  const showExtras = hasChinese(message.content);

  return (
    <div
      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        message.role === "user"
          ? "text-white"
          : "bg-white text-[var(--lingo-navy)]"
      }`}
      style={{
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background:
          message.role === "user"
            ? LINGO_ACCENT_GRADIENT_GLOSSY
            : "#fff",
        boxShadow: HSK_CARD_SHADOW,
      }}
    >
      <p className="whitespace-pre-wrap">{convertText(message.content)}</p>
      {showExtras && showPinyin && pinyinLine && (
        <p
          className={`mt-2 text-xs leading-relaxed ${
            message.role === "user" ? "text-white/75" : "text-[#071E2E]/60"
          }`}
        >
          {pinyinLine}
        </p>
      )}
      {showExtras && showEnglish && (
        <p
          className={`mt-1.5 text-xs italic leading-relaxed ${
            message.role === "user" ? "text-white/70" : "text-[#071E2E]/50"
          }`}
        >
          {extras?.englishLoading
            ? "Translating…"
            : extras?.english || "—"}
        </p>
      )}
    </div>
  );
}

function LearnChatB1Plus({
  words,
  island,
  onComplete,
  onBack,
  fillContainer = false,
  allIslandWords,
}: LearnChatProps) {
  const { convertText } = useCharacterSet();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinyin, setShowPinyin] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);
  const [showWordList, setShowWordList] = useState(false);
  const [messageExtras, setMessageExtras] = useState<
    Record<number, MessageExtras>
  >({});
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initialLoadRef = useRef(false);

  const islandWords = useMemo(() => {
    const list = allIslandWords ?? words;
    return [...list].sort(
      (a, b) => (a.position ?? 999) - (b.position ?? 999),
    );
  }, [allIslandWords, words]);

  const wordPayload = words.map((w) => ({
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    english: w.english,
  }));

  const callApi = async (history: ChatMessage[]) => {
    const res = await fetch("/api/learn-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        messages: history,
        islandLevel: island.level,
        islandTopic: island.topic,
        words: wordPayload,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to get response");
    }

    const data = await res.json();
    return data.message as string;
  };

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;

    (async () => {
      try {
        const message = await callApi([]);
        setMessages([{ role: "assistant", content: message }]);
      } catch (err) {
        console.error(err);
        setError("Could not start practice. You can finish and try chat later.");
        setMessages([
          {
            role: "assistant",
            content:
              "Hi! Let's practice your new words. Type a message when you're ready.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, showPinyin, showEnglish, messageExtras]);

  const fetchEnglish = useCallback(async (index: number, text: string) => {
    setMessageExtras((prev) => ({
      ...prev,
      [index]: { ...prev[index], englishLoading: true },
    }));

    try {
      const res = await fetch("/api/story/english", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed to translate");
      const data = await res.json();
      setMessageExtras((prev) => ({
        ...prev,
        [index]: { english: data.english || "", englishLoading: false },
      }));
    } catch (err) {
      console.error(err);
      setMessageExtras((prev) => ({
        ...prev,
        [index]: { english: "Translation unavailable", englishLoading: false },
      }));
    }
  }, []);

  useEffect(() => {
    if (!showEnglish) return;

    messages.forEach((msg, index) => {
      if (!hasChinese(msg.content)) return;
      const cached = messageExtras[index];
      if (cached?.english || cached?.englishLoading) return;
      void fetchEnglish(index, msg.content);
    });
  }, [showEnglish, messages, messageExtras, fetchEnglish]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMessage];
    setMessages(nextHistory);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const reply = await callApi(nextHistory);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      console.error(err);
      setError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`mx-auto flex max-w-2xl flex-col ${
        fillContainer ? "h-full min-h-0 px-6 py-6" : "min-h-0"
      }`}
    >
      <LearnSequenceCard className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 text-center">
        <button
          type="button"
          onClick={() => setShowWordList((v) => !v)}
          className="text-sm font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--lingo-teal)" }}
        >
          {showWordList ? "Hide" : "View"} words on this island (
          {islandWords.length})
        </button>

        {showWordList && (
          <div
            className="mt-3 max-h-44 overflow-y-auto rounded-2xl bg-white text-left"
            style={{
              border: `1px solid ${LINGO_ACCENT_BORDER}`,
              boxShadow: HSK_CARD_SHADOW,
            }}
          >
            {islandWords.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b px-4 py-2.5 last:border-b-0"
                style={{ borderColor: LINGO_ACCENT_BORDER }}
              >
                <span className="lingo-display text-sm font-medium text-[var(--lingo-navy)]">
                  {convertText(w.hanzi)}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--lingo-text-muted)" }}
                >
                  {w.pinyin}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--lingo-text-muted)" }}
                >
                  · {w.english}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <PracticeWordStrip words={words} />

      <div className="mb-3 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setShowPinyin((v) => !v)}
          className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
          style={{
            color: showPinyin ? "#fff" : "var(--lingo-navy)",
            background: showPinyin ? LINGO_ACCENT_GRADIENT_GLOSSY : "#fff",
            border: `1px solid ${showPinyin ? "transparent" : LINGO_ACCENT_BORDER}`,
            boxShadow: showPinyin ? HSK_CARD_SHADOW : undefined,
          }}
        >
          {showPinyin ? "Hide" : "Show"} Pinyin
        </button>
        <button
          type="button"
          onClick={() => setShowEnglish((v) => !v)}
          className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
          style={{
            color: showEnglish ? "#fff" : "var(--lingo-navy)",
            background: showEnglish ? LINGO_ACCENT_GRADIENT_GLOSSY : "#fff",
            border: `1px solid ${showEnglish ? "transparent" : LINGO_ACCENT_BORDER}`,
            boxShadow: showEnglish ? HSK_CARD_SHADOW : undefined,
          }}
        >
          {showEnglish ? "Hide" : "Show"} English
        </button>
      </div>

      <div
        ref={scrollRef}
        className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-2xl p-4"
        style={{
          background: LINGO_ACCENT_TINT,
          border: `1px solid ${LINGO_ACCENT_BORDER}`,
        }}
      >
        {loading ? (
          <p className="text-sm" style={{ color: "var(--lingo-text-muted)" }}>
            Starting practice…
          </p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <ChatBubble
                message={msg}
                showPinyin={showPinyin}
                showEnglish={showEnglish}
                extras={messageExtras[i]}
              />
            </div>
          ))
        )}
        {sending && (
          <p className="text-sm" style={{ color: "var(--lingo-text-muted)" }}>
            华华 is typing…
          </p>
        )}
      </div>

      {error && (
        <p className="mb-2 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          disabled={loading || sending}
          placeholder="Type your message…"
          className="flex-1 px-4 py-2.5 text-sm text-[var(--lingo-navy)] focus:outline-none focus:ring-2 disabled:opacity-50"
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            borderRadius: 18,
            background: "#fff",
            border: `1px solid ${LINGO_ACCENT_BORDER}`,
            boxShadow: HSK_CARD_SHADOW,
          }}
        />
        <PrimaryButton
          size="compact"
          onClick={() => void handleSend()}
          disabled={loading || sending || !input.trim()}
        >
          Send
        </PrimaryButton>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {onBack ? (
          <SecondaryButton onClick={onBack}>← Back</SecondaryButton>
        ) : null}
        <SecondaryButton className="flex-1" onClick={onComplete}>
          Finish practice →
        </SecondaryButton>
      </div>
      </LearnSequenceCard>
    </div>
  );
}

export default function LearnChat({
  words,
  island,
  learnLevel,
  onComplete,
  onBack,
  fillContainer = false,
  allIslandWords,
}: LearnChatProps) {
  const effectiveLevel = resolveLearnLevel(island.level, learnLevel);
  const useExerciseChat = useExerciseChatForIsland(island.level);

  const exerciseIsland = useMemo(
    () => ({ ...island, level: effectiveLevel }),
    [island.id, island.topic, island.level, effectiveLevel],
  );

  if (useExerciseChat) {
    return (
      <ExerciseChat
        words={words}
        island={exerciseIsland}
        onComplete={onComplete}
        onBack={onBack}
        fillContainer={fillContainer}
      />
    );
  }

  return (
    <LearnChatB1Plus
      words={words}
      island={island}
      onComplete={onComplete}
      onBack={onBack}
      fillContainer={fillContainer}
      allIslandWords={allIslandWords}
    />
  );
}
