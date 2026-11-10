# SMS texting practice (华华)

Learners can optionally connect a mobile number, verify it with a texted
code, consent to practice texts, and then chat with 华华, an AI Mandarin
practice partner (DeepSeek), by SMS. Subscribers also get proactive
"openers" after Journey lessons and on a schedule they control.

The provider layer is provider-neutral (`lib/sms/types.ts`); Telnyx is the
only implementation and stays inside `lib/sms/telnyx.ts`. Tests use a fake
provider and never send real texts.

Deployment, Telnyx configuration, cron, and country rollout steps are in
[`SMS_OPERATIONS.md`](./SMS_OPERATIONS.md).

## Setup (summary)

1. Apply the migrations, in order (never edit an applied one):
   - `supabase/migrations/20261103_000001_sms_prototype.sql`
   - `supabase/migrations/20261104_000001_sms_phone_verification.sql`
   - `supabase/migrations/20261106_000001_sms_huahua_phase2.sql`
   - `supabase/migrations/20261107_000001_personalized_onboarding.sql`
2. Add the SMS variables from `.env.example` (server-only; never prefix them
   with `NEXT_PUBLIC_`). Texting stays hidden in the UI until
   `TELNYX_API_KEY`, `TELNYX_PUBLIC_KEY`, `TELNYX_FROM_NUMBER`, and
   `SMS_VERIFICATION_SECRET` (32+ chars) are all set. 华华 replies need
   `DEEPSEEK_API_KEY`; without it, learners get short fixed fallback texts.
3. Point the Telnyx Messaging Profile webhook at `https://<host>/api/sms/webhook`.
4. Schedule `/api/cron/sms-process` every 5 minutes with `CRON_SECRET`.
   Without it, Journey and scheduled openers never send, webhook retries never
   run, and retention cleanup never happens.

### Local testing

Run the app, then `node scripts/sms-webhook-proxy.mjs` (forwards only
`POST /api/sms/webhook` from port 3004 to the app on 3003; override with
`SMS_PROXY_PORT` / `SMS_APP_PORT`), and expose just the gateway with
`ngrok http 3004`. `SMS_WEBHOOK_ALLOW_UNSIGNED=true` skips signature checks
for synthetic local webhooks only; it is ignored when `NODE_ENV=production`.

`/dev/huahua` (404 in production) renders the Texting page against mocked
APIs; add `?view=onboarding` for the onboarding style step.

Tests:

- `npm run test:sms`: runs every migration in an in-process Postgres
  (PGlite) with Supabase-style default grants, a fake provider, a fake model,
  and an injected clock. No network, Supabase project, or secrets.
- `npx playwright test tests/e2e/huahua-settings.spec.ts`: Texting page and
  onboarding step against mocked routes.
- `npm run test:onboarding`: personalized onboarding logic plus its RPCs and
  row-level security on PGlite.
- `npx playwright test tests/e2e/personalized-onboarding.spec.ts`: the full
  onboarding flow at mobile, tablet, and desktop widths with mocked APIs,
  including axe accessibility checks and an analytics privacy check.

PGlite is a single connection, so the "concurrent" tests interleave calls
rather than running them truly in parallel. Row locks and unique constraints
carry the real concurrency guarantees.

## Learner flow

- **Personalized onboarding** (`/onboarding/journey` and `/app/onboarding`,
  `components/Onboarding/personalized/`): this flow never asks for a phone
  number. The plan preview leads straight to the commitment and the paywall.
  Learners keep the 华华 defaults for their level and connect a number later
  on the Texting page. The phone and texting step ids stay in `STEP_ORDER`
  only so saved progress from the phone version still parses; a saved
  learner on one of them resumes at the next step that is shown.
- **Legacy onboarding** (`?islandId=`, `?resume=texting`, `?track=hsk`):
  after the journey is created, an optional "practice by text" step appears.
  After verification, the learner picks a texting style and correction mode
  (`HuahuaOnboardingStyle`). The step is skipped automatically if SMS is not
  configured or the learner already has an active number.
- **Texting page** (`/app/huahua`, sidebar "Texting"): number setup, texting
  style, pinyin/English help, schedule (subscribers), usage meter, words from
  chats, recent conversations, and deleting history. If SMS isn't configured
  the page explains that texting is unavailable instead of erroring.
- **Account → Profile → Texting Practice**: number setup plus a link to the
  Texting page.
- Learners in countries that aren't enabled can tap "My country isn't
  listed" to record interest. This never enables texting there.

## Conversation design

- **Welcome** (`lib/sms/huahua/welcome.ts`): sent once after verification.
  It is level-appropriate (from the learner's Journey level), discloses that
  华华 is an AI, lists commands, and offers the style menu to subscribers.
- **Personas** (`personas.ts`): `friendly_friend` (free and paid),
  `focused_coach`, `accountability_partner`, `professional_partner`
  (subscribers). Replying `1`–`4` right after the menu switches style.
- **Correction modes** (`correction.ts`): `gentle` (default), `coach`,
  `hint_first`, `conversation_only`.
- **Scaffolding** (`scaffolding.ts`): HSK1–6 controls sentence length,
  vocabulary, and when pinyin/English help is added (`auto`, `more`, `less`).
  Pinyin comes from the model, with a local pinyin-pro fallback.
- **Commands** (`commands.ts`, case- and punctuation-insensitive):

  | English | Chinese | Effect |
  | --- | --- | --- |
  | `pinyin` | `拼音` | Pinyin for the last message |
  | `translate` | `翻译` | English for the last message |
  | `hint` | `提示` | A hint without the answer |
  | `easier` / `harder` | `简单一点` / `难一点` | Adjust difficulty |
  | `explain` | `解释一下` | Explain the last correction |
  | `english` | `中文` | Reply language |
  | `stop correcting me` / `correct me` | | Correction mode |
  | `pause` / `resume` | | Pause or resume proactive texts |

  Prefixing with "always" or "from now on" (`以后`, `一直`, `总是`) makes a
  help command persistent. Carrier keywords STOP/START/HELP are handled
  before any of this (`lib/sms/keywords.ts`) and work in every state.
- **Structured AI output** (`ai.ts`, `turn.ts`): the model returns JSON
  (message, correction, words used, comfort signals). It is validated at
  runtime, trimmed to the country's segment limit, and checked for safety.
  Any failure or timeout falls back to a deterministic message
  (`fallbacks.ts`), and fallbacks are rate-limited per contact.
- **Safety** (`safety.ts`): crisis messages get a fixed reply with 988/911
  (US/CA) or local guidance, unmetered. Texts that share passwords, codes, or
  card numbers get a fixed warning. Outbound text that asks for credentials
  is replaced. Asking whether 华华 is human always gets an honest AI answer.
- **Word comfort** (`wordComfort.ts`, `sms_word_comfort`): words used well or
  struggled with in chats move a 0–1 comfort score (`needs practice` below
  0.45, `comfortable` from 0.7). It is kept separate from quiz mastery and
  never changes Journey or review progress.
- **Threads** (`sms_threads`): each opener or inbound text opens or joins a
  thread. A thread goes stale after 6 hours of quiet, or 48 hours for an
  unanswered opener.

## Proactive openers (subscribers)

- **Journey trigger**: completing a Journey step queues one opener (job key
  `journey:<island>`) via `lib/sms/huahua/journeyTrigger.ts`. Errors are
  logged and never affect the lesson response.
- **Scheduled**: the cron planner creates at most one job per learner per
  planned local day (key `scheduled:<user>:<date>`), based on days per week,
  preferred days, and openers per week (5, 3, 2, or 1).
- **Delivery windows** default to 18:00–21:00 local. Windows are always
  clamped to 08:00–21:00 (quiet hours), computed in the learner's IANA time
  zone, and DST-safe.
- **Gates** (`evaluateGates` in `openers.ts`), checked in order: an active
  consented contact, a current subscription, an enabled country, frequency
  not off, the weekly and daily caps, no unanswered opener in the last 48
  hours, no conversation in the last 3 hours, and inside a delivery window.
  Journey openers that hit a cap or are outside a window are rescheduled;
  scheduled ones are skipped.
- **Non-response rules**: after 2 unanswered openers in a row, frequency
  steps down one tier (when auto-adjust is on). After 3, 华华 sends a single
  control text ("keep them / less often / pause"). If that is ignored too,
  proactive texts pause (`paused_reason = no_response`). The learner can
  still text 华华 at any time.
- Opener facts are truthful: only the actual completed lesson and words the
  learner studied are mentioned. Vocabulary is weighted 70% recent, 20% needs
  practice, 10% maintenance.
- Jobs are claimed with a 2-minute lease, retried with exponential backoff
  (up to 1 hour), and marked `failed` after 5 attempts. Sends use idempotency
  keys (`opener:<job>`), so a retry never texts twice.

## Plans and allowance

Defined in `lib/sms/huahua/plans.ts`. Subscription status mirrors
`lib/entitlements.ts` (`product_subscriptions`, then legacy `profiles.plan`).

| Plan | Allowance | Period | Styles | Openers |
| --- | --- | --- | --- | --- |
| Free trial | 8 segments | Lifetime | Friendly friend | No |
| Subscriber | 600 segments | Billing month | All four | Yes |

- Usage counts provider segments for 华华's metered texts (replies, openers,
  fallbacks). It is charged atomically before sending (`sms_usage_charge`).
- Subscribers get one text when they cross 80%; everyone gets one notice
  when the allowance runs out. Each notice is sent at most once per period.
- STOP/HELP replies, verification codes, consent and welcome texts, account
  commands (pause/resume/style), control texts, and safety replies are never
  metered and never blocked.

## Countries

`lib/sms/countries.ts` is the registry: sender type, two-way support,
registration needs, compliance notes, segment limit, and rollout status.
Only **Canada (CA)** and **United States (US)** are enabled. A country is
offered only if it is `enabled`, two-way capable, and (when set) listed in
`SMS_SUPPORTED_COUNTRIES`. The env variable can only narrow the list; it
can't enable a country on its own.

## API

All routes require a signed-in user. Mutations also require a same-origin
JSON request (`lib/security/sameOrigin.ts`).

| Route | Purpose |
| --- | --- |
| `GET /api/sms/phone` | Masked status, pending code info, supported countries |
| `POST /api/sms/phone/start` | `{ country, phoneNumber, consent: true, consentVersion, source }` texts a code |
| `POST /api/sms/phone/verify` | `{ code, confirmTransfer? }` verifies, activates, records consent, sends welcome |
| `POST /api/sms/phone/resend` | New code to the pending number (30s cooldown, max 5 per verification) |
| `PATCH /api/sms/phone` | `{ action: "pause" \| "resume" }` |
| `DELETE /api/sms/phone` | Disconnect (row kept as `released` for audit/history) |
| `GET /api/sms/huahua` | Texting page overview (phone, plan, preferences, usage, threads, words, countries) |
| `PATCH /api/sms/huahua` | Update preferences (plan-gated personas, validated windows and time zone) |
| `DELETE /api/sms/huahua/history` | `{ includeWords? }` erases message text, threads, and optionally word comfort |
| `POST /api/sms/huahua/interest` | `{ country }` records interest in a country that isn't enabled |
| `POST /api/sms/webhook` | Telnyx webhook |
| `GET/POST /api/cron/sms-process` | Background work (`CRON_SECRET`) |

Prototype routes: `GET /api/sms/contacts` returns masked numbers;
`POST /api/sms/contacts` returns 410; `POST /api/sms/send` is disabled unless
`SMS_MANUAL_SEND_ENABLED=true` and only texts the caller's own active number.

### Webhook

The webhook verifies the Ed25519 signature, stores the event (deduplicated
by provider event id), and acknowledges quickly. STOP/START/HELP keywords
are processed before responding so opt-outs take effect immediately;
everything else is processed with `waitUntil`. The cron retries any event
that didn't finish (leased, with backoff).

### Cron (`/api/cron/sms-process`)

Each step is isolated, so one failure doesn't stop the rest:

1. Retry unprocessed webhook events.
2. Plan today's scheduled openers.
3. Run due opener jobs.
4. `sms_cleanup`: expired codes, rate-limit events, old webhook events.
5. `sms_retention_cleanup(90, 30)`: redact message text older than 90 days,
   delete stale threads, and delete finished jobs older than 30 days.

## Data model

Phase 1:

- `sms_contacts.status`: `unverified` (legacy), `active`, `paused`,
  `opted_out`, `disabled` (repeated delivery failures), `released`
  (disconnected, replaced, or transferred; kept for audit). There is one
  non-released row per phone number and per user. `paused_reason` is `user`
  or `no_response`.
- `sms_phone_verifications`: HMAC-SHA256 code hashes (never plaintext),
  10-minute expiry, attempt and send counters, consent source and version.
- `sms_messages`: inbound and outbound texts. Outbound rows carry an
  `idempotency_key` (`welcome:<contact>`, `reply:<inbound>`, `opener:<job>`,
  …), so no text is sent twice.
- `sms_webhook_events`, `sms_rate_limit_events`.

Phase 2 (`20261106_000001_sms_huahua_phase2.sql`):

- `sms_preferences`: persona, correction, scaffolding, schedule, and
  non-response counters.
- `sms_jobs`: idempotent opener queue.
- `sms_threads`: conversation threads.
- `sms_usage_periods`: per-period segment usage and notices.
- `sms_word_comfort`: word comfort scores.
- `sms_country_interest`: interest in countries that aren't enabled.
- `sms_transfer_audit`: number moves between accounts (number, both user
  and contact ids, and the verification).
- `sms_consent_events`: every consent or status change, written by a
  trigger. Kept through retention and history deletion.

Access:

- Writes happen only through `sms_*` Postgres functions, executable by
  `service_role` only (explicitly revoked from `public`, `anon`, and
  `authenticated`).
- Phase 2 tables are service-role only.
- Signed-in users can read only their own `sms_contacts` and `sms_messages`
  rows (RLS). The app reads them server-side.
- The browser only sees what the API routes return: masked numbers and the
  learner's own data.

## Behaviour notes

- No AI replies unless the contact is `active` (verified and consented).
  Unknown, pending, paused-by-carrier, opted-out, disabled, and unverified
  numbers are ignored; HELP still gets the fixed help text. A learner who
  paused proactive texts can still start a conversation.
- STOP-style keywords opt out. START re-activates only previously verified
  contacts. Out-of-order STOP/START events are resolved by provider
  timestamp. Telnyx also handles carrier-level STOP, and error `40300` marks
  a contact opted out. The website never re-activates an opted-out number;
  the learner must text START.
- Moving a number to another account requires re-verification and explicit
  confirmation. The previous account's history stays with that account, and
  the move is recorded in `sms_transfer_audit`.
- AI texts are limited to the country's segment limit (3 for CA/US; UCS-2
  segments are 67 code units each) with grapheme-safe trimming
  (`lib/sms/segments.ts`).
- Provider send errors are recorded on the message. Only definite
  rejections (4xx/429/503) are retryable; timeouts are never resent. Three
  permanent delivery failures in a row disable the contact.
- Verification codes, phone numbers, and message text are kept out of logs
  and analytics (`lib/sms/log.ts`). Numbers are shown masked
  (`+1 ••• ••• 9212`).
- Deleting history redacts message text in place (rows stay for delivery and
  usage accounting), deletes closed threads, clears open-thread context, and
  redacts the matching webhook payloads. Consent events and transfer audit
  rows are kept.
- Consent copy lives in `lib/sms/consent.ts`. Bump `SMS_CONSENT_VERSION` when
  it changes. It is a product safeguard, not legal advice; have counsel
  review it.
