/**
 * Generates the themed *unit roadmap* for an HSK curriculum ("My HSK Path").
 *
 * Interest tags and Foundations slots are assigned in code before this call.
 * DeepSeek only writes titles / Chinese names / themes for those fixed slots.
 */

import type { HskMotivation } from "@/lib/deepseek/generate-hsk-journey";
import type { CurriculumSlot } from "@/lib/hsk/unitSlots";
import { FOUNDATIONS_INTEREST_TAG } from "@/lib/hsk/pathStandard";

export interface HskCurriculumUnitSketch {
  unit_number: number;
  title: string;
  title_zh: string;
  theme: string;
  interest_tag: string;
  kind: "themed" | "foundations";
}

const MOTIVATION_LABEL: Record<HskMotivation, string> = {
  school: "school / academic interests",
  job: "work / career",
  heritage: "family and cultural heritage",
  hobby: "a personal hobby or interest",
};

export async function generateHskCurriculum({
  milestoneLevel,
  slots,
  interests,
  motivation,
  personalizationText,
}: {
  milestoneLevel: number;
  slots: CurriculumSlot[];
  interests: string[];
  motivation: HskMotivation;
  personalizationText: string;
}): Promise<HskCurriculumUnitSketch[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const levelLabel = `HSK ${milestoneLevel}`;
  const interestList =
    interests.length > 0 ? interests.join(", ") : "general everyday life";

  const slotLines = slots
    .map((s) => {
      if (s.kind === "foundations") {
        return `${s.unit_number}. FOUNDATIONS — connectors, particles, measure words, abstract/formal vocab. Do not theme the unit title around a hobby. interest_tag must be exactly "${FOUNDATIONS_INTEREST_TAG}".`;
      }
      return `${s.unit_number}. THEMED — interest_tag must be exactly "${s.interest_tag}".`;
    })
    .join("\n");

  const prompt = `You are a Mandarin curriculum designer building a personalized ${levelLabel} vocabulary path.

The learner's motivation: ${MOTIVATION_LABEL[motivation]}
Their interests: ${interestList}
In their own words: "${personalizationText}"

You must produce exactly ${slots.length} sequential units. Interest tags and Foundations slots are ALREADY ASSIGNED — do not change them, do not invent other tags, do not reorder.

Slots:
${slotLines}

Each themed unit will later be filled with ~32 official ${levelLabel} words that match its interest_tag, plus a couple of functional/connector words. Foundations units pull primarily functional/connector vocabulary. Themes must be broad enough to carry ~45 words.

For each unit return:
- "unit_number": the number from the slot list
- "title": short English label, island-topic style (e.g. "Meeting Your Roommate", "Ordering at a Restaurant"). Foundations titles should sound like grammar/function workshops (e.g. "Making Contrasts", "Counting and Measuring"), not a hobby scene.
- "title_zh": a natural Chinese name for the unit
- "theme": ONE sentence describing the scenario/context. For Foundations, describe the language function. For themed units, ground the scene in that slot's interest AND the learner's own words.
- "interest_tag": copy the assigned tag from the slot list verbatim

RULES:
- Units get progressively broader / more demanding within each kind.
- title must be English; title_zh must be Chinese.
- Never retag a slot. Never skip a slot.

Respond in this exact JSON format:
{
  "units": [
    { "unit_number": 1, "title": "...", "title_zh": "...", "theme": "...", "interest_tag": "..." }
  ]
}`;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that outputs only valid JSON for Chinese learning curricula. No markdown fences.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 3500,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const finish = data.choices?.[0]?.finish_reason;
    throw new Error(
      `No content in DeepSeek curriculum response (finish_reason=${finish}, usage=${JSON.stringify(data.usage)})`,
    );
  }

  let jsonContent = String(content).trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "");
  }

  let parsed: { units?: unknown };
  try {
    parsed = JSON.parse(jsonContent);
  } catch (e) {
    throw new Error(
      `Failed to parse HSK curriculum JSON: ${e}. Snippet: ${jsonContent.slice(0, 240)}`,
    );
  }

  const byNumber = new Map<number, { title: string; title_zh: string; theme: string }>();
  const rawUnits = Array.isArray(parsed.units) ? parsed.units : [];
  for (const raw of rawUnits as any[]) {
    const title = String(raw?.title ?? "").trim();
    if (!title) continue;
    const num = Number(raw?.unit_number);
    if (!Number.isFinite(num)) continue;
    byNumber.set(num, {
      title,
      title_zh: String(raw?.title_zh ?? "").trim(),
      theme: String(raw?.theme ?? "").trim(),
    });
  }

  const units: HskCurriculumUnitSketch[] = slots.map((slot) => {
    const generated = byNumber.get(slot.unit_number);
    const fallbackTitle =
      slot.kind === "foundations"
        ? `Foundations ${slot.unit_number}`
        : slot.interest_tag;
    return {
      unit_number: slot.unit_number,
      title: generated?.title || fallbackTitle,
      title_zh: generated?.title_zh || "",
      theme: generated?.theme || "",
      interest_tag: slot.interest_tag,
      kind: slot.kind,
    };
  });

  if (units.length === 0) {
    throw new Error("HSK curriculum generation returned no usable units");
  }

  return units;
}

export type { CurriculumSlot };
