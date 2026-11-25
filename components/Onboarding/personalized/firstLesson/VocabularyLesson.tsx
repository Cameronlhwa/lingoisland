"use client";
import type {VocabularyGroup} from "@/lib/onboarding/personalized/firstLesson/curriculum";
import {ArrowRight, BookOpen, Check, ShieldCheck} from "lucide-react";
import styles from "./VocabularyLesson.module.css";
import type {FirstLessonProgress,MatchPair} from "@/lib/onboarding/personalized/firstLesson/types";
import {unfamiliarVocabulary,groupedVocabularyBatch,orderedVocabulary} from "@/lib/onboarding/personalized/firstLesson/vocabulary";
import {CARD_BORDER,GREEN,MUTED,PrimaryButton,SKY_PALE,TextButton} from "../ui";
import {MatchWords,WordCard} from "./LessonActivities";
export function VocabularyLesson({words,groups,progress,previouslyKnown,matching=true,polished=false,saving=false,onSave,onComplete,onMistake,onUnavailable}:{
 polished?:boolean;saving?:boolean;matching?:boolean;words:MatchPair[];groups:VocabularyGroup[];progress:FirstLessonProgress;previouslyKnown:ReadonlySet<string>;onSave:(patch:Partial<FirstLessonProgress>)=>void;onComplete:()=>void;onMistake:(id:string)=>void;onUnavailable:()=>void;
}) {
 const allowed=new Set(words.map(w=>w.id));
 const known=(progress.vocabularyKnownIds??words.filter(w=>previouslyKnown.has(w.hanzi)).map(w=>w.id)).filter(id=>allowed.has(id));
 const ordered=orderedVocabulary(words,groups);
 const unknown=unfamiliarVocabulary(ordered,known);
 const index=Math.min(progress.vocabularyIndex??0,Math.max(0,unknown.length-1));
 const active=groupedVocabularyBatch(ordered,groups,known,index);
 const batch=active?.batch??[];
 const batchStart=active?.batchStart??0;
 // An old category-based checkpoint may precede the end of the combined batch.
 const testing=matching && progress.vocabularyTesting===true && index===batchStart+batch.length-1;
 const completeBatch=()=>{
  const next=batchStart+batch.length;
  if(next>=unknown.length)onComplete();
  else onSave({vocabularyIndex:next,vocabularyTesting:false});
 };
 if(!progress.vocabularyChecked && polished)return <div className={styles.recognition} data-testid="lesson-vocabulary" data-vocabulary-step="check">
  <div className={styles.intro}>
   <span className={styles.eyebrow}><BookOpen size={14} aria-hidden/>Make it yours</span>
   <h2>Start with what you know</h2>
   <p>Tap the words you already know. We’ll focus on the ones that are new to you.</p>
  </div>
  <div className={styles.selectionHeading}><span>Your lesson vocabulary</span><span>{known.length} of {words.length} familiar</span></div>
  <div className={styles.wordGrid}>{words.map(word=>{
   const selected=known.includes(word.id);
   return <button type="button" key={word.id} aria-pressed={selected} data-testid={`known-word-${word.id}`} onClick={()=>onSave({vocabularyKnownIds:selected?known.filter(id=>id!==word.id):[...known,word.id]})} className={styles.word}>
    <span className={styles.checkbox} aria-hidden>{selected&&<Check size={13} strokeWidth={3}/>}</span>
    <span className={styles.hanzi} lang="zh-CN">{word.hanzi}</span>
    <span className={styles.pinyin}>{word.pinyin}</span>
    <span className={styles.wordState}>{selected?"Already familiar":"Tap if you know it"}</span>
   </button>;
  })}</div>
  <div className={styles.quickActions}><button type="button" data-testid="vocabulary-know-all" onClick={()=>onSave({vocabularyKnownIds:words.map(w=>w.id)})}>I know all of these</button><span aria-hidden>·</span><button type="button" data-testid="vocabulary-know-none" onClick={()=>onSave({vocabularyKnownIds:[]})}>These are all new</button></div>
  <div className={styles.nextUp}>
   <span className={styles.nextIcon}><BookOpen size={19} aria-hidden/></span>
   <div><strong>{unknown.length?`${unknown.length} new ${unknown.length===1?"word":"words"} to make your own`:"Ready to put your words to use"}</strong><p>{unknown.length?"Learn a few at a time, then try a quick practice.":"Next, learn this lesson’s grammar pattern."}</p></div>
  </div>
  <PrimaryButton mobileSticky className={styles.continue} disabled={saving} data-testid="vocabulary-confirm" onClick={()=>{onSave({vocabularyKnownIds:known,vocabularyChecked:true,vocabularyIndex:0,vocabularyTesting:false});if(!unknown.length)onComplete();}}>{unknown.length?"Learn my new words":"Continue to grammar"}<ArrowRight size={17} aria-hidden/></PrimaryButton>
  <p className={styles.reassurance}><ShieldCheck size={14} aria-hidden/>Your grammar practice is included either way.</p>
 </div>;
 if(!progress.vocabularyChecked)return <div data-testid="lesson-vocabulary" data-vocabulary-step="check">
  <h2 className="mb-3 text-xl font-bold">Which words do you already know?</h2>
  <p className="mb-4 text-sm leading-relaxed" style={{color:MUTED}}>Select the words whose meanings you know. Words you recognized earlier are already selected. {matching?"We’ll teach your new words in groups of three, then practise matching them. Smaller groups include familiar words for review.":"We’ll introduce the expressions you need before the reading and discussion."}</p>
  <div className="grid grid-cols-3 gap-2">{words.map(word=><button type="button" key={word.id} aria-pressed={known.includes(word.id)} data-testid={`known-word-${word.id}`} onClick={()=>onSave({vocabularyKnownIds:known.includes(word.id)?known.filter(id=>id!==word.id):[...known,word.id]})} className="relative min-h-[72px] min-w-0 rounded-xl border-2 px-2 py-2 text-center" style={{borderColor:known.includes(word.id)?GREEN:CARD_BORDER,background:known.includes(word.id)?SKY_PALE:"white"}}><span className="block break-words text-lg font-bold leading-snug sm:text-xl" lang="zh-CN">{word.hanzi}</span><span className="mt-1 block break-words text-xs leading-snug" style={{color:MUTED}}>{word.pinyin}</span>{known.includes(word.id)&&<Check size={16} className="absolute right-2 top-2" style={{color:GREEN}} aria-hidden/>}</button>)}</div>
  <div className="mt-2 flex justify-center gap-2"><TextButton data-testid="vocabulary-know-all" onClick={()=>onSave({vocabularyKnownIds:words.map(w=>w.id)})}>I know all of these</TextButton><TextButton data-testid="vocabulary-know-none" onClick={()=>onSave({vocabularyKnownIds:[]})}>These are all new</TextButton></div>
  <p className="mt-3 text-center text-sm" style={{color:MUTED}}>{unknown.length?`${unknown.length} new ${unknown.length===1?"word":"words"} · learn up to three, then practise`:"No new words to learn. Let’s practise the grammar."}</p>
  <PrimaryButton mobileSticky className="mt-5" data-testid="vocabulary-confirm" onClick={()=>{onSave({vocabularyKnownIds:known,vocabularyChecked:true,vocabularyIndex:0,vocabularyTesting:false});if(!unknown.length)onComplete();}}>{unknown.length?"Learn my new words":"Continue to grammar"}</PrimaryButton>
  <p className="mt-3 text-center text-xs" style={{color:MUTED}}>You’ll still learn and practise this lesson’s grammar pattern.</p>
 </div>;
 if(!unknown.length)return <div data-testid="lesson-vocabulary" data-vocabulary-step="known"><p>You know these words. Let’s use them in a sentence.</p><PrimaryButton mobileSticky className="mt-5" onClick={onComplete}>Continue to grammar</PrimaryButton></div>;
 const word=unknown[index];
 return <div data-testid="lesson-vocabulary" data-vocabulary-step={testing?"test":"teach"} data-vocabulary-index={index} data-batch-ids={batch.map(w=>w.id).join("|")} data-quiz-ids={active?.quizPairs.map(w=>w.id).join("|")}>
  <p className="mb-4 text-center text-xs font-semibold" style={{color:MUTED}}>Vocabulary · Group {active?.round} of {active?.rounds} · {testing?"Let’s see what you remember":`Word ${index-batchStart+1} of ${batch.length}`}</p>
  {!testing?<><WordCard phrase={{...word,meaning:word.label}} onUnavailable={onUnavailable}/><PrimaryButton mobileSticky className="mt-6" data-testid="lesson-teach-continue" onClick={()=>index===batchStart+batch.length-1?(matching?onSave({vocabularyTesting:true}):completeBatch()):onSave({vocabularyIndex:index+1,vocabularyTesting:false})}>{index===batchStart+batch.length-1?(matching?"Practise these words":"Continue"):"Next word"}</PrimaryButton></>:<MatchWords key={batchStart} pairs={active?.quizPairs??batch} onComplete={completeBatch} onMistake={onMistake} onUnavailable={onUnavailable}/>}
 </div>;
}
