"use client";
import { useState } from "react";
import Image from "next/image";
import { Volume2 } from "lucide-react";
import { pinyin } from "pinyin-pro";
import type { LessonPhrase } from "@/lib/onboarding/personalized/firstLesson/types";
import { say } from "./lessonSpeech";
import styles from "./ConversationPrompt.module.css";

export function ConversationPrompt({ prompt, selected, onUnavailable, writing = false, label }: {
  prompt: string;
  writing?: boolean;
  label?: string;
  selected?: LessonPhrase;
  onUnavailable: () => void;
}) {
  const [showPinyin, setShowPinyin] = useState(true);
  // Keep all mixed-language content, including prompts containing several Chinese examples.
  const firstChinese = prompt.search(/[\u3400-\u9fff]/);
  const instruction = firstChinese > 0 ? prompt.slice(0, firstChinese) : "";
  const sentence = firstChinese >= 0 ? prompt.slice(firstChinese) : prompt;
  const hasChinese = firstChinese >= 0;
  const hasBlank = /_{2,}/.test(sentence);
  const parts = sentence.split(/(_{2,}|[\u3400-\u9fff]+[，。！？、；：‘’“”「」『』…]*)/).filter(Boolean);
  const spoken = sentence.replace(/_{2,}/g, selected?.hanzi ?? "");
  const canListen = hasChinese && (!hasBlank || Boolean(selected));
  const listenHint = "Choose an answer to hear the sentence";
  return <div className={styles.wrapper}>
    {instruction.trim() && <p className={styles.instruction}>{instruction.trim()}</p>}
    <section className={styles.panel} data-english={!hasChinese} aria-label="Conversation practice">
      <div className={styles.toolbar}>
        <span className={styles.label}>{label ?? (hasChinese ? "Say to Huahua" : "Your task")}</span>
        {hasChinese && <div className={styles.controls}>
          {!(writing && hasBlank) && <button type="button" className={styles.listen} disabled={!canListen}
            aria-label={canListen ? "Listen to your sentence" : listenHint}
            title={canListen ? "Listen to your sentence" : listenHint}
            onClick={() => say(spoken, onUnavailable)}><Volume2 size={19} aria-hidden="true"/></button>}
          <button type="button" role="switch" aria-checked={showPinyin} className={styles.toggle}
            onClick={() => setShowPinyin(value => !value)}>Pinyin<span className={styles.track} data-on={showPinyin}><span/></span></button>
        </div>}
      </div>
      <div className={styles.dialogue}>
        <Image src="/onboarding/huahua/04-follow-the-exchange.png" alt="Huahua" width={1254} height={1254} sizes="(max-width: 639px) 64px, 88px" className={styles.avatar}/>
        <div className={styles.bubble}>
          <p className={styles.sentence} lang={hasChinese ? "zh-CN" : "en"} aria-label={hasBlank ? sentence.replace(/_{2,}/g, selected?.hanzi ?? "（空白）") : sentence}>
            {parts.map((part, index) => /_{2,}/.test(part) ? <span key={index} className={styles.word}>
              <span className={styles.slot} data-filled={Boolean(selected)}>{selected?.hanzi ?? <span className="sr-only">Blank</span>}</span>
              {showPinyin && <span className={styles.pinyin}>{selected?.pinyin || '\u00a0'}</span>}
            </span> : part.trim() && <span key={index} className={/[\u3400-\u9fff]/.test(part) ? styles.word : hasChinese ? styles.context : styles.task}>
              <span>{part.trim()}</span>
              {showPinyin && /[\u3400-\u9fff]/.test(part) && <span className={styles.pinyin}>{pinyin(part.trim())}</span>}
            </span>)}
          </p>
        </div>
      </div>
    </section>
  </div>;
}
