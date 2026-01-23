"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ChatRole = "user" | "assistant";

export type IslandChatSelectedWord = {
  hanzi?: string;
  pinyin?: string;
  english?: string;
};

type ChatMessage = {
  id?: string;
  role: ChatRole;
  content: string;
  created_at?: string;
  model?: string | null;
};

export default function IslandSideChat({
  islandId,
  askAIWord,
  onAskAIHandled,
}: {
  islandId: string;
  askAIWord?: IslandChatSelectedWord | null;
  onAskAIHandled?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [modelMode, setModelMode] = useState<"chat" | "thinking">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedWord, setSelectedWord] =
    useState<IslandChatSelectedWord | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);

  const [panelWidth, setPanelWidth] = useState(420);
  const resizingRef = useRef(false);

  const hasLoadedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const askAIKeyRef = useRef<string | null>(null);

  const clampWidth = (w: number) => Math.max(320, Math.min(560, w));

  function stripMarkdown(text: string) {
    return (
      text
        // **bold** -> bold
        .replace(/\*\*(.*?)\*\*/g, "$1")
        // __bold__ -> bold
        .replace(/__(.*?)__/g, "$1")
        // ### Heading -> Heading
        .replace(/^#{1,6}\s+/gm, "")
        // - item -> item
        .replace(/^\s*-\s+/gm, "")
        // 1. item -> item
        .replace(/^\s*\d+\.\s+/gm, "")
        // remove stray markdown bullets like "* "
        .replace(/^\s*\*\s+/gm, "")
        // remove horizontal rules
        .replace(/^\s*---\s*$/gm, "")
        // trim extra whitespace
        .trim()
    );
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsMobile(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    // Keep scroll pinned on new messages
    scrollToBottom();
  }, [messages.length, open]);

  const loadHistory = async () => {
    if (!islandId) return;
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await fetch(`/api/island-chat?islandId=${islandId}`, {
        method: "GET",
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to load chat history");
      }
      const data = (await res.json()) as { messages?: ChatMessage[] };
      setMessages(data.messages || []);
      hasLoadedRef.current = true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load chat history");
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    // Lazy-load only when opened the first time
    if (open && !hasLoadedRef.current) {
      void loadHistory();
    }
  }, [open]);

  useEffect(() => {
    // Island changed: reset local state (history reload when opened)
    hasLoadedRef.current = false;
    setMessages([]);
    setSelectedWord(null);
    setError(null);
  }, [islandId]);

  const sendMessage = async ({
    content,
    wordOverride,
  }: {
    content: string;
    wordOverride?: IslandChatSelectedWord | null;
  }) => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    try {
      const res = await fetch("/api/island-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          islandId,
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          modelMode,
          selectedWord: wordOverride ?? selectedWord ?? undefined,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to send message");
      }

      const data = (await res.json()) as { reply?: string };
      const reply = (data.reply || "").trim();
      if (reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const askAiPrompt = useMemo(() => {
    const hanzi = askAIWord?.hanzi?.trim();
    if (!hanzi) return null;
    return `Explain ${hanzi} in a native way for my level. Include meaning, register (formal/casual), and 3 practical examples with pinyin + short English.`;
  }, [askAIWord?.hanzi]);

  useEffect(() => {
    if (!askAIWord || !askAIWord.hanzi || !askAiPrompt) return;
    const key = `${islandId}:${askAIWord.hanzi}:${askAIWord.pinyin || ""}:${
      askAIWord.english || ""
    }`;
    if (askAIKeyRef.current === key) return;
    askAIKeyRef.current = key;

    setSelectedWord(askAIWord);
    setOpen(true);

    // Ensure history is present (optional) then send
    const run = async () => {
      if (!hasLoadedRef.current) {
        await loadHistory();
      }
      await sendMessage({ content: askAiPrompt, wordOverride: askAIWord });
      onAskAIHandled?.();
    };
    void run();
  }, [askAiPrompt, askAIWord, islandId, onAskAIHandled]);

  const onPointerDownResize = (e: React.PointerEvent) => {
    if (isMobile) return;
    resizingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!resizingRef.current) return;
      const next = clampWidth(window.innerWidth - e.clientX);
      setPanelWidth(next);
    };
    const onUp = () => {
      resizingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [isMobile]);

  const clearChat = async () => {
    if (!confirm("Clear this island chat history? This cannot be undone.")) {
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/island-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ islandId, action: "clear" }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Failed to clear chat");
      }
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear chat");
    } finally {
      setSending(false);
    }
  };

  const Header = (
    <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold text-gray-900">AI Chat</div>
        <select
          value={modelMode}
          onChange={(e) => setModelMode(e.target.value as "chat" | "thinking")}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
          aria-label="Model"
        >
          <option value="chat">Chat</option>
          <option value="thinking">Thinking</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={clearChat}
          disabled={sending}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          title="New chat"
          aria-label="New chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M9 3h6a1 1 0 011 1v2h4v2H4V6h4V4a1 1 0 011-1zm2 0v2h2V3h-2z" />
            <path d="M6 10h12l-1 10a2 2 0 01-2 2H9a2 2 0 01-2-2L6 10z" />
          </svg>
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
          aria-label="Close chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M6.225 4.811a.75.75 0 011.06 0L12 9.525l4.715-4.714a.75.75 0 111.06 1.06L13.06 10.586l4.715 4.714a.75.75 0 11-1.06 1.06L12 11.646l-4.715 4.714a.75.75 0 11-1.06-1.06l4.714-4.714-4.714-4.715a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>
    </div>
  );

  const Body = (
    <>
      <div className="px-4 py-2 text-xs text-gray-500">
        {selectedWord?.hanzi ? (
          <span>
            Selected: <span className="font-medium">{selectedWord.hanzi}</span>
            {selectedWord.pinyin ? ` • ${selectedWord.pinyin}` : ""}
            {selectedWord.english ? ` • ${selectedWord.english}` : ""}
          </span>
        ) : (
          <span>Ask anything about this island’s words or sentences.</span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
        {loadingHistory ? (
          <div className="text-sm text-gray-600">Loading chat…</div>
        ) : messages.length === 0 ? (
          <div className="text-sm text-gray-600">
            Start by asking a question (or tap “Ask AI” on a word).
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m, idx) => (
              <div
                key={m.id || `${m.role}-${idx}`}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    m.role === "user"
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {m.role === "assistant"
                    ? stripMarkdown(m.content)
                    : m.content}
                </div>
              </div>
            ))}

            {sending ? (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-900 shadow-sm">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
                      style={{ animationDelay: "120ms" }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500"
                      style={{ animationDelay: "240ms" }}
                    />
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}
        {error ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendMessage({ content: input });
        }}
        className="border-t border-gray-200 p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message AI…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="rounded-xl border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </>
  );

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-lg transition-all hover:shadow-xl ${
          open ? "opacity-0 pointer-events-none" : ""
        }`}
        aria-label="Open AI chat"
        title="AI chat"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-6 w-6"
        >
          <path d="M4.804 21.644A1.5 1.5 0 003 20.25V6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v8.5A2.25 2.25 0 0118.75 17.5H9.664l-3.47 3.47a1.5 1.5 0 01-1.39.674z" />
        </svg>
        <span className="text-sm font-medium">Ask AI</span>
      </button>

      {/* Desktop split-screen sidebar (normal flex child) */}
      {!isMobile && open ? (
        <div
          className="sticky top-0 z-10 flex h-screen shrink-0"
          style={{ width: panelWidth }}
        >
          <div
            onPointerDown={onPointerDownResize}
            className="h-full w-2 cursor-col-resize bg-transparent"
            title="Drag to resize"
          />
          <div className="flex h-full w-full flex-col border-l border-gray-200 bg-white shadow-xl">
            {Header}
            {Body}
          </div>
        </div>
      ) : null}

      {/* Mobile drawer */}
      {isMobile && (
        <>
          <div
            className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
              open ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
            onClick={() => setOpen(false)}
          />
          <div
            className={`fixed inset-x-0 bottom-0 z-50 flex h-[70vh] flex-col rounded-t-2xl border border-gray-200 bg-white shadow-2xl transition-transform duration-200 ${
              open ? "translate-y-0" : "translate-y-full"
            }`}
            aria-hidden={!open}
          >
            <div className="flex justify-center pt-2">
              <div className="h-1.5 w-10 rounded-full bg-gray-300" />
            </div>
            {Header}
            {Body}
          </div>
        </>
      )}
    </>
  );
}
