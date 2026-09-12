export const REQUIRED_SENTENCE_TIERS = ["easy", "same", "hard"] as const;

type IslandWordRow = {
  id: string;
};

type IslandSentenceRow = {
  word_id: string;
  tier: string;
};

/**
 * An island is learn-ready only when every saved word has all of its sentence
 * tiers. This intentionally derives readiness from persisted rows rather than
 * from optimistic generation progress counters.
 */
export function getIslandReadiness(
  words: IslandWordRow[],
  sentences: IslandSentenceRow[],
  wordTarget: number,
) {
  const tiersByWord = new Map<string, Set<string>>();
  for (const sentence of sentences) {
    const tiers = tiersByWord.get(sentence.word_id) ?? new Set<string>();
    tiers.add(sentence.tier);
    tiersByWord.set(sentence.word_id, tiers);
  }

  const incompleteWordIds = words
    .filter((word) => {
      const tiers = tiersByWord.get(word.id) ?? new Set<string>();
      return REQUIRED_SENTENCE_TIERS.some((tier) => !tiers.has(tier));
    })
    .map((word) => word.id);

  const requiredSentenceCount = wordTarget * REQUIRED_SENTENCE_TIERS.length;
  const completedSentenceCount = words.reduce((count, word) => {
    const tiers = tiersByWord.get(word.id) ?? new Set<string>();
    return count + REQUIRED_SENTENCE_TIERS.filter((tier) => tiers.has(tier)).length;
  }, 0);

  return {
    learnReady:
      words.length >= wordTarget &&
      incompleteWordIds.length === 0 &&
      completedSentenceCount >= requiredSentenceCount,
    incompleteWordIds,
    completedSentenceCount,
    requiredSentenceCount,
  };
}
