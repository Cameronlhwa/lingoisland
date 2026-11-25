import dotenv from "dotenv";
import postgres from "postgres";
import { readFileSync } from "node:fs";

dotenv.config({ path: ".env.local", quiet: true });

type Preflight = { lessons_exist: boolean; sessions_exist: boolean; completion_exists: boolean };
const preflightSql = `select
  to_regclass('public.journey_lessons') is not null as lessons_exist,
  to_regclass('public.pronunciation_sessions') is not null as sessions_exist,
  to_regprocedure('public.complete_pronunciation_session(uuid)') is not null as completion_exists;`;

function checkDependencies(state: Preflight) {
  if (!state.sessions_exist || !state.completion_exists) {
    throw new Error("Apply the existing pronunciation/session-progress migrations before the journey lesson migration.");
  }
}

async function main() {
  const migration = readFileSync("supabase/migrations/20261124_000001_journey_lessons.sql", "utf8");
  const direct = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (direct) {
    const sql = postgres(direct, { max: 1, connect_timeout: 10 });
    try {
      const [state] = await sql.unsafe<Preflight[]>(preflightSql);
      checkDependencies(state);
      if (state.lessons_exist) { console.log("Journey lesson storage already exists. No migration was applied."); return; }
      await sql.begin(async transaction => { await transaction.unsafe(migration); });
    } finally { await sql.end({ timeout: 5 }); }
  } else {
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!token || !url) throw new Error("Configure DATABASE_URL, or refresh SUPABASE_ACCESS_TOKEN in .env.local. Alternatively, run the journey lesson SQL migration in Supabase’s SQL Editor.");
    const ref = new URL(url).hostname.split(".")[0];
    const query = async (text: string) => {
      const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST", signal: AbortSignal.timeout(30000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: text }),
      });
      if (response.status === 401 || response.status === 403) throw new Error(`Supabase rejected the management credential (HTTP ${response.status}). Refresh SUPABASE_ACCESS_TOKEN locally, or use the SQL Editor. No migration was applied by this request.`);
      if (!response.ok) throw new Error(`Supabase did not complete the database request (HTTP ${response.status}). Check the project’s SQL Editor before retrying.`);
      return response.json();
    };
    const [state] = await query(preflightSql) as Preflight[];
    if (!state || typeof state.lessons_exist !== "boolean") throw new Error("Could not verify the database schema. No migration was applied.");
    checkDependencies(state);
    if (state.lessons_exist) { console.log("Journey lesson storage already exists. No migration was applied."); return; }
    await query(`begin;\n${migration}\ncommit;`);
    const [after] = await query(preflightSql) as Preflight[];
    if (!after?.lessons_exist) throw new Error("The migration response could not be verified. Check Supabase’s SQL Editor before retrying.");
  }
  console.log("Journey lesson storage is ready. Reload the journey lesson to start the mini-course teaching flow.");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Journey lesson migration could not be applied.");
  process.exitCode = 1;
});
