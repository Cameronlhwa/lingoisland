"use client";
import Image from "next/image";
import { pinyin } from "pinyin-pro";
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
function KeyWords({text,words,reading=false}:{text:string;words:readonly string[];reading?:boolean}) {
  const targets=Array.from(new Set(words)).filter(Boolean).sort((a,b)=>b.length-a.length);
  const pieces=[];
  let start=0,index=0;
  while(index<text.length){
    const target=targets.map(word => {
      if (!reading) return text.startsWith(word,index) ? word : undefined;
      // Preserve authored spacing, including pinyin with joined syllables.
      const pattern=word.replace(/\s/g, "").split("").map(char=>char.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("\\s*");
      return text.slice(index).match(new RegExp(`^${pattern}`, "iu"))?.[0];
    }).find(Boolean);
    if(!target){index++;continue;}
    if(start<index)pieces.push(text.slice(start,index));
    pieces.push(<span key={index} className={styles.keyWord}>{target}</span>);
    index+=target.length;start=index;
  }
  if(start<text.length)pieces.push(text.slice(start));
  return <>{pieces}</>;
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
          <p className={`${styles.partPinyin} ${piece.variable ? styles.variableReading : styles.fixedReading}`}>{piece.pinyin}</p>
          <p className={styles.partMeaning}>{piece.meaning}</p>
        </div>)}
      </div>
      <p className={styles.patternMeaning}>{example.meaning}</p>
    </> : <>
      <p className={styles.hanzi} lang="zh-CN">{example.keyWords ? <KeyWords text={example.hanzi} words={example.keyWords}/> : <KeyWords text={example.hanzi} words={example.highlight ? [example.highlight.hanzi] : []}/>}</p>
      <p className={styles.pinyin}>{example.keyWords ? <KeyWords reading text={example.pinyin} words={example.keyWords.map(word => pinyin(word, { toneType: "symbol" }))}/> : <KeyWords reading text={example.pinyin} words={example.highlight ? [example.highlight.pinyin] : []}/>}</p>
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
