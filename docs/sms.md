# SMS texting practice

Learners can optionally connect a mobile number, verify it with a texted
code, consent to practice texts, and then chat with 华华 (DeepSeek) by SMS.
The provider layer is provider-neutral (`lib/sms/types.ts`); Telnyx is the
current implementation (`lib/sms/telnyx.ts`).

## Setup

1. Apply the migrations, in order:
   - `supabase/migrations/20261103_000001_sms_prototype.sql` (skip if already applied)
   - `supabase/migrations/20261104_000001_sms_phone_verification.sql`

   With the Supabase CLI: `supabase db push`. Or paste each file into the
   SQL editor. The second migration is safe to re-run.
2. Add the SMS variables from `.env.example` (server-only; never prefix them
   with `NEXT_PUBLIC_`). Texting stays hidden in the UI until
   `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_FROM_NUMBER`, and
   `SMS_VERIFICATION_SECRET` (32+ chars) are all set.
3. In Telnyx, set the Messaging Profile webhook URL to
   `https://<host>/api/sms/webhook` (inbound messages and delivery receipts).
4. Schedule `/api/cron/sms-process` (GET/POST with
   `Authorization: Bearer $CRON_SECRET`) every 1–5 minutes. It retries any
   webhook event whose background processing did not finish and prunes old
   SMS data. Minute-level Vercel Cron requires a Pro plan; otherwise use an
   external scheduler. It is intentionally not in `vercel.json`, because
   sub-daily schedules fail deployment on Hobby plans.

### Local testing

Run the app, then `node scripts/sms-webhook-proxy.mjs` (forwards only
`POST /api/sms/webhook` from port 3004 to the app on 3003; override with
`SMS_PROXY_PORT` / `SMS_APP_PORT`), and expose just the gateway with
`ngrok http 3004`. `SMS_WEBHOOK_ALLOW_UNSIGNED=true` skips signature checks
for synthetic local webhooks only; it is ignored when `NODE_ENV=production`.

Tests: `npm run test:sms` (runs the real migrations in an in-process
Postgres via PGlite; no network or Supabase project needed).

## Learner flow

- **Onboarding** (`/app/onboarding`): after the journey is created, an
  optional "practice by text" step appears. Skipping or any SMS problem never
  blocks the journey. The step is skipped automatically if SMS is not
  configured or the learner already has an active number. A session flag
  resumes the step after a reload (e.g. switching to Messages for the code);
  a pending code also resumes in Account settings.
- **Account → Profile → Texting Practice**: add, verify, resend, change,
  pause/resume, or disconnect a number.

Both use `components/sms/SmsPhoneSetup.tsx`.

## API

All routes require a signed-in user; mutations also require a same-origin
JSON request (`lib/security/sameOrigin.ts`).

| Route | Purpose |
| --- | --- |
| `GET /api/sms/phone` | Masked status, pending code info, supported countries |
| `POST /api/sms/phone/start` | `{ country, phoneNumber, consent: true, consentVersion, source }` texts a code |
| `POST /api/sms/phone/verify` | `{ code, confirmTransfer? }` verifies, activates, records consent, sends welcome |
| `POST /api/sms/phone/resend` | New code to the pending number (30s cooldown, max 5 per verification) |
| `PATCH /api/sms/phone` | `{ action: "pause" \| "resume" }` |
| `DELETE /api/sms/phone` | Disconnect (row kept as `released` for audit/history) |
| `POST /api/sms/webhook` | Telnyx webhook (signature verified, stored, acknowledged, processed in background) |
| `GET/POST /api/cron/sms-process` | Retries unprocessed events, cleanup (`CRON_SECRET`) |

Prototype routes: `GET /api/sms/contacts` now returns masked numbers;
`POST /api/sms/contacts` returns 410 (contacts are only created by
verification); `POST /api/sms/send` is disabled unless
`SMS_MANUAL_SEND_ENABLED=true` and only texts the caller's own active number.

## Data model

- `sms_contacts.status`: `unverified` (legacy prototype rows), `active`,
  `paused`, `opted_out`, `disabled` (repeated delivery failures), `released`
  (disconnected/replaced/transferred; kept for history and consent audit).
  One non-released row per phone number and per user.
- `sms_phone_verifications`: HMAC-SHA256 code hashes (never plaintext), 10
  minute expiry, attempt and send counters, consent source/version.
- `sms_messages`: inbound and outbound texts; outbound rows carry an
  `idempotency_key` (`welcome:<contact>`, `reply:<inbound message>`, …) so no
  text is ever sent twice.
- `sms_webhook_events`: every signed event, deduplicated by provider event id,
  with processing attempts and backoff.
- `sms_rate_limit_events`: sliding-window counters keyed by hashed ids.

Writes happen only through `sms_*` Postgres functions, executable by the
service role only. Authenticated users can read their own contacts and
messages; the prototype's client insert/update policies were removed.

## Behavior notes

- No AI replies unless the contact is `active` (verified + consented).
  Unknown, pending, paused, opted-out, disabled, and unverified numbers are
  ignored (HELP still gets the fixed help text).
- STOP-style keywords opt out; START re-activates only previously verified
  contacts. Out-of-order STOP/START events are resolved by provider timestamp.
  Telnyx also handles carrier-level STOP; error `40300` marks a contact
  opted out. The website never re-activates an opted-out number; the learner
  must text START.
- AI replies are limited to 2 SMS segments (UCS-2: 134 code units) with
  grapheme-safe trimming (`lib/sms/segments.ts`). DeepSeek is retried once;
  on failure a short fixed apology is sent at most once per hour.
- Provider send errors are recorded on the message. Only definite
  rejections (4xx/429/503) are retryable; timeouts are never resent.
- Three permanent delivery failures in a row disable the contact.
- Verification codes, phone numbers, and message text are kept out of logs
  and analytics (`lib/sms/log.ts`); numbers are shown masked (`+1 ••• ••• 9212`).
- Consent copy lives in `lib/sms/consent.ts`. Bump `SMS_CONSENT_VERSION` when
  it changes. It is a product safeguard, not legal advice; have counsel
  review it, and complete Telnyx 10DLC / toll-free registration before launch.
