"use client";

import { useState } from "react";
import HuahuaOnboardingStyle from "@/components/sms/HuahuaOnboardingStyle";
import HuahuaSettings from "@/components/sms/HuahuaSettings";
import SmsPhoneSetup from "@/components/sms/SmsPhoneSetup";

export default function HuahuaHarness({ view }: { view: "settings" | "onboarding" }) {
  const [verified, setVerified] = useState(false);
  if (view === "onboarding") {
    return (
      <main className="mx-auto w-full max-w-md px-4 py-8">
        <h1 className="text-xl font-bold text-gray-900">
          {verified ? "You're all set to text 华华!" : "Want to practice Mandarin by text?"}
        </h1>
        <div className="mt-6">
          <SmsPhoneSetup source="onboarding" onVerified={() => setVerified(true)} />
          {verified ? <HuahuaOnboardingStyle /> : null}
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">Texting with 华华</h1>
      <HuahuaSettings />
    </main>
  );
}
