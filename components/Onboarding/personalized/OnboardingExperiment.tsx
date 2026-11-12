"use client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAnalytics } from "@/lib/posthog/client";
import { MINI_LESSON_ONBOARDING_FLAG, onboardingVariant, type OnboardingVariant } from "@/lib/onboarding/personalized/experiment";
const Context = createContext<OnboardingVariant>("control");
const PreviewContext = createContext(false);
export const useIsOnboardingPreview = () => useContext(PreviewContext);
export function OnboardingPreview({children}:{children:ReactNode}) {return <PreviewContext.Provider value={true}><Context.Provider value="test">{children}</Context.Provider></PreviewContext.Provider>;}
export const useOnboardingVariant = () => useContext(Context);
/** Resolve before mounting the questionnaire, then hold steady through identification and flag reloads. */
export function OnboardingExperiment({children}:{children:ReactNode}) {
  const {posthog} = useAnalytics();
  const [variant,setVariant] = useState<OnboardingVariant | null>(null);
  const locked = useRef(false);
  useEffect(() => {
    const unsubscribe = posthog?.onFeatureFlags((_keys, values, context) => {
      if (locked.current) return;
      const flag = context?.errorsLoading ? undefined : values[MINI_LESSON_ONBOARDING_FLAG];
      locked.current = true;
      // Use the loaded response rather than a possibly stale cached assignment.
      // Record exposure only for the assignment actually rendered.
      if (flag !== undefined) posthog.getFeatureFlag(MINI_LESSON_ONBOARDING_FLAG);
      setVariant(onboardingVariant(flag));
    });
    const timer = setTimeout(() => {
      if (!locked.current) {locked.current = true;setVariant("control");}
    },2500);
    return () => {clearTimeout(timer);if(typeof unsubscribe === "function")unsubscribe();};
  },[posthog]);
  if (variant === null) return <div className="flex min-h-screen items-center justify-center" style={{background:"#EAF6FB",color:"#4F6E83"}} role="status">Loading your plan…</div>;
  return <Context.Provider value={variant}>{children}</Context.Provider>;
}
