"use client";

import Link from "next/link";
import { useAnalytics } from "@/lib/posthog/client";

export function TopicPageCTAs({
  topicName,
  slug,
}: {
  topicName: string;
  slug: string;
}) {
  const onboardingHref = `/onboarding/journey?topic=${encodeURIComponent(topicName)}`;
  const { captureEvent } = useAnalytics();

  const handleStartIsland = () => {
    captureEvent("topic_click", {
      topic_name: topicName,
      source: "topic_page",
      cta: "start_topic_island",
    });
  };

  const handleSecondary = () => {
    captureEvent("topic_click", {
      topic_name: topicName,
      source: "topic_page",
      cta: "level_tuned_vocab",
    });
  };

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm">
      <p className="mb-4 text-gray-700">
        Ready to learn this vocabulary with level-tuned sentences and a daily
        review loop? Start your Topic Island and we&apos;ll generate words and
        examples for you.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={onboardingHref}
          onClick={handleStartIsland}
          className="inline-flex justify-center rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-800"
        >
          Start this Topic Island
        </Link>
        <Link
          href={onboardingHref}
          onClick={handleSecondary}
          className="inline-flex justify-center rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-medium text-gray-900 transition-colors hover:bg-gray-50"
        >
          Get level-tuned vocab + a daily review loop
        </Link>
      </div>
    </div>
  );
}
