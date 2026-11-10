// Server-only: asks DeepSeek for the playback and always returns something
// usable. Any failure (no key, timeout, bad JSON, a rule broken) falls back to
// the template, so onboarding never waits on or breaks because of the model.

import { planFor, type OnboardingAnswers } from "./flow";
import { INSIGHT_SYSTEM_PROMPT, insightFacts, insightKey, insightUserPrompt, modelInsightProblem, parseModelInsight, templateInsight } from "./insight";
import type { InsightAnswer } from "./insightTypes";

export const INSIGHT_TIMEOUT_MS = 4500;

type Fetcher = typeof fetch;

export async function generateInsight(
  answers: OnboardingAnswers,
  options: { apiKey?: string | null; fetcher?: Fetcher; timeoutMs?: number } = {},
): Promise<{ insight: InsightAnswer; reason: "ok" | "no_key" | "timeout" | "error" | "rejected"; problem?: string | null }> {
  const plan = planFor(answers);
  const fallback = templateInsight(answers, plan);
  const apiKey = options.apiKey === undefined ? process.env.DEEPSEEK_API_KEY?.trim() : options.apiKey;
  if (!apiKey) return { insight: fallback, reason: "no_key" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? INSIGHT_TIMEOUT_MS);
  try {
    const response = await (options.fetcher ?? fetch)("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: INSIGHT_SYSTEM_PROMPT },
          { role: "user", content: insightUserPrompt(insightFacts(answers, plan)) },
        ],
        temperature: 0.5,
        max_tokens: 400,
        // V4 Flash thinking shares max_tokens with content; see generate-journey.ts.
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) return { insight: fallback, reason: "error" };
    const data = (await response.json().catch(() => null)) as { choices?: { message?: { content?: unknown } }[] } | null;
    const content = data?.choices?.[0]?.message?.content;
    const parsed = parseModelInsight(content, insightKey(answers));
    return parsed ? { insight: parsed, reason: "ok" } : { insight: fallback, reason: "rejected", problem: modelInsightProblem(content) };
  } catch {
    return { insight: fallback, reason: controller.signal.aborted ? "timeout" : "error" };
  } finally {
    clearTimeout(timer);
  }
}
