-- Huahua Phase 2: personas, correction modes, scheduling, Journey-triggered
-- openers, message allowance, word comfort, consent audit, and retention.
--
-- Builds on 20261103_000001_sms_prototype.sql and
-- 20261104_000001_sms_phone_verification.sql (do not edit those files).
-- New tables are service-role only: the website reads them through
-- authenticated API routes that filter by the signed-in user.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- sms_contacts: why a number is paused
-- ---------------------------------------------------------------------------

alter table public.sms_contacts add column if not exists paused_reason text;

alter table public.sms_contacts drop constraint if exists sms_contacts_paused_reason_check;
alter table public.sms_contacts add constraint sms_contacts_paused_reason_check
  check (paused_reason is null or paused_reason in ('user', 'no_response'));

create or replace function public.sms_contacts_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.is_active := new.status = 'active';
  new.opted_out := new.status = 'opted_out';
  if new.status <> 'paused' then
    new.paused_reason := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- sms_preferences: persona, correction, scaffolding, and schedule
-- ---------------------------------------------------------------------------

create table if not exists public.sms_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  persona text not null default 'friendly_friend'
    check (persona in ('friendly_friend', 'focused_coach', 'accountability_partner', 'professional_partner')),
  correction_mode text not null default 'gentle'
    check (correction_mode in ('gentle', 'coach', 'hint_first', 'conversation_only')),
  scaffolding text not null default 'auto'
    check (scaffolding in ('auto', 'more', 'less')),
  days_per_week smallint not null default 3 check (days_per_week between 1 and 7),
  -- 0 = Sunday … 6 = Saturday, in the learner's time zone.
  preferred_days smallint[] not null default '{}'
    check (preferred_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  -- Proactive openers per week. Null follows the days-per-week default.
  openers_per_week smallint check (openers_per_week is null or openers_per_week between 0 and 7),
  auto_adjust boolean not null default true,
  -- [{"start": minutes, "end": minutes}] in local time, validated by the app.
  delivery_windows jsonb not null default '[{"start": 1080, "end": 1260}]'::jsonb
    check (jsonb_typeof(delivery_windows) = 'array'
      and jsonb_array_length(delivery_windows) between 1 and 3),
  timezone text check (timezone is null or char_length(timezone) between 1 and 64),
  unanswered_openers smallint not null default 0 check (unanswered_openers >= 0),
  frequency_reduced_at timestamptz,
  control_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sms_preferences enable row level security;

-- ---------------------------------------------------------------------------
-- sms_jobs: idempotent proactive-opener queue
-- ---------------------------------------------------------------------------

create table if not exists public.sms_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('journey_opener', 'scheduled_opener')),
  idempotency_key text not null unique,
  journey_island_id uuid references public.journey_islands(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'skipped', 'failed', 'cancelled')),
  not_before timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  lease_until timestamptz,
  outcome text,
  last_error text,
  message_id uuid references public.sms_messages(id) on delete set null,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_jobs_due_idx on public.sms_jobs (not_before) where status = 'pending';
create index if not exists sms_jobs_lease_idx on public.sms_jobs (lease_until) where status = 'processing';
create index if not exists sms_jobs_user_idx on public.sms_jobs (user_id, created_at desc);

alter table public.sms_jobs enable row level security;

-- ---------------------------------------------------------------------------
-- sms_threads: one conversation (opener or learner-started) at a time
-- ---------------------------------------------------------------------------

create table if not exists public.sms_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.sms_contacts(id) on delete cascade,
  origin text not null check (origin in ('welcome', 'opener', 'control', 'inbound')),
  status text not null default 'open' check (status in ('open', 'closed')),
  outcome text check (outcome is null or outcome in ('answered', 'ignored', 'completed')),
  job_id uuid references public.sms_jobs(id) on delete set null,
  journey_island_id uuid references public.journey_islands(id) on delete set null,
  inbound_count integer not null default 0 check (inbound_count >= 0),
  outbound_count integer not null default 0 check (outbound_count >= 0),
  conversation_state text not null default 'opening'
    check (conversation_state in ('opening', 'practicing', 'wrapping_up', 'closed')),
  -- Session-only overrides from in-message commands (pinyin, easier, …).
  session jsonb not null default '{}'::jsonb check (jsonb_typeof(session) = 'object'),
  target_vocab jsonb not null default '[]'::jsonb check (jsonb_typeof(target_vocab) = 'array'),
  started_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sms_threads_open_contact_key
  on public.sms_threads (contact_id) where status = 'open';
create index if not exists sms_threads_user_started_idx on public.sms_threads (user_id, started_at desc);
create index if not exists sms_threads_closed_idx on public.sms_threads (closed_at) where status = 'closed';

alter table public.sms_threads enable row level security;

-- ---------------------------------------------------------------------------
-- sms_messages: threads, segment metering, structured metadata, redaction
-- ---------------------------------------------------------------------------

alter table public.sms_messages
  add column if not exists thread_id uuid references public.sms_threads(id) on delete set null,
  add column if not exists segments integer,
  add column if not exists metered boolean not null default false,
  add column if not exists usage_period_start timestamptz,
  add column if not exists metadata jsonb,
  add column if not exists redacted_at timestamptz;

alter table public.sms_messages drop constraint if exists sms_messages_segments_check;
alter table public.sms_messages add constraint sms_messages_segments_check
  check (segments is null or segments >= 0);

alter table public.sms_messages drop constraint if exists sms_messages_kind_check;
alter table public.sms_messages add constraint sms_messages_kind_check
  check (kind is null or kind in (
    'inbound', 'reply', 'fallback', 'welcome', 'help', 'resubscribed', 'manual',
    'opener', 'control', 'command', 'notice', 'safety', 'persona'
  ));

create index if not exists sms_messages_thread_idx on public.sms_messages (thread_id, created_at);
create index if not exists sms_messages_retention_idx
  on public.sms_messages (coalesce(occurred_at, created_at)) where redacted_at is null;

-- ---------------------------------------------------------------------------
-- sms_usage_periods: segment allowance per billing period
-- ---------------------------------------------------------------------------

create table if not exists public.sms_usage_periods (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  plan_key text not null,
  allowance_segments integer not null check (allowance_segments >= 0),
  used_segments integer not null default 0 check (used_segments >= 0),
  warned_at timestamptz,
  exhausted_at timestamptz,
  exhausted_notice_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start),
  check (period_end > period_start)
);

alter table public.sms_usage_periods enable row level security;

-- ---------------------------------------------------------------------------
-- sms_word_comfort: texting comfort per word. Separate from quiz mastery,
-- streaks, and island progress; nothing here adds words to quizzes.
-- ---------------------------------------------------------------------------

create table if not exists public.sms_word_comfort (
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null check (char_length(word) between 1 and 32),
  pinyin text check (pinyin is null or char_length(pinyin) <= 80),
  english text check (english is null or char_length(english) <= 120),
  comfort_score numeric(4, 3) not null default 0.300 check (comfort_score between 0 and 1),
  success_count integer not null default 0 check (success_count >= 0),
  struggle_count integer not null default 0 check (struggle_count >= 0),
  understood_count integer not null default 0 check (understood_count >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  pinyin_requests integer not null default 0 check (pinyin_requests >= 0),
  translation_requests integer not null default 0 check (translation_requests >= 0),
  easier_requests integer not null default 0 check (easier_requests >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  ignored_count integer not null default 0 check (ignored_count >= 0),
  last_signal text,
  last_practiced_at timestamptz,
  source text not null default 'conversation' check (source in ('journey', 'conversation')),
  journey_island_id uuid references public.journey_islands(id) on delete set null,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, word)
);

create index if not exists sms_word_comfort_score_idx on public.sms_word_comfort (user_id, comfort_score);
create index if not exists sms_word_comfort_recent_idx on public.sms_word_comfort (user_id, last_practiced_at desc);

alter table public.sms_word_comfort enable row level security;

-- ---------------------------------------------------------------------------
-- Interest, transfer audit, consent audit
-- ---------------------------------------------------------------------------

create table if not exists public.sms_country_interest (
  user_id uuid not null references auth.users(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, country_code)
);

alter table public.sms_country_interest enable row level security;

create table if not exists public.sms_transfer_audit (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  from_user_id uuid references auth.users(id) on delete set null,
  from_contact_id uuid references public.sms_contacts(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  to_contact_id uuid references public.sms_contacts(id) on delete set null,
  verification_id uuid references public.sms_phone_verifications(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.sms_transfer_audit enable row level security;

create table if not exists public.sms_consent_events (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.sms_contacts(id) on delete set null,
  phone_number text not null,
  event text not null check (event in (
    'consent_granted', 'opted_out', 'opted_in', 'paused', 'auto_paused', 'resumed',
    'reactivated', 'disabled', 'released', 'unverified'
  )),
  detail text,
  consent_version text,
  occurred_at timestamptz not null default now()
);

create index if not exists sms_consent_events_user_idx on public.sms_consent_events (user_id, occurred_at desc);

alter table public.sms_consent_events enable row level security;

-- Service-role-only access for every Phase 2 table.
do $$
declare
  t text;
begin
  foreach t in array array[
    'sms_preferences', 'sms_jobs', 'sms_threads', 'sms_usage_periods', 'sms_word_comfort',
    'sms_country_interest', 'sms_transfer_audit', 'sms_consent_events'
  ]
  loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('drop policy if exists "Service role only" on public.%I', t);
    execute format('create policy "Service role only" on public.%I for all to service_role using (true) with check (true)', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Consent audit trail. Every consent or status change on a contact is
-- recorded here; these rows survive message retention and history deletion.
-- ---------------------------------------------------------------------------

create or replace function public.sms_contacts_consent_audit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.consent_at is not null then
      insert into sms_consent_events (user_id, contact_id, phone_number, event, detail, consent_version)
      values (new.user_id, new.id, new.phone_number, 'consent_granted', new.consent_source, new.consent_version);
    end if;
    return new;
  end if;

  if new.consent_at is not null and new.consent_at is distinct from old.consent_at then
    insert into sms_consent_events (user_id, contact_id, phone_number, event, detail, consent_version)
    values (new.user_id, new.id, new.phone_number, 'consent_granted', new.consent_source, new.consent_version);
  end if;

  if new.status is distinct from old.status then
    insert into sms_consent_events (user_id, contact_id, phone_number, event, detail, consent_version)
    values (
      new.user_id, new.id, new.phone_number,
      case new.status
        when 'paused' then case when new.paused_reason = 'no_response' then 'auto_paused' else 'paused' end
        when 'active' then case old.status
          when 'opted_out' then 'opted_in'
          when 'paused' then 'resumed'
          else 'reactivated' end
        else new.status
      end,
      case when new.status = 'released' then new.release_reason end,
      new.consent_version
    );

    if new.status = 'released' then
      update sms_threads
      set status = 'closed', outcome = coalesce(outcome, 'completed'), closed_at = now(), updated_at = now()
      where contact_id = new.id and status = 'open';
      if new.release_reason in ('disconnected', 'transferred') then
        update sms_jobs
        set status = 'cancelled', outcome = 'contact_released', finished_at = now(), updated_at = now()
        where user_id = new.user_id and status in ('pending', 'processing');
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sms_contacts_consent_audit on public.sms_contacts;
create trigger sms_contacts_consent_audit
  after insert or update on public.sms_contacts
  for each row execute function public.sms_contacts_consent_audit();

-- ---------------------------------------------------------------------------
-- Replaced Phase 1 functions (same signatures)
-- ---------------------------------------------------------------------------

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
    'last_delivery_error', c.last_delivery_error,
    'last_delivery_error_at', c.last_delivery_error_at,
    'delivery_failure_count', c.delivery_failure_count
  ) end
$$;

-- Same as Phase 1, plus: transfers are written to sms_transfer_audit, and a
-- concurrent claim of the same number returns 'conflict' instead of failing.
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
        user_id, phone_number, display_name, language_level, status,
        verified_at, consent_at, consent_source, consent_version
      ) values (
        p_user_id, v_ver.phone_number,
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

  insert into sms_preferences (user_id) values (p_user_id) on conflict (user_id) do nothing;

  return jsonb_build_object(
    'status', 'verified',
    'contact', sms_contact_json(v_contact),
    'replaced', v_replaced,
    'transferred', v_transferred,
    'needs_welcome', v_contact.welcome_sent_at is null
  );
end;
$$;

create or replace function public.sms_set_paused(p_user_id uuid, p_paused boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_contact sms_contacts;
begin
  select * into v_contact from sms_contacts
  where user_id = p_user_id and status <> 'released'
  for update;

  if v_contact.id is null then
    return jsonb_build_object('status', 'no_contact');
  end if;

  if p_paused then
    if v_contact.status in ('active', 'paused') then
      update sms_contacts
      set status = 'paused', paused_at = coalesce(paused_at, now()), paused_reason = 'user'
      where id = v_contact.id returning * into v_contact;
    else
      return jsonb_build_object('status', 'invalid_state', 'contact', sms_contact_json(v_contact));
    end if;
  else
    if v_contact.status = 'paused' then
      update sms_contacts set status = 'active', paused_at = null
      where id = v_contact.id returning * into v_contact;
      update sms_preferences
      set unanswered_openers = 0, control_sent_at = null, updated_at = now()
      where user_id = p_user_id;
    elsif v_contact.status <> 'active' then
      return jsonb_build_object('status', 'invalid_state', 'contact', sms_contact_json(v_contact));
    end if;
  end if;

  return jsonb_build_object('status', 'ok', 'contact', sms_contact_json(v_contact));
end;
$$;

-- Pausing stops proactive texts only. Replies to the learner's own texts
-- continue while paused, so only openers and control messages need 'active'.
create or replace function public.sms_claim_outbound(
  p_contact_id uuid,
  p_idempotency_key text,
  p_kind text,
  p_provider text,
  p_require_active boolean,
  p_stale_seconds integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_contact sms_contacts;
  v_message sms_messages;
begin
  select * into v_contact from sms_contacts where id = p_contact_id;
  if v_contact.id is null or v_contact.status = 'released' then
    return jsonb_build_object('claimed', false, 'reason', 'contact_unavailable');
  end if;
  if p_require_active and (
    v_contact.status not in ('active', 'paused')
    or (p_kind in ('opener', 'control') and v_contact.status <> 'active')
  ) then
    return jsonb_build_object('claimed', false, 'reason', 'contact_' || v_contact.status);
  end if;

  insert into sms_messages (
    contact_id, user_id, direction, body, provider, status, kind,
    idempotency_key, send_attempts
  ) values (
    v_contact.id, v_contact.user_id, 'outbound', '', p_provider, 'preparing', p_kind,
    p_idempotency_key, 1
  )
  on conflict (idempotency_key) where idempotency_key is not null
  do update set
    status = 'preparing',
    error = null,
    retryable = false,
    send_attempts = sms_messages.send_attempts + 1,
    updated_at = now()
  where (sms_messages.status = 'failed' and sms_messages.retryable)
     or (sms_messages.status = 'preparing'
         and sms_messages.updated_at < now() - make_interval(secs => p_stale_seconds))
  returning * into v_message;

  if v_message.id is null then
    return jsonb_build_object('claimed', false, 'reason', 'duplicate');
  end if;

  return jsonb_build_object(
    'claimed', true,
    'message_id', v_message.id,
    'phone_number', v_contact.phone_number,
    'contact', sms_contact_json(v_contact)
  );
end;
$$;

-- Same as Phase 1, except paused contacts still get replies.
create or replace function public.sms_handle_inbound(
  p_provider text,
  p_provider_message_id text,
  p_from text,
  p_body text,
  p_occurred_at timestamptz,
  p_keyword text,
  p_raw_payload jsonb
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

  if p_keyword = 'help' then
    return jsonb_build_object('outcome', 'help', 'message_id', v_message_id, 'contact_id', v_contact.id);
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

-- ---------------------------------------------------------------------------
-- Context and preferences
-- ---------------------------------------------------------------------------

-- Everything the processor and settings page need about one learner. Reads
-- app tables defensively so SMS keeps working if one of them is missing.
create or replace function public.sms_get_user_context(p_user_id uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_contact sms_contacts;
  v_prefs sms_preferences;
  v_profile jsonb;
  v_billing jsonb;
  v_subs jsonb;
begin
  select * into v_contact from sms_contacts
  where user_id = p_user_id and status <> 'released'
  limit 1;

  select * into v_prefs from sms_preferences where user_id = p_user_id;

  begin
    select to_jsonb(up) into v_profile from user_profiles up where up.user_id = p_user_id limit 1;
  exception when undefined_table or undefined_column then
    v_profile := null;
  end;

  begin
    select to_jsonb(p) into v_billing from profiles p where p.id = p_user_id;
  exception when undefined_table or undefined_column then
    v_billing := null;
  end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'product', s.product,
      'status', s.status,
      'current_period_end', s.current_period_end
    )), '[]'::jsonb)
    into v_subs
    from product_subscriptions s where s.user_id = p_user_id;
  exception when undefined_table or undefined_column then
    v_subs := null;
  end;

  return jsonb_build_object(
    'contact', sms_contact_json(v_contact),
    'preferences', case when v_prefs.user_id is null then null else to_jsonb(v_prefs) end,
    'profile', case when v_profile is null then null else jsonb_build_object(
      'cefr_level', v_profile->>'cefr_level',
      'hsk_current_level', v_profile->'hsk_current_level',
      'timezone', v_profile->>'timezone'
    ) end,
    'billing', case when v_billing is null then null else jsonb_build_object(
      'plan', v_billing->>'plan',
      'current_period_end', v_billing->>'current_period_end'
    ) end,
    'subscriptions', v_subs
  );
end;
$$;

-- p_patch keys: persona, correction_mode, scaffolding, days_per_week,
-- preferred_days, openers_per_week (null = default), auto_adjust,
-- delivery_windows, timezone. Values are validated by the app and again by
-- the table constraints.
create or replace function public.sms_update_preferences(p_user_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_prefs sms_preferences;
begin
  insert into sms_preferences (user_id) values (p_user_id) on conflict (user_id) do nothing;

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
    updated_at = now()
  where user_id = p_user_id
  returning * into v_prefs;

  update sms_contacts set persona = v_prefs.persona
  where user_id = p_user_id and status <> 'released' and persona is distinct from v_prefs.persona;

  return to_jsonb(v_prefs);
end;
$$;

-- Automatic frequency step-down after unanswered openers.
create or replace function public.sms_reduce_frequency(p_user_id uuid, p_openers_per_week integer, p_now timestamptz)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_prefs sms_preferences;
begin
  update sms_preferences
  set openers_per_week = p_openers_per_week, frequency_reduced_at = p_now, updated_at = now()
  where user_id = p_user_id
  returning * into v_prefs;
  return to_jsonb(v_prefs);
end;
$$;

create or replace function public.sms_auto_pause(p_contact_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_contact sms_contacts;
begin
  update sms_contacts
  set status = 'paused', paused_at = now(), paused_reason = 'no_response'
  where id = p_contact_id and status = 'active'
  returning * into v_contact;
  return jsonb_build_object('paused', v_contact.id is not null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Threads
-- ---------------------------------------------------------------------------

create or replace function public.sms_thread_json(t public.sms_threads)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when t.id is null then null else jsonb_build_object(
    'id', t.id,
    'origin', t.origin,
    'status', t.status,
    'outcome', t.outcome,
    'journey_island_id', t.journey_island_id,
    'inbound_count', t.inbound_count,
    'outbound_count', t.outbound_count,
    'conversation_state', t.conversation_state,
    'session', t.session,
    'target_vocab', t.target_vocab,
    'started_at', t.started_at,
    'last_inbound_at', t.last_inbound_at,
    'last_outbound_at', t.last_outbound_at
  ) end
$$;

-- Closes the contact's open thread. An opener or control message that got
-- no reply counts as unanswered.
create or replace function public.sms_settle_open_thread(p_contact_id uuid, p_now timestamptz)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_thread sms_threads;
  v_user uuid;
  v_ignored boolean := false;
  v_prefs sms_preferences;
begin
  select user_id into v_user from sms_contacts where id = p_contact_id;
  if v_user is null then
    return jsonb_build_object('closed', false);
  end if;
  insert into sms_preferences (user_id) values (v_user) on conflict (user_id) do nothing;

  select * into v_thread from sms_threads
  where contact_id = p_contact_id and status = 'open'
  for update;

  if v_thread.id is not null then
    v_ignored := v_thread.origin in ('opener', 'control') and v_thread.inbound_count = 0;
    update sms_threads
    set status = 'closed',
        outcome = case when v_ignored then 'ignored' when inbound_count > 0 then 'answered' else 'completed' end,
        conversation_state = 'closed',
        closed_at = p_now,
        updated_at = now()
    where id = v_thread.id;
    if v_ignored then
      update sms_preferences
      set unanswered_openers = unanswered_openers + 1, updated_at = now()
      where user_id = v_user;
    end if;
  end if;

  select * into v_prefs from sms_preferences where user_id = v_user;
  return jsonb_build_object(
    'closed', v_thread.id is not null,
    'closed_origin', v_thread.origin,
    'ignored', v_ignored,
    'unanswered_openers', v_prefs.unanswered_openers,
    'control_sent_at', v_prefs.control_sent_at,
    'frequency_reduced_at', v_prefs.frequency_reduced_at
  );
end;
$$;

create or replace function public.sms_open_thread(
  p_contact_id uuid,
  p_origin text,
  p_job_id uuid,
  p_journey_island_id uuid,
  p_target_vocab jsonb,
  p_session jsonb,
  p_now timestamptz
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_contact sms_contacts;
  v_thread sms_threads;
begin
  select * into v_contact from sms_contacts where id = p_contact_id for update;
  if v_contact.id is null or v_contact.status = 'released' then
    return null;
  end if;
  perform sms_settle_open_thread(p_contact_id, p_now);

  insert into sms_threads (
    user_id, contact_id, origin, job_id, journey_island_id, target_vocab, session, started_at
  ) values (
    v_contact.user_id, v_contact.id, p_origin, p_job_id, p_journey_island_id,
    coalesce(p_target_vocab, '[]'::jsonb), coalesce(p_session, '{}'::jsonb), p_now
  )
  returning * into v_thread;

  if p_origin = 'control' then
    update sms_preferences set control_sent_at = p_now, updated_at = now() where user_id = v_contact.user_id;
  end if;

  return sms_thread_json(v_thread);
end;
$$;

-- Files an inbound text under the open thread (or a new one) exactly once,
-- and resets the non-response counters because the learner engaged.
create or replace function public.sms_attach_inbound(
  p_contact_id uuid,
  p_message_id uuid,
  p_now timestamptz,
  p_stale_seconds integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_contact sms_contacts;
  v_message sms_messages;
  v_thread sms_threads;
  v_prefs sms_preferences;
  v_last timestamptz;
begin
  select * into v_contact from sms_contacts where id = p_contact_id for update;
  select * into v_message from sms_messages where id = p_message_id and contact_id = p_contact_id for update;
  if v_contact.id is null or v_message.id is null then
    return null;
  end if;

  insert into sms_preferences (user_id) values (v_contact.user_id) on conflict (user_id) do nothing;
  select * into v_prefs from sms_preferences where user_id = v_contact.user_id;

  if v_message.thread_id is not null then
    select * into v_thread from sms_threads where id = v_message.thread_id;
    return jsonb_build_object(
      'thread', sms_thread_json(v_thread),
      'already_attached', true,
      'control_sent_at', v_prefs.control_sent_at,
      'unanswered_openers', v_prefs.unanswered_openers
    );
  end if;

  select * into v_thread from sms_threads
  where contact_id = p_contact_id and status = 'open'
  for update;

  if v_thread.id is not null then
    v_last := greatest(v_thread.started_at, coalesce(v_thread.last_inbound_at, v_thread.started_at),
                       coalesce(v_thread.last_outbound_at, v_thread.started_at));
    -- An unanswered opener stays open longer so a late reply still counts as an answer.
    if v_last < p_now - make_interval(secs => case
         when v_thread.inbound_count = 0 and v_thread.origin <> 'inbound' then greatest(p_stale_seconds, 172800)
         else p_stale_seconds end) then
      update sms_threads
      set status = 'closed',
          outcome = case when inbound_count > 0 then 'answered'
                         when origin in ('opener', 'control') then 'ignored'
                         else 'completed' end,
          conversation_state = 'closed',
          closed_at = p_now,
          updated_at = now()
      where id = v_thread.id;
      v_thread := null;
    end if;
  end if;

  if v_thread.id is null then
    insert into sms_threads (user_id, contact_id, origin, started_at)
    values (v_contact.user_id, v_contact.id, 'inbound', p_now)
    returning * into v_thread;
  end if;

  update sms_threads
  set inbound_count = inbound_count + 1,
      last_inbound_at = p_now,
      outcome = case when origin in ('opener', 'control', 'welcome') then 'answered' else outcome end,
      conversation_state = case when conversation_state = 'opening' then 'practicing' else conversation_state end,
      updated_at = now()
  where id = v_thread.id
  returning * into v_thread;

  update sms_messages set thread_id = v_thread.id, updated_at = now() where id = p_message_id;

  update sms_preferences
  set unanswered_openers = 0, control_sent_at = null, updated_at = now()
  where user_id = v_contact.user_id;

  return jsonb_build_object(
    'thread', sms_thread_json(v_thread),
    'already_attached', false,
    'control_sent_at', v_prefs.control_sent_at,
    'unanswered_openers', v_prefs.unanswered_openers
  );
end;
$$;

-- p_patch: {conversation_state?, target_vocab?, session? (merged), close?}
create or replace function public.sms_record_thread_outbound(
  p_thread_id uuid,
  p_message_id uuid,
  p_metadata jsonb,
  p_patch jsonb,
  p_now timestamptz
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_thread sms_threads;
  v_first boolean := false;
begin
  if p_message_id is not null then
    update sms_messages
    set thread_id = p_thread_id, metadata = coalesce(p_metadata, metadata), updated_at = now()
    where id = p_message_id and thread_id is null;
    v_first := found;
  end if;

  update sms_threads set
    outbound_count = outbound_count + case when v_first then 1 else 0 end,
    last_outbound_at = case when v_first then p_now else last_outbound_at end,
    conversation_state = coalesce(p_patch->>'conversation_state', conversation_state),
    target_vocab = case when jsonb_typeof(p_patch->'target_vocab') = 'array'
      then p_patch->'target_vocab' else target_vocab end,
    session = case when jsonb_typeof(p_patch->'session') = 'object'
      then session || (p_patch->'session') else session end,
    status = case when coalesce((p_patch->>'close')::boolean, false) then 'closed' else status end,
    outcome = case when coalesce((p_patch->>'close')::boolean, false)
      then coalesce(outcome, 'completed') else outcome end,
    closed_at = case when coalesce((p_patch->>'close')::boolean, false) then p_now else closed_at end,
    updated_at = now()
  where id = p_thread_id
  returning * into v_thread;

  return sms_thread_json(v_thread);
end;
$$;

-- The contact's latest delivered practice text with its structured metadata
-- (pinyin, translation, target vocab) for deterministic commands.
create or replace function public.sms_last_outbound(p_contact_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select to_jsonb(x) from (
    select id, kind, body, metadata
    from sms_messages
    where contact_id = p_contact_id and direction = 'outbound' and provider_message_id is not null
      and redacted_at is null and body <> ''
      and kind in ('reply', 'opener', 'welcome', 'command', 'persona')
    order by coalesce(sent_at, created_at) desc
    limit 1
  ) x
$$;

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

-- A new Journey opener supersedes any older pending one for the learner, so
-- only the most recent Journey drives the next opener.
create or replace function public.sms_enqueue_job(
  p_user_id uuid,
  p_kind text,
  p_idempotency_key text,
  p_not_before timestamptz,
  p_journey_island_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_job sms_jobs;
begin
  if not exists (
    select 1 from sms_contacts where user_id = p_user_id and status in ('active', 'paused')
  ) then
    return jsonb_build_object('created', false, 'status', 'no_contact');
  end if;

  insert into sms_jobs (user_id, kind, idempotency_key, not_before, journey_island_id)
  values (p_user_id, p_kind, p_idempotency_key, p_not_before, p_journey_island_id)
  on conflict (idempotency_key) do nothing
  returning * into v_job;

  if v_job.id is null then
    select * into v_job from sms_jobs where idempotency_key = p_idempotency_key;
    return jsonb_build_object('created', false, 'job_id', v_job.id, 'status', v_job.status);
  end if;

  if p_kind = 'journey_opener' then
    update sms_jobs
    set status = 'skipped', outcome = 'superseded', finished_at = now(), updated_at = now()
    where user_id = p_user_id and id <> v_job.id and status = 'pending'
      and kind in ('journey_opener', 'scheduled_opener');
  elsif exists (
    select 1 from sms_jobs
    where user_id = p_user_id and id <> v_job.id and status in ('pending', 'processing')
  ) then
    update sms_jobs
    set status = 'skipped', outcome = 'already_queued', finished_at = now(), updated_at = now()
    where id = v_job.id;
    return jsonb_build_object('created', false, 'job_id', v_job.id, 'status', 'skipped');
  end if;

  return jsonb_build_object('created', true, 'job_id', v_job.id, 'status', v_job.status);
end;
$$;

create or replace function public.sms_claim_jobs(p_now timestamptz, p_limit integer, p_lease_seconds integer)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_jobs jsonb;
begin
  with due as (
    select id from sms_jobs
    where (status = 'pending' and not_before <= p_now)
       or (status = 'processing' and lease_until < p_now)
    order by not_before
    limit p_limit
    for update skip locked
  ),
  claimed as (
    update sms_jobs j
    set status = 'processing',
        attempts = j.attempts + 1,
        lease_until = p_now + make_interval(secs => p_lease_seconds),
        updated_at = now()
    from due
    where j.id = due.id
    returning j.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'kind', kind,
    'idempotency_key', idempotency_key,
    'journey_island_id', journey_island_id,
    'attempts', attempts,
    'not_before', not_before,
    'created_at', created_at
  ) order by not_before), '[]'::jsonb)
  into v_jobs
  from claimed;
  return v_jobs;
end;
$$;

-- p_status 'pending' reschedules the job for p_not_before.
create or replace function public.sms_finish_job(
  p_job_id uuid,
  p_status text,
  p_outcome text,
  p_error text,
  p_not_before timestamptz,
  p_message_id uuid
)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  update sms_jobs set
    status = p_status,
    outcome = p_outcome,
    last_error = left(p_error, 500),
    not_before = case when p_status = 'pending' then coalesce(p_not_before, not_before) else not_before end,
    lease_until = null,
    message_id = coalesce(p_message_id, message_id),
    finished_at = case when p_status in ('sent', 'skipped', 'failed', 'cancelled') then now() else null end,
    updated_at = now()
  where id = p_job_id and status = 'processing';
  return jsonb_build_object('ok', found);
end;
$$;

-- Openers already sent (or attempted) in the current week and day, plus the
-- most recent one, for frequency caps and non-response rules.
create or replace function public.sms_get_opener_stats(
  p_user_id uuid,
  p_week_start timestamptz,
  p_day_start timestamptz
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'week_count', (select count(*) from sms_threads
      where user_id = p_user_id and origin in ('opener', 'control') and started_at >= p_week_start),
    'day_count', (select count(*) from sms_threads
      where user_id = p_user_id and origin in ('opener', 'control') and started_at >= p_day_start),
    'last', (select sms_thread_json(t) from sms_threads t
      where t.user_id = p_user_id and t.origin in ('opener', 'control')
      order by t.started_at desc limit 1),
    'open_jobs', (select count(*) from sms_jobs
      where user_id = p_user_id and status in ('pending', 'processing')),
    'last_inbound_at', (select max(last_inbound_at) from sms_threads where user_id = p_user_id)
  )
$$;

create or replace function public.sms_list_active_contacts(p_after uuid, p_limit integer)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(user_id order by user_id), '[]'::jsonb) from (
    select user_id from sms_contacts
    where status = 'active' and (p_after is null or user_id > p_after)
    order by user_id
    limit p_limit
  ) c
$$;

-- Vocabulary for an opener: the Journey island just finished (or the most
-- recent one), words that need practice, and comfortable words to maintain.
create or replace function public.sms_get_opener_material(
  p_user_id uuid,
  p_journey_island_id uuid,
  p_limit integer
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_ji jsonb;
  v_recent jsonb := '[]'::jsonb;
  v_needs jsonb;
  v_maintain jsonb;
begin
  begin
    if p_journey_island_id is not null then
      select to_jsonb(ji) into v_ji
      from journey_islands ji join journeys j on j.id = ji.journey_id
      where ji.id = p_journey_island_id and j.user_id = p_user_id;
    end if;
    if v_ji is null then
      select to_jsonb(ji) into v_ji
      from journey_islands ji join journeys j on j.id = ji.journey_id
      where j.user_id = p_user_id and ji.completed_at is not null
      order by ji.completed_at desc
      limit 1;
    end if;
  exception when undefined_table or undefined_column then
    v_ji := null;
  end;

  if v_ji is not null and v_ji->>'island_id' is not null then
    begin
      select coalesce(jsonb_agg(jsonb_build_object('hanzi', w.hanzi, 'pinyin', w.pinyin, 'english', w.english)
                                order by w.position), '[]'::jsonb)
      into v_recent
      from (
        select hanzi, pinyin, english, position from island_words
        where island_id = (v_ji->>'island_id')::uuid
        order by position
        limit p_limit
      ) w;
    exception when undefined_table or undefined_column then
      v_recent := '[]'::jsonb;
    end;
  end if;

  if jsonb_array_length(v_recent) = 0 and jsonb_typeof(v_ji->'seed_words') = 'array' then
    select coalesce(jsonb_agg(jsonb_build_object('hanzi', e->>'hanzi', 'pinyin', e->>'pinyin', 'english', e->>'english')), '[]'::jsonb)
    into v_recent
    from (select e from jsonb_array_elements(v_ji->'seed_words') e limit p_limit) s;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('hanzi', word, 'pinyin', pinyin, 'english', english)), '[]'::jsonb)
  into v_needs
  from (
    select word, pinyin, english from sms_word_comfort
    where user_id = p_user_id and comfort_score < 0.45
    order by struggle_count desc, last_practiced_at asc nulls first
    limit p_limit
  ) n;

  select coalesce(jsonb_agg(jsonb_build_object('hanzi', word, 'pinyin', pinyin, 'english', english)), '[]'::jsonb)
  into v_maintain
  from (
    select word, pinyin, english from sms_word_comfort
    where user_id = p_user_id and comfort_score >= 0.7
    order by last_practiced_at asc nulls first
    limit p_limit
  ) m;

  return jsonb_build_object(
    'journey_island', case when v_ji is null then null else jsonb_build_object(
      'id', v_ji->>'id',
      'name', v_ji->>'name',
      'zh', v_ji->>'zh',
      'completed_at', v_ji->>'completed_at'
    ) end,
    'recent', v_recent,
    'needs_practice', v_needs,
    'maintenance', v_maintain
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Usage (segment allowance)
-- ---------------------------------------------------------------------------

-- Charges a message's segments to the learner's period exactly once. With
-- p_enforce, nothing is charged once the allowance is used up.
create or replace function public.sms_usage_charge(
  p_user_id uuid,
  p_message_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_plan_key text,
  p_allowance integer,
  p_segments integer,
  p_enforce boolean
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_usage sms_usage_periods;
  v_message sms_messages;
  v_before integer;
begin
  insert into sms_usage_periods (user_id, period_start, period_end, plan_key, allowance_segments)
  values (p_user_id, p_period_start, p_period_end, p_plan_key, p_allowance)
  on conflict (user_id, period_start) do update
  set period_end = excluded.period_end,
      plan_key = excluded.plan_key,
      allowance_segments = excluded.allowance_segments,
      updated_at = now();

  select * into v_usage from sms_usage_periods
  where user_id = p_user_id and period_start = p_period_start
  for update;

  select * into v_message from sms_messages where id = p_message_id for update;
  if v_message.id is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_message');
  end if;
  if v_message.metered then
    return jsonb_build_object(
      'allowed', true, 'already_charged', true,
      'used', v_usage.used_segments, 'allowance', v_usage.allowance_segments
    );
  end if;

  v_before := v_usage.used_segments;
  if p_enforce and v_before >= v_usage.allowance_segments then
    update sms_usage_periods set exhausted_at = coalesce(exhausted_at, now()), updated_at = now()
    where user_id = p_user_id and period_start = p_period_start;
    return jsonb_build_object(
      'allowed', false, 'reason', 'allowance_exhausted',
      'used', v_before, 'allowance', v_usage.allowance_segments,
      'exhausted_notice_at', v_usage.exhausted_notice_at
    );
  end if;

  update sms_usage_periods
  set used_segments = used_segments + p_segments,
      exhausted_at = case when used_segments + p_segments >= allowance_segments
        then coalesce(exhausted_at, now()) else exhausted_at end,
      updated_at = now()
  where user_id = p_user_id and period_start = p_period_start
  returning * into v_usage;

  update sms_messages
  set metered = true, segments = p_segments, usage_period_start = p_period_start, updated_at = now()
  where id = p_message_id;

  return jsonb_build_object(
    'allowed', true,
    'already_charged', false,
    'used_before', v_before,
    'used', v_usage.used_segments,
    'allowance', v_usage.allowance_segments,
    'warned_at', v_usage.warned_at
  );
end;
$$;

-- Returns segments for a message the provider definitely did not accept.
create or replace function public.sms_usage_refund(p_message_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_message sms_messages;
begin
  select * into v_message from sms_messages where id = p_message_id for update;
  if v_message.id is null or not v_message.metered then
    return jsonb_build_object('refunded', false);
  end if;

  update sms_usage_periods
  set used_segments = greatest(used_segments - coalesce(v_message.segments, 0), 0),
      exhausted_at = case when used_segments - coalesce(v_message.segments, 0) < allowance_segments
        then null else exhausted_at end,
      updated_at = now()
  where user_id = v_message.user_id and period_start = v_message.usage_period_start;

  update sms_messages set metered = false, updated_at = now() where id = p_message_id;
  return jsonb_build_object('refunded', true);
end;
$$;

-- Atomically claims a once-per-period notice ('warned' or 'exhausted_notice').
create or replace function public.sms_usage_claim_notice(
  p_user_id uuid,
  p_period_start timestamptz,
  p_notice text
)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  if p_notice = 'warned' then
    update sms_usage_periods set warned_at = now(), updated_at = now()
    where user_id = p_user_id and period_start = p_period_start and warned_at is null;
  elsif p_notice = 'exhausted_notice' then
    update sms_usage_periods set exhausted_notice_at = now(), updated_at = now()
    where user_id = p_user_id and period_start = p_period_start and exhausted_notice_at is null;
  else
    return jsonb_build_object('claimed', false);
  end if;
  return jsonb_build_object('claimed', found);
end;
$$;

create or replace function public.sms_get_usage(p_user_id uuid, p_period_start timestamptz)
returns jsonb
language sql
stable
set search_path = public
as $$
  select to_jsonb(u) from sms_usage_periods u
  where u.user_id = p_user_id and u.period_start = p_period_start
$$;

-- ---------------------------------------------------------------------------
-- Word comfort
-- ---------------------------------------------------------------------------

-- p_signals: [{word, pinyin?, english?, signal, delta, source?, journey_island_id?}]
-- The app owns the scoring model (deltas); this applies them atomically.
create or replace function public.sms_apply_word_signals(p_user_id uuid, p_signals jsonb, p_now timestamptz)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_signal jsonb;
  v_count integer := 0;
  v_name text;
begin
  for v_signal in select value from jsonb_array_elements(coalesce(p_signals, '[]'::jsonb)) limit 20
  loop
    v_name := v_signal->>'signal';
    if coalesce(v_signal->>'word', '') = '' or v_name is null then
      continue;
    end if;

    insert into sms_word_comfort (user_id, word, pinyin, english, source, journey_island_id, first_seen_at)
    values (
      p_user_id,
      left(v_signal->>'word', 32),
      left(nullif(v_signal->>'pinyin', ''), 80),
      left(nullif(v_signal->>'english', ''), 120),
      case when v_signal->>'source' = 'journey' then 'journey' else 'conversation' end,
      nullif(v_signal->>'journey_island_id', '')::uuid,
      p_now
    )
    on conflict (user_id, word) do update
    set pinyin = coalesce(sms_word_comfort.pinyin, excluded.pinyin),
        english = coalesce(sms_word_comfort.english, excluded.english);

    update sms_word_comfort set
      comfort_score = least(1, greatest(0, comfort_score + coalesce((v_signal->>'delta')::numeric, 0))),
      success_count = success_count + case when v_name in ('understood', 'used_successfully') then 1 else 0 end,
      struggle_count = struggle_count + case when v_name in ('requested_pinyin', 'requested_translation', 'requested_easier', 'error') then 1 else 0 end,
      understood_count = understood_count + case when v_name = 'understood' then 1 else 0 end,
      used_count = used_count + case when v_name = 'used_successfully' then 1 else 0 end,
      pinyin_requests = pinyin_requests + case when v_name = 'requested_pinyin' then 1 else 0 end,
      translation_requests = translation_requests + case when v_name = 'requested_translation' then 1 else 0 end,
      easier_requests = easier_requests + case when v_name = 'requested_easier' then 1 else 0 end,
      error_count = error_count + case when v_name = 'error' then 1 else 0 end,
      ignored_count = ignored_count + case when v_name = 'ignored' then 1 else 0 end,
      last_signal = v_name,
      last_practiced_at = case when v_name = 'ignored' then last_practiced_at else p_now end,
      updated_at = now()
    where user_id = p_user_id and word = left(v_signal->>'word', 32);
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('applied', v_count);
end;
$$;

-- ---------------------------------------------------------------------------
-- Settings page data, history deletion, country interest, retention
-- ---------------------------------------------------------------------------

create or replace function public.sms_get_huahua_overview(
  p_user_id uuid,
  p_thread_limit integer,
  p_message_limit integer,
  p_word_limit integer
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'threads', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'origin', t.origin,
        'started_at', t.started_at,
        'status', t.status,
        'messages', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'direction', m.direction, 'body', m.body, 'at', m.at
          ) order by m.at), '[]'::jsonb)
          from (
            select direction, body, coalesce(occurred_at, sent_at, created_at) as at
            from sms_messages
            where thread_id = t.id and redacted_at is null and body <> ''
              and (direction = 'inbound' or provider_message_id is not null)
            order by coalesce(occurred_at, sent_at, created_at) desc
            limit p_message_limit
          ) m
        )
      ) order by t.started_at desc), '[]'::jsonb)
      from (
        select * from sms_threads
        where user_id = p_user_id
          and exists (select 1 from sms_messages m where m.thread_id = sms_threads.id and m.redacted_at is null and m.body <> '')
        order by started_at desc
        limit p_thread_limit
      ) t
    ),
    'recent_words', (
      select coalesce(jsonb_agg(to_jsonb(w) order by w.last_practiced_at desc), '[]'::jsonb) from (
        select word, pinyin, english, comfort_score, last_practiced_at from sms_word_comfort
        where user_id = p_user_id and last_practiced_at is not null
        order by last_practiced_at desc limit p_word_limit
      ) w
    ),
    'needs_practice', (
      select coalesce(jsonb_agg(to_jsonb(w) order by w.comfort_score), '[]'::jsonb) from (
        select word, pinyin, english, comfort_score, last_practiced_at from sms_word_comfort
        where user_id = p_user_id and comfort_score < 0.45 and last_practiced_at is not null
        order by comfort_score, struggle_count desc limit p_word_limit
      ) w
    ),
    'getting_comfortable', (
      select coalesce(jsonb_agg(to_jsonb(w) order by w.comfort_score desc), '[]'::jsonb) from (
        select word, pinyin, english, comfort_score, last_practiced_at from sms_word_comfort
        where user_id = p_user_id and comfort_score >= 0.7
        order by comfort_score desc, last_practiced_at desc nulls last limit p_word_limit
      ) w
    )
  )
$$;

-- Removes message text and conversation threads for the learner. Delivery
-- metadata, consent events, and usage totals are kept as audit records.
create or replace function public.sms_delete_history(p_user_id uuid, p_include_words boolean)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_messages integer;
  v_threads integer;
  v_events integer := 0;
  v_words integer := 0;
begin
  update sms_webhook_events e
  set payload = jsonb_build_object('redacted', true)
  where e.processed_at is not null
    and e.payload->'data'->'payload'->>'id' in (
      select provider_message_id from sms_messages
      where user_id = p_user_id and provider_message_id is not null
    );
  get diagnostics v_events = row_count;

  update sms_messages
  set body = '', raw_payload = null, metadata = null, redacted_at = now(), updated_at = now()
  where user_id = p_user_id and (redacted_at is null or body <> '' or raw_payload is not null);
  get diagnostics v_messages = row_count;

  delete from sms_threads where user_id = p_user_id and status = 'closed';
  get diagnostics v_threads = row_count;
  update sms_threads
  set target_vocab = '[]'::jsonb, session = '{}'::jsonb, updated_at = now()
  where user_id = p_user_id;

  if p_include_words then
    delete from sms_word_comfort where user_id = p_user_id;
    get diagnostics v_words = row_count;
  end if;

  return jsonb_build_object(
    'messages', v_messages, 'threads', v_threads, 'webhook_events', v_events, 'words', v_words
  );
end;
$$;

create or replace function public.sms_record_country_interest(p_user_id uuid, p_country_code text)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  insert into sms_country_interest (user_id, country_code)
  values (p_user_id, upper(p_country_code))
  on conflict (user_id, country_code) do nothing;
  return jsonb_build_object('recorded', true);
end;
$$;

-- Raw texts are kept for p_message_days, then their content is removed;
-- delivery status, timestamps, kind, and segment counts remain.
create or replace function public.sms_retention_cleanup(
  p_message_days integer default 90,
  p_job_days integer default 30
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_messages integer;
  v_threads integer;
  v_jobs integer;
begin
  update sms_messages
  set body = '', raw_payload = null, metadata = null, redacted_at = now(), updated_at = now()
  where redacted_at is null
    and coalesce(occurred_at, created_at) < now() - make_interval(days => p_message_days);
  get diagnostics v_messages = row_count;

  delete from sms_threads
  where status = 'closed' and coalesce(closed_at, started_at) < now() - make_interval(days => p_message_days);
  get diagnostics v_threads = row_count;

  delete from sms_jobs
  where status in ('sent', 'skipped', 'failed', 'cancelled')
    and coalesce(finished_at, updated_at) < now() - make_interval(days => p_job_days);
  get diagnostics v_jobs = row_count;

  return jsonb_build_object('messages_redacted', v_messages, 'threads_deleted', v_threads, 'jobs_deleted', v_jobs);
end;
$$;

-- Lock every Phase 2 function down to the service role.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'sms_contacts_before_write()',
    'sms_contacts_consent_audit()',
    'sms_contact_json(public.sms_contacts)',
    'sms_complete_verification(uuid, uuid, boolean, text, text)',
    'sms_set_paused(uuid, boolean)',
    'sms_claim_outbound(uuid, text, text, text, boolean, integer)',
    'sms_handle_inbound(text, text, text, text, timestamptz, text, jsonb)',
    'sms_get_user_context(uuid)',
    'sms_update_preferences(uuid, jsonb)',
    'sms_reduce_frequency(uuid, integer, timestamptz)',
    'sms_auto_pause(uuid)',
    'sms_thread_json(public.sms_threads)',
    'sms_settle_open_thread(uuid, timestamptz)',
    'sms_open_thread(uuid, text, uuid, uuid, jsonb, jsonb, timestamptz)',
    'sms_attach_inbound(uuid, uuid, timestamptz, integer)',
    'sms_record_thread_outbound(uuid, uuid, jsonb, jsonb, timestamptz)',
    'sms_last_outbound(uuid)',
    'sms_enqueue_job(uuid, text, text, timestamptz, uuid)',
    'sms_claim_jobs(timestamptz, integer, integer)',
    'sms_finish_job(uuid, text, text, text, timestamptz, uuid)',
    'sms_get_opener_stats(uuid, timestamptz, timestamptz)',
    'sms_list_active_contacts(uuid, integer)',
    'sms_get_opener_material(uuid, uuid, integer)',
    'sms_usage_charge(uuid, uuid, timestamptz, timestamptz, text, integer, integer, boolean)',
    'sms_usage_refund(uuid)',
    'sms_usage_claim_notice(uuid, timestamptz, text)',
    'sms_get_usage(uuid, timestamptz)',
    'sms_apply_word_signals(uuid, jsonb, timestamptz)',
    'sms_get_huahua_overview(uuid, integer, integer, integer)',
    'sms_delete_history(uuid, boolean)',
    'sms_record_country_interest(uuid, text)',
    'sms_retention_cleanup(integer, integer)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
