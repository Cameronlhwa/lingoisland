-- A WhatsApp reply can prove ownership without an outbound OTP template.
-- The server only exposes this function to its service role; it returns the
-- pending record needed to check the one-time code with SMS_VERIFICATION_SECRET.
create or replace function public.sms_get_whatsapp_connect_candidate(p_phone_number text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select case when v.id is null then null else jsonb_build_object(
    'id', v.id,
    'user_id', v.user_id,
    'phone_number', v.phone_number,
    'code_hash', v.code_hash
  ) end
  from (
    select id, user_id, phone_number, code_hash
    from sms_phone_verifications
    where phone_number = p_phone_number
      and channel = 'whatsapp'
      and verified_at is null
      and invalidated_at is null
      and expires_at > now()
    order by created_at desc
    limit 1
  ) v
$$;

revoke all on function public.sms_get_whatsapp_connect_candidate(text) from public, anon, authenticated;
grant execute on function public.sms_get_whatsapp_connect_candidate(text) to service_role;

-- The connect message is a real inbound WhatsApp message, so it opens the
-- 24-hour customer-service window for the newly activated contact.
create or replace function public.sms_mark_whatsapp_connect_inbound(
  p_user_id uuid,
  p_phone_number text,
  p_occurred_at timestamptz
)
returns void
language sql
set search_path = public
as $$
  update sms_contacts
  set last_inbound_at = greatest(coalesce(last_inbound_at, p_occurred_at), p_occurred_at),
      updated_at = now()
  where user_id = p_user_id
    and phone_number = p_phone_number
    and channel = 'whatsapp'
    and status = 'active'
$$;

revoke all on function public.sms_mark_whatsapp_connect_inbound(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.sms_mark_whatsapp_connect_inbound(uuid, text, timestamptz) to service_role;
