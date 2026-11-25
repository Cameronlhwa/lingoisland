import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("lesson migration isolates users, requires journey ownership and rejects stale saves", async () => {
  const db = new PGlite();
  const user = "00000000-0000-0000-0000-000000000001", other = "00000000-0000-0000-0000-000000000002";
  const island = "10000000-0000-0000-0000-000000000001", foreign = "10000000-0000-0000-0000-000000000002", journey = "20000000-0000-0000-0000-000000000001";
  try {
    await db.exec(`create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      create table topic_islands(id uuid primary key,user_id uuid);
      create table journeys(id uuid primary key,user_id uuid);
      create table journey_islands(id uuid primary key default gen_random_uuid(),journey_id uuid,island_id uuid);
      create table pronunciation_sessions(id uuid primary key,source text);
      grant select on topic_islands,journeys,journey_islands to authenticated;
      insert into auth.users values('${user}'),('${other}');
      insert into topic_islands values('${island}','${user}'),('${foreign}','${other}');
      insert into journeys values('${journey}','${user}');
      insert into journey_islands(journey_id,island_id) values('${journey}','${island}');`);
    await db.exec(readFileSync("supabase/migrations/20261124_000001_journey_lessons.sql", "utf8"));
    await db.exec(`grant select,insert,update on journey_lessons to authenticated; set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`);
    await db.query("insert into journey_lessons(island_id,user_id,objective) values($1,$2,'{}')", [island, user]);
    await assert.rejects(() => db.query("insert into journey_lessons(island_id,user_id,objective) values($1,$2,'{}')", [foreign, user]), /row-level security/);
    const first = await db.query("update journey_lessons set revision=1,progress='{\"stepId\":\"grammar\"}' where island_id=$1 and revision=0 returning revision", [island]);
    const stale = await db.query("update journey_lessons set revision=1,progress='{\"stepId\":\"stale\"}' where island_id=$1 and revision=0 returning revision", [island]);
    assert.equal(first.rows.length, 1); assert.equal(stale.rows.length, 0);
    await assert.rejects(() => db.query("update journey_lessons set island_id=$1 where island_id=$2", [foreign, island]), /cannot change its owner/);
    await db.query("update journey_lessons set content='{\"saved\":true}' where island_id=$1", [island]);
    await assert.rejects(() => db.query("update journey_lessons set content='{\"changed\":true}' where island_id=$1", [island]), /immutable/);
    await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);`);
    assert.equal((await db.query("select * from journey_lessons")).rows.length, 0);
    assert.equal((await db.query("update journey_lessons set revision=99 returning revision")).rows.length, 0);
    await assert.rejects(() => db.query("insert into journey_lessons(island_id,user_id,objective) values($1,$2,'{}')", [foreign, other]), /row-level security/);
  } finally { await db.close(); }
});
