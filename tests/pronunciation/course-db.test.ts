import assert from "node:assert/strict";
import {it} from "node:test";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";

it("migration enforces ownership and completion commits once, with latest per-item scores",async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
      create table public.pronunciation_profiles(user_id uuid primary key,overall_score numeric,streak_count int default 0,streak_last_date date,last_practiced_at timestamptz,updated_at timestamptz);
      create table public.pronunciation_sessions(id uuid primary key,user_id uuid,sentences jsonb,status text,completed_at timestamptz);
      create table public.pronunciation_attempts(id uuid default gen_random_uuid(),session_id uuid,unit_type text,target_text text,overall_score numeric,created_at timestamptz default now());
      grant all on public.pronunciation_profiles,public.pronunciation_sessions,public.pronunciation_attempts to authenticated;
      insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
    await db.exec(readFileSync("supabase/migrations/20261112_000001_tone_course_and_session_progress.sql","utf8"));
    const user="00000000-0000-0000-0000-000000000001",session="10000000-0000-0000-0000-000000000001";
    await db.query(`insert into pronunciation_sessions(id,user_id,sentences,status) values($1,$2,$3,'in_progress')`,[session,user,JSON.stringify([{sentenceHanzi:"你好。"},{sentenceHanzi:"你好。"}])]);
    await db.query(`insert into pronunciation_profiles(user_id,overall_score) values($1,70)`,[user]);
    await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);
    await assert.rejects(()=>db.query("select complete_pronunciation_session($1)",[session]),/Finish each/);
    await db.query(`insert into pronunciation_attempts(session_id,unit_type,target_text,item_id,overall_score,created_at) values($1,'sentence','你好。','item-0',40,'2026-11-12'),($1,'sentence','你好。','item-0',80,'2026-11-13'),($1,'sentence','你好。','item-1',100,'2026-11-13')`,[session]);
    const first=await db.query<{summary:{avgScore:number}}>("select complete_pronunciation_session($1) summary",[session]);assert.equal(first.rows[0].summary.avgScore,90);
    const before=await db.query("select * from pronunciation_profiles");
    await db.query("select complete_pronunciation_session($1)",[session]);
    assert.deepEqual((await db.query("select * from pronunciation_profiles")).rows,before.rows);
    assert.equal(Number((before.rows[0] as {overall_score:number}).overall_score),76);
    await db.query(`insert into tone_course_progress(user_id,version,state) values($1,1,'{}')`,[user]);
    const firstSave=await db.query(`update tone_course_progress set revision=2,state='{"saved":true}' where user_id=$1 and version=1 and revision=1 returning revision`,[user]);
    const staleSave=await db.query(`update tone_course_progress set revision=2,state='{"stale":true}' where user_id=$1 and version=1 and revision=1 returning revision`,[user]);
    assert.equal(firstSave.rows.length,1);assert.equal(staleSave.rows.length,0);
    assert.deepEqual((await db.query<{state:unknown}>("select state from tone_course_progress")).rows[0].state,{saved:true});
    await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);`);
    assert.equal((await db.query("select * from tone_course_progress")).rows.length,0);
    await assert.rejects(()=>db.query(`insert into tone_course_progress(user_id,version,state) values($1,2,'{}')`,[user]),/row-level security/);
    await assert.rejects(()=>db.query("select complete_pronunciation_session($1)",[session]),/not found/);
  }finally{await db.close();}
});
