"use client";

import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import { useAnalytics } from "@/lib/posthog/client";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  "All",
  "Travel & getting around",
  "Everyday life",
  "Relationships & dating",
  "Work & office Mandarin",
  "School & student life",
  "Food & cooking",
  "Health & practical life",
  "Internet culture & modern life",
];

export function TopicsHubClient({ children }: { children: React.ReactNode }) {
  const [category, setCategory] = useState("All");
  const [topicInput, setTopicInput] = useState("");
  const { captureEvent } = useAnalytics();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const categoryMatch = category === "All" ? null : category;

  const filterSection = useCallback(
    (section: Element) => {
      const categoryAttr = section.getAttribute("data-topic-category");
      const matchCategory = !categoryMatch || categoryAttr === categoryMatch;
      (section as HTMLElement).style.display = matchCategory ? "" : "none";
    },
    [categoryMatch],
  );

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const sections = node.querySelectorAll("[data-topic-category]");
    sections.forEach(filterSection);
  }, [filterSection]);

  const handleTopicSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const topic = topicInput.trim();
      if (topic) {
        captureEvent("onboarding_start_from_topics", { topic });
      }
      const url = topic
        ? `/onboarding/journey?topic=${encodeURIComponent(topic)}`
        : "/onboarding/journey";
      router.push(url);
    },
    [topicInput, captureEvent, router],
  );

  const handleLinkClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a[data-topics-link]");
      if (!link) return;
      const topicName = link.textContent?.trim() ?? "";
      const source = link.getAttribute("data-source") ?? "hub";
      captureEvent("topic_click", {
        topic_name: topicName,
        source,
      });
    },
    [captureEvent],
  );

  return (
    <div ref={containerRef}>
      <form
        onSubmit={handleTopicSubmit}
        className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <p className="mb-3 text-sm font-medium text-gray-700">
          Already have a topic in mind? Type in below and get started!
        </p>
        <input
          type="text"
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          placeholder="e.g. ordering at a restaurant, small talk..."
          className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:outline-none"
          aria-label="Your topic"
        />
        <button
          type="submit"
          className="inline-flex items-center rounded-lg border-2 border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          Create your Topic Island →
        </button>
      </form>

      <div className="mb-8">
        <p className="mb-2 text-sm font-medium text-gray-700">
          Filter by category
        </p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                category === cat
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div onClickCapture={handleLinkClick}>{children}</div>
    </div>
  );
}
