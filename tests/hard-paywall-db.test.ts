import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
const {PGlite}=createRequire(process.cwd()+"/package.json")("@electric-sql/pglite") as typeof import("@electric-sql/pglite");

test("direct database access denies unpaid learners, preserves paid ownership, and protects billing grants",async()=>{
 const db=await PGlite.create();
 const free="00000000-0000-0000-0000-000000000001",paid="00000000-0000-0000-0000-000000000002";
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
  grant usage on schema auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;
  create table profiles(id uuid primary key,plan text,current_period_end timestamptz,stripe_customer_id text,stripe_subscription_id text,cancel_at_period_end boolean default false);
  insert into profiles(id,plan) values('${free}','free'),('${paid}','pro');
  create table topic_islands(id int primary key,user_id uuid);
  insert into topic_islands values(1,'${free}'),(2,'${paid}');
  alter table topic_islands enable row level security;
  create policy owner_access on topic_islands for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
  grant select,insert,update on profiles,topic_islands to authenticated;
  create function get_quiz_queue() returns int language plpgsql security definer as $$
  BEGIN
    return 42;
  END;
  $$;
  create function get_hsk_level_progress() returns table(progress int) language sql security definer as $$select 42 as progress;$$;
  create function grant_manual_pro() returns void language plpgsql security definer as $$begin update profiles set plan='pro'; end;$$;`);
  const sql=readFileSync("supabase/migrations/20261125_000001_hard_paywall.sql","utf8");await db.exec(sql);
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.role','authenticated',false);select set_config('request.jwt.claim.sub','${free}',false);`);
  assert.equal((await db.query('select * from topic_islands')).rows.length,0);
  await assert.rejects(()=>db.query('select get_quiz_queue()'),/subscription is required/);
  await assert.rejects(()=>db.query('select * from get_hsk_level_progress()'),/subscription is required/);
  await assert.rejects(()=>db.query('select grant_manual_pro()'),/permission denied/);
  await assert.rejects(()=>db.query(`insert into topic_islands values(3,'${free}')`),/row-level security/);
  await assert.rejects(()=>db.query(`update profiles set plan='pro' where id='${free}'`),/server-managed/);
  await assert.rejects(()=>db.query(`update profiles set current_period_end=now()+interval '10 years' where id='${free}'`),/server-managed/);
  await db.exec(`select set_config('request.jwt.claim.sub','${paid}',false);`);
  assert.deepEqual((await db.query('select id from topic_islands')).rows,[{id:2}]);
  assert.equal((await db.query<{get_quiz_queue:number}>('select get_quiz_queue()')).rows[0].get_quiz_queue,42);
  await assert.rejects(()=>db.query('select * from get_hsk_level_progress()'),/subscription is required/);
  await db.exec(`reset role;create table product_subscriptions(user_id uuid,product text,status text,current_period_end timestamptz);
   insert into product_subscriptions values('${paid}','core','canceled',null);
   set role authenticated;`);
  assert.equal((await db.query('select * from topic_islands')).rows.length,0,'canceled product row overrides legacy pro');
  await db.exec(`reset role;update product_subscriptions set status='active',current_period_end=now()+interval '1 day';set role authenticated;`);
  assert.equal((await db.query('select * from topic_islands')).rows.length,1);
  await db.exec(`reset role;update product_subscriptions set current_period_end=now()-interval '1 day';set role authenticated;`);
  assert.equal((await db.query('select * from topic_islands')).rows.length,0,'expired subscriptions cannot read learning data');
  await db.exec(`reset role;insert into product_subscriptions values('${paid}','hsk','active',now()+interval '1 day');set role authenticated;`);
  assert.deepEqual((await db.query('select * from get_hsk_level_progress()')).rows,[{progress:42}]);
  await db.exec(`reset role;`);await db.exec(sql);
 }finally{await db.close();}
});
