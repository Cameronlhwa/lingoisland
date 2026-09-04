/**
 * Given a curriculum unit's assigned official HSK words plus its theme, produce
 * the unit's 5-island / 2-story structure: distribute the HSK words across the
 * islands, add themed supporting ("filler") vocab, name each island, and sketch
 * the two story checkpoints.
 *
 * The HSK words are fixed input — the model must place every one of them and may
 * not invent Chinese for them. Supporting words ARE invented by the model
 * (level-appropriate, on-theme, not necessarily on any HSK list).
 *
 * Same DeepSeek stack as the other generators.
 */

export interface HskUnitIslandPlan {
  position: number; // 1..5
  name: string; // English island name
  zh: string; // Chinese island name
  hskHanzi: string[]; // subset of the input HSK words assigned here
  filler: { hanzi: string; pinyin: string; english: string }[];
}

export interface HskUnitStoryPlan {
  afterIsland: 2 | 5;
  title: string;
  hint: string;
}

export interface HskUnitIslandsResult {
  islands: HskUnitIslandPlan[];
  stories: HskUnitStoryPlan[];
}

// island 1 = 5 words (4 HSK + 1 filler), islands 2-5 = 10 words (7 HSK + 3 filler)
const HSK_PER_ISLAND = [4, 7, 7, 7, 7];
const FILLER_PER_ISLAND = [1, 3, 3, 3, 3];

export async function generateHskUnitIslands({
  unitTitle,
  theme,
  interestTag,
  milestoneLevel,
  hskWords,
  foundations = false,
  personalizationText = "",
  userInterests = [],
}: {
  unitTitle: string;
  theme: string;
  interestTag: string;
  milestoneLevel: number;
  hskWords: { hanzi: string; pinyin: string; english: string | null }[];
  foundations?: boolean;
  personalizationText?: string;
  userInterests?: string[];
}): Promise<HskUnitIslandsResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const levelLabel = milestoneLevel === 7 ? "HSK 7-9" : `HSK ${milestoneLevel}`;
  const wordLines = hskWords
    .map((w, i) => `${i + 1}. ${w.hanzi} (${w.pinyin}) — ${w.english ?? ""}`)
    .join("\n");

  const interestNote = foundations
    ? `This is a FOUNDATIONS unit (connectors, particles, measure words, abstract/formal vocab). Island names should describe language functions, not a hobby scene. Individual supporting words and story hints may still lightly reference the learner's interests (${userInterests.join(", ") || "everyday life"}) and their own words ("${personalizationText}") when that does not feel forced.`
    : `Learner interest this unit leans on: ${interestTag}
In their own words: "${personalizationText}"
The official words below were already filtered toward this interest. Island names and filler vocab should stay on that theme.`;

  const prompt = `You are a Mandarin curriculum designer building one unit of a ${levelLabel} learning path.

Unit: "${unitTitle}"
Theme: ${theme}
${interestNote}

Below are ${hskWords.length} official ${levelLabel} words that MUST all be taught in this unit.
Do not change their Chinese; place every single one into exactly one island.

${wordLines}

Build 5 progressively harder islands and 2 story checkpoints:
- Island 1: exactly ${HSK_PER_ISLAND[0]} of the HSK words + ${FILLER_PER_ISLAND[0]} supporting word.
- Islands 2-5: exactly 7 of the HSK words + 3 supporting words each.
- Supporting ("filler") words are yours to choose: level-appropriate, on-theme, useful, and
  NOT duplicates of the HSK words above. Give hanzi + pinyin + concise English for each.
- Every HSK word above must appear in exactly one island's "hskHanzi" list; the counts must match.
- Each island needs an English "name" and a Chinese "zh" name.
- Story checkpoint after island 2 and after island 5: short "title" + one-line "hint".

Respond in this exact JSON format:
{
  "islands": [
    { "position": 1, "name": "...", "zh": "...", "hskHanzi": ["...", "..."], "filler": [{ "hanzi": "...", "pinyin": "...", "english": "..." }] }
  ],
  "stories": [
    { "afterIsland": 2, "title": "...", "hint": "..." },
    { "afterIsland": 5, "title": "...", "hint": "..." }
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
      temperature: 0.4,
      max_tokens: 4000,
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
      `No content in DeepSeek unit-islands response (finish_reason=${finish}, usage=${JSON.stringify(data.usage)})`,
    );
  }

  let jsonContent = String(content).trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "");
  }

  let parsed: { islands?: unknown; stories?: unknown };
  try {
    parsed = JSON.parse(jsonContent);
  } catch (e) {
    throw new Error(
      `Failed to parse HSK unit-islands JSON: ${e}. Snippet: ${jsonContent.slice(0, 240)}`,
    );
  }

  const validHanzi = new Set(hskWords.map((w) => w.hanzi));
  const rawIslands = Array.isArray(parsed.islands) ? parsed.islands : [];

  const islands: HskUnitIslandPlan[] = rawIslands
    .map((raw: any, idx: number): HskUnitIslandPlan => ({
      position: Number(raw?.position ?? idx + 1),
      name: String(raw?.name ?? `Island ${idx + 1}`).trim(),
      zh: String(raw?.zh ?? "").trim(),
      hskHanzi: (Array.isArray(raw?.hskHanzi) ? raw.hskHanzi : [])
        .map((h: unknown) => String(h).trim())
        .filter((h: string) => validHanzi.has(h)),
      filler: (Array.isArray(raw?.filler) ? raw.filler : [])
        .map((f: any) => ({
          hanzi: String(f?.hanzi ?? "").trim(),
          pinyin: String(f?.pinyin ?? "").trim(),
          english: String(f?.english ?? "").trim(),
        }))
        .filter((f: { hanzi: string }) => f.hanzi.length > 0 && !validHanzi.has(f.hanzi)),
    }))
    .sort((a, b) => a.position - b.position)
    .slice(0, 5)
    .map((island, idx) => ({ ...island, position: idx + 1 }));

  if (islands.length !== 5) {
    throw new Error(`HSK unit must produce exactly 5 islands (got ${islands.length})`);
  }

  // Ensure every assigned HSK word landed somewhere; sweep any strays into the
  // last island so nothing is silently dropped.
  const placed = new Set(islands.flatMap((i) => i.hskHanzi));
  const missing = hskWords.map((w) => w.hanzi).filter((h) => !placed.has(h));
  if (missing.length > 0) {
    islands[islands.length - 1].hskHanzi.push(...missing);
  }

  const rawStories = Array.isArray(parsed.stories) ? parsed.stories : [];
  const stories: HskUnitStoryPlan[] = rawStories
    .map((raw: any): HskUnitStoryPlan | null => {
      const afterIsland = Number(raw?.afterIsland);
      if (afterIsland !== 2 && afterIsland !== 5) return null;
      const title = String(raw?.title ?? "").trim();
      const hint = String(raw?.hint ?? "").trim();
      if (!title) return null;
      return { afterIsland: afterIsland as 2 | 5, title, hint };
    })
    .filter((s): s is HskUnitStoryPlan => s !== null);

  if (!stories.some((s) => s.afterIsland === 2)) {
    stories.push({ afterIsland: 2, title: `${unitTitle} — checkpoint`, hint: "Uses words from islands 1-2" });
  }
  if (!stories.some((s) => s.afterIsland === 5)) {
    stories.push({ afterIsland: 5, title: `${unitTitle} — finale`, hint: "Reviews every word in this unit" });
  }
  stories.sort((a, b) => a.afterIsland - b.afterIsland);

  return { islands, stories: stories.slice(0, 2) };
}
