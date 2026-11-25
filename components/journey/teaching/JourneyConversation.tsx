"use client";

import { useEffect, useRef, useState } from "react";
import { pinyin } from "pinyin-pro";
import { conversationParts, isUnavailableChatMessage } from "@/lib/journey/teaching/chatReply";
import { ArrowUp, Check, Loader2, Volume2 } from "lucide-react";
import HuahuaAvatar from "@/components/app/HuahuaAvatar";
import { say } from "@/components/Onboarding/personalized/firstLesson/lessonSpeech";
import type { JourneyLesson, LessonProgress } from "@/lib/journey/teaching/curriculum";
import styles from "./JourneyLessonPlayer.module.css";

type Messages = NonNullable<LessonProgress["chatMessages"]>;

export default function JourneyConversation({ islandId, lesson, messages, onMessages, onComplete }: {
  islandId: string; lesson: JourneyLesson; messages: Messages;
  onMessages: (messages: Messages) => void; onComplete: () => void;
}) {
  const [visibleMessages, setVisibleMessages] = useState(messages);
  useEffect(() => { setVisibleMessages(messages); }, [messages]);
  const [pinyinOpen, setPinyinOpen] = useState<Record<string, boolean>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [outgoing, setOutgoing] = useState("");
  const [error, setError] = useState("");
  const [meanings, setMeanings] = useState<Record<string, { text?: string; open: boolean; loading?: boolean; error?: boolean }>>({});
  const meaningRequests = useRef(new Set<string>());
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controllerRef.current?.abort(); }; }, []);
  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [visibleMessages, busy]);
  useEffect(() => {
    const field = inputRef.current;
    if (field) { field.style.height = "auto"; field.style.height = `${Math.min(field.scrollHeight, 100)}px`; }
  }, [input]);

  const toggleMeaning = async (text: string) => {
    if (meaningRequests.current.has(text)) return;
    const cached = meanings[text];
    if (cached?.text) { setMeanings(current => ({ ...current, [text]: { ...cached, open: !cached.open } })); return; }
    meaningRequests.current.add(text);
    setMeanings(current => ({ ...current, [text]: { open: true, loading: true } }));
    try {
      const response = await fetch("/api/story/english", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok || typeof data.english !== "string" || !data.english.trim()) throw new Error("Translation unavailable");
      if (mounted.current) setMeanings(current => ({ ...current, [text]: { text: data.english, open: true } }));
    } catch {
      if (mounted.current) setMeanings(current => ({ ...current, [text]: { open: true, error: true } }));
    } finally { meaningRequests.current.delete(text); }
  };
  const send = async (start = false) => {
    if (controllerRef.current || (!start && !input.trim())) return;
    const controller = new AbortController(); controllerRef.current = controller;
    const text = input.trim();
    const cleanHistory = visibleMessages.filter(message => message.role !== "assistant" || !isUnavailableChatMessage(message.content));
    const history: Messages = start ? cleanHistory : [...cleanHistory, { role: "user", content: text }];
    setBusy(true); setOutgoing(start ? "" : text); setError("");
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch("/api/learn-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonIslandId: islandId, messages: history, replySuggestions: true }), signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Huahua couldn’t reply. Please try again.");
      if (typeof data.message !== "string" || !data.message.trim() || isUnavailableChatMessage(data.message)) throw new Error("Huahua couldn’t reply. Please try again.");
      const suggestions = Array.isArray(data.suggestions) ? data.suggestions.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 80).slice(0, 3) : [];
      if (mounted.current) {
        const next: Messages = [...history, { role: "assistant", content: data.message, ...(suggestions.length ? { suggestions } : {}) }];
        setVisibleMessages(next);
        onMessages(next);
        if (!start) setInput("");
      }
    } catch (error) {
      if (mounted.current) setError(controller.signal.aborted ? "Huahua is taking a little longer. Try again." : (error as Error).message);
    } finally {
      clearTimeout(timer); controllerRef.current = null;
      if (mounted.current) { setBusy(false); setOutgoing(""); }
    }
  };
  const last = visibleMessages[visibleMessages.length - 1];
  const lastParts = last?.role === "assistant" ? conversationParts(last.content) : null;
  const needsRecovery = last?.role === "assistant" && isUnavailableChatMessage(last.content);
  const suggestions = last?.role === "assistant" ? (last.suggestions?.length ? last.suggestions : lastParts?.suggestions ?? []) : [];
  const hasReply = visibleMessages.some(message => message.role === "user");

  return <section className={styles.chat} data-testid="journey-conversation" aria-label="Conversation with Huahua">
    <header className={styles.chatHeader}>
      <HuahuaAvatar className={styles.chatAvatar} />
      <div><h2>Huahua</h2><p>Put it into practice with Huahua</p></div>
      {hasReply && <button type="button" className={styles.chatFinish} disabled={busy} onClick={onComplete}><Check size={14} aria-hidden /><span>Finish this lesson</span></button>}
    </header>
    <p className={styles.chatMission}>Try using {lesson.objective.pattern} and your new words.</p>
    <div ref={threadRef} className={styles.chatThread} role="log" aria-label="Messages" aria-live="polite" tabIndex={0}>
      {!visibleMessages.length && <div className={styles.chatStart}><p>Try your new Mandarin in a conversation.</p><button type="button" disabled={busy} onClick={() => void send(true)}>{busy ? "Huahua is getting ready…" : "Start the conversation"}</button></div>}
      {visibleMessages.map((message, index) => {
        if (message.role === "assistant" && isUnavailableChatMessage(message.content)) return <p key={index} className={styles.chatError}>Huahua’s reply didn’t load.</p>;
        const parts: ReturnType<typeof conversationParts> = message.role === "assistant" ? conversationParts(message.content) : { message: message.content, suggestions: [], hints: [] };
        const pinyinKey = `${index}:${message.content}`;
        const pronunciation = message.role === "assistant" ? parts.pinyin || pinyin(parts.message) : "";
        return <div key={index} className={`${styles.chatMessage} ${message.role === "user" ? styles.chatOutgoing : styles.chatIncoming}`}>
        <span className="sr-only">{message.role === "assistant" ? "Huahua" : "You"}: </span>
        <p className={styles.chatBubble}>{parts.message}</p>
        {message.role === "assistant" && <>
          {pinyinOpen[pinyinKey] && <p className={styles.chatPinyin} id={`journey-pinyin-${index}`}>{pronunciation}</p>}
          <div className={styles.chatTools}>
            <button type="button" className={styles.chatListen} aria-label={`Listen to Huahua’s message ${index + 1}`} onClick={() => say(parts.message, () => setError("Audio isn’t available right now."))}><Volume2 size={14} aria-hidden />Listen</button>
            <button type="button" className={styles.chatListen} aria-expanded={!!pinyinOpen[pinyinKey]} aria-controls={`journey-pinyin-${index}`} onClick={() => setPinyinOpen(current => ({ ...current, [pinyinKey]: !current[pinyinKey] }))}>{pinyinOpen[pinyinKey] ? "Hide pinyin" : "Show pinyin"}</button>
            <button type="button" className={styles.chatListen} aria-expanded={!!meanings[parts.message]?.open} disabled={meanings[parts.message]?.loading} onClick={() => void toggleMeaning(parts.message)}>{meanings[parts.message]?.loading ? "Loading meaning…" : meanings[parts.message]?.error ? "Retry meaning" : meanings[parts.message]?.open ? "Hide meaning" : "Show meaning"}</button>
          </div>
          {meanings[parts.message]?.open && <p className={styles.chatMeaning} role="status">{meanings[parts.message].loading ? "Loading meaning…" : meanings[parts.message].error ? "Meaning is unavailable. You can try again." : meanings[parts.message].text}</p>}
        </>}
      </div>; })}
      {outgoing && <div className={`${styles.chatMessage} ${styles.chatOutgoing}`}><p className={styles.chatBubble}>{outgoing}</p></div>}
      {busy && <div className={styles.chatTyping} role="status"><Loader2 size={14} className={styles.spinner} aria-hidden />Huahua is replying…</div>}
    </div>
    <div className={styles.chatFooter}>
      {error && <p role="alert" className={styles.chatError}>{error}{input.trim() ? " Your reply is still here." : ""}</p>}
      {needsRecovery && <button type="button" className={styles.chatListen} disabled={busy} onClick={() => void send(true)}>Retry Huahua’s reply</button>}
      {!!visibleMessages.length && <>
        {!busy && !!suggestions.length && <div className={styles.chatSuggestions} aria-label="Suggested replies"><p>Suggested replies</p><div>{suggestions.map(suggestion => <button key={suggestion} type="button" onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}>{suggestion}</button>)}</div></div>}
        {!busy && !!lastParts?.hints.length && <div className={styles.chatHintPills} aria-label="Hints">{lastParts.hints.map(hint => <span key={hint}>{hint}</span>)}</div>}
        <form className={styles.chatComposer} onSubmit={event => { event.preventDefault(); void send(); }}>
          <label className="sr-only" htmlFor="journey-reply">Your reply in Mandarin</label>
          <textarea ref={inputRef} id="journey-reply" rows={1} maxLength={600} value={input} disabled={busy} placeholder="Or write your reply…" onChange={event => setInput(event.target.value)} onKeyDown={event => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void send(); }
          }} />
          <button type="submit" aria-label="Send reply" disabled={busy || !input.trim()}>{busy ? <Loader2 size={19} className={styles.spinner} aria-hidden /> : <ArrowUp size={21} aria-hidden />}</button>
        </form>
      </>}
    </div>
  </section>;
}
