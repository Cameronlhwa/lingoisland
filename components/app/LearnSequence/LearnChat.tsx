"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { pinyin } from "pinyin-pro";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import ExerciseChat from "./ExerciseChat";
import {
  resolveLearnLevel,
  useExerciseChatForIsland,
} from "./levels";
import type { LearnIsland, LearnWord } from "./types";

interface LearnChatProps {
  words: LearnWord[];
  island: LearnIsland;
  learnLevel?: string;
  onComplete: () => void;
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
      <p
        className="mb-2.5 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[#8AABBF]"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        Words to practice
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {words.map((w) => (
          <div key={w.id} className="group relative">
            <div
              className="cursor-default rounded-full border border-[#C2DCF0] bg-white px-3.5 py-1.5 text-sm font-medium text-[#071E2E] shadow-sm transition-colors group-hover:border-[#2176AE] group-hover:bg-[#EAF4FB]"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              {convertText(w.hanzi)}
            </div>
            <div
              className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[200px] -translate-x-1/2 rounded-lg border border-[#C2DCF0] bg-white px-3 py-2 text-center opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
            >
              <p className="text-xs font-medium text-[#5A7A90]">{w.pinyin}</p>
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
          ? "bg-[#2176AE] text-white"
          : "bg-white text-[#071E2E] shadow-sm"
      }`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
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
      className={`mx-auto flex max-w-2xl flex-col px-6 py-6 ${
        fillContainer ? "h-full min-h-0" : "h-[calc(100vh-8rem)]"
      }`}
    >
      <div className="mb-4 text-center">
        <button
          type="button"
          onClick={() => setShowWordList((v) => !v)}
          className="text-sm font-semibold text-[#2176AE] underline-offset-2 hover:underline"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          {showWordList ? "Hide" : "View"} words on this island (
          {islandWords.length})
        </button>

        {showWordList && (
          <div
            className="mt-3 max-h-44 overflow-y-auto rounded-xl border border-[#2176AE]/20 bg-white/80 text-left"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            {islandWords.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-[#2176AE]/10 px-4 py-2.5 last:border-b-0"
              >
                <span
                  className="text-sm font-medium text-[#071E2E]"
                  style={{ fontFamily: "'Lora', Georgia, serif" }}
                >
                  {convertText(w.hanzi)}
                </span>
                <span className="text-xs text-[#071E2E]/50">{w.pinyin}</span>
                <span className="text-xs text-[#071E2E]/60">· {w.english}</span>
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
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            showPinyin
              ? "border-[#2176AE] bg-[#2176AE] text-white"
              : "border-[#2176AE]/30 bg-white/70 text-[#071E2E]"
          }`}
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          {showPinyin ? "Hide" : "Show"} Pinyin
        </button>
        <button
          type="button"
          onClick={() => setShowEnglish((v) => !v)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            showEnglish
              ? "border-[#2176AE] bg-[#2176AE] text-white"
              : "border-[#2176AE]/30 bg-white/70 text-[#071E2E]"
          }`}
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          {showEnglish ? "Hide" : "Show"} English
        </button>
      </div>

      <div
        ref={scrollRef}
        className="mb-4 flex-1 space-y-3 overflow-y-auto rounded-xl border border-[#2176AE]/20 bg-white/60 p-4"
      >
        {loading ? (
          <p className="text-sm text-[#071E2E]/50">Starting practice…</p>
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
          <p className="text-sm text-[#071E2E]/50">华华 is typing…</p>
        )}
      </div>

      {error && (
        <p className="mb-2 text-center text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-2">
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
          className="flex-1 rounded-lg border border-[#2176AE]/25 bg-white px-4 py-2.5 text-sm text-[#071E2E] focus:border-[#2176AE] focus:outline-none focus:ring-2 focus:ring-[#2176AE]/20 disabled:opacity-50"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={loading || sending || !input.trim()}
          className="rounded-lg bg-[#2176AE] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        >
          Send
        </button>
      </div>

      <button
        type="button"
        onClick={onComplete}
        className="mt-4 w-full rounded-lg border border-[#2176AE]/30 bg-white/70 py-3 text-sm font-semibold text-[#2176AE] transition-colors hover:bg-white"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        Finish practice →
      </button>
    </div>
  );
}

export default function LearnChat({
  words,
  island,
  learnLevel,
  onComplete,
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
        fillContainer={fillContainer}
      />
    );
  }

  return (
    <LearnChatB1Plus
      words={words}
      island={island}
      onComplete={onComplete}
      fillContainer={fillContainer}
      allIslandWords={allIslandWords}
    />
  );
}
