"use client";
import {useState,useEffect} from "react";
import {ArrowLeft,RotateCcw,LogOut,ArrowRight} from "lucide-react";
import PersonalizedOnboardingFlow from "@/components/Onboarding/personalized/PersonalizedOnboardingFlow";
import {PREVIEW_STORAGE_KEY} from "@/lib/testing/config";
import {Shell,StepFrame,PrimaryButton,SecondaryButton,GREEN,MUTED,CARD_BORDER} from "@/components/Onboarding/personalized/ui";
export default function TestingDashboard(){
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const [open,setOpen]=useState(false),[run,setRun]=useState(0),[error,setError]=useState("");
 function reset(){try{localStorage.removeItem(PREVIEW_STORAGE_KEY);setRun(n=>n+1);setOpen(true);setError("");}catch{setError("Could not reset this browser’s test progress.");}}
 async function signOut(){try{const response=await fetch("/api/admin/testing-session",{method:"DELETE"});if(!response.ok)throw new Error();window.location.reload();}catch{setError("Could not sign out. Try again.");}}
 return <><header className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-2 border-b bg-white px-4 py-2" style={{borderColor:CARD_BORDER}}>
 <button disabled={!ready} className="flex min-h-11 items-center gap-2 text-sm font-semibold" style={{color:GREEN}} onClick={()=>setOpen(false)}><ArrowLeft size={16}/>Testing</button>
 <div className="flex items-center gap-3"><span className="hidden text-xs sm:inline" style={{color:MUTED}}>Private preview</span><button disabled={!ready} className="flex min-h-11 items-center gap-2 text-sm font-semibold" style={{color:GREEN}} onClick={reset}><RotateCcw size={16}/>Reset test run</button><button disabled={!ready} className="flex min-h-11 items-center gap-2 text-sm" style={{color:MUTED}} onClick={()=>void signOut()}><LogOut size={16}/>Sign out</button></div></header>
 {error&&<p role="alert" className="p-3 text-center">{error}</p>}
 {open?<PersonalizedOnboardingFlow key={run} mode="public" preview/>:<Shell><StepFrame title="What would you like to test?" subtitle="Preview the latest flow as many times as you need." onBack={null}>
 <div className="rounded-2xl border p-5" style={{borderColor:CARD_BORDER}}><h2 className="text-xl font-bold">Onboarding flow</h2><p className="my-3 text-sm leading-relaxed" style={{color:MUTED}}>Try the new onboarding, including vocabulary checks, the first lesson, pronunciation feedback, and the mini chat.</p><PrimaryButton disabled={!ready} onClick={()=>setOpen(true)}>Open onboarding flow<ArrowRight size={17}/></PrimaryButton><SecondaryButton disabled={!ready} className="mt-2" onClick={reset}>Start from the beginning</SecondaryButton></div>
 <p className="mt-4 text-sm" style={{color:MUTED}}>Test progress is separate from normal onboarding. Reset clears only this preview.</p></StepFrame></Shell>}
 </>;
}
