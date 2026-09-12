/**
 * Record in-page topic-island reviews (flashcards / drag-drop) for 华华 island progress.
 */
export type TopicIslandQuizActivity = {
  todayCount: number;
  huahuaStage: number;
  didStageUpgrade: boolean;
};

export async function recordTopicIslandQuizActivity(
  count: number,
): Promise<TopicIslandQuizActivity | null> {
  if (count <= 0) return null;

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
    if (
      typeof data?.todayCount === "number" &&
      typeof data?.huahuaStage === "number"
    ) {
      return {
        todayCount: data.todayCount,
        huahuaStage: data.huahuaStage,
        didStageUpgrade: data.didStageUpgrade === true,
      };
    }
    return null;
  } catch {
    // Non-blocking — same as island page quiz flow.
    return null;
  }
}
