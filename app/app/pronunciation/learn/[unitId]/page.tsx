"use client";
import {useEffect,useRef,useState} from "react";
import {useParams,useRouter,useSearchParams} from "next/navigation";
import Link from "next/link";
import {ArrowLeft,Check} from "lucide-react";
import styles from "./lesson.module.css";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { APP_PAGE_TITLE_CLASS } from "@/components/app/AppPage";
import SpeakerWithSpeed from "@/components/app/SpeakerWithSpeed";
import RecordButton,{type ScoreResult,type RecordError} from "@/components/app/Pronunciation/RecordButton";
import PronunciationFeedback from "@/components/app/Pronunciation/PronunciationFeedback";
import ToneContour from "@/components/app/Pronunciation/ToneContour";
import ToneSequence from "@/components/app/Pronunciation/ToneSequence";
import AppPageLoading from "@/components/app/AppPageLoading";
import {useCourseProgress} from "@/components/app/Pronunciation/useCourseProgress";
import {COURSE_UNITS,TONE_RULE_RECAP,spokenPinyin} from "@/lib/pronunciation/course/content";
import {emptyActivity,safeCourseReturn} from "@/lib/pronunciation/course/progress";
import {stopTextToSpeech} from "@/lib/utils/tts";

function ToneLessonPage({unitId}:{unitId:string}) {
  const router=useRouter();const search=useSearchParams();
  const unit=COURSE_UNITS.find(value=>value.id===unitId);
  const {progress,results,setResults,loading,saving,error,reload,act}=useCourseProgress();
  const [activityId,setActivityId]=useState<string|null>(null);const [selected,setSelected]=useState<number|null>(null);
  const [unitDone,setUnitDone]=useState(false);const [recordError,setRecordError]=useState<RecordError|null>(null);
  const [recordingBusy,setRecordingBusy]=useState(false);const [retryBlob,setRetryBlob]=useState<Blob|null>(null);
  const [recordedUrl,setRecordedUrl]=useState<string|null>(null);const audioUrl=useRef<string|null>(null);
  const initialized=useRef(false);const [retrying,setRetrying]=useState(false);
  const returnTo=safeCourseReturn(search.get("returnTo"));const suffix=search.get("returnTo")?`?returnTo=${encodeURIComponent(returnTo)}`:"";
  const index=unit?.activities.findIndex(activity=>activity.id===activityId)??-1;
  const activity=unit?.activities[index];const status=activity?progress.activities[activity.id]??emptyActivity():emptyActivity();
  const result=activity?results[activity.id]:null;
  useEffect(()=>{
    if(loading||!unit||initialized.current||error)return;
    initialized.current=true;
    const requested=search.get("activity");
    const id=unit.activities.find(a=>a.id===requested)?.id??unit.activities.find(a=>a.id===progress.currentActivityId)?.id??unit.activities.find(a=>!progress.activities[a.id]?.completed)?.id??unit.activities[0].id;
    setActivityId(id);void act({type:"visit",activityId:id});
  },[loading,unit,progress,search,error,act]);
  useEffect(()=>{window.scrollTo({top:0,behavior:"instant"});setSelected(null);setRecordError(null);setRetrying(false);setRecordingBusy(false);setRecordedUrl(null);stopTextToSpeech();if(audioUrl.current){URL.revokeObjectURL(audioUrl.current);audioUrl.current=null;}},[activityId]);
  useEffect(()=>()=>{stopTextToSpeech();if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);},[]);
  async function complete(skipSpeaking=false){
    if(!activity||recordingBusy||saving)return;
    if(result&&!skipSpeaking&&status.attemptId!==result.attemptId){if(!await act({type:"scored",activityId:activity.id,attemptId:result.attemptId}))return;}
    const next=await act({type:"complete",activityId:activity.id,skipSpeaking});if(!next)return;
    stopTextToSpeech();
    if(unit?.activities[index+1])setActivityId(unit.activities[index+1].id);else setUnitDone(true);
  }
  async function onScored(value:ScoreResult){if(!activity)return;setResults(previous=>({...previous,[activity.id]:value}));setRetrying(false);setRecordError(null);await act({type:"scored",activityId:activity.id,attemptId:value.attemptId});}
  if(loading)return <AppPageLoading/>;
  if(!unit)return <div className="p-8"><h1>Lesson not found</h1><Link href="/app/pronunciation/learn">Back to Tone Mastery</Link></div>;
  const nextUnit=COURSE_UNITS[COURSE_UNITS.indexOf(unit)+1];
  if(unitDone)return <div className="mx-auto max-w-xl px-5 py-12 text-center"><Check className="mx-auto text-[var(--lingo-teal)]" size={36}/><h1 className="lingo-display mt-4 text-3xl font-bold text-[var(--lingo-navy)]">{unit.title} complete</h1><p className="mt-4 text-sm text-[var(--lingo-text-muted)]">Your progress is saved. Keep accuracy ahead of speed, and return to any activity whenever you like.</p>{nextUnit&&<Button className="mt-7" onClick={()=>router.push(`/app/pronunciation/learn/${nextUnit.id}${suffix}`)}>Continue to {nextUnit.title}</Button>}<div className="mt-5"><Link href={`/app/pronunciation/learn${suffix}`} className="font-semibold text-[var(--lingo-teal)]">{progress.completedAt?"See course results":"Course overview"}</Link></div>{search.get("returnTo")&&<Link href={returnTo} className="mt-5 inline-block text-sm underline">Return to my practice</Link>}</div>;
  return <div className={`${styles.lesson} mx-auto w-full max-w-4xl px-4 py-3 sm:px-6 sm:py-5`}>
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href={`/app/pronunciation/learn${suffix}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--lingo-text-muted)]"><ArrowLeft size={16}/>Course overview</Link>{search.get("returnTo")&&<Link href={returnTo} className="text-sm font-semibold text-[var(--lingo-teal)]">Return to my practice</Link>}</div>
    <p className="mt-1 text-xs font-bold uppercase tracking-widest text-[var(--lingo-teal)]">{unit.title} · Activity {index+1} of {unit.activities.length}</p>
    {activity && <header className="mb-5 mt-3">
      <h1 id="tone-activity-title" className={APP_PAGE_TITLE_CLASS}>{activity.title}</h1>
      <p className="mt-2 text-sm text-[var(--lingo-text-muted)]">{activity.kind === "rule" ? "Find the spoken tone." : "Listen, then say it."}</p>
    </header>}
    {error&&<div role="alert" className="my-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button className="mt-2 underline" onClick={()=>void reload()}>Reload saved progress</button></div>}
    {activity&&<Card key={activity.id} role="region" aria-labelledby="tone-activity-title" aria-busy={saving} hover={false} padded={false} className={`${styles.card} p-4 sm:p-6`}>
      <div className={styles.model}>
        {activity.kind === "listen" && !status.resolved ? (
          <div className="my-8 flex flex-col items-center gap-4">
            <p className="text-sm text-[var(--lingo-text-muted)]">Listen carefully. Which two tones do you hear?</p>
            <SpeakerWithSpeed text={activity.text} type="word" size="lg" />
          </div>
        ) : (
          <>
            <p lang="zh-CN" className={`break-words text-center font-bold leading-relaxed text-[var(--lingo-navy)] ${activity.kind === "speak" ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"}`}>{activity.text}</p>
            {activity.kind === "rule" && !status.resolved ? (
              <p className="mt-5 text-center text-xl font-semibold">{activity.cue}</p>
            ) : (
              <>
                {activity.writtenPinyin && (activity.kind === "speak" ? (
                  <details className="mt-2 text-center text-sm text-[var(--lingo-text-muted)]">
                    <summary className="min-h-11 cursor-pointer py-3">Written pinyin reference</summary>
                    <p className="pb-2">{activity.writtenPinyin}</p>
                  </details>
                ) : <p className="mt-2 text-center text-sm text-[var(--lingo-text-muted)]">Written: {activity.writtenPinyin}</p>)}
                <p className="mt-2 text-center text-base text-[var(--lingo-text)]">{activity.writtenPinyin ? "Spoken: " : ""}{spokenPinyin(activity)}</p>
              </>
            )}
            <p className="mt-1 text-center text-sm text-[var(--lingo-text-muted)]">{activity.meaning}</p>
            {(activity.kind !== "rule" || status.resolved) && <div className="mt-3 flex justify-center">
              <SpeakerWithSpeed text={activity.text} type={activity.kind === "speak" ? "sentence" : "word"} size="lg" />
            </div>}
          </>
        )}
      </div>
      {activity.options&&!status.resolved&&<fieldset className="mt-6"><legend className="mb-3 text-sm font-bold text-[var(--lingo-navy)]">{activity.kind==="listen"?"Choose the tone pair":"What tone should the first syllable have when spoken?"}</legend><div className="grid grid-cols-2 gap-3">{activity.options.map((option,optionIndex)=><label key={option} className="relative"><input className="peer sr-only" type="radio" name="answer" checked={selected===optionIndex} onChange={()=>setSelected(optionIndex)} disabled={saving}/><span className={`flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border-2 px-3 py-3 text-center text-sm font-semibold text-[var(--lingo-navy)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${selected===optionIndex?"border-[var(--lingo-teal)] bg-[var(--lingo-sky-pale)]":"border-[var(--lingo-border)]"}`}>{option}</span></label>)}</div><Button className={`${styles.check} mt-5 w-full`} disabled={selected===null||saving} onClick={()=>selected!==null&&void act({type:"answer",activityId:activity.id,selected})}>Check answer</Button>{status.errors===1&&<p role="status" className="mt-4 text-sm text-[var(--lingo-text-muted)]">Not quite. {activity.kind==="listen"?"Listen again and try once more.":"Check the next syllable's tone and try again."}</p>}</fieldset>}
      {(activity.kind==="teach"||activity.kind==="speak"||status.resolved)&&<>
        <div className={styles.instruction}>
        {activity.tone===5&&activity.previousTone?<ToneSequence tones={[activity.previousTone,5]}/>:activity.spokenTones?<ToneSequence tones={activity.spokenTones}/>:activity.tone&&<div className="mt-4 flex justify-center"><ToneContour tone={activity.tone} previousTone={activity.previousTone} connectedSpeech={activity.tone===3?true:undefined}/></div>}
        {status.resolved&&activity.options&&<div role="status" className="rounded-2xl bg-[var(--lingo-sky-pale)] px-4 py-3 text-center text-sm text-[var(--lingo-navy)]"><strong>{status.errors===2?"Answer revealed":status.firstCorrect?"Great listening and reasoning!":"You got it!"}: {activity.options[activity.answer!]}</strong><p className="mt-1">{activity.explanation}</p></div>}
        {!activity.options&&<p className="text-center text-sm leading-relaxed text-[var(--lingo-text)]">{activity.explanation}</p>}
        </div>
        {activity.chunks&&<details className="mt-2"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold text-[var(--lingo-teal)]">Listen in small chunks</summary><div className="flex flex-wrap gap-3 pb-3">{activity.chunks.map(chunk=><div key={chunk} className="flex max-w-full flex-wrap items-center gap-2 rounded-xl bg-[var(--lingo-sky-pale)] px-3 py-2"><span lang="zh-CN" className="text-sm">{chunk}</span><SpeakerWithSpeed text={chunk} type="sentence" size="sm"/></div>)}</div></details>}
        <div className={styles.response} data-rule={activity.kind==="rule"?"true":undefined} data-compact={activity.kind!=="rule"&&(!result||retrying)&&!recordError?"true":undefined}>
        {activity.kind!=="rule"&&<div data-recording={(!result||retrying)&&!recordError?"true":undefined} className={styles.recording}><h2 hidden={!!result&&!retrying} className="mb-4 text-sm font-bold text-[var(--lingo-navy)]">Now try saying it</h2>
          {result&&!retrying?<PronunciationFeedback layout="lesson" disabled={saving} result={result} recordedAudioUrl={recordedUrl??undefined} mode={activity.kind==="speak"?"sentence":"word"} onRetry={()=>{setRetrying(true);setRecordError(null);}} onContinue={()=>void complete(false)} continueLabel={saving?"Saving…":"Continue"}/>:<RecordButton compact key={activity.id} sessionId="tone-course" courseActivityId={activity.id} unitType={activity.kind==="speak"?"sentence":"word"} targetText={activity.text} targetPinyin={spokenPinyin(activity)} maxDuration={activity.kind==="speak"?45:12} disabled={saving} onBusyChange={setRecordingBusy} onScored={value=>void onScored(value)} onError={setRecordError} onRecorded={blob=>{if(audioUrl.current)URL.revokeObjectURL(audioUrl.current);audioUrl.current=URL.createObjectURL(blob);setRecordedUrl(audioUrl.current);stopTextToSpeech();}} retryBlob={retryBlob} onRetryConsumed={()=>setRetryBlob(null)}/>}
          {recordError&&<div role="alert" className="mt-4 text-sm text-red-700"><p>{recordError.message}</p>{recordError.kind==="network"&&recordError.audioBlob&&<button className="mt-2 underline" onClick={()=>setRetryBlob(recordError.audioBlob!)}>Retry checking this recording</button>}<p className="mt-2 text-[var(--lingo-text-muted)]">You can try again or continue without speaking. An unavailable recording is not counted as a successful pronunciation attempt.</p></div>}
        </div>}
        {activity.kind==="rule"?<Button className="mt-6 w-full" disabled={saving} onClick={()=>void complete()}>Continue</Button>:(!result||retrying)&&<button type="button" disabled={saving||recordingBusy} onClick={()=>void complete(true)} className="mt-6 min-h-11 w-full rounded-xl px-4 py-2 text-sm font-semibold text-[var(--lingo-text-muted)] underline disabled:opacity-50">Continue without speaking</button>}
        </div>
      </>}
    </Card>}
    {activity && <p role="status" className="mt-3 text-center text-xs text-[var(--lingo-text-muted)]">{saving ? "Saving progress…" : "Your progress is saved after each answer."}</p>}
    <div className="mt-5">
    <details className="mt-2 text-sm text-[var(--lingo-text-muted)]"><summary className="min-h-11 cursor-pointer py-3 font-semibold">About this lesson</summary><p className="pb-3 leading-relaxed">{unit.description}</p></details>
    {unitId==="hear-and-say"&&index===0&&<details className="mb-3 rounded-2xl bg-[var(--lingo-sky-pale)] px-4 text-sm text-[var(--lingo-navy)]"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Example: hear the tones in 妈妈</summary><aside aria-label="Worked listening example" className="pb-4">
      <h2 className="font-bold">An example before you start</h2>
      <p className="mt-2">妈妈 (māma) means Mom. Listen: the first syllable is high and steady, and the second is short and light. The answer is First + Neutral.</p>
      <div className="mt-3 flex justify-center"><SpeakerWithSpeed text="妈妈" type="word" size="md"/></div>
      <ToneSequence tones={[1,5]}/>
      <p className="mt-2">After each answer, try saying the word too. Keep its two tone shapes together. You can replay the model, listen back to your recording, and try again.</p>
    </aside></details>}
    {unitId==="tone-changes"&&index>=6&&<details className="mb-3 rounded-2xl bg-[var(--lingo-sky-pale)] px-4 text-sm text-[var(--lingo-navy)]"><summary className="min-h-11 cursor-pointer py-3 font-semibold">Quick recap — check the next tone</summary><aside aria-label="Tone rules recap"><ul className="list-disc space-y-2 pb-4 pl-5">{TONE_RULE_RECAP.map(rule=><li key={rule}>{rule}</li>)}</ul></aside></details>}
    </div>
  </div>;
}

export default function ToneLessonRoute(){const params=useParams();return <ToneLessonPage key={String(params?.unitId)} unitId={String(params?.unitId)}/>;}
