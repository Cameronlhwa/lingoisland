-- Defense in depth for direct Supabase reads/writes as well as app/API gates.
-- Existing data and subscription grants are retained. Apply with the app release.
begin;

create or replace function public.has_paid_learning_access(required_product text default 'either')
returns boolean language plpgsql stable security definer set search_path = pg_catalog, public as $$
declare
  learner uuid := auth.uid();
  requested text;
  has_row boolean;
  active_row boolean;
  legacy_plan text;
  legacy_end timestamptz;
begin
  if learner is null or required_product not in ('core','hsk','either') then return false; end if;
  select plan, current_period_end into legacy_plan, legacy_end from public.profiles where id=learner;
  foreach requested in array (case when required_product='either' then array['core','hsk'] else array[required_product] end) loop
    has_row := false; active_row := false;
    if to_regclass('public.product_subscriptions') is not null then
      execute 'select count(*)>0, coalesce(bool_or(status in (''active'',''trialing'') and (current_period_end is null or current_period_end>now())),false) from public.product_subscriptions where user_id=$1 and product=$2'
        into has_row, active_row using learner, requested;
    end if;
    if active_row then return true; end if;
    if not has_row and (legacy_end is null or legacy_end>now()) and
       ((requested='core' and legacy_plan in ('pro','both')) or (requested='hsk' and legacy_plan in ('hsk','both'))) then return true; end if;
  end loop;
  return false;
end;
$$;
revoke all on function public.has_paid_learning_access(text) from public;
grant execute on function public.has_paid_learning_access(text) to anon, authenticated, service_role;

-- Existing owner policies remain in force. Restrictive policies add a paid check
-- without changing which subscriber owns a private lesson, card, or story.
do $$
declare
  relation text;
  product text;
  had_rls boolean;
begin
  foreach relation in array array[
    'topic_islands','island_words','island_sentences','island_grammar_focus','island_grammar_examples',
    'island_chat_threads','island_chat_messages','journeys','journey_islands','journey_lessons',
    'stories','story_words','story_sentences','story_chat_threads','story_chat_messages',
    'quiz_islands','quiz_cards','quiz_activity_events','cards','card_collections','card_review_state','decks','flashcards',
    'pronunciation_profiles','pronunciation_sessions','pronunciation_attempts','pronunciation_diagnostic_attempts','pronunciation_weak_sounds',
    'tone_course_attempts','tone_course_progress','topic_island_review_events','a0_course_words','a0_course_sentences',
    'hsk_words','curricula','curriculum_units','journey_island_hsk_words','practice_tests','test_sections','test_attempts',
    'sms_messages','sms_threads','sms_word_comfort','sms_preferences'
  ] loop
    if to_regclass('public.'||relation) is null then continue; end if;
    product := case when relation in ('hsk_words','curricula','curriculum_units','journey_island_hsk_words','practice_tests','test_sections','test_attempts') then 'hsk' else 'either' end;
    select relrowsecurity into had_rls from pg_class where oid=to_regclass('public.'||relation);
    execute format('alter table public.%I enable row level security',relation);
    if not had_rls then
      execute format('create policy hard_paywall_existing_grants on public.%I for all to anon,authenticated using ((select public.has_paid_learning_access(%L))) with check ((select public.has_paid_learning_access(%L)))',relation,product,product);
    end if;
    execute format('drop policy if exists hard_paywall_subscription on public.%I',relation);
    execute format('create policy hard_paywall_subscription on public.%I as restrictive for all to anon,authenticated using ((select public.has_paid_learning_access(%L))) with check ((select public.has_paid_learning_access(%L)))',relation,product,product);
  end loop;
end;
$$;

-- Older maintenance helpers must never be callable by a learner or anonymous browser.
do $$
declare fn record;
begin
  for fn in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('grant_manual_pro','fix_stripe_subscription_by_id','fix_stripe_subscription_by_email') loop
    execute format('revoke all on function %s from public,anon,authenticated',fn.signature);
    execute format('grant execute on function %s to service_role',fn.signature);
  end loop;
end;
$$;

-- SECURITY DEFINER quiz/progress RPCs bypass table RLS, so guard their entry too.
create or replace function public.require_paid_learning_access(required_product text default 'either')
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if coalesce(auth.role(),'')='service_role' then return; end if;
  if not public.has_paid_learning_access(required_product) then
    raise exception 'A subscription is required for learning features' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.require_paid_learning_access(text) from public;
grant execute on function public.require_paid_learning_access(text) to anon,authenticated,service_role;
do $$
declare fn record; definition text; guarded text; product text;
begin
  for fn in select p.oid,p.proname,p.prosrc,l.lanname from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.proname in ('ensure_new_queue_populated','get_quiz_queue','grade_card','get_quiz_stats','get_hsk_level_progress','complete_pronunciation_session','debug_quiz_island') loop
    if position('public.require_paid_learning_access' in fn.prosrc)>0 then continue; end if;
    product := case when fn.proname='get_hsk_level_progress' then 'hsk' else 'either' end;
    definition := pg_get_functiondef(fn.oid);
    if fn.lanname='plpgsql' then
      guarded := regexp_replace(fn.prosrc,'(^|\n)([ \t]*begin)([ \t\r\n])',format(E'\\1\\2\n  perform public.require_paid_learning_access(%L);\n\\3',product),'i');
      if guarded=fn.prosrc then raise exception 'Could not guard function %',fn.proname; end if;
    elsif fn.lanname='sql' then
      guarded := 'with paid_gate as materialized (select public.require_paid_learning_access('||quote_literal(product)||')) select result.* from paid_gate cross join lateral ('||regexp_replace(trim(fn.prosrc),';[[:space:]]*$','')||') result';
    else raise exception 'Unsupported learning function language for %',fn.proname;
    end if;
    execute replace(definition,fn.prosrc,guarded);
  end loop;
end;
$$;

-- Owners may change preferences, but only trusted billing code can grant access.
create or replace function public.protect_profile_billing_fields()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare field text;
begin
  if current_user in ('postgres','supabase_admin','service_role') or coalesce(auth.role(),'')='service_role' then return new; end if;
  if tg_op='INSERT' then
    if coalesce(new.plan,'free') <> 'free' then raise exception 'Billing fields are server-managed' using errcode='42501'; end if;
    foreach field in array array['stripe_customer_id','stripe_subscription_id','current_period_end'] loop
      if coalesce(to_jsonb(new)->field,'null'::jsonb) <> 'null'::jsonb then raise exception 'Billing fields are server-managed' using errcode='42501'; end if;
    end loop;
  else
    foreach field in array array['plan','stripe_customer_id','stripe_subscription_id','current_period_end','cancel_at_period_end'] loop
      if to_jsonb(new)->field is distinct from to_jsonb(old)->field then raise exception 'Billing fields are server-managed' using errcode='42501'; end if;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_billing_fields on public.profiles;
create trigger protect_profile_billing_fields before insert or update on public.profiles for each row execute function public.protect_profile_billing_fields();
commit;
