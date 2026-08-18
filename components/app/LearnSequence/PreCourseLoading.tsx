"use client";

import HuahuaAvatar from "@/components/app/HuahuaAvatar";

interface PreCourseLoadingProps {
  topic: string;
  level: string;
  progressLabel: string;
  progressPercentage: number;
}

export default function PreCourseLoading({
  topic,
  level,
  progressLabel,
  progressPercentage,
}: PreCourseLoadingProps) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ background: "#D6EEF8" }}
    >
      <header className="border-b border-[#2176AE]/15 bg-[#D6EEF8]/95 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <p
            className="text-xs font-medium uppercase tracking-wider text-[#071E2E]/50"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Getting started
          </p>
          <p
            className="text-sm font-semibold text-[#071E2E]"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            Preparing your lesson
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-md rounded-2xl border border-[#C2DCF0] bg-white p-8 text-center shadow-sm"
          style={{ borderWidth: "0.5px" }}
        >
          <div className="mb-4 flex justify-center">
            <HuahuaAvatar className="h-14 w-14" />
          </div>
          <h1
            className="mb-2 text-xl font-semibold text-[#071E2E]"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            {topic}
          </h1>
          <p
            className="mb-6 text-sm text-[#5A7A90]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            Level {level}
          </p>

          <div className="mb-2 flex justify-between text-xs font-medium text-[#5A7A90]">
            <span>Building your island</span>
            <span>{progressLabel}</span>
          </div>
          <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-[#B8D8EC]/40">
            <div
              className="h-full rounded-full bg-[#2176AE] transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <p
            className="text-sm text-[#5A7A90]"
            style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            华华 is picking words and example sentences for you…
          </p>
        </div>
      </div>
    </div>
  );
}
