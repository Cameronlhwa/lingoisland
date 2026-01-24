"use client";

export default function FlashcardsCard({
  dueCount,
  onReview,
}: {
  dueCount?: number;
  onReview: () => void;
}) {
  const showDue = typeof dueCount === "number" && dueCount > 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Flashcards</h2>
          <p className="mt-1 text-sm text-gray-600">
            Quick review to lock words in.
          </p>
        </div>
        {showDue && (
          <div className="text-sm font-medium text-gray-700">
            Due today: {dueCount}
          </div>
        )}
        <button
          onClick={onReview}
          className="w-fit rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          Review
        </button>
      </div>
    </div>
  );
}

