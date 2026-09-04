import dotenv from "dotenv";
import {
  runHsk2VocabularyMigration,
  runHskVocabularyMigration,
} from "@/lib/supabase/runHskVocabularyMigration";

dotenv.config({ path: ".env.local" });

async function main() {
  const schema = await runHskVocabularyMigration();
  console.log(schema.message);
  const standard = await runHsk2VocabularyMigration();
  console.log(standard.message);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
