# Journey mini-course teaching

Journey lessons now reuse the mini-course curriculum schema, grammar sequence,
grammar renderer, vocabulary recognition/batching, sentence building and writing
grader. Onboarding imports remain compatible through re-exports.

## Enablement

Apply `supabase/migrations/20261124_000001_journey_lessons.sql` using the normal
Supabase migration process, then release the application changes. The migration
depends on the existing pronunciation sessions and session-completion migration.
Run `npm run db:migrate:journey-lessons` from the project directory to apply the
migration with configured database credentials. A 401/403 means the management
credential needs refreshing locally; alternatively, run the SQL file in the
Supabase SQL Editor. No credentials should be pasted into chat.

If the new table is absent, the existing island and generation endpoints retain
their legacy flow. Other database errors are surfaced rather than silently
discarding progress. Completed legacy islands are not converted. New and unfinished
journey islands get a teaching plan when started or loaded after enablement.

## Teaching and progression

Each of the six app teaching bands (A0 through C1) has five ordered grammar
objectives, one per journey island. These are internal product bands; they are
not a new claim about official HSK equivalence. Future journeys can revisit those
patterns in new topics. A larger mastery-based cross-journey curriculum is a
separate extension to the objective catalog.

The lesson introduces a grammar expression and the island’s topic vocabulary,
checks familiar words, teaches unfamiliar words in small batches, explains the
grammar, immediately checks it, and asks the learner to transfer it to a second
sentence. B1+ includes original writing. All levels offer sentence pronunciation
or listening practice, followed by a topic conversation with Huahua.

The saved objective is supplied to sentence and grammar generation. Prepared
grammar examples are reused when they match; otherwise the lesson prepare endpoint
requests examples for that exact objective. Provider failure leaves preparation
retryable. Generated content is saved once, and a database trigger protects the
saved objective and content from later changes. The most recent 20 conversation messages are saved. Progress uses stable activity IDs
and revision comparisons to prevent stale tabs from overwriting newer work.

## Endpoints

- `POST /api/journey/[id]/start-island`: creates/resumes the teaching objective.
- `POST /api/topic-islands/[id]/generate-batch`: includes the assigned grammar in
  existing grammar and sentence generation.
- `GET /api/topic-islands/[id]`: includes nullable `teaching` with the saved lesson,
  progress and revision. The existing island screen provides a resume link.
- `POST /api/topic-islands/[id]/lesson`: prepares and freezes the curriculum;
  returns `{lesson, progress, revision}`. Existing snapshots are returned unchanged.
- `GET/PATCH /api/topic-islands/[id]/lesson-progress`: reads progress or accepts
  `{revision, progress, evidence}`. Updates move at most one activity ahead;
  sentence-building answers are checked against server content. A stale revision
  returns 409. Writing progression requires a matching server-approved answer.
- `POST /api/topic-islands/[id]/lesson-writing`: accepts `{stepId, answer}` and
  resolves the rubric from the saved curriculum, never from client instructions.
- `POST /api/topic-islands/[id]/lesson-speaking`: creates/reuses a session containing
  the lesson's exact sentence. The recording uses the existing
  `POST /api/pronunciation/score` with `itemId: item-0`. Scored sessions are completed
  through the existing idempotent completion function when the lesson finishes.
  Listening-only sessions do not award pronunciation scores.
- `POST /api/learn-chat`: accepts `{lessonIslandId, messages}` for journey teaching.
  Topic, level, vocabulary and mission come from the owned saved lesson. Existing
  callers keep their previous behaviour.
- `POST /api/journey/[id]/complete`: retains the existing island quiz/completion
  flow and requires the mini-course checkpoint to be complete for converted islands.

New lesson endpoints enforce authentication, ownership and the relevant Islands
or HSK subscription. JSON mutations check origin. Preparation, grading and chat
have per-process request limits. RLS also isolates lesson rows by owner and journey.

## Verification

- `npm run test:journey`: objective selection, shared sequencing, answer validation,
  progress transitions, provider-response rejection, mutation validation, request
  limits and a real PostgreSQL-compatible migration/RLS/concurrency test.
- `npm run test:onboarding` and `npm run test:pronunciation`: shared-component and
  existing pronunciation regressions.
- `npx tsc --noEmit --incremental false`: application and test type checks.
- `npx playwright test tests/e2e/journey-teaching.spec.ts`: refresh/resume, failed
  save recovery, listening and conversation completion, desktop/mobile layout and
  actual microphone/WAV recording with mocked scoring. The suite temporarily
  creates a rendering harness route and removes it afterward; it does not bypass
  authentication on production routes or write production progress.

Browser checks mock generation/chat/scoring responses and persistence. Live
provider credentials, production database migration and a signed-in staging smoke
test remain deployment checks. No production learner data is changed by these tests.

## Surrounding vocabulary policy

New journey grammar examples, all word-sentence tiers, pronunciation sentences
(derived from the grammar examples), and Huahua replies/suggested replies use
HSK 2.0 vocabulary cumulatively up to the selected level (A0–C1 → HSK 1–6).
The exact lesson target words and assigned grammar expressions may be harder.
Earlier completed lessons in this journey and completed owned journeys provide
additional learned-word exceptions, including their completed mini-course words.
Future lessons and other unfinished journeys never contribute exceptions.

Generation receives the actual approved vocabulary and a small sample of learned
words for occasional review. Server validation checks lexical compounds before
productive combinations; imported bracket/paired-pattern entries and ordinary
forms such as 杯/杯子 are normalized. Unlisted or unapproved supporting words
trigger bounded rewriting rather than silently raising the level. Cached grammar
examples are checked before compiling a new lesson. Sentence repair uses the same
policy and keeps existing rows until replacements have passed validation.

This is a practical vocabulary ceiling based on the bundled syllabus, not a
claim that automated tokenization can certify every word sense or grammar level.
Existing immutable lesson snapshots and completed progress are not rewritten.
The current chat policy applies when generating new turns in saved lessons too.
No database migration is required for this policy.
