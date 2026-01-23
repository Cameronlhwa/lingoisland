"use client";

import StoryCard, { type StorySummary } from "./StoryCard";

export default function StoriesList({ stories }: { stories: StorySummary[] }) {
  if (stories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No stories yet. Create a custom story or generate today's story.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
    </div>
  );
}

