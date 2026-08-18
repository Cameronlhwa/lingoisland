import {
  isBeginnerLearnLevel,
  resolveLearnLevel,
  useExerciseChatForIsland,
} from "../components/app/LearnSequence/levels";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

assert(isBeginnerLearnLevel("A0"), "A0 is beginner");
assert(isBeginnerLearnLevel("A1"), "A1 is beginner");
assert(isBeginnerLearnLevel("A2"), "A2 is beginner");
assert(isBeginnerLearnLevel("A1-"), "A1- is beginner");
assert(!isBeginnerLearnLevel("B1"), "B1 is not beginner");

assert(resolveLearnLevel("A1", "B1") === "A1", "island A1 wins");
assert(resolveLearnLevel("B1", "A1") === "A1", "profile A1 fallback");
assert(resolveLearnLevel("B1", "B1") === "B1", "both B1 stays B1");
assert(
  isBeginnerLearnLevel(resolveLearnLevel("B1", "A1")),
  "B1 island + A1 profile → easier sentence tier",
);
assert(
  !useExerciseChatForIsland("B1"),
  "B1 island uses typed chat regardless of profile",
);
assert(
  useExerciseChatForIsland("A2"),
  "A2 island uses exercise chat",
);
assert(
  useExerciseChatForIsland("A0"),
  "A0 island uses exercise chat",
);

console.log("\nAll learn-level checks passed.");
