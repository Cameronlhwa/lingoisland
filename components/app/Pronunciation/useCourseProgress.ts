"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {ScoreResult} from "./RecordButton";
import {weakSyllablesFromCharacters} from "@/lib/pronunciation/isolateTarget";
import {initialCourseProgress,type CourseAction,type CourseProgress} from "@/lib/pronunciation/course/progress";
export function useCourseProgress() {
  const [progress,setProgress]=useState<CourseProgress>(initialCourseProgress);
  const [results,setResults]=useState<Record<string,ScoreResult>>({});
  const revision=useRef(0);const inFlight=useRef(false);
  const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState<string|null>(null);
  const reload=useCallback(async()=>{setLoading(true);setError(null);try{
    const response=await fetch("/api/pronunciation/course/progress",{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error);
    revision.current=data.revision;setProgress(data.progress);
    const scores:Record<string,ScoreResult>={};
    for(const row of data.attempts??[])scores[row.activity_id]={attemptId:row.id,overallScore:row.overall_score,characters:row.score?.characters??[],weakSyllables:weakSyllablesFromCharacters(row.score?.characters??[])};
    setResults(scores);
  }catch(cause){setError(cause instanceof Error?cause.message:"Could not load the course.");}finally{setLoading(false);}},[]);
  useEffect(()=>{void reload();},[reload]);
  const act=useCallback(async(action:CourseAction)=>{
    if(inFlight.current)return null;inFlight.current=true;setSaving(true);setError(null);
    try{const response=await fetch("/api/pronunciation/course/progress",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:revision.current,action})});const data=await response.json();if(!response.ok)throw new Error(data.error);revision.current=data.revision;setProgress(data.progress);return data.progress as CourseProgress;}
    catch(cause){setError(cause instanceof Error?cause.message:"Could not save this lesson. Please retry.");return null;}finally{inFlight.current=false;setSaving(false);}
  },[]);
  return {progress,results,setResults,loading,saving,error,reload,act};
}
