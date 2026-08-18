"use client";

import { useRouter } from "next/navigation";
import type { LearnIsland, LearnWord } from "@/components/app/LearnSequence/types";
import HuahuaAvatar from "@/components/app/HuahuaAvatar";

interface HuahuaChatCardProps {
  topic: string;
  island: LearnIsland;
  words: LearnWord[];
  onOpenDesktop: () => void;
}

export default function HuahuaChatCard({
  topic,
  island,
  onOpenDesktop,
}: HuahuaChatCardProps) {
  const router = useRouter();

  const handleClick = () => {
    const isMobile =
      typeof window !== "undefined" && window.innerWidth < 768;

    if (isMobile) {
      router.push(`/app/topic-islands/${island.id}/chat`);
    } else {
      onOpenDesktop();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
    >
      <div className="flex items-center gap-4">
        <HuahuaAvatar className="h-14 w-14" />

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-900">
            <span className="text-gray-900">华华</span> wants to talk to you!
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Practice talking about{" "}
            <span className="font-medium text-gray-900">{topic}</span> with 华华
            before your quiz.
          </p>
          <span className="mt-3 inline-block rounded-xl bg-[#121926] px-4 py-2 text-sm font-semibold text-white">
            Start chatting →
          </span>
        </div>
      </div>
    </button>
  );
}
