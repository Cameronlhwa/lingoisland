type SentenceBuild = {
  chunks: ReadonlyArray<{ id: string; label: string }>;
  order: readonly string[];
};

/** Identical visible tiles are interchangeable; each actual tile can be used once. */
export function isCorrectBuildAnswer(prompt: SentenceBuild, answer: unknown): boolean {
  if (!Array.isArray(answer) || answer.length !== prompt.order.length
    || !answer.every((id): id is string => typeof id === "string")
    || new Set(answer).size !== answer.length
    || new Set(prompt.order).size !== prompt.order.length) return false;

  const labels = new Map(prompt.chunks.map(chunk => [chunk.id, chunk.label]));
  if (labels.size !== prompt.chunks.length) return false;
  const expectedIds = new Set(prompt.order);
  return answer.every((id, index) => expectedIds.has(id)
    && labels.has(id) && labels.has(prompt.order[index])
    && labels.get(id) === labels.get(prompt.order[index]));
}
