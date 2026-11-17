import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickDailyStoryIslands,
  pickDailyStoryWords,
} from "../../lib/stories/getOrCreateDailyStory";

const islands = [
  { id: "a", topic: "Airports" },
  { id: "b", topic: "Cafes" },
  { id: "c", topic: "Meetings" },
  { id: "d", topic: "Family" },
  { id: "e", topic: "Travel" },
];

describe("daily story island selection", () => {
  it("does not always lock onto the two islands with the most learned words", () => {
    const learned = new Map([
      ["a", 40],
      ["b", 35],
      ["c", 3],
      ["d", 2],
      ["e", 1],
    ]);

    const seen = new Set<string>();
    // Deterministic rotating "random" so we cover multiple outcomes.
    let n = 0;
    const random = () => {
      n += 1;
      return (n % 7) / 7;
    };

    for (let i = 0; i < 20; i++) {
      const picked = pickDailyStoryIslands({
        eligibleIslands: islands,
        learnedCountByIsland: learned,
        recentlyUsedIslandIds: [],
        islandCount: 2,
        random,
      });
      assert.equal(picked.length, 2);
      for (const island of picked) seen.add(island.id);
    }

    assert.ok(
      seen.size >= 3,
      `expected rotation across 3+ islands, got ${[...seen].join(",")}`,
    );
  });

  it("prefers islands that were not used in recent daily stories", () => {
    const learned = new Map([
      ["a", 10],
      ["b", 10],
      ["c", 10],
      ["d", 10],
    ]);
    const picked = pickDailyStoryIslands({
      eligibleIslands: islands.slice(0, 4),
      learnedCountByIsland: learned,
      recentlyUsedIslandIds: ["a", "b", "a", "b"],
      islandCount: 2,
      random: () => 0.1,
    });
    const ids = picked.map((island) => island.id);
    assert.deepEqual(ids.sort(), ["c", "d"]);
  });

  it("spreads target words across the selected islands", () => {
    const wordsByIsland = new Map([
      [
        "a",
        Array.from({ length: 10 }, (_, i) => ({
          id: `a${i}`,
          hanzi: `A${i}`,
          pinyin: "a",
          english: "a",
          island_id: "a",
          learned_at: `2026-11-${String(20 - i).padStart(2, "0")}T00:00:00Z`,
        })),
      ],
      [
        "b",
        Array.from({ length: 10 }, (_, i) => ({
          id: `b${i}`,
          hanzi: `B${i}`,
          pinyin: "b",
          english: "b",
          island_id: "b",
          learned_at: `2026-11-${String(20 - i).padStart(2, "0")}T00:00:00Z`,
        })),
      ],
    ]);

    const picked = pickDailyStoryWords({
      selectedIslands: [
        { id: "a", topic: "Airports" },
        { id: "b", topic: "Cafes" },
      ],
      wordsByIsland,
      targetCount: 8,
      random: () => 0,
    });

    assert.equal(picked.length, 8);
    const fromA = picked.filter((word) => word.island_id === "a").length;
    const fromB = picked.filter((word) => word.island_id === "b").length;
    assert.equal(fromA, 4);
    assert.equal(fromB, 4);
  });
});
