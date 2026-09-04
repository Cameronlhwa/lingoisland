/**
 * One-time HSK 2.0 word tagging + optional extra decoys.
 *
 *   npx tsx scripts/tagHskWords.ts --sample          # classify ~20 words, print only
 *   npx tsx scripts/tagHskWords.ts --sample --write  # write that sample
 *   npx tsx scripts/tagHskWords.ts --full --write    # all 2.0 words (ask Cameron first)
 *   npx tsx scripts/tagHskWords.ts --decoys          # print 30 decoy candidates
 *
 * Uses ANTHROPIC_API_KEY if set, otherwise DEEPSEEK_API_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const INTERESTS = [
  "Food & cooking",
  "Film & TV / C-dramas",
  "Music",
  "Travel",
  "Business & career",
  "Technology",
  "Sports & fitness",
  "History & culture",
  "Gaming",
  "Art & design",
  "Science & nature",
  "News & current events",
  "Health & wellness",
  "Relationships & family",
] as const;

type Word = {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string | null;
  level: number;
  part_of_speech: string | null;
};

type TagResult = {
  hanzi: string;
  interest_tags: string[];
  is_functional: boolean;
};

const SAMPLE_PER_LEVEL = 4; // 4 × 6 = 24, we'll print ~20
const CHUNK = 25;

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function classifyChunk(words: Word[]): Promise<TagResult[]> {
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim();
  const lines = words
    .map(
      (w, i) =>
        `${i + 1}. ${w.hanzi} (${w.pinyin}) — ${w.english ?? ""} [${w.part_of_speech ?? "?"}, HSK ${w.level}]`,
    )
    .join("\n");

  const prompt = `Classify each official HSK 2.0 Chinese word.

Allowed interest_tags (0–3, verbatim or empty):
${INTERESTS.join(", ")}

is_functional = true for connectors, grammar particles, measure words, and abstract/formal vocabulary that does not naturally belong to a theme (虽然, 之所以, 大约, 尽管, 的, 了, 把, 被, 个, etc.).
A word may have tags AND be functional. Most functional words have zero tags.

Words:
${lines}

Respond with JSON only:
{ "words": [ { "hanzi": "...", "interest_tags": [], "is_functional": false } ] }`;

  if (anthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropic,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text = data.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "";
    return parseTagJson(text, words);
  }

  if (!deepseek) {
    throw new Error("Set ANTHROPIC_API_KEY or DEEPSEEK_API_KEY");
  }

  const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deepseek}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        { role: "system", content: "Output only valid JSON. No markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2500,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return parseTagJson(data.choices?.[0]?.message?.content ?? "", words);
}

function parseTagJson(raw: string, fallback: Word[]): TagResult[] {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "");
  }
  const parsed = JSON.parse(text) as { words?: unknown };
  const rows = Array.isArray(parsed.words) ? parsed.words : [];
  const byHanzi = new Map<string, TagResult>();
  for (const rawRow of rows as any[]) {
    const hanzi = String(rawRow?.hanzi ?? "").trim();
    if (!hanzi) continue;
    const tags = (Array.isArray(rawRow?.interest_tags) ? rawRow.interest_tags : [])
      .map((t: unknown) => String(t).trim())
      .filter((t: string) => (INTERESTS as readonly string[]).includes(t))
      .slice(0, 3);
    byHanzi.set(hanzi, {
      hanzi,
      interest_tags: tags,
      is_functional: Boolean(rawRow?.is_functional),
    });
  }
  return fallback.map((w) => byHanzi.get(w.hanzi) ?? {
    hanzi: w.hanzi,
    interest_tags: [],
    is_functional: false,
  });
}

async function generateDecoyCandidates(): Promise<
  { hanzi: string; pinyin: string; difficulty_level: number }[]
> {
  const deepseek = process.env.DEEPSEEK_API_KEY?.trim();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  const prompt = `Invent 30 plausible-looking but NONEXISTENT Mandarin words (fake Hanzi+pinyin). They must not be real dictionary words, place names, or famous titles.
Return JSON: { "decoys": [ { "hanzi": "...", "pinyin": "...", "difficulty_level": 1 } ] }
Roughly 5 per difficulty_level 1 through 6.`;

  const body = anthropic
    ? {
        url: "https://api.anthropic.com/v1/messages",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropic,
          "anthropic-version": "2023-06-01",
        },
        payload: {
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        },
        extract: (data: any) =>
          data.content?.map((c: { text?: string }) => c.text ?? "").join("") ?? "",
      }
    : {
        url: "https://api.deepseek.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${deepseek}`,
        },
        payload: {
          model: "deepseek-v4-flash",
          messages: [
            { role: "system", content: "Output only valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 2000,
          thinking: { type: "disabled" },
          response_format: { type: "json_object" },
        },
        extract: (data: any) => data.choices?.[0]?.message?.content ?? "",
      };

  if (!anthropic && !deepseek) throw new Error("Need an API key for decoys");
  const res = await fetch(body.url, {
    method: "POST",
    headers: body.headers as unknown as Record<string, string>,
    body: JSON.stringify(body.payload),
  });
  if (!res.ok) throw new Error(`Decoy gen ${res.status}: ${await res.text()}`);
  const text = body.extract(await res.json());
  let json = text.trim();
  if (json.startsWith("```")) json = json.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "");
  const parsed = JSON.parse(json) as { decoys?: any[] };
  return (parsed.decoys ?? [])
    .map((d) => ({
      hanzi: String(d?.hanzi ?? "").trim(),
      pinyin: String(d?.pinyin ?? "").trim(),
      difficulty_level: Math.min(6, Math.max(1, Number(d?.difficulty_level) || 1)),
    }))
    .filter((d) => d.hanzi.length > 0);
}

async function main() {
  const sample = hasFlag("--sample");
  const full = hasFlag("--full");
  const write = hasFlag("--write");
  const decoysOnly = hasFlag("--decoys");

  if (decoysOnly) {
    const decoys = await generateDecoyCandidates();
    console.log(JSON.stringify(decoys, null, 2));
    return;
  }

  if (!sample && !full) {
    console.error("Use --sample (review first) or --full --write (after Cameron approves).");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from("hsk_words")
    .select("id, hanzi, pinyin, english, level, part_of_speech")
    .eq("standard", "2.0")
    .eq("is_placeholder", false)
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error || !data) throw new Error(error?.message || "Failed to load hsk_words");
  let words = data as Word[];

  if (sample) {
    const picked: Word[] = [];
    for (let level = 1; level <= 6; level++) {
      const at = words.filter((w) => w.level === level);
      picked.push(...at.slice(0, level <= 2 ? 3 : 4));
    }
    words = picked.slice(0, 20);
  }

  console.log(`Classifying ${words.length} words (${write ? "WRITE" : "dry-run"})…`);
  const tagged: { word: Word; tag: TagResult }[] = [];

  for (let i = 0; i < words.length; i += CHUNK) {
    const chunk = words.slice(i, i + CHUNK);
    const results = await classifyChunk(chunk);
    for (let j = 0; j < chunk.length; j++) {
      tagged.push({ word: chunk[j], tag: results[j] });
    }
    console.log(`  ${Math.min(i + CHUNK, words.length)} / ${words.length}`);
  }

  for (const row of tagged) {
    console.log(
      `HSK${row.word.level} ${row.word.hanzi} ${row.word.pinyin} — ${row.word.english ?? ""} | tags=[${row.tag.interest_tags.join(", ")}] functional=${row.tag.is_functional}`,
    );
  }

  if (!write) {
    console.log("\nDry-run only. Re-run with --write after you approve the sample.");
    return;
  }

  for (const row of tagged) {
    const { error: upErr } = await supabase
      .from("hsk_words")
      .update({
        interest_tags: row.tag.interest_tags,
        is_functional: row.tag.is_functional,
      })
      .eq("id", row.word.id);
    if (upErr) console.warn("update failed", row.word.hanzi, upErr.message);
  }
  console.log(`Wrote ${tagged.length} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
