"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LearnIsland, LearnWord } from "@/components/app/LearnSequence/types";

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
  const [imgError, setImgError] = useState(false);

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
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
          {!imgError ? (
            <img
              src="/capybara-face.png"
              alt="华华"
              className="h-12 w-12 object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-3xl" aria-hidden>
              🦫
            </span>
          )}
        </div>

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
