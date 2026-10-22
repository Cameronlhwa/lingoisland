import { writeFile } from "node:fs/promises";
import path from "node:path";
import cedict from "cc-cedict";
import * as tokenizerModule from "../lib/chineseTokenizer.ts";

// lib/ compiles as CommonJS under tsx, so its exports may sit on `default`.
const { pickBestCedictEntry } = ((tokenizerModule as { default?: unknown }).default ??
  tokenizerModule) as typeof tokenizerModule;

/**
 * Builds lib/data/cedict-compact.json from cc-cedict.
 *
 * cc-cedict builds typed-array indexes for every entry when imported (~470 MB
 * of heap), so the app looks words up in this precomputed table instead: each
 * word maps to the single entry pickBestCedictEntry would choose from
 * cc-cedict's getBySimplified / getByTraditional results.
 *
 * Run with: npm run gen:cedict
 */

type Entry = { pinyin: string; english: string[] };
type Lookup = (word: string, pinyin: null, options: { asObject: false }) => Entry[] | null;

const internal = cedict as unknown as {
  data: { simplified: Record<string, unknown>; traditional: Record<string, unknown> };
  getBySimplified: Lookup;
  getByTraditional: Lookup;
};

async function main() {
  const words = new Set([
    ...Object.keys(internal.data.simplified),
    ...Object.keys(internal.data.traditional),
  ]);

  const compact: Record<string, [string, string[]]> = {};
  for (const word of words) {
    const best = pickBestCedictEntry(
      internal.getBySimplified(word, null, { asObject: false }),
      internal.getByTraditional(word, null, { asObject: false }),
    );
    if (best) compact[word] = [best.pinyin, best.english];
  }

  const outPath = path.join(process.cwd(), "lib/data/cedict-compact.json");
  const json = JSON.stringify(compact);
  await writeFile(outPath, json);
  console.log(
    `Wrote ${outPath}: ${Object.keys(compact).length} words, ` +
      `${(json.length / 1e6).toFixed(1)} MB`,
  );
}

void main();
