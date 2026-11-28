"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAnalytics } from "@/lib/posthog/client";
import { MINI_LESSON_ONBOARDING_FLAG, FIRST_LEVEL_TEST_FLAG, onboardingVariant, firstLevelVariant, type OnboardingVariant, type FirstLevelVariant } from "@/lib/onboarding/personalized/experiment";
const Context = createContext<OnboardingVariant>("control");
const FirstLevelContext = createContext<FirstLevelVariant>("control");
const PreviewContext = createContext(false);
export const useIsOnboardingPreview = () => useContext(PreviewContext);
export const useOnboardingVariant = () => useContext(Context);
export const useFirstLevelVariant = () => useContext(FirstLevelContext);
export function OnboardingPreview({children,firstLevel="control"}:{children:ReactNode;firstLevel?:FirstLevelVariant}) {
 return <PreviewContext.Provider value={true}><Context.Provider value="test"><FirstLevelContext.Provider value={firstLevel}>{children}</FirstLevelContext.Provider></Context.Provider></PreviewContext.Provider>;
}
/** Resolve both independent flags before mounting; lock through identification and reloads. */
export function OnboardingExperiment({children}:{children:ReactNode}) {
 const {posthog}=useAnalytics();
 const [assignment,setAssignment]=useState<{onboarding:OnboardingVariant;firstLevel:FirstLevelVariant}|null>(null);
 const locked=useRef(false);
 useEffect(()=>{
  const unsubscribe=posthog?.onFeatureFlags((_keys,values,context)=>{
   if(locked.current)return;
   const mini=context?.errorsLoading?undefined:values[MINI_LESSON_ONBOARDING_FLAG];
   const first=context?.errorsLoading?undefined:values[FIRST_LEVEL_TEST_FLAG];
   locked.current=true;
   // The flow captures exposure only after choosing its persisted assignment.
   if(mini!==undefined)posthog.getFeatureFlag(MINI_LESSON_ONBOARDING_FLAG);
   setAssignment({onboarding:onboardingVariant(mini),firstLevel:firstLevelVariant(first)});
  });
  const timer=setTimeout(()=>{if(!locked.current){locked.current=true;setAssignment({onboarding:"control",firstLevel:"control"});}},2500);
  return ()=>{clearTimeout(timer);if(typeof unsubscribe==="function")unsubscribe();};
 },[posthog]);
 if(!assignment)return <div className="flex min-h-screen items-center justify-center" style={{background:"#fffaf3",color:"#4F6E83"}} role="status">Loading your plan…</div>;
 return <Context.Provider value={assignment.onboarding}><FirstLevelContext.Provider value={assignment.firstLevel}>{children}</FirstLevelContext.Provider></Context.Provider>;
}
