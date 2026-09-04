/**
 * Seed HSK vocabulary into Supabase (3.0 by default, or 2.0 with --standard 2.0).
 *
 * Prerequisites:
 *   1. Build JSON:
 *        python3 scripts/import_hsk_vocabulary.py
 *        python3 scripts/import_hsk_vocabulary_2_0.py
 *   2. Schema migrations in supabase/migrations/
 *
 * Usage:
 *   npx tsx scripts/seedHskVocabulary.ts
 *   npx tsx scripts/seedHskVocabulary.ts --standard 2.0
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import {
  runHsk2VocabularyMigration,
  runHskVocabularyMigration,
} from "../lib/supabase/runHskVocabularyMigration";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const resolvedSupabaseUrl = supabaseUrl!;
const resolvedSupabaseServiceKey = supabaseServiceKey!;

type HskWordSeed = {
  sort_order: number;
  hanzi: string;
  pinyin: string | null;
  part_of_speech: string | null;
  english: string | null;
  level: number;
  level_band: string | null;
  standard: string;
};

type Payload = {
  standard: string;
  count: number;
  words: HskWordSeed[];
};

const BATCH_SIZE = 500;

function parseStandardArg(): "2.0" | "3.0" {
  const index = process.argv.indexOf("--standard");
  if (index >= 0) {
    const value = process.argv[index + 1];
    if (value === "2.0" || value === "3.0") return value;
    console.error('Invalid --standard. Use "2.0" or "3.0".');
    process.exit(1);
  }
  return "3.0";
}

async function main() {
  const standard = parseStandardArg();
  const dataPath = path.resolve(
    process.cwd(),
    standard === "2.0" ? "data/hsk-vocabulary-2.0.json" : "data/hsk-vocabulary-3.0.json",
  );

  if (!fs.existsSync(dataPath)) {
    const importer =
      standard === "2.0"
        ? "scripts/import_hsk_vocabulary_2_0.py"
        : "scripts/import_hsk_vocabulary.py";
    console.error(`Missing ${dataPath}. Run ${importer} first.`);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(dataPath, "utf8")) as Payload;
  const supabase = createClient(resolvedSupabaseUrl, resolvedSupabaseServiceKey);

  const { error: schemaProbeError } = await supabase
    .from("hsk_words")
    .select("level_band")
    .limit(1);
  const schemaReady = !schemaProbeError;

  if (!schemaReady) {
    console.log("Applying HSK vocabulary schema migration...");
    try {
      const migration = await runHskVocabularyMigration();
      console.log(migration.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("\nMigration failed:", message);
      console.error(
        "\nApply supabase/migrations/20260827_000001_hsk_vocabulary_3_0.sql in the Supabase SQL Editor,",
      );
      console.error("or add SUPABASE_DB_PASSWORD to .env.local and rerun.\n");
      process.exit(1);
    }
  } else {
    console.log("HSK vocabulary schema already applied (level_band column present).");
  }

  const { error: standardProbeError } = await supabase
    .from("user_profiles")
    .select("hsk_standard")
    .limit(1);
  if (standardProbeError) {
    console.log("Applying HSK 2.0 standard preference migration...");
    try {
      const migration = await runHsk2VocabularyMigration();
      console.log(migration.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("\nCould not apply HSK 2.0 preference migration:", message);
      console.warn(
        "Apply supabase/migrations/20260901_000002_hsk_2_0_vocabulary.sql in the Supabase SQL Editor.",
      );
      console.warn("Continuing to seed vocabulary words.\n");
    }
  } else {
    try {
      const migration = await runHsk2VocabularyMigration();
      console.log(migration.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("Could not refresh get_hsk_level_progress RPC:", message);
    }
  }

  console.log(`Seeding ${payload.words.length} HSK ${payload.standard} words...`);

  const { error: deleteError } = await supabase
    .from("hsk_words")
    .delete()
    .eq("standard", payload.standard);
  if (deleteError) {
    console.error(
      `Failed to clear existing ${payload.standard} vocabulary:`,
      deleteError.message,
    );
    process.exit(1);
  }

  let inserted = 0;
  for (let i = 0; i < payload.words.length; i += BATCH_SIZE) {
    const batch = payload.words.slice(i, i + BATCH_SIZE).map((word) => ({
      standard: word.standard,
      level: word.level,
      level_band: word.level_band,
      sort_order: word.sort_order,
      hanzi: word.hanzi,
      pinyin: word.pinyin ?? "",
      english: word.english ?? "",
      part_of_speech: word.part_of_speech,
      is_placeholder: false,
    }));

    const { error } = await supabase.from("hsk_words").insert(batch);
    if (error) {
      console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${payload.words.length}`);
  }

  const missingEnglish = payload.words.filter((word) => !word.english).length;
  console.log(`Done. ${missingEnglish} words still have no English translation.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
