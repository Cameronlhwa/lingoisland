import postgres from "postgres";
import { readFileSync } from "fs";
import { join } from "path";
import { getSentenceStyleDatabaseUrl } from "@/lib/supabase/runSentenceStyleMigration";

const MIGRATION_3_0 = join(
  process.cwd(),
  "supabase/migrations/20260827_000001_hsk_vocabulary_3_0.sql",
);

const MIGRATION_2_0 = join(
  process.cwd(),
  "supabase/migrations/20260901_000002_hsk_2_0_vocabulary.sql",
);

async function runSqlFile(filePath: string, successMessage: string) {
  const databaseUrl = getSentenceStyleDatabaseUrl();
  if (!databaseUrl) {
    throw new Error(
      "Set DATABASE_URL or SUPABASE_DB_PASSWORD (plus NEXT_PUBLIC_SUPABASE_URL) to run migrations.",
    );
  }

  const sqlText = readFileSync(filePath, "utf8");
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql.unsafe(sqlText);
    return {
      ok: true as const,
      message: successMessage,
    };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function runHskVocabularyMigration(): Promise<{
  ok: true;
  message: string;
}> {
  return runSqlFile(MIGRATION_3_0, "HSK vocabulary 3.0 schema migration applied");
}

export async function runHsk2VocabularyMigration(): Promise<{
  ok: true;
  message: string;
}> {
  return runSqlFile(
    MIGRATION_2_0,
    "HSK 2.0 vocabulary + standard preference migration applied",
  );
}
