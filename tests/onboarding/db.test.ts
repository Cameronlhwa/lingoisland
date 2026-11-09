import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { scoreAssessment, selectAssessment, type AssessmentItem } from "../../lib/onboarding/personalized/assessment";
import { emptyAnswers, initialState, markCompleted, type OnboardingAnswers, type OnboardingState } from "../../lib/onboarding/personalized/flow";
import { getQuestion } from "../../lib/onboarding/personalized/questionBank";
import { prepareProgressSave, stateFromRow, type ProgressRow } from "../../lib/onboarding/personalized/save";
import { createSmsTestDb } from "../sms/helpers";

// Real Postgres (PGlite) with the onboarding migration. Calls run as the
// `authenticated` role with auth.uid() set, the same way PostgREST runs them.

type Db = Awaited<ReturnType<typeof createSmsTestDb>>;
let ctx: Db;

const NOW = new Date("2026-11-07T12:00:00Z");

before(async () => {
  ctx = await createSmsTestDb();
  // Supabase lets the API roles resolve auth.uid(); the bare test schema does not by default.
  await ctx.db.exec("grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;");
});

async function asUser<T>(userId: string | null, fn: () => Promise<T>, role = "authenticated"): Promise<T> {
  if (userId) await ctx.db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await ctx.db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await ctx.db.exec("reset role");
    await ctx.db.exec("reset request.jwt.claim.sub");
  }
}

async function call<T>(userId: string | null, fn: string, args: Record<string, unknown> = {}, role = "authenticated"): Promise<T> {
  return asUser(userId, () => ctx.rpc<T>(fn, args), role);
}

function answer(items: AssessmentItem[], correct: boolean) {
  return items.map((item) => {
    const question = getQuestion(item.questionId)!;
    const choiceId = correct ? question.answer : question.choices.find((choice) => choice.id !== question.answer)!.id;
    return { position: item.position, questionId: item.questionId, choiceId };
  });
}

function learnerState(overrides: Partial<OnboardingAnswers> = {}): OnboardingState {
  const attemptId = randomUUID();
  const items = selectAssessment({ claimedLevel: 3, topic: "work", seed: attemptId });
  const answers = answer(items, true);
  return {
    ...initialState(NOW),
    answers: {
      ...emptyAnswers(),
      goal: { primary: "work", secondary: "travel", otherText: null },
      interests: { keys: ["meetings", "clients"], custom: "Board games" },
      level: { selfReport: "basic_conversations" },
      calibration: {
        attemptId,
        claimedLevel: 3,
        items,
        answers,
        placement: scoreAssessment({ claimedLevel: 3, items, answers }),
        writingSystem: "traditional",
      },
      pronunciation: { status: "skipped", toneSupport: null },
      availability: { minutes: "15", days: "3", session: null },
      ...overrides,
    },
  };
}

type SaveResult = { status: string; revision?: number; progress?: ProgressRow & Record<string, unknown> };

async function save(userId: string, state: OnboardingState, expectedRevision: number | null, step = "plan") {
  const prepared = prepareProgressSave({ state, currentStep: step, expectedRevision, timezone: "UTC", allowSimulation: false });
  assert.ok(prepared, "state is valid");
  return call<SaveResult>(userId, "onboarding_save_progress", prepared!.saveArgs);
}

describe("onboarding progress persistence", () => {
  it("saves normalized columns and interests computed on the server", async () => {
    const userId = await ctx.createUser();
    const result = await save(userId, learnerState(), null);
    assert.equal(result.status, "saved");
    assert.equal(result.revision, 1);
    const row = result.progress!;
    assert.equal(row.primary_goal, "work");
    assert.equal(row.secondary_goal, "travel");
    assert.equal(row.self_reported_level, 3);
    assert.equal(row.provisional_level, 4);
    assert.equal(row.minutes_per_day, 15);
    assert.equal(row.days_per_week, 3);
    assert.equal(row.custom_interest, "Board games");
    assert.deepEqual(
      (row.interests as Array<{ key: string; is_custom: boolean }>).map((interest) => [interest.key, interest.is_custom]),
      [
        ["meetings", false],
        ["clients", false],
        ["custom", true],
      ],
    );
    const restored = stateFromRow(row, "UTC")!;
    assert.equal(restored.state.answers.calibration.writingSystem, "traditional");
    assert.equal(restored.state.revision, 1);
  });

  it("returns a conflict instead of overwriting a newer save", async () => {
    const userId = await ctx.createUser();
    await save(userId, learnerState(), null);
    await save(userId, learnerState({ availability: { minutes: "30", days: "5", session: "auto" } }), 1);
    const stale = await save(userId, learnerState({ availability: { minutes: "5", days: "2", session: null } }), 1);
    assert.equal(stale.status, "conflict");
    assert.equal(stale.progress?.revision, 2);
    assert.equal(stale.progress?.minutes_key, "30");
  });

  it("re-scores a tampered placement before anything is stored", async () => {
    const userId = await ctx.createUser();
    const state = learnerState();
    const tampered = JSON.parse(JSON.stringify(state));
    tampered.answers.calibration.answers = answer(state.answers.calibration.items, false);
    tampered.answers.calibration.placement.provisionalLevel = 6;
    const result = await save(userId, tampered, null);
    assert.equal(result.progress?.provisional_level, 1);
  });

  it("never stores the commitment name, and keeps completion one-way", async () => {
    const userId = await ctx.createUser();
    const committed = learnerState({ commitment: { name: "Cameron", committedAt: NOW.toISOString() } });
    const first = await save(userId, committed, null, "paywall");
    assert.equal(first.progress?.status, "completed");
    assert.ok(first.progress?.committed_at);
    assert.doesNotMatch(JSON.stringify(first.progress), /Cameron/);
    const reopened = await save(userId, learnerState(), 1, "goal");
    assert.equal(reopened.progress?.status, "completed");
    assert.ok(reopened.progress?.committed_at, "commitment timestamp survives later saves");
  });

  it("downgrades a simulated messaging status outside development", () => {
    const prepared = prepareProgressSave({
      state: learnerState({ messaging: { channel: "sms", status: "simulated" } }),
      currentStep: "commitment",
      expectedRevision: null,
      timezone: "UTC",
      allowSimulation: false,
    })!;
    assert.deepEqual(prepared.state.answers.messaging, { channel: "none", status: "unavailable" });
    assert.equal(prepared.saveArgs.p_columns.messaging_status, "unavailable");
  });

  it("records abandonment with the step", async () => {
    const userId = await ctx.createUser();
    await save(userId, markCompleted(learnerState(), "goal", NOW), null, "availability");
    const result = await call<{ status: string }>(userId, "onboarding_mark_abandoned", { p_step: "availability", p_last_completed_step: "pronunciation" });
    assert.equal(result.status, "recorded");
    const { rows } = await ctx.db.query<{ last_abandoned_at: string | null; step_events: Record<string, { abandoned_at?: string }> }>(
      "select last_abandoned_at, step_events from onboarding_progress where user_id = $1",
      [userId],
    );
    assert.ok(rows[0].last_abandoned_at);
    assert.ok(rows[0].step_events.availability?.abandoned_at);
  });
});

describe("calibration responses", () => {
  it("stores one row per question and replaces a re-submitted attempt", async () => {
    const userId = await ctx.createUser();
    const prepared = prepareProgressSave({ state: learnerState(), currentStep: "plan", expectedRevision: null, timezone: "UTC", allowSimulation: false })!;
    assert.ok(prepared.assessmentArgs);
    await call(userId, "onboarding_record_assessment", prepared.assessmentArgs!);
    await call(userId, "onboarding_record_assessment", prepared.assessmentArgs!);
    const { rows } = await ctx.db.query<{ position: number; role: string; weight: string }>(
      "select position, role, weight from onboarding_assessment_responses where user_id = $1 order by position",
      [userId],
    );
    assert.deepEqual(rows.map((row) => row.position), [1, 2, 3, 4, 5]);
    assert.deepEqual(rows.map((row) => row.role), ["warmup", "representative", "interest", "diagnostic", "confidence"]);
    assert.deepEqual(rows.map((row) => Number(row.weight) >= 2), [false, true, false, true, false]);
  });
});

describe("plan activation", () => {
  it("requires a commitment, then activates exactly once", async () => {
    const userId = await ctx.createUser();
    const journeyId = randomUUID();
    assert.equal((await call<{ status: string }>(userId, "onboarding_mark_activated", { p_journey_id: journeyId })).status, "not_committed");
    await save(userId, learnerState(), null);
    assert.equal((await call<{ status: string }>(userId, "onboarding_mark_activated", { p_journey_id: journeyId })).status, "not_committed");
    await save(userId, learnerState({ commitment: { name: null, committedAt: NOW.toISOString() } }), 1, "paywall");
    const first = await call<{ status: string; journey_id: string }>(userId, "onboarding_mark_activated", { p_journey_id: journeyId });
    assert.deepEqual(first, { status: "activated", journey_id: journeyId });
    const retry = await call<{ status: string; journey_id: string }>(userId, "onboarding_mark_activated", { p_journey_id: randomUUID() });
    assert.deepEqual(retry, { status: "already_activated", journey_id: journeyId });
  });
});

describe("authorization", () => {
  it("keeps every learner's onboarding rows private", async () => {
    const owner = await ctx.createUser();
    const other = await ctx.createUser();
    await save(owner, learnerState(), null);
    const prepared = prepareProgressSave({ state: learnerState(), currentStep: "plan", expectedRevision: null, timezone: "UTC", allowSimulation: false })!;
    await call(owner, "onboarding_record_assessment", prepared.assessmentArgs!);

    assert.equal(await call(other, "onboarding_get_progress"), null);
    await asUser(other, async () => {
      for (const table of ["onboarding_progress", "onboarding_interests", "onboarding_assessment_responses"]) {
        const { rows } = await ctx.db.query(`select * from public.${table} where user_id = $1`, [owner]);
        assert.equal(rows.length, 0, `${table} hidden from other learners`);
      }
      const update = await ctx.db.query("update public.onboarding_progress set provisional_level = 6 where user_id = $1", [owner]);
      assert.equal(update.affectedRows ?? 0, 0);
      await assert.rejects(
        ctx.db.query("insert into public.onboarding_progress (user_id) values ($1)", [owner]),
        /row-level security|violates/,
      );
    });
    const { rows } = await ctx.db.query<{ provisional_level: number }>("select provisional_level from onboarding_progress where user_id = $1", [owner]);
    assert.equal(rows[0].provisional_level, 4);
  });

  it("returns unauthorized without a signed-in user and denies the anon role", async () => {
    const result = await call<{ status: string }>(null, "onboarding_save_progress", {
      p_expected_revision: null,
      p_answers: {},
      p_step_events: {},
      p_columns: {},
      p_interests: [],
    });
    assert.equal(result.status, "unauthorized");
    assert.equal((await call<{ status: string }>(null, "onboarding_mark_activated", { p_journey_id: randomUUID() })).status, "unauthorized");
    await asUser(
      null,
      async () => {
        await assert.rejects(ctx.db.query("select public.onboarding_get_progress()"), /permission denied/);
        await assert.rejects(ctx.db.query("select * from public.onboarding_progress"), /permission denied/);
      },
      "anon",
    );
  });

  it("does not let signed-in users call the service-only preview or SMS functions", async () => {
    const userId = await ctx.createUser();
    await asUser(userId, async () => {
      await assert.rejects(ctx.db.query("select public.sms_get_preview_thread($1, 10)", [userId]), /permission denied/);
      await assert.rejects(ctx.db.query("select public.sms_update_preferences($1, '{}'::jsonb)", [userId]), /permission denied/);
    });
  });
});
