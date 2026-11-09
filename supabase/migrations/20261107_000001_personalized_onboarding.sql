-- Personalized onboarding: resumable progress, interests, hidden calibration
-- responses, plus the Huahua pieces onboarding needs (WhatsApp channel,
-- separate consents per message type, onboarding preview chat, quiet hours,
-- writing system, and new support and correction options).
--
-- Forward-only. Builds on 20261104_000001_sms_phone_verification.sql and
-- 20261106_000001_sms_huahua_phase2.sql (do not edit those files).
-- Safe to re-run.

-- ===========================================================================
-- Onboarding progress (learner-owned, RLS protected)
-- ===========================================================================

create table if not exists public.onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version smallint not null default 1 check (version >= 1),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  current_step text not null default 'goal' check (char_length(current_step) between 1 and 32),
  last_completed_step text check (last_completed_step is null or char_length(last_completed_step) <= 32),
  primary_goal text check (primary_goal is null or primary_goal in ('work', 'school', 'heritage', 'travel', 'everyday', 'other')),
  primary_goal_label text check (primary_goal_label is null or char_length(primary_goal_label) <= 60),
  secondary_goal text check (secondary_goal is null or secondary_goal in ('work', 'school', 'heritage', 'travel', 'everyday', 'other')),
  secondary_goal_label text check (secondary_goal_label is null or char_length(secondary_goal_label) <= 60),
  goal_other_text text check (goal_other_text is null or char_length(goal_other_text) <= 40),
  custom_interest text check (custom_interest is null or char_length(custom_interest) <= 40),
  self_reported_key text check (self_reported_key is null or char_length(self_reported_key) <= 32),
  self_reported_level smallint check (self_reported_level is null or self_reported_level between 0 and 6),
  provisional_level smallint check (provisional_level is null or provisional_level between 0 and 6),
  -- Scoring detail for debugging (rule, weighted score). Never shown to learners.
  placement jsonb check (placement is null or jsonb_typeof(placement) = 'object'),
  assessment_attempt_id uuid,
  pronunciation_status text not null default 'not_started'
    check (pronunciation_status in ('not_started', 'skipped', 'denied', 'failed', 'completed')),
  pronunciation_recommendation text
    check (pronunciation_recommendation is null or pronunciation_recommendation in ('standard', 'extra')),
  minutes_key text check (minutes_key is null or minutes_key in ('5', '10', '15', '30', '60', '60_plus')),
  minutes_per_day smallint check (minutes_per_day is null or minutes_per_day between 1 and 240),
  days_key text check (days_key is null or days_key in ('2', '3', '5', '7', 'varies')),
  days_per_week smallint check (days_per_week is null or days_per_week between 1 and 7),
  session_preference text check (session_preference is null or session_preference in ('one_session', 'short_sessions', 'auto')),
  support_recommendation jsonb check (support_recommendation is null or jsonb_typeof(support_recommendation) = 'object'),
  milestone_key text check (milestone_key is null or char_length(milestone_key) <= 32),
  milestone_range text check (milestone_range is null or char_length(milestone_range) <= 40),
  plan jsonb check (plan is null or jsonb_typeof(plan) = 'object'),
  messaging_channel text check (messaging_channel is null or messaging_channel in ('sms', 'whatsapp', 'none')),
  messaging_status text not null default 'not_started'
    -- 'simulated': local development only; nothing is sent.
    check (messaging_status in ('not_started', 'skipped', 'unavailable', 'verified', 'simulated')),
  huahua_preferences jsonb check (huahua_preferences is null or jsonb_typeof(huahua_preferences) = 'object'),
  preview_status text not null default 'not_started'
    check (preview_status in ('not_started', 'skipped', 'sent', 'completed', 'declined', 'simulated', 'unavailable')),
  committed_at timestamptz,
  completed_at timestamptz,
  -- Set once the plan is applied to the account (level, goal, first Journey).
  activated_at timestamptz,
  activated_journey_id uuid,
  -- Versioned client snapshot used only to resume the flow.
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  -- {step: {started_at, completed_at, skipped_at, abandoned_at}}
  step_events jsonb not null default '{}'::jsonb check (jsonb_typeof(step_events) = 'object'),
  last_abandoned_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.onboarding_progress
  add column if not exists activated_at timestamptz,
  add column if not exists activated_journey_id uuid;

create table if not exists public.onboarding_interests (
  user_id uuid not null references auth.users(id) on delete cascade,
  interest_key text not null check (interest_key ~ '^[a-z_]{2,32}$'),
  label text not null check (char_length(label) between 1 and 40),
  is_custom boolean not null default false,
  position smallint not null default 0 check (position between 0 and 20),
  created_at timestamptz not null default now(),
  primary key (user_id, interest_key)
);

create table if not exists public.onboarding_assessment_responses (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null,
  position smallint not null check (position between 1 and 5),
  question_id text not null check (char_length(question_id) between 1 and 40),
  role text not null check (role in ('warmup', 'representative', 'interest', 'diagnostic', 'confidence')),
  question_level smallint not null check (question_level between 0 and 6),
  choice_id text not null check (char_length(choice_id) between 1 and 4),
  correct boolean not null,
  weight numeric(5, 2) not null check (weight >= 0),
  answered_at timestamptz not null default now(),
  unique (user_id, attempt_id, position)
);

create index if not exists onboarding_assessment_responses_user_idx
  on public.onboarding_assessment_responses (user_id, answered_at desc);

alter table public.onboarding_progress enable row level security;
alter table public.onboarding_interests enable row level security;
alter table public.onboarding_assessment_responses enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['onboarding_progress', 'onboarding_interests', 'onboarding_assessment_responses']
  loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
    execute format('drop policy if exists "Own rows" on public.%I', t);
    execute format(
      'create policy "Own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
    execute format('drop policy if exists "Service role" on public.%I', t);
    execute format('create policy "Service role" on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end;
$$;

grant usage, select on sequence public.onboarding_assessment_responses_id_seq to authenticated, service_role;
revoke all on sequence public.onboarding_assessment_responses_id_seq from anon;

-- Progress functions run as the caller (security invoker) so RLS applies;
-- auth.uid() is the only identity they accept.

create or replace function public.onboarding_progress_json(p public.onboarding_progress)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when p.user_id is null then null else
    (to_jsonb(p) - 'user_id') || jsonb_build_object(
      'interests', coalesce((
        select jsonb_agg(jsonb_build_object('key', i.interest_key, 'label', i.label, 'is_custom', i.is_custom)
                         order by i.position, i.interest_key)
        from onboarding_interests i where i.user_id = p.user_id
      ), '[]'::jsonb)
    )
  end
$$;

create or replace function public.onboarding_get_progress()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_row onboarding_progress;
begin
  if auth.uid() is null then
    return null;
  end if;
  select * into v_row from onboarding_progress where user_id = auth.uid();
  return onboarding_progress_json(v_row);
end;
$$;

-- Saves the whole progress snapshot with optimistic concurrency. A stale
-- p_expected_revision returns 'conflict' with the stored row so the client
-- can merge instead of overwriting newer answers from another tab.
-- p_columns holds normalized fields computed and validated by the server.
create or replace function public.onboarding_save_progress(
  p_expected_revision integer,
  p_answers jsonb,
  p_step_events jsonb,
  p_columns jsonb,
  p_interests jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row onboarding_progress;
  v_cols jsonb := coalesce(p_columns, '{}'::jsonb);
  v_item jsonb;
  v_position integer := 0;
begin
  if v_user is null then
    return jsonb_build_object('status', 'unauthorized');
  end if;

  insert into onboarding_progress (user_id) values (v_user) on conflict (user_id) do nothing;

  select * into v_row from onboarding_progress where user_id = v_user for update;

  if p_expected_revision is not null and v_row.revision <> p_expected_revision then
    return jsonb_build_object('status', 'conflict', 'progress', onboarding_progress_json(v_row));
  end if;

  update onboarding_progress set
    version = coalesce((v_cols->>'version')::smallint, version),
    -- Completion is one-way: a late save from another tab cannot reopen it.
    status = case when status = 'completed' then 'completed' else coalesce(v_cols->>'status', status) end,
    current_step = coalesce(v_cols->>'current_step', current_step),
    last_completed_step = case when v_cols ? 'last_completed_step' then v_cols->>'last_completed_step' else last_completed_step end,
    primary_goal = case when v_cols ? 'primary_goal' then v_cols->>'primary_goal' else primary_goal end,
    primary_goal_label = case when v_cols ? 'primary_goal_label' then v_cols->>'primary_goal_label' else primary_goal_label end,
    secondary_goal = case when v_cols ? 'secondary_goal' then v_cols->>'secondary_goal' else secondary_goal end,
    secondary_goal_label = case when v_cols ? 'secondary_goal_label' then v_cols->>'secondary_goal_label' else secondary_goal_label end,
    goal_other_text = case when v_cols ? 'goal_other_text' then v_cols->>'goal_other_text' else goal_other_text end,
    custom_interest = case when v_cols ? 'custom_interest' then v_cols->>'custom_interest' else custom_interest end,
    self_reported_key = case when v_cols ? 'self_reported_key' then v_cols->>'self_reported_key' else self_reported_key end,
    self_reported_level = case when v_cols ? 'self_reported_level' then (v_cols->>'self_reported_level')::smallint else self_reported_level end,
    provisional_level = case when v_cols ? 'provisional_level' then (v_cols->>'provisional_level')::smallint else provisional_level end,
    placement = case when v_cols ? 'placement' then nullif(v_cols->'placement', 'null'::jsonb) else placement end,
    assessment_attempt_id = case when v_cols ? 'assessment_attempt_id' then (v_cols->>'assessment_attempt_id')::uuid else assessment_attempt_id end,
    pronunciation_status = coalesce(v_cols->>'pronunciation_status', pronunciation_status),
    pronunciation_recommendation = case when v_cols ? 'pronunciation_recommendation' then v_cols->>'pronunciation_recommendation' else pronunciation_recommendation end,
    minutes_key = case when v_cols ? 'minutes_key' then v_cols->>'minutes_key' else minutes_key end,
    minutes_per_day = case when v_cols ? 'minutes_per_day' then (v_cols->>'minutes_per_day')::smallint else minutes_per_day end,
    days_key = case when v_cols ? 'days_key' then v_cols->>'days_key' else days_key end,
    days_per_week = case when v_cols ? 'days_per_week' then (v_cols->>'days_per_week')::smallint else days_per_week end,
    session_preference = case when v_cols ? 'session_preference' then v_cols->>'session_preference' else session_preference end,
    support_recommendation = case when v_cols ? 'support_recommendation' then nullif(v_cols->'support_recommendation', 'null'::jsonb) else support_recommendation end,
    milestone_key = case when v_cols ? 'milestone_key' then v_cols->>'milestone_key' else milestone_key end,
    milestone_range = case when v_cols ? 'milestone_range' then v_cols->>'milestone_range' else milestone_range end,
    plan = case when v_cols ? 'plan' then nullif(v_cols->'plan', 'null'::jsonb) else plan end,
    messaging_channel = case when v_cols ? 'messaging_channel' then v_cols->>'messaging_channel' else messaging_channel end,
    messaging_status = coalesce(v_cols->>'messaging_status', messaging_status),
    huahua_preferences = case when v_cols ? 'huahua_preferences' then nullif(v_cols->'huahua_preferences', 'null'::jsonb) else huahua_preferences end,
    preview_status = coalesce(v_cols->>'preview_status', preview_status),
    committed_at = coalesce(committed_at, (v_cols->>'committed_at')::timestamptz),
    completed_at = coalesce(completed_at, (v_cols->>'completed_at')::timestamptz),
    answers = coalesce(p_answers, answers),
    step_events = coalesce(p_step_events, step_events),
    revision = revision + 1,
    updated_at = now()
  where user_id = v_user
  returning * into v_row;

  if jsonb_typeof(p_interests) = 'array' then
    delete from onboarding_interests where user_id = v_user;
    for v_item in select value from jsonb_array_elements(p_interests) limit 20
    loop
      insert into onboarding_interests (user_id, interest_key, label, is_custom, position)
      values (v_user, v_item->>'key', left(v_item->>'label', 40), coalesce((v_item->>'is_custom')::boolean, false), v_position)
      on conflict (user_id, interest_key) do nothing;
      v_position := v_position + 1;
    end loop;
  end if;

  return jsonb_build_object('status', 'saved', 'revision', v_row.revision, 'progress', onboarding_progress_json(v_row));
end;
$$;

-- Stores one calibration attempt. Re-submitting the same attempt replaces
-- its answers instead of duplicating them.
create or replace function public.onboarding_record_assessment(p_attempt_id uuid, p_responses jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_count integer := 0;
begin
  if v_user is null then
    return jsonb_build_object('status', 'unauthorized');
  end if;
  if p_attempt_id is null or jsonb_typeof(p_responses) <> 'array' then
    return jsonb_build_object('status', 'invalid');
  end if;

  delete from onboarding_assessment_responses where user_id = v_user and attempt_id = p_attempt_id;
  for v_item in select value from jsonb_array_elements(p_responses) limit 5
  loop
    insert into onboarding_assessment_responses (
      user_id, attempt_id, position, question_id, role, question_level, choice_id, correct, weight
    ) values (
      v_user, p_attempt_id,
      (v_item->>'position')::smallint,
      v_item->>'question_id',
      v_item->>'role',
      (v_item->>'question_level')::smallint,
      v_item->>'choice_id',
      (v_item->>'correct')::boolean,
      (v_item->>'weight')::numeric
    )
    on conflict (user_id, attempt_id, position) do nothing;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('status', 'saved', 'count', v_count);
end;
$$;

create or replace function public.onboarding_mark_abandoned(p_step text, p_last_completed_step text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null or p_step is null or char_length(p_step) > 32 then
    return jsonb_build_object('status', 'ignored');
  end if;
  update onboarding_progress
  set last_abandoned_at = now(),
      step_events = jsonb_set(
        step_events,
        array[p_step],
        coalesce(step_events->p_step, '{}'::jsonb) || jsonb_build_object('abandoned_at', now()),
        true
      ),
      updated_at = now()
  where user_id = v_user and status = 'in_progress';
  return jsonb_build_object('status', case when found then 'recorded' else 'ignored' end);
end;
$$;

-- One-way: the first activation wins so a retried request never creates a
-- second activation. Later calls get 'already_activated' with the first Journey id.
create or replace function public.onboarding_mark_activated(p_journey_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_row onboarding_progress;
begin
  if v_user is null then
    return jsonb_build_object('status', 'unauthorized');
  end if;
  select * into v_row from onboarding_progress where user_id = v_user for update;
  if v_row.user_id is null or v_row.committed_at is null then
    return jsonb_build_object('status', 'not_committed');
  end if;
  if v_row.activated_at is not null then
    return jsonb_build_object('status', 'already_activated', 'journey_id', v_row.activated_journey_id);
  end if;
  update onboarding_progress
  set activated_at = now(), activated_journey_id = p_journey_id, updated_at = now()
  where user_id = v_user;
  return jsonb_build_object('status', 'activated', 'journey_id', p_journey_id);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'onboarding_progress_json(public.onboarding_progress)',
    'onboarding_get_progress()',
    'onboarding_save_progress(integer, jsonb, jsonb, jsonb, jsonb)',
    'onboarding_record_assessment(uuid, jsonb)',
    'onboarding_mark_abandoned(text, text)',
    'onboarding_mark_activated(uuid)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
end;
$$;

-- ===========================================================================
-- Huahua: channel, consents, preferences, preview
-- ===========================================================================

alter table public.sms_contacts
  add column if not exists channel text not null default 'sms',
  add column if not exists last_inbound_at timestamptz;

alter table public.sms_contacts drop constraint if exists sms_contacts_channel_check;
alter table public.sms_contacts add constraint sms_contacts_channel_check check (channel in ('sms', 'whatsapp'));

alter table public.sms_phone_verifications
  add column if not exists channel text not null default 'sms',
  add column if not exists consent_scheduled boolean not null default true,
  add column if not exists consent_journey boolean not null default true;

alter table public.sms_phone_verifications drop constraint if exists sms_phone_verifications_channel_check;
alter table public.sms_phone_verifications add constraint sms_phone_verifications_channel_check
  check (channel in ('sms', 'whatsapp'));

-- Legacy single consent covered every recurring practice text, so existing
-- learners keep both message types on.
alter table public.sms_preferences
  add column if not exists consent_scheduled boolean not null default true,
  add column if not exists consent_journey boolean not null default true,
  add column if not exists writing_system text not null default 'simplified',
  -- Minutes after local midnight. Proactive texts never go out between
  -- quiet_start and quiet_end; replies to the learner's own texts still do.
  add column if not exists quiet_start smallint not null default 1260,
  add column if not exists quiet_end smallint not null default 480;

alter table public.sms_preferences drop constraint if exists sms_preferences_writing_system_check;
alter table public.sms_preferences add constraint sms_preferences_writing_system_check
  check (writing_system in ('simplified', 'traditional'));
alter table public.sms_preferences drop constraint if exists sms_preferences_quiet_hours_check;
alter table public.sms_preferences add constraint sms_preferences_quiet_hours_check
  check (quiet_start between 0 and 1439 and quiet_end between 0 and 1439 and quiet_start <> quiet_end);
alter table public.sms_preferences drop constraint if exists sms_preferences_scaffolding_check;
alter table public.sms_preferences add constraint sms_preferences_scaffolding_check
  check (scaffolding in ('auto', 'more', 'less', 'on_request'));
alter table public.sms_preferences drop constraint if exists sms_preferences_correction_mode_check;
alter table public.sms_preferences add constraint sms_preferences_correction_mode_check
  check (correction_mode in ('gentle', 'balanced', 'coach', 'hint_first', 'conversation_only', 'auto'));

alter table public.sms_threads drop constraint if exists sms_threads_origin_check;
alter table public.sms_threads add constraint sms_threads_origin_check
  check (origin in ('welcome', 'opener', 'control', 'inbound', 'preview'));

alter table public.sms_messages drop constraint if exists sms_messages_kind_check;
alter table public.sms_messages add constraint sms_messages_kind_check
  check (kind is null or kind in (
    'inbound', 'reply', 'fallback', 'welcome', 'help', 'resubscribed', 'manual',
    'opener', 'control', 'command', 'notice', 'safety', 'persona', 'preview'
  ));

alter table public.sms_consent_events
  add column if not exists channel text,
  add column if not exists scope text,
  add column if not exists source text;

alter table public.sms_consent_events drop constraint if exists sms_consent_events_event_check;
alter table public.sms_consent_events add constraint sms_consent_events_event_check
  check (event in (
    'consent_granted', 'consent_declined', 'consent_withdrawn', 'opted_out', 'opted_in', 'paused',
    'auto_paused', 'resumed', 'reactivated', 'disabled', 'released', 'unverified'
  ));
alter table public.sms_consent_events drop constraint if exists sms_consent_events_scope_check;
alter table public.sms_consent_events add constraint sms_consent_events_scope_check
  check (scope is null or scope in ('scheduled_invitations', 'journey_followups'));
alter table public.sms_consent_events drop constraint if exists sms_consent_events_channel_check;
alter table public.sms_consent_events add constraint sms_consent_events_channel_check
  check (channel is null or channel in ('sms', 'whatsapp'));

-- Contact rows now report their channel and last inbound time (WhatsApp's
-- 24-hour customer-service window starts at the learner's last message).
create or replace function public.sms_contact_json(c public.sms_contacts)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when c.id is null then null else jsonb_build_object(
    'id', c.id,
    'user_id', c.user_id,
    'phone_number', c.phone_number,
    'status', c.status,
    'channel', c.channel,
    'display_name', c.display_name,
    'language_level', c.language_level,
    'persona', c.persona,
    'verified_at', c.verified_at,
    'consent_at', c.consent_at,
    'consent_source', c.consent_source,
    'consent_version', c.consent_version,
    'welcome_sent_at', c.welcome_sent_at,
    'paused_at', c.paused_at,
    'paused_reason', c.paused_reason,
    'opted_out_at', c.opted_out_at,
    'opted_in_at', c.opted_in_at,
    'disabled_at', c.disabled_at,
    'last_inbound_at', c.last_inbound_at,
    'last_delivery_error', c.last_delivery_error,
    'last_delivery_error_at', c.last_delivery_error_at,
    'delivery_failure_count', c.delivery_failure_count
  ) end
$$;

-- Same as Phase 1, plus the pending verification's channel (resends must use it).
create or replace function public.sms_get_phone_state(p_user_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_contact sms_contacts;
  v_pending sms_phone_verifications;
begin
  select * into v_contact from sms_contacts
  where user_id = p_user_id and status <> 'released'
  limit 1;

  select * into v_pending from sms_phone_verifications
  where user_id = p_user_id and verified_at is null and invalidated_at is null
  limit 1;

  return jsonb_build_object(
    'contact', sms_contact_json(v_contact),
    'pending', case when v_pending.id is null then null else jsonb_build_object(
      'id', v_pending.id,
      'phone_number', v_pending.phone_number,
      'channel', v_pending.channel,
      'expires_at', v_pending.expires_at,
      'attempt_count', v_pending.attempt_count,
      'send_count', v_pending.send_count,
      'last_sent_at', v_pending.last_sent_at,
      'consent_source', v_pending.consent_source,
      'delivery_status', v_pending.delivery_status
    ) end
  );
end;
$$;

drop function if exists public.sms_start_verification(uuid, text, text, timestamptz, text, text);

create or replace function public.sms_start_verification(
  p_user_id uuid,
  p_phone_number text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_consent_source text,
  p_consent_version text,
  p_channel text default 'sms',
  p_consent_scheduled boolean default true,
  p_consent_journey boolean default true
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_contact sms_contacts;
  v_row sms_phone_verifications;
begin
  select * into v_contact from sms_contacts
  where user_id = p_user_id and status <> 'released'
  for update;

  -- Same number on the same channel: nothing to verify. A different channel
  -- always needs a fresh verification so channels never switch silently.
  if v_contact.id is not null and v_contact.phone_number = p_phone_number
     and v_contact.status = 'active' and v_contact.channel = coalesce(p_channel, 'sms') then
    insert into sms_preferences (user_id, consent_scheduled, consent_journey)
    values (p_user_id, coalesce(p_consent_scheduled, true), coalesce(p_consent_journey, true))
    on conflict (user_id) do nothing;
    return jsonb_build_object('status', 'already_active');
  end if;

  update sms_phone_verifications
  set invalidated_at = now(), updated_at = now()
  where user_id = p_user_id and verified_at is null and invalidated_at is null;

  insert into sms_phone_verifications (
    user_id, phone_number, code_hash, expires_at, consent_source, consent_version,
    channel, consent_scheduled, consent_journey
  ) values (
    p_user_id, p_phone_number, p_code_hash, p_expires_at, p_consent_source, p_consent_version,
    coalesce(p_channel, 'sms'), coalesce(p_consent_scheduled, true), coalesce(p_consent_journey, true)
  )
  returning * into v_row;

  return jsonb_build_object(
    'status', 'started',
    'id', v_row.id,
    'expires_at', v_row.expires_at,
    'last_sent_at', v_row.last_sent_at,
    'send_count', v_row.send_count
  );
end;
$$;

-- Same as Phase 2, plus: the verified channel and per-type consents are
-- copied to the contact and preferences, with one audit row per consent.
create or replace function public.sms_complete_verification(
  p_user_id uuid,
  p_verification_id uuid,
  p_confirm_transfer boolean,
  p_display_name text,
  p_language_level text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_ver sms_phone_verifications;
  v_owner sms_contacts;
  v_current sms_contacts;
  v_contact sms_contacts;
  v_replaced boolean := false;
  v_transferred boolean := false;
begin
  select * into v_ver from sms_phone_verifications
  where id = p_verification_id and user_id = p_user_id
  for update;

  if v_ver.id is null or v_ver.invalidated_at is not null then
    return jsonb_build_object('status', 'no_pending');
  end if;

  if v_ver.verified_at is not null then
    select * into v_contact from sms_contacts where id = v_ver.contact_id;
    return jsonb_build_object(
      'status', 'already_verified',
      'contact', sms_contact_json(v_contact),
      'needs_welcome', v_contact.id is not null and v_contact.status = 'active' and v_contact.welcome_sent_at is null
    );
  end if;

  if v_ver.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  begin
    select * into v_owner from sms_contacts
    where phone_number = v_ver.phone_number and status <> 'released' and user_id <> p_user_id
    for update;

    if v_owner.id is not null then
      if not coalesce(p_confirm_transfer, false) then
        return jsonb_build_object('status', 'transfer_required');
      end if;
      update sms_contacts
      set status = 'released', released_at = now(), release_reason = 'transferred'
      where id = v_owner.id;
      v_transferred := true;
    end if;

    select * into v_current from sms_contacts
    where user_id = p_user_id and status <> 'released'
    for update;

    if v_current.id is not null and v_current.phone_number = v_ver.phone_number then
      update sms_contacts
      set status = 'active',
          channel = v_ver.channel,
          verified_at = now(),
          consent_at = now(),
          consent_source = v_ver.consent_source,
          consent_version = v_ver.consent_version,
          opted_in_at = case when v_current.status = 'opted_out' then now() else opted_in_at end,
          paused_at = null,
          disabled_at = null,
          delivery_failure_count = 0,
          last_delivery_error = null,
          last_delivery_error_at = null,
          display_name = coalesce(nullif(p_display_name, ''), display_name),
          language_level = coalesce(nullif(p_language_level, ''), language_level)
      where id = v_current.id
      returning * into v_contact;
    else
      if v_current.id is not null then
        update sms_contacts
        set status = 'released', released_at = now(), release_reason = 'replaced'
        where id = v_current.id;
        v_replaced := true;
      end if;

      insert into sms_contacts (
        user_id, phone_number, channel, display_name, language_level, status,
        verified_at, consent_at, consent_source, consent_version
      ) values (
        p_user_id, v_ver.phone_number, v_ver.channel,
        coalesce(nullif(p_display_name, ''), 'Learner'),
        coalesce(nullif(p_language_level, ''), 'beginner'),
        'active', now(), now(), v_ver.consent_source, v_ver.consent_version
      )
      returning * into v_contact;
    end if;
  exception when unique_violation then
    -- Another account claimed this number at the same moment.
    return jsonb_build_object('status', 'conflict');
  end;

  if v_transferred then
    insert into sms_transfer_audit (
      phone_number, from_user_id, from_contact_id, to_user_id, to_contact_id, verification_id
    ) values (
      v_ver.phone_number, v_owner.user_id, v_owner.id, p_user_id, v_contact.id, v_ver.id
    );
  end if;

  update sms_phone_verifications
  set verified_at = now(), contact_id = v_contact.id, updated_at = now()
  where id = v_ver.id;

  update sms_phone_verifications
  set invalidated_at = now(), updated_at = now()
  where phone_number = v_ver.phone_number
    and id <> v_ver.id
    and verified_at is null
    and invalidated_at is null;

  insert into sms_preferences (user_id, consent_scheduled, consent_journey)
  values (p_user_id, v_ver.consent_scheduled, v_ver.consent_journey)
  on conflict (user_id) do update
  set consent_scheduled = excluded.consent_scheduled,
      consent_journey = excluded.consent_journey,
      updated_at = now();

  insert into sms_consent_events (user_id, contact_id, phone_number, event, detail, consent_version, channel, scope, source)
  values
    (p_user_id, v_contact.id, v_ver.phone_number,
     case when v_ver.consent_scheduled then 'consent_granted' else 'consent_declined' end,
     v_ver.consent_source, v_ver.consent_version, v_ver.channel, 'scheduled_invitations', v_ver.consent_source),
    (p_user_id, v_contact.id, v_ver.phone_number,
     case when v_ver.consent_journey then 'consent_granted' else 'consent_declined' end,
     v_ver.consent_source, v_ver.consent_version, v_ver.channel, 'journey_followups', v_ver.consent_source);

  return jsonb_build_object(
    'status', 'verified',
    'contact', sms_contact_json(v_contact),
    'replaced', v_replaced,
    'transferred', v_transferred,
    'needs_welcome', v_contact.welcome_sent_at is null
  );
end;
$$;

-- Same as Phase 1, plus a 'preview' send also counts as the welcome so the
-- generic welcome is never sent on top of the onboarding preview.
create or replace function public.sms_complete_outbound(
  p_message_id uuid,
  p_body text,
  p_provider_message_id text,
  p_status text,
  p_error text,
  p_retryable boolean,
  p_recipient_opted_out boolean
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_message sms_messages;
begin
  update sms_messages
  set body = coalesce(p_body, body),
      provider_message_id = coalesce(p_provider_message_id, provider_message_id),
      status = p_status,
      error = p_error,
      retryable = coalesce(p_retryable, false),
      sent_at = case when p_provider_message_id is not null then now() else sent_at end,
      status_updated_at = now(),
      updated_at = now()
  where id = p_message_id
  returning * into v_message;

  if v_message.id is null then
    return jsonb_build_object('ok', false);
  end if;

  if v_message.kind in ('welcome', 'preview') and p_provider_message_id is not null then
    update sms_contacts set welcome_sent_at = coalesce(welcome_sent_at, now())
    where id = v_message.contact_id;
  end if;

  if p_recipient_opted_out then
    update sms_contacts
    set status = 'opted_out', opted_out_at = now()
    where id = v_message.contact_id and status in ('active', 'paused', 'disabled');
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

drop function if exists public.sms_handle_inbound(text, text, text, text, timestamptz, text, jsonb);

-- Same as Phase 2, plus: records the channel's last inbound time, and a
-- message on a channel the learner did not verify gets no AI reply (STOP
-- and HELP are always honored).
create or replace function public.sms_handle_inbound(
  p_provider text,
  p_provider_message_id text,
  p_from text,
  p_body text,
  p_occurred_at timestamptz,
  p_keyword text,
  p_raw_payload jsonb,
  p_channel text default 'sms'
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_contact sms_contacts;
  v_message_id uuid;
  v_duplicate boolean := false;
  v_at timestamptz := least(coalesce(p_occurred_at, now()), now());
begin
  select * into v_contact from sms_contacts
  where phone_number = p_from and status <> 'released'
  for update;

  if v_contact.id is null then
    return jsonb_build_object('outcome', 'unknown_number');
  end if;

  insert into sms_messages (
    contact_id, user_id, direction, body, provider, provider_message_id,
    status, kind, raw_payload, occurred_at
  ) values (
    v_contact.id, v_contact.user_id, 'inbound', coalesce(p_body, ''), p_provider,
    p_provider_message_id, 'received', 'inbound', p_raw_payload, v_at
  )
  on conflict (provider, provider_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    v_duplicate := true;
    select id into v_message_id from sms_messages
    where provider = p_provider and provider_message_id = p_provider_message_id;
  end if;

  if not v_duplicate and v_contact.channel = coalesce(p_channel, 'sms') then
    update sms_contacts
    set last_inbound_at = greatest(coalesce(last_inbound_at, v_at), v_at)
    where id = v_contact.id
    returning * into v_contact;
  end if;

  if p_keyword is not null and v_duplicate then
    return jsonb_build_object('outcome', 'duplicate', 'message_id', v_message_id);
  end if;

  if p_keyword = 'stop' then
    if v_contact.status <> 'opted_out' and v_at >= coalesce(v_contact.opted_in_at, '-infinity'::timestamptz) then
      update sms_contacts set status = 'opted_out', opted_out_at = v_at where id = v_contact.id;
      return jsonb_build_object('outcome', 'opted_out', 'message_id', v_message_id, 'contact_id', v_contact.id);
    end if;
    return jsonb_build_object('outcome', 'already_opted_out', 'message_id', v_message_id, 'contact_id', v_contact.id);
  end if;

  if p_keyword = 'help' then
    return jsonb_build_object('outcome', 'help', 'message_id', v_message_id, 'contact_id', v_contact.id);
  end if;

  if v_contact.channel <> coalesce(p_channel, 'sms') then
    return jsonb_build_object('outcome', 'channel_mismatch', 'message_id', v_message_id, 'contact_id', v_contact.id);
  end if;

  if p_keyword = 'start' then
    if v_contact.status = 'opted_out'
       and v_contact.verified_at is not null
       and v_contact.consent_at is not null
       and v_at >= coalesce(v_contact.opted_out_at, '-infinity'::timestamptz) then
      update sms_contacts set status = 'active', opted_in_at = v_at where id = v_contact.id;
      return jsonb_build_object('outcome', 'resubscribed', 'message_id', v_message_id, 'contact_id', v_contact.id);
    end if;
    return jsonb_build_object(
      'outcome', case when v_contact.verified_at is null then 'start_unverified' else 'start_ignored' end,
      'message_id', v_message_id, 'contact_id', v_contact.id
    );
  end if;

  if v_contact.status not in ('active', 'paused') then
    return jsonb_build_object('outcome', 'ignored_' || v_contact.status, 'message_id', v_message_id, 'contact_id', v_contact.id);
  end if;

  return jsonb_build_object(
    'outcome', 'reply',
    'duplicate', v_duplicate,
    'message_id', v_message_id,
    'contact', sms_contact_json(v_contact)
  );
end;
$$;

-- Phase 2 keys plus consent_scheduled, consent_journey, writing_system,
-- quiet_start, and quiet_end. Consent changes are audited per type.
create or replace function public.sms_update_preferences(p_user_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_before sms_preferences;
  v_prefs sms_preferences;
  v_contact sms_contacts;
begin
  insert into sms_preferences (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_before from sms_preferences where user_id = p_user_id for update;

  update sms_preferences set
    persona = case when p_patch ? 'persona' then p_patch->>'persona' else persona end,
    correction_mode = case when p_patch ? 'correction_mode' then p_patch->>'correction_mode' else correction_mode end,
    scaffolding = case when p_patch ? 'scaffolding' then p_patch->>'scaffolding' else scaffolding end,
    days_per_week = case when p_patch ? 'days_per_week' then (p_patch->>'days_per_week')::smallint else days_per_week end,
    preferred_days = case when p_patch ? 'preferred_days'
      then array(select (value)::smallint from jsonb_array_elements_text(p_patch->'preferred_days') order by 1)
      else preferred_days end,
    openers_per_week = case when p_patch ? 'openers_per_week'
      then (p_patch->>'openers_per_week')::smallint else openers_per_week end,
    auto_adjust = case when p_patch ? 'auto_adjust' then (p_patch->>'auto_adjust')::boolean else auto_adjust end,
    delivery_windows = case when p_patch ? 'delivery_windows' then p_patch->'delivery_windows' else delivery_windows end,
    timezone = case when p_patch ? 'timezone' then p_patch->>'timezone' else timezone end,
    consent_scheduled = case when p_patch ? 'consent_scheduled' then (p_patch->>'consent_scheduled')::boolean else consent_scheduled end,
    consent_journey = case when p_patch ? 'consent_journey' then (p_patch->>'consent_journey')::boolean else consent_journey end,
    writing_system = case when p_patch ? 'writing_system' then p_patch->>'writing_system' else writing_system end,
    quiet_start = case when p_patch ? 'quiet_start' then (p_patch->>'quiet_start')::smallint else quiet_start end,
    quiet_end = case when p_patch ? 'quiet_end' then (p_patch->>'quiet_end')::smallint else quiet_end end,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_prefs;

  select * into v_contact from sms_contacts where user_id = p_user_id and status <> 'released' limit 1;

  if v_contact.id is not null then
    update sms_contacts set persona = v_prefs.persona
    where id = v_contact.id and persona is distinct from v_prefs.persona;

    if v_prefs.consent_scheduled is distinct from v_before.consent_scheduled then
      insert into sms_consent_events (user_id, contact_id, phone_number, event, detail, consent_version, channel, scope, source)
      values (p_user_id, v_contact.id, v_contact.phone_number,
              case when v_prefs.consent_scheduled then 'consent_granted' else 'consent_withdrawn' end,
              'settings', v_contact.consent_version, v_contact.channel, 'scheduled_invitations', 'account_settings');
    end if;
    if v_prefs.consent_journey is distinct from v_before.consent_journey then
      insert into sms_consent_events (user_id, contact_id, phone_number, event, detail, consent_version, channel, scope, source)
      values (p_user_id, v_contact.id, v_contact.phone_number,
              case when v_prefs.consent_journey then 'consent_granted' else 'consent_withdrawn' end,
              'settings', v_contact.consent_version, v_contact.channel, 'journey_followups', 'account_settings');
    end if;
  end if;

  return to_jsonb(v_prefs);
end;
$$;

-- What the onboarding preview chat needs to personalize its messages.
create or replace function public.sms_get_onboarding_snapshot(p_user_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when p.user_id is null then null else jsonb_build_object(
    'primary_goal', p.primary_goal,
    'primary_goal_label', p.primary_goal_label,
    'goal_other_text', p.goal_other_text,
    'provisional_level', p.provisional_level,
    'interests', coalesce((
      select jsonb_agg(jsonb_build_object('key', i.interest_key, 'label', i.label, 'is_custom', i.is_custom)
                       order by i.position, i.interest_key)
      from onboarding_interests i where i.user_id = p.user_id
    ), '[]'::jsonb),
    'huahua_preferences', p.huahua_preferences
  ) end
  from (select 1) one
  left join onboarding_progress p on p.user_id = p_user_id
$$;

-- The learner's most recent onboarding preview thread and its messages.
create or replace function public.sms_get_preview_thread(p_user_id uuid, p_message_limit integer)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when t.id is null then null else jsonb_build_object(
    'thread', sms_thread_json(t),
    'messages', (
      select coalesce(jsonb_agg(jsonb_build_object('direction', m.direction, 'body', m.body, 'at', m.at, 'status', m.status)
                                order by m.at), '[]'::jsonb)
      from (
        select direction, body, status, coalesce(occurred_at, sent_at, created_at) as at
        from sms_messages
        where thread_id = t.id and redacted_at is null and body <> ''
          and (direction = 'inbound' or provider_message_id is not null)
        order by coalesce(occurred_at, sent_at, created_at) desc
        limit p_message_limit
      ) m
    )
  ) end
  from (select 1) one
  left join lateral (
    select * from sms_threads
    where user_id = p_user_id and origin = 'preview'
    order by started_at desc
    limit 1
  ) t on true
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'sms_contact_json(public.sms_contacts)',
    'sms_get_phone_state(uuid)',
    'sms_start_verification(uuid, text, text, timestamptz, text, text, text, boolean, boolean)',
    'sms_complete_verification(uuid, uuid, boolean, text, text)',
    'sms_complete_outbound(uuid, text, text, text, text, boolean, boolean)',
    'sms_handle_inbound(text, text, text, text, timestamptz, text, jsonb, text)',
    'sms_update_preferences(uuid, jsonb)',
    'sms_get_onboarding_snapshot(uuid)',
    'sms_get_preview_thread(uuid, integer)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
