/**
 * Record in-page topic-island reviews (flashcards / drag-drop) for 华华 island progress.
 */
export async function recordTopicIslandQuizActivity(count: number): Promise<void> {
  if (count <= 0) return;

  const tzOffset = new Date().getTimezoneOffset();
  try {
    const response = await fetch("/api/quiz-activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count, tzOffset }),
    });
    const data = await response.json().catch(() => ({}));
    if (
      typeof data?.huahuaTotalReviews === "number" &&
      typeof data?.huahuaStage === "number"
    ) {
      window.dispatchEvent(
        new CustomEvent("huahua-progress-updated", {
          detail: {
            totalReviews: data.huahuaTotalReviews,
            stage: data.huahuaStage,
          },
        }),
      );
    }
  } catch {
    // Non-blocking — same as island page quiz flow.
  }
}
