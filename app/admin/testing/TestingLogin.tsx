"use client";
import {useState,useEffect,type FormEvent} from "react";
import {TESTING_EMAIL} from "@/lib/testing/config";
import {Shell,StepFrame,PrimaryButton,CARD_BORDER,MUTED} from "@/components/Onboarding/personalized/ui";
export default function TestingLogin(){
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const [email,setEmail]=useState(TESTING_EMAIL),[password,setPassword]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError("");try{const res=await fetch("/api/admin/testing-session",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});const data=await res.json();if(!res.ok){setError(data.error??"Could not sign in. Try again.");return;}window.location.reload();}catch{setError("Could not sign in. Check your connection and try again.");}finally{setBusy(false);}}
 return <Shell><StepFrame title="LingoIsland testing" subtitle="Sign in to preview and repeat the new onboarding flow." onBack={null}>
 <form onSubmit={submit} className="space-y-4"><label className="block text-sm font-semibold">Email<input className="mt-2 block w-full rounded-xl border px-4 py-3" style={{borderColor:CARD_BORDER}} type="email" disabled={!ready} autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
 <label className="block text-sm font-semibold">Password<input className="mt-2 block w-full rounded-xl border px-4 py-3" style={{borderColor:CARD_BORDER}} type="password" disabled={!ready} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
 {error&&<p role="alert" style={{color:"#A64231"}}>{error}</p>}<PrimaryButton type="submit" disabled={busy||!ready}>{busy?"Signing in…":"Sign in"}</PrimaryButton></form>
 <p className="mt-4 text-center text-sm" style={{color:MUTED}}>Private testing access</p></StepFrame></Shell>;
}
