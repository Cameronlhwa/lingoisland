import type { Metadata } from "next";
import HuahuaSettings from "@/components/sms/HuahuaSettings";

export const metadata: Metadata = { title: "Texting with 华华" };

export default function HuahuaPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 md:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Texting with 华华</h1>
        <p className="text-sm text-gray-600">
          Practice Mandarin by text with 华华, your practice partner. Choose how 华华 texts you, when, and how much help
          you get.
        </p>
      </header>
      <HuahuaSettings />
    </main>
  );
}
