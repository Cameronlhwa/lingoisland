# Paid access

Learning requires the matching product subscription. The public questionnaire,
saved onboarding answers, sign-in, billing, payment recovery, waitlist, and carrier
account/safety commands remain available. Onboarding lesson/pronunciation demos,
the first island, free monthly allowances, and free texting trials are retired.

Protection is enforced by the app layout, default-paid API middleware, explicit
activation/lesson checks, and database RLS/RPC guards. Checkout initiation, an
onboarding-complete flag, and `checkout=success` are not proof of access.

Existing active subscriptions and legitimate legacy profile grants remain valid.
An explicit inactive product subscription overrides a legacy profile grant.
Expired subscriptions do not grant access. Core and HSK access remain separate.

## Release

Deploy the code first, then apply `supabase/migrations/20261125_000001_hard_paywall.sql` immediately as part of the same release. The new checkout code must be live before the billing-field trigger is installed. Both steps are required for the full hard paywall.
It retains learning data and subscription records, adds restrictive paid-access
policies, protects profile billing fields, gates learning RPCs, and removes public
execution grants from old administrative subscription repair functions. Trusted
billing writes (including checkout customer creation) use the service role.

No migration or deployment is performed by tests. Validate in an isolated checkout:

- Run the `tests/hard-paywall*.test.ts` suites plus onboarding activation/flow tests.
- Run `tests/e2e/hard-paywall.spec.ts` with an isolated Next server configured with
  `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and a dummy anon key. The suite
  hosts its own fake auth/database service on port 54321; it forbids fixture writes.
  Never point this browser fixture at production Supabase.
