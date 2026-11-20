"use client";
import Image from "next/image";
import { ArrowDown, ArrowRight } from "lucide-react";
import type { GrammarCard, TeachingExample } from "@/lib/onboarding/personalized/firstLesson/curriculum";
import { AudioButton } from "./LessonActivities";
import styles from "./TeachingSlide.module.css";

const ASSETS = {
  change: "01-change-one-piece.png",
  pattern: "02-build-the-pattern.png",
  contrast: "03-compare-meanings.png",
  exchange: "04-follow-the-exchange.png",
};
function Highlight({ text, value, hanzi = false }: { text: string; value?: string; hanzi?: boolean }) {
  const index = value ? text.indexOf(value) : -1;
  if (index < 0 || !value) return <>{text}</>;
  return <>{text.slice(0, index)}<mark className={hanzi ? styles.highlight : styles.soundHighlight}>{value}</mark>{text.slice(index + value.length)}</>;
}
function Example({ example, index, format, onUnavailable }: { example: TeachingExample; index: number; format: GrammarCard["format"]; onUnavailable: () => void }) {
  return <div className={`${styles.bubble} ${index > 0 ? styles.mintBubble : ""} ${format === "exchange" && index > 0 ? styles.reply : ""}`} data-testid={`teaching-example-${index}`}>
    <div className={styles.exampleHeader}>
      <span className={styles.label}>{example.label}</span>
      <AudioButton text={example.hanzi} label="Listen" onUnavailable={onUnavailable}/>
    </div>
    {example.context && <p className={styles.context}>{example.context}</p>}
    {example.parts ? <>
      <div className={styles.parts} aria-label={example.hanzi} style={{gridTemplateColumns:example.parts.map(piece=>`${Math.max(1,piece.hanzi.length)}fr`).join(" ")}}>
        {example.parts.map((piece, i) => <div key={`${piece.hanzi}-${i}`} className={styles.part}>
          <p className={`${styles.partHanzi} ${piece.variable ? styles.variablePart : ""}`} lang="zh-CN">{piece.hanzi}</p>
          <p className={styles.partPinyin}>{piece.pinyin}</p>
          <p className={styles.partMeaning}>{piece.meaning}</p>
        </div>)}
      </div>
      <p className={styles.patternMeaning}>{example.meaning}</p>
    </> : <>
      <p className={styles.hanzi} lang="zh-CN"><Highlight text={example.hanzi} value={example.highlight?.hanzi} hanzi/></p>
      <p className={styles.pinyin}><Highlight text={example.pinyin} value={example.highlight?.pinyin}/></p>
      <p className={styles.meaning}>{example.meaning}</p>
    </>}
  </div>;
}
/** Four reusable teaching layouts; all language and geometry remain native website elements. */
export function TeachingSlide({ card, onUnavailable }: { card: GrammarCard; onUnavailable: () => void }) {
  return <div data-testid="grammar-teaching" data-teaching-format={card.format} data-concept={card.id}>
    <div className={styles.lesson}>
      <div className={styles.mascot} aria-hidden="true">
        <Image src={`/onboarding/huahua/${ASSETS[card.format]}`} alt="" width={1254} height={1254} sizes="(max-width: 639px) 56px, 144px" className={styles.character}/>
      </div>
      <div className={styles.examples}>
        {card.examples.map((example, index) => <div key={`${card.id}-${index}`}>
          {index > 0 && card.connector && <div className={styles.connector} aria-hidden="true">
            {card.format === "exchange" ? <ArrowRight size={16}/> : <ArrowDown size={16}/>}
            <span>{card.connector}</span>
          </div>}
          <Example example={example} index={index} format={card.format} onUnavailable={onUnavailable}/>
        </div>)}
      </div>
    </div>
    <div className={styles.takeaway} data-testid="teaching-takeaway">
      <p>{card.takeaway}</p>
      {card.detail && <p className={styles.detail}>{card.detail}</p>}
    </div>
  </div>;
}
