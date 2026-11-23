import test from "node:test";
import assert from "node:assert/strict";
import { makeBudgetCourse } from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import { GOALS } from "../../lib/onboarding/personalized/goals";

const benefits = {
 heritage: ["传统让家人保持联系。", "Traditions keep families connected."],
 work: ["自由选择让工作安排更灵活。", "Freedom of choice makes work arrangements more flexible."],
 school: ["自己选择能提高学习兴趣。", "Making their own choices can increase students’ interest in learning."],
 travel: ["提前计划可以节省时间。", "Planning ahead can save time."],
 everyday: ["网上聊天让大家保持联系。", "Online chat helps people stay in touch."],
 other: ["手机应用让练习更方便。", "Mobile apps make practice more convenient."],
};
test("every topic and variant translates the benefit itself", () => {
 for (const goal of GOALS) for (const variant of [0, 1]) {
  const lesson = makeBudgetCourse(6, goal.key, variant);
  const benefit = lesson.curriculum!.cards.find(card => card.id === "however")!.examples[0];
  assert.deepEqual([benefit.hanzi, benefit.meaning], benefits[goal.key]);
 }
});
test("all 72 onboarding courses have translations without generic sentence placeholders", () => {
 for (const tier of [1,2,3,4,5,6] as const) for (const goal of GOALS) for (const variant of [0,1]) {
  const lesson = makeBudgetCourse(tier, goal.key, variant);
  const inspect = (value: unknown): void => {
   if (!value || typeof value !== "object") return;
   const item = value as Record<string, unknown>;
   if (typeof item.meaning === "string") {
    assert.ok(item.meaning.trim(), lesson.id);
    assert.doesNotMatch(item.meaning, /There is a benefit|first activity|this group’s perspective|Balance the needs and considerations|undefined/, lesson.id);
   }
   if (typeof item.translation === "string") assert.doesNotMatch(item.translation, /first activity|undefined/, lesson.id);
   Object.values(item).forEach(inspect);
  };
  inspect(lesson);
  if (tier === 5) {
   const reading = lesson.curriculum!.practices.find(p => p.kind === "reading")!;
   assert.ok(reading.kind === "reading");
   for (const target of lesson.targets) assert.ok(reading.reading.translation.includes(target.meaning), lesson.id);
  }
 }
});
