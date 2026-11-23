"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, X } from "lucide-react";
import styles from "./TopicConversation.module.css";

export type ConversationTopic = {
  title: string;
  description: string;
  file: string;
  goal: string;
  question: string;
  placeholder: string;
  reply: string;
  examples: string[];
};

export default function TopicConversation({ topic, onClose }: { topic: ConversationTopic; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const latest = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [draft, setDraft] = useState("");
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"initialTyping" | "asking" | "typing" | "replied" | "ready">("initialTyping");
  const [error, setError] = useState("");
  const valid = (value: string) => new RegExp("[\\p{L}\\p{N}]", "u").test(value) && value.trim().length >= 2;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (phase !== "initialTyping" && phase !== "typing" && phase !== "replied") return;
    const next = phase === "initialTyping" ? "asking" : phase === "typing" ? "replied" : "ready";
    const timer = window.setTimeout(() => setPhase(next), phase === "replied" ? (reduceMotion ? 0 : 400) : 2000);
    return () => window.clearTimeout(timer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase !== "asking") latest.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "instant" : "smooth" });
  }, [phase, reduceMotion]);

  const enter = { initial: { opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: reduceMotion ? 0 : 0.3 } };
  const href = `/onboarding/journey?${new URLSearchParams({ source: "topic-chat", topic: answer, goal: topic.goal }).toString()}`;

  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="topic-conversation-title" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div {...enter} className={styles.panel}>
        <button autoFocus type="button" className={styles.close} aria-label="Close topic preview" onClick={onClose}><X size={21} aria-hidden="true" /></button>
        <div className={styles.preview}>
          {topic.file ? <Image src={`/home/redesign-v2/${topic.file}.webp`} alt="" width={112} height={112} /> : <span className={styles.customArt} aria-hidden="true">✦</span>}
          <div>
            <p className={styles.eyebrow}>YOUR NEXT CHAPTER</p>
            <h2 id="topic-conversation-title">{topic.title}</h2>
            <p className={styles.description}>{topic.description}</p>
          </div>
          <div className={styles.examples} aria-label="Things you could explore">{topic.examples.map((example) => <span key={example}>{example}</span>)}</div>
        </div>
        <div className={styles.conversation}>
          <p className={styles.sender}>LingoIsland <span>· A little more you</span></p>
          <div role="status" aria-live="polite" aria-atomic="true">
            {phase === "initialTyping" ? <div className={styles.typing} aria-label="LingoIsland is typing"><span /><span /><span /></div> : <motion.p {...enter} className={styles.received}>{topic.question}</motion.p>}
          </div>
          {phase === "asking" ? (
            <form className={styles.form} onSubmit={(event) => {
              event.preventDefault();
              if (!valid(draft)) { setError("Tell us a little more. Use at least two letters or numbers."); return; }
              setAnswer(draft.trim()); setPhase("typing"); setError("");
            }}>
              <label className={styles.srOnly} htmlFor="topic-chat-answer">What would you like to learn?</label>
              <div className={styles.composer}>
                <input id="topic-chat-answer" value={draft} onChange={(event) => { setDraft(event.target.value); setError(""); }} placeholder={topic.placeholder} maxLength={160} autoComplete="off" aria-describedby={error ? "topic-chat-error" : undefined} aria-invalid={Boolean(error)} />
                <button type="submit" disabled={!valid(draft)} aria-label="Send your answer"><ArrowUp size={23} strokeWidth={2.5} aria-hidden="true" /></button>
              </div>
              {error && <p role="alert" id="topic-chat-error" className={styles.error}>{error}</p>}
              <p className={styles.hint}>Your interests. Your pace. Your Mandarin.</p>
            </form>
          ) : phase !== "initialTyping" ? (
            <>
              <motion.p {...enter} className={styles.sent}>{answer}</motion.p>
              <div ref={latest} role="status" aria-live="polite" aria-atomic="true" className={styles.response}>
                {phase === "typing" ? <div className={styles.typing} aria-label="LingoIsland is typing"><span /><span /><span /></div> : <motion.p {...enter} className={styles.received}>{topic.reply} Click below to get started!</motion.p>}
              </div>
              {phase === "ready" && <motion.div {...enter} className={styles.actions}><Link href={href} className={styles.start}>Build my learning plan</Link><button type="button" className={styles.edit} onClick={() => { setDraft(answer); setPhase("asking"); }}>Edit my answer</button></motion.div>}
            </>
          ) : null}
        </div>
      </motion.div>
    </dialog>
  );
}
