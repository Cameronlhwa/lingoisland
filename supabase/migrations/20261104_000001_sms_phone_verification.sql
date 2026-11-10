-- SMS phone verification, consent, and webhook processing.
--
-- Builds on 20261103_000001_sms_prototype.sql (do not edit that file).
-- All writes go through the service role via the sms_* functions below;
-- authenticated users can only read their own contacts and messages.

-- ---------------------------------------------------------------------------
-- sms_contacts: lifecycle status, verification, and consent audit fields
-- ---------------------------------------------------------------------------

alter table public.sms_contacts
  add column if not exists status text,
  add column if not exists verified_at timestamptz,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_source text,
  add column if not exists consent_version text,
  add column if not exists welcome_sent_at timestamptz,
  add column if not exists paused_at timestamptz,
  add column if not exists opted_out_at timestamptz,
  add column if not exists opted_in_at timestamptz,
  add column if not exists disabled_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists release_reason text,
  add column if not exists last_delivery_error text,
  add column if not exists last_delivery_error_at timestamptz,
  add column if not exists delivery_failure_count integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

-- Prototype contacts were never verified, so they cannot receive AI replies
-- until the learner verifies the number through the new flow.
update public.sms_contacts
set status = case when opted_out then 'opted_out' else 'unverified' end,
    opted_out_at = case when opted_out then coalesce(opted_out_at, updated_at) else opted_out_at end
where status is null;

alter table public.sms_contacts
  alter column status set default 'unverified',
  alter column status set not null;

alter table public.sms_contacts drop constraint if exists sms_contacts_status_check;
alter table public.sms_contacts add constraint sms_contacts_status_check
  check (status in ('unverified', 'active', 'paused', 'opted_out', 'disabled', 'released'));

alter table public.sms_contacts drop constraint if exists sms_contacts_consent_source_check;
alter table public.sms_contacts add constraint sms_contacts_consent_source_check
  check (consent_source is null or consent_source in ('onboarding', 'account_settings'));

alter table public.sms_contacts drop constraint if exists sms_contacts_release_reason_check;
alter table public.sms_contacts add constraint sms_contacts_release_reason_check
  check (release_reason is null or release_reason in ('disconnected', 'replaced', 'transferred'));

alter table public.sms_contacts drop constraint if exists sms_contacts_verified_consent_check;
alter table public.sms_contacts add constraint sms_contacts_verified_consent_check
  check (
    status not in ('active', 'paused')
    or (verified_at is not null and consent_at is not null and consent_version is not null)
  );

-- One current (non-released) contact per phone number and per user.
-- Released rows are kept so message history and consent audit survive.
update public.sms_contacts c
set status = 'released', released_at = now(), release_reason = 'replaced'
where c.status <> 'released'
  and exists (
    select 1 from public.sms_contacts newer
    where newer.user_id = c.user_id
      and newer.status <> 'released'
      and (newer.created_at, newer.id) > (c.created_at, c.id)
  );

alter table public.sms_contacts drop constraint if exists sms_contacts_phone_number_key;
create unique index if not exists sms_contacts_current_phone_key
  on public.sms_contacts (phone_number) where status <> 'released';
create unique index if not exists sms_contacts_current_user_key
  on public.sms_contacts (user_id) where status <> 'released';
create index if not exists sms_contacts_phone_idx on public.sms_contacts (phone_number);

-- Keep the prototype boolean flags consistent for any legacy readers.
create or replace function public.sms_contacts_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.is_active := new.status = 'active';
  new.opted_out := new.status = 'opted_out';
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sms_contacts_before_write on public.sms_contacts;
create trigger sms_contacts_before_write
  before insert or update on public.sms_contacts
  for each row execute function public.sms_contacts_before_write();

-- Contacts must only be created or changed by the verified server flow.
drop policy if exists "Users can create own SMS contacts" on public.sms_contacts;
drop policy if exists "Users can update own SMS contacts" on public.sms_contacts;
drop policy if exists "Users can create own SMS messages" on public.sms_messages;

-- ---------------------------------------------------------------------------
-- sms_messages: outbound idempotency and delivery tracking
-- ---------------------------------------------------------------------------

alter table public.sms_messages alter column provider_message_id drop not null;

alter table public.sms_messages
  add column if not exists kind text,
  add column if not exists idempotency_key text,
  add column if not exists error text,
  add column if not exists retryable boolean not null default false,
  add column if not exists send_attempts integer not null default 0,
  add column if not exists occurred_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists status_updated_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.sms_messages
set kind = case when direction = 'inbound' then 'inbound' else 'manual' end
where kind is null;

alter table public.sms_messages drop constraint if exists sms_messages_kind_check;
alter table public.sms_messages add constraint sms_messages_kind_check
  check (kind is null or kind in ('inbound', 'reply', 'fallback', 'welcome', 'help', 'resubscribed', 'manual'));

create unique index if not exists sms_messages_idempotency_key
  on public.sms_messages (idempotency_key) where idempotency_key is not null;
create index if not exists sms_messages_contact_occurred_idx
  on public.sms_messages (contact_id, coalesce(occurred_at, created_at) desc);

-- ---------------------------------------------------------------------------
-- sms_webhook_events: durable processing state so retries are safe
-- ---------------------------------------------------------------------------

alter table public.sms_webhook_events
  add column if not exists occurred_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists outcome text;

create index if not exists sms_webhook_events_pending_idx
  on public.sms_webhook_events (created_at)
  where processed_at is null and failed_at is null;

-- ---------------------------------------------------------------------------
-- sms_phone_verifications: hashed one-time codes
-- ---------------------------------------------------------------------------

create table if not exists public.sms_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  code_hash text not null,
  expires_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  send_count integer not null default 1 check (send_count >= 0),
  last_sent_at timestamptz not null default now(),
  verified_at timestamptz,
  invalidated_at timestamptz,
  consent_source text not null check (consent_source in ('onboarding', 'account_settings')),
  consent_version text not null,
  consent_accepted_at timestamptz not null default now(),
  contact_id uuid references public.sms_contacts(id) on delete set null,
  last_provider_message_id text,
  delivery_status text,
  delivery_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sms_phone_verifications_open_user_key
  on public.sms_phone_verifications (user_id)
  where verified_at is null and invalidated_at is null;
create index if not exists sms_phone_verifications_phone_idx
  on public.sms_phone_verifications (phone_number, created_at desc);
create index if not exists sms_phone_verifications_provider_message_idx
  on public.sms_phone_verifications (last_provider_message_id)
  where last_provider_message_id is not null;

alter table public.sms_phone_verifications enable row level security;

-- ---------------------------------------------------------------------------
-- sms_rate_limit_events: sliding-window counters keyed by hashed buckets
-- ---------------------------------------------------------------------------

create table if not exists public.sms_rate_limit_events (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists sms_rate_limit_events_bucket_idx
  on public.sms_rate_limit_events (bucket, created_at desc);

alter table public.sms_rate_limit_events enable row level security;

-- ---------------------------------------------------------------------------
-- Functions (service role only). Each returns jsonb so the app can call them
-- uniformly through supabase.rpc().
-- ---------------------------------------------------------------------------

-- p_limits: [{"bucket": text, "max": int, "window_seconds": int}, ...]
-- Either every bucket has capacity and one hit is recorded in each, or
-- nothing is recorded.
create or replace function public.sms_rate_limit_consume(p_limits jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_limit jsonb;
  v_count integer;
  v_oldest timestamptz;
  v_retry integer := 0;
  v_blocked text;
begin
  for v_limit in
    select value from jsonb_array_elements(p_limits) order by value->>'bucket'
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_limit->>'bucket', 0));
  end loop;

  for v_limit in select value from jsonb_array_elements(p_limits)
  loop
    select count(*), min(created_at) into v_count, v_oldest
    from sms_rate_limit_events
    where bucket = v_limit->>'bucket'
      and created_at > now() - make_interval(secs => (v_limit->>'window_seconds')::int);

    if v_count >= (v_limit->>'max')::int then
      v_blocked := coalesce(v_blocked, v_limit->>'bucket');
      v_retry := greatest(
        v_retry,
        ceil(extract(epoch from (v_oldest + make_interval(secs => (v_limit->>'window_seconds')::int) - now())))::int
      );
    end if;
  end loop;

  if v_blocked is not null then
    return jsonb_build_object('allowed', false, 'bucket', v_blocked, 'retry_after_seconds', greatest(v_retry, 1));
  end if;

  insert into sms_rate_limit_events (bucket)
  select value->>'bucket' from jsonb_array_elements(p_limits);

  return jsonb_build_object('allowed', true);
end;
$$;

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
    'opted_out_at', c.opted_out_at,
    'opted_in_at', c.opted_in_at,
    'disabled_at', c.disabled_at,
    'last_delivery_error', c.last_delivery_error,
    'last_delivery_error_at', c.last_delivery_error_at,
    'delivery_failure_count', c.delivery_failure_count
  ) end
$$;

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

create or replace function public.sms_start_verification(
  p_user_id uuid,
  p_phone_number text,
  p_code_hash text,
  p_expires_at timestamptz,
  p_consent_source text,
  p_consent_version text
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

  if v_contact.id is not null and v_contact.phone_number = p_phone_number and v_contact.status = 'active' then
    return jsonb_build_object('status', 'already_active');
  end if;

  update sms_phone_verifications
  set invalidated_at = now(), updated_at = now()
  where user_id = p_user_id and verified_at is null and invalidated_at is null;

  insert into sms_phone_verifications (
    user_id, phone_number, code_hash, expires_at, consent_source, consent_version
  ) values (
    p_user_id, p_phone_number, p_code_hash, p_expires_at, p_consent_source, p_consent_version
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

create or replace function public.sms_resend_verification(
  p_user_id uuid,
  p_code_hash text,
  p_expires_at timestamptz,
  p_max_sends integer,
  p_cooldown_seconds integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_row sms_phone_verifications;
  v_wait integer;
begin
  select * into v_row from sms_phone_verifications
  where user_id = p_user_id and verified_at is null and invalidated_at is null
  for update;

  if v_row.id is null then
    return jsonb_build_object('status', 'no_pending');
  end if;

  if v_row.send_count >= p_max_sends then
    return jsonb_build_object('status', 'send_limit');
  end if;

  v_wait := ceil(extract(epoch from (v_row.last_sent_at + make_interval(secs => p_cooldown_seconds) - now())))::int;
  if v_wait > 0 then
    return jsonb_build_object('status', 'cooldown', 'retry_after_seconds', v_wait);
  end if;

  update sms_phone_verifications
  set code_hash = p_code_hash,
      expires_at = p_expires_at,
      attempt_count = 0,
      send_count = send_count + 1,
      last_sent_at = now(),
      delivery_status = null,
      delivery_error = null,
      last_provider_message_id = null,
      updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'status', 'resent',
    'id', v_row.id,
    'phone_number', v_row.phone_number,
    'expires_at', v_row.expires_at,
    'last_sent_at', v_row.last_sent_at,
    'send_count', v_row.send_count
  );
end;
$$;

create or replace function public.sms_record_verification_send(
  p_verification_id uuid,
  p_provider_message_id text,
  p_delivery_status text,
  p_delivery_error text
)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  update sms_phone_verifications
  set last_provider_message_id = p_provider_message_id,
      delivery_status = p_delivery_status,
      delivery_error = p_delivery_error,
      updated_at = now()
  where id = p_verification_id;
  return jsonb_build_object('ok', found);
end;
$$;

-- Counts the attempt before the caller compares the code, so concurrent
-- guesses can never exceed p_max_attempts.
create or replace function public.sms_begin_verification_attempt(
  p_user_id uuid,
  p_max_attempts integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_row sms_phone_verifications;
begin
  select * into v_row from sms_phone_verifications
  where user_id = p_user_id and verified_at is null and invalidated_at is null
  for update;

  if v_row.id is null then
    return jsonb_build_object('status', 'no_pending');
  end if;
  if v_row.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_row.attempt_count >= p_max_attempts then
    return jsonb_build_object('status', 'too_many_attempts');
  end if;

  update sms_phone_verifications
  set attempt_count = attempt_count + 1, updated_at = now()
  where id = v_row.id
  returning * into v_row;

  return jsonb_build_object(
    'status', 'ok',
    'id', v_row.id,
    'phone_number', v_row.phone_number,
    'code_hash', v_row.code_hash,
    'attempts_remaining', greatest(p_max_attempts - v_row.attempt_count, 0)
  );
end;
$$;

-- Atomically activates the verified number and records consent. A number
-- that belongs to another account is only moved when p_confirm_transfer is
-- true; the caller has already proven possession of the number.
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

  update sms_phone_verifications
  set verified_at = now(), contact_id = v_contact.id, updated_at = now()
  where id = v_ver.id;

  -- Any other pending verification for this number can no longer complete
  -- silently; it will need a fresh code.
  update sms_phone_verifications
  set invalidated_at = now(), updated_at = now()
  where phone_number = v_ver.phone_number
    and id <> v_ver.id
    and verified_at is null
    and invalidated_at is null;

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
    if v_contact.status = 'active' then
      update sms_contacts set status = 'paused', paused_at = now()
      where id = v_contact.id returning * into v_contact;
    elsif v_contact.status <> 'paused' then
      return jsonb_build_object('status', 'invalid_state', 'contact', sms_contact_json(v_contact));
    end if;
  else
    if v_contact.status = 'paused' then
      update sms_contacts set status = 'active', paused_at = null
      where id = v_contact.id returning * into v_contact;
    elsif v_contact.status <> 'active' then
      return jsonb_build_object('status', 'invalid_state', 'contact', sms_contact_json(v_contact));
    end if;
  end if;

  return jsonb_build_object('status', 'ok', 'contact', sms_contact_json(v_contact));
end;
$$;

create or replace function public.sms_disconnect(p_user_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  update sms_contacts
  set status = 'released', released_at = now(), release_reason = 'disconnected'
  where user_id = p_user_id and status <> 'released';
  get diagnostics v_count = row_count;

  update sms_phone_verifications
  set invalidated_at = now(), updated_at = now()
  where user_id = p_user_id and verified_at is null and invalidated_at is null;

  return jsonb_build_object('status', 'ok', 'released', v_count > 0);
end;
$$;

-- Reserves an outbound send. Returns claimed=false when the same
-- idempotency key was already sent (or is being sent), so retries never
-- produce duplicate texts. A row that failed before reaching the provider,
-- or that was abandoned mid-generation, can be reclaimed.
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
  if p_require_active and v_contact.status <> 'active' then
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

  if v_message.kind = 'welcome' and p_provider_message_id is not null then
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

-- Applies a provider delivery receipt without regressing a final status
-- when receipts arrive out of order.
create or replace function public.sms_apply_delivery_status(
  p_provider text,
  p_provider_message_id text,
  p_status text,
  p_error text,
  p_failed boolean,
  p_recipient_opted_out boolean,
  p_disable_after_failures integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_message sms_messages;
  v_rank_new integer;
  v_rank_old integer;
  v_was_failed boolean;
  v_contact sms_contacts;
begin
  v_rank_new := case
    when p_status in ('delivered', 'delivery_failed', 'sending_failed', 'delivery_unconfirmed', 'failed') then 4
    when p_status = 'sent' then 3
    when p_status = 'sending' then 2
    else 1 end;

  select * into v_message from sms_messages
  where provider = p_provider and provider_message_id = p_provider_message_id
  for update;

  if v_message.id is null then
    update sms_phone_verifications
    set delivery_status = p_status,
        delivery_error = case when p_failed then p_error else delivery_error end,
        updated_at = now()
    where last_provider_message_id = p_provider_message_id;
    if found then
      return jsonb_build_object('outcome', 'verification_status');
    end if;
    return jsonb_build_object('outcome', 'unknown_message');
  end if;

  v_rank_old := case
    when v_message.status in ('delivered', 'delivery_failed', 'sending_failed', 'delivery_unconfirmed', 'failed') then 4
    when v_message.status = 'sent' then 3
    when v_message.status = 'sending' then 2
    else 1 end;

  if v_rank_new < v_rank_old or (v_rank_old = 4 and v_message.status = p_status) then
    return jsonb_build_object('outcome', 'stale_status');
  end if;

  v_was_failed := v_message.status in ('delivery_failed', 'sending_failed', 'failed');

  update sms_messages
  set status = p_status,
      error = case when p_failed then p_error else error end,
      status_updated_at = now(),
      updated_at = now()
  where id = v_message.id;

  if v_message.direction <> 'outbound' then
    return jsonb_build_object('outcome', 'status_updated');
  end if;

  select * into v_contact from sms_contacts where id = v_message.contact_id for update;

  if p_recipient_opted_out and v_contact.status in ('active', 'paused', 'disabled') then
    update sms_contacts set status = 'opted_out', opted_out_at = now()
    where id = v_contact.id;
    return jsonb_build_object('outcome', 'recipient_opted_out');
  end if;

  if p_failed and not v_was_failed then
    update sms_contacts
    set delivery_failure_count = delivery_failure_count + 1,
        last_delivery_error = left(p_error, 500),
        last_delivery_error_at = now(),
        status = case
          when status = 'active' and delivery_failure_count + 1 >= p_disable_after_failures then 'disabled'
          else status end,
        disabled_at = case
          when status = 'active' and delivery_failure_count + 1 >= p_disable_after_failures then now()
          else disabled_at end
    where id = v_contact.id
    returning * into v_contact;
    return jsonb_build_object(
      'outcome', case when v_contact.status = 'disabled' then 'contact_disabled' else 'delivery_failed' end
    );
  end if;

  if p_status = 'delivered' and v_contact.delivery_failure_count > 0 then
    update sms_contacts set delivery_failure_count = 0 where id = v_contact.id;
  end if;

  return jsonb_build_object('outcome', 'status_updated');
end;
$$;

-- Records an inbound text and applies STOP/START. p_keyword is one of
-- 'stop', 'start', 'help', or null. Keyword actions are skipped for
-- duplicate deliveries and for events older than the latest opt change.
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

  if v_contact.status <> 'active' then
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

-- Conversation context up to and including p_until_message_id, ordered by
-- when the provider says each text happened.
create or replace function public.sms_get_conversation(
  p_contact_id uuid,
  p_until_message_id uuid,
  p_limit integer
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with anchor as (
    select coalesce(occurred_at, created_at) as at from sms_messages where id = p_until_message_id
  ),
  recent as (
    select m.direction, m.body, coalesce(m.occurred_at, m.created_at) as at, m.id
    from sms_messages m, anchor
    where m.contact_id = p_contact_id
      and coalesce(m.occurred_at, m.created_at) <= anchor.at
      and m.body <> ''
      and (m.direction = 'inbound' or m.provider_message_id is not null)
    order by coalesce(m.occurred_at, m.created_at) desc, m.id desc
    limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object('direction', direction, 'body', body) order by at, id), '[]'::jsonb)
  from recent
$$;

create or replace function public.sms_record_webhook_event(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_row sms_webhook_events;
  v_duplicate boolean := false;
begin
  insert into sms_webhook_events (provider, event_id, event_type, occurred_at, payload)
  values (p_provider, p_event_id, p_event_type, p_occurred_at, p_payload)
  on conflict (provider, event_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    v_duplicate := true;
    select * into v_row from sms_webhook_events where provider = p_provider and event_id = p_event_id;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'duplicate', v_duplicate,
    'pending', v_row.processed_at is null and v_row.failed_at is null
  );
end;
$$;

create or replace function public.sms_claim_webhook_event(
  p_event_row_id uuid,
  p_lease_seconds integer,
  p_max_attempts integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_row sms_webhook_events;
begin
  update sms_webhook_events
  set processing_started_at = now(), attempt_count = attempt_count + 1
  where id = p_event_row_id
    and processed_at is null
    and failed_at is null
    and attempt_count < p_max_attempts
    and (processing_started_at is null or processing_started_at < now() - make_interval(secs => p_lease_seconds))
  returning * into v_row;

  if v_row.id is null then
    return jsonb_build_object('claimed', false);
  end if;

  return jsonb_build_object(
    'claimed', true,
    'provider', v_row.provider,
    'event_type', v_row.event_type,
    'attempt_count', v_row.attempt_count,
    'payload', v_row.payload
  );
end;
$$;

create or replace function public.sms_finish_webhook_event(
  p_event_row_id uuid,
  p_outcome text,
  p_error text,
  p_retry_after_seconds integer,
  p_max_attempts integer
)
returns jsonb
language plpgsql
set search_path = public
as $$
begin
  if p_error is null then
    update sms_webhook_events
    set processed_at = now(), outcome = p_outcome, error = null, processing_started_at = null
    where id = p_event_row_id;
  else
    update sms_webhook_events
    set error = left(p_error, 1000),
        outcome = p_outcome,
        processing_started_at = null,
        next_attempt_at = now() + make_interval(secs => coalesce(p_retry_after_seconds, 60)),
        failed_at = case when attempt_count >= p_max_attempts then now() else null end
    where id = p_event_row_id;
  end if;
  return jsonb_build_object('ok', found);
end;
$$;

create or replace function public.sms_list_retryable_webhook_events(
  p_limit integer,
  p_min_age_seconds integer,
  p_lease_seconds integer,
  p_max_attempts integer
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(id), '[]'::jsonb) from (
    select id from sms_webhook_events
    where processed_at is null
      and failed_at is null
      and attempt_count < p_max_attempts
      and created_at < now() - make_interval(secs => p_min_age_seconds)
      and (next_attempt_at is null or next_attempt_at <= now())
      and (processing_started_at is null or processing_started_at < now() - make_interval(secs => p_lease_seconds))
    order by created_at
    limit p_limit
  ) pending
$$;

create or replace function public.sms_cleanup(
  p_webhook_retention_days integer default 30,
  p_verification_retention_days integer default 30
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_events integer;
  v_verifications integer;
  v_limits integer;
begin
  delete from sms_webhook_events
  where created_at < now() - make_interval(days => p_webhook_retention_days)
    and (processed_at is not null or failed_at is not null);
  get diagnostics v_events = row_count;

  delete from sms_phone_verifications
  where created_at < now() - make_interval(days => p_verification_retention_days)
    and (verified_at is not null or invalidated_at is not null or expires_at < now());
  get diagnostics v_verifications = row_count;

  -- Code hashes are useless after expiry; drop them early.
  update sms_phone_verifications
  set code_hash = 'expired'
  where verified_at is null and expires_at < now() - interval '1 day' and code_hash <> 'expired';

  delete from sms_rate_limit_events where created_at < now() - interval '2 days';
  get diagnostics v_limits = row_count;

  return jsonb_build_object(
    'webhook_events', v_events,
    'verifications', v_verifications,
    'rate_limit_events', v_limits
  );
end;
$$;

-- Lock every SMS function down to the service role.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'sms_contacts_before_write()',
    'sms_rate_limit_consume(jsonb)',
    'sms_contact_json(public.sms_contacts)',
    'sms_get_phone_state(uuid)',
    'sms_start_verification(uuid, text, text, timestamptz, text, text)',
    'sms_resend_verification(uuid, text, timestamptz, integer, integer)',
    'sms_record_verification_send(uuid, text, text, text)',
    'sms_begin_verification_attempt(uuid, integer)',
    'sms_complete_verification(uuid, uuid, boolean, text, text)',
    'sms_set_paused(uuid, boolean)',
    'sms_disconnect(uuid)',
    'sms_claim_outbound(uuid, text, text, text, boolean, integer)',
    'sms_complete_outbound(uuid, text, text, text, text, boolean, boolean)',
    'sms_apply_delivery_status(text, text, text, text, boolean, boolean, integer)',
    'sms_handle_inbound(text, text, text, text, timestamptz, text, jsonb)',
    'sms_get_conversation(uuid, uuid, integer)',
    'sms_record_webhook_event(text, text, text, timestamptz, jsonb)',
    'sms_claim_webhook_event(uuid, integer, integer)',
    'sms_finish_webhook_event(uuid, text, text, integer, integer)',
    'sms_list_retryable_webhook_events(integer, integer, integer, integer)',
    'sms_cleanup(integer, integer)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
