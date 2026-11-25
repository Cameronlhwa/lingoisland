"use client";
import { useEffect, useState } from "react";
import JourneyLessonPlayer, { type LessonSnapshot } from "@/components/journey/teaching/JourneyLessonPlayer";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CharacterSetProvider } from "@/contexts/CharacterSetContext";
export default function JourneyTeachingHarness() {
 const [snapshot,setSnapshot] = useState<LessonSnapshot|null>(null);
 const [done,setDone] = useState("");
 useEffect(()=>{void fetch("/api/journey-teaching-fixture").then(r=>r.json()).then(setSnapshot);},[]);
 if(done)return <p>{done}</p>;
 return <LanguageProvider><CharacterSetProvider>{snapshot && <JourneyLessonPlayer islandId="island" initial={snapshot} onExit={()=>setDone("Saved and exited")} onComplete={()=>setDone("Lesson finished")} />}</CharacterSetProvider></LanguageProvider>;
}
