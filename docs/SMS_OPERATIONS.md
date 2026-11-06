# SMS operations runbook

How to deploy, configure, and operate 华华 texting. Product behaviour is in
[`sms.md`](./sms.md).

## 1. Apply the database migration

Apply in order; never edit an applied migration (add a new one instead):

1. `20261103_000001_sms_prototype.sql`
2. `20261104_000001_sms_phone_verification.sql`
3. `20261106_000001_sms_huahua_phase2.sql`

Use `supabase db push`, or paste each file into the Supabase SQL editor. The
Phase 2 migration uses `if not exists` / `create or replace` and can be
re-run.

Check it applied (SQL editor):

```sql
select count(*) from information_schema.tables
where table_schema = 'public'
  and table_name in ('sms_preferences', 'sms_jobs', 'sms_threads', 'sms_usage_periods',
                     'sms_word_comfort', 'sms_country_interest', 'sms_transfer_audit',
                     'sms_consent_events');
-- expect 8

select has_function_privilege('authenticated', 'public.sms_get_huahua_overview(uuid, integer, integer, integer)', 'execute');
-- expect false
```

## 2. Environment variables

All are server-only (see `.env.example`). Set them in the hosting
provider, never in the repository.

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | All SMS writes go through service-role RPCs |
| `TELNYX_API_KEY` | Yes | Telnyx API v2 key |
| `TELNYX_PUBLIC_KEY` | Yes | Ed25519 webhook signing key (Base64) |
| `TELNYX_FROM_NUMBER` | Yes | E.164 number on the Messaging Profile |
| `SMS_VERIFICATION_SECRET` | Yes | 32+ random chars; rotating it invalidates pending codes |
| `CRON_SECRET` | Yes | Protects `/api/cron/sms-process` |
| `DEEPSEEK_API_KEY` | Recommended | Without it, 华华 sends fixed fallback texts |
| `SMS_SUPPORTED_COUNTRIES` | No | Narrows the enabled registry list (e.g. `CA`) |
| `SMS_OWN_NUMBERS` | No | Extra sending numbers; inbound from them is ignored |
| `SMS_MANUAL_SEND_ENABLED` | No | Keep `false` in production |
| `SMS_WEBHOOK_ALLOW_UNSIGNED` | No | Must be `false`; ignored in production anyway |

## 3. Telnyx configuration

1. **Number**: buy a Canadian or US long code with SMS enabled and assign it
   to a Messaging Profile.
2. **Webhook**: on the Messaging Profile, set the inbound webhook URL to
   `https://<production-host>/api/sms/webhook`, API version 2. The same URL
   receives delivery receipts (`message.finalized`).
3. **Signing key**: copy the public key from Mission Control → Account
   Settings → Keys & Credentials into `TELNYX_PUBLIC_KEY`. Unsigned or
   badly signed webhooks get a 400.
4. **US registration (required before texting US numbers)**: register a
   10DLC brand and campaign (or toll-free verification) and attach the
   number. Use the consent copy in `lib/sms/consent.ts` as the opt-in
   description, and texts from `lib/sms/huahua/welcome.ts` as samples.
5. **Canada**: toll-free verification or a registered long code is
   recommended for deliverability. Consent is recorded with version and
   source for CASL.
6. **Opt-out keywords**: the app replies to STOP/START/HELP itself. If Telnyx
   auto-responses are also on, learners get two replies. Either turn off the
   profile's auto-response text or accept the duplicate. Carrier-level STOP
   is still enforced (error `40300` marks the contact opted out).

## 4. Schedule the cron

`/api/cron/sms-process` (GET or POST) needs
`Authorization: Bearer $CRON_SECRET` (or `x-cron-secret`). Run it every 5
minutes. Openers can only go out on a run, so the interval is the delivery
precision.

It isn't in `vercel.json`, because Vercel Hobby rejects schedules more
frequent than daily. Options:

- **Vercel Pro**: add to `vercel.json`:

  ```json
  { "crons": [{ "path": "/api/cron/sms-process", "schedule": "*/5 * * * *" }] }
  ```

  Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically.
- **External scheduler** (GitHub Actions, cron-job.org, etc.):

  ```bash
  curl -fsS -X POST https://<production-host>/api/cron/sms-process \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

The response holds only counts, for example
`{ "webhooks": { "processed": 0 }, "planned": { ... }, "jobs": { ... }, "cleanup": { ... }, "retention": { ... } }`.
A step that failed shows `{ "error": true }` and logs
`sms-process <step> failed`. `{ "skipped": "sms_not_configured" }` means the
SMS variables are incomplete.

## 5. Post-deploy verification

Use a real phone you own:

1. Texting page (`/app/huahua`) shows "Your number". If it says texting is
   unavailable, a required variable is missing.
2. Add the number, receive the code, and verify. The welcome text arrives.
3. Text `你好`: 华华 replies. Text `pinyin`: pinyin for the last message.
4. Text `HELP`: fixed help text. Text `STOP`: opt-out confirmation, and the
   page shows the number as opted out. Text `START` to re-activate.
5. Run the cron manually (step 4) and confirm `200` with counts.
6. For a subscriber test account, complete a Journey step inside the
   delivery window and run the cron: one opener arrives.
7. Check logs: no phone numbers, codes, or message text.

## 6. Enabling another country

1. Confirm the provider supports two-way SMS there for your sender type,
   and complete any registration (sender ID, templates, campaign).
2. Get counsel to review consent, quiet-hours, and opt-out rules.
3. In `lib/sms/countries.ts`, set `enabled: true`, `rolloutStatus: "pilot"`
   or `"live"`, and check `segmentLimit` and `complianceNotes`. Countries
   without two-way support can't be enabled; the registry filters them out.
4. If `SMS_SUPPORTED_COUNTRIES` is set, add the code there too.
5. Review `sms_country_interest` for learners who asked for it. The app
   doesn't text them automatically; they must verify a number.
6. Add or adjust tests in `tests/sms/huahua-units.test.ts` and deploy.

To disable a country, set `enabled: false`. Openers stop for contacts there
(`country_disabled` gate) and new verifications are refused. Existing
inbound conversations still get STOP/HELP handling.

## 7. Turning texting off

- **Soft off**: unset `TELNYX_FROM_NUMBER` (or `SMS_VERIFICATION_SECRET`).
  The UI hides texting, onboarding skips the step, Journey triggers stop,
  and the cron returns `skipped`. The webhook still processes inbound texts,
  so STOP is honoured and 华华 still replies to learners who text.
- **Hard off**: also disable the Messaging Profile, or remove its webhook
  URL, in Telnyx. Carrier-level STOP still applies.

## 8. Data and retention

- Message text is redacted after 90 days. Finished jobs are deleted after 30
  days. Expired codes and rate-limit rows are pruned on every cron run.
- Learners can erase their own history from the Texting page.
- Deleting an auth user cascades to their SMS rows, including consent
  events. Transfer audit rows survive with the user ids set to null. Export
  `sms_consent_events` first if you need to keep consent records.
- For a data request, query by `user_id` in the SMS tables with the service
  role. Never expose these tables to the browser.
