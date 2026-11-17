-- Additive: existing review sessions and diagnostic comparisons retain their identity.
alter table public.pronunciation_sessions add column if not exists progress jsonb;
alter table public.pronunciation_sessions add column if not exists progress_revision integer not null default 0;
alter table public.pronunciation_sessions add column if not exists summary jsonb;
alter table public.pronunciation_attempts add column if not exists item_id text;

create table if not exists public.tone_course_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  revision integer not null default 1,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,version)
);
create table if not exists public.tone_course_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null,
  activity_id text not null,
  client_request_id uuid not null,
  target_text text not null,
  score jsonb not null,
  overall_score numeric,
  created_at timestamptz not null default now(),
  unique(user_id,version,activity_id,client_request_id)
);
alter table public.tone_course_progress enable row level security;
alter table public.tone_course_attempts enable row level security;
drop policy if exists "Own tone course progress" on public.tone_course_progress;
create policy "Own tone course progress" on public.tone_course_progress for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "Own tone course attempts" on public.tone_course_attempts;
create policy "Own tone course attempts" on public.tone_course_attempts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update on public.tone_course_progress to authenticated;
grant select,insert on public.tone_course_attempts to authenticated;
grant all on public.tone_course_progress,public.tone_course_attempts to service_role;

-- The session lock serializes repeated completions. The profile lock serializes
-- completions of different sessions by the same learner. Everything commits once.
create or replace function public.complete_pronunciation_session(p_session_id uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  s public.pronunciation_sessions%rowtype;
  p public.pronunciation_profiles%rowtype;
  session_average numeric;
  result jsonb;
  today date := (now() at time zone 'UTC')::date;
  streak integer;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into s from public.pronunciation_sessions where id=p_session_id and user_id=auth.uid() for update;
  if not found then raise exception 'Practice session not found'; end if;
  if s.status='abandoned' then raise exception 'This session was abandoned'; end if;
  if jsonb_array_length(s.sentences)=0 then raise exception 'This session has no practice items'; end if;
  if s.status<>'completed' and exists (
    select 1 from jsonb_array_elements(s.sentences) with ordinality as i(item,n)
    where not exists(select 1 from public.pronunciation_attempts a where a.session_id=s.id and a.unit_type='sentence'
      and a.item_id=coalesce(i.item->>'itemId','item-'||(i.n-1)::text))
    and (select count(*) from public.pronunciation_attempts a where a.session_id=s.id and a.unit_type='sentence' and a.item_id is null and a.target_text=i.item->>'sentenceHanzi')
      < (select count(*) from jsonb_array_elements(s.sentences) j where j->>'sentenceHanzi'=i.item->>'sentenceHanzi')
  ) then raise exception 'Finish each sentence before completing practice'; end if;

  if s.summary is not null and s.status='completed' then return s.summary; end if;
  select round(avg(a.overall_score),1) into session_average
  from jsonb_array_elements(s.sentences) with ordinality as i(item,n)
  cross join lateral (
    select x.overall_score from public.pronunciation_attempts x where x.session_id=s.id and x.unit_type='sentence'
    and (x.item_id=coalesce(i.item->>'itemId','item-'||(i.n-1)::text) or (x.item_id is null and x.target_text=i.item->>'sentenceHanzi'))
    order by x.created_at desc,x.id desc limit 1
  ) a;
  result:=jsonb_build_object('avgScore',session_average,'sentenceCount',jsonb_array_length(s.sentences),'topWeak',null);
  if s.status='completed' then
    update public.pronunciation_sessions set summary=result where id=s.id;
    return result;
  end if;
  insert into public.pronunciation_profiles(user_id) values(auth.uid()) on conflict(user_id) do nothing;
  select * into p from public.pronunciation_profiles where user_id=auth.uid() for update;
  streak:=case when p.streak_last_date=today then p.streak_count when p.streak_last_date=today-1 then p.streak_count+1 else 1 end;
  update public.pronunciation_profiles set
    last_practiced_at=now(),streak_count=streak,streak_last_date=today,
    overall_score=case when session_average is null then p.overall_score when p.overall_score is null then session_average else round(p.overall_score*0.7+session_average*0.3,1) end,
    updated_at=now()
  where user_id=auth.uid();
  update public.pronunciation_sessions set status='completed',completed_at=now(),summary=result where id=s.id;
  return result;
end $$;
revoke all on function public.complete_pronunciation_session(uuid) from public,anon;
grant execute on function public.complete_pronunciation_session(uuid) to authenticated;
notify pgrst,'reload schema';
