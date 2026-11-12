"use client";
import {useState} from "react";
import OnboardingPaywall from "@/components/Onboarding/OnboardingPaywall";
import {activationCopy} from "./PaywallStep";
import {planFor,type OnboardingState} from "@/lib/onboarding/personalized/flow";
export function PreviewPaywall({state}:{state:OnboardingState}){
 const [interval,setInterval]=useState<"monthly"|"yearly">("monthly"),[notice,setNotice]=useState<string|null>(null);
 const plan=planFor(state.answers);
 return <OnboardingPaywall fullPage topic={plan.journeyTopic} journeyTopic={plan.journeyTopic} islandLevel={plan.cefr} billingInterval={interval} onBillingIntervalChange={setInterval} activation={{...activationCopy(plan,state),onClose:()=>setNotice("Preview complete. Use Reset test run to start again."),onNotNow:()=>setNotice("Preview complete. Use Reset test run to start again.")}} onProceedCheckout={()=>setNotice("This is a private preview. No checkout or charge was created. Use Reset test run to try again.")} checkoutError={notice}/>;
}
