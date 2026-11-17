import dotenv from "dotenv";
import postgres from "postgres";
import {readFileSync} from "node:fs";
dotenv.config({path:".env.local"});

async function main(){
  const query=readFileSync("supabase/migrations/20261112_000001_tone_course_and_session_progress.sql","utf8");
  const direct=process.env.DATABASE_URL??process.env.SUPABASE_DB_URL;
  if(direct){const sql=postgres(direct,{max:1});try{await sql.begin(async transaction=>{await transaction.unsafe(query);});}finally{await sql.end({timeout:5});}}
  else{
    const token=process.env.SUPABASE_ACCESS_TOKEN,url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    if(!token||!url)throw new Error("Configure DATABASE_URL or a valid SUPABASE_ACCESS_TOKEN and NEXT_PUBLIC_SUPABASE_URL, or run the migration file in the Supabase SQL Editor.");
    const ref=new URL(url).hostname.split(".")[0];
    const response=await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({query:`begin;\n${query}\ncommit;`})});
    if(!response.ok)throw new Error(`Migration was not applied (Supabase HTTP ${response.status}). Refresh the management credential or use the SQL Editor.`);
  }
  console.log("Tone course tables and reliable practice completion are ready.");
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Migration could not be applied.");process.exitCode=1;});
