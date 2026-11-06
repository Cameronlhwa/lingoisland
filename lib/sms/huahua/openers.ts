import { getSmsCountry, segmentLimitForCountry } from "../countries";
import { describeSmsError, logSmsError } from "../log";
import { CONTROL_MESSAGE } from "../messages";
import { sendTrackedSms } from "../outbound";
import type { SmsRpc } from "../rpc";
import type { HuahuaTurnInput } from "./ai";
import { composeSms, pinyinFor } from "./compose";
import { clock, loadHuahuaContext, meterFor, type HuahuaContext, type HuahuaDeps } from "./context";
import { fallbackOpener } from "./fallbacks";
import {
  effectiveOpenersPerWeek,
  isWithinWindow,
  localDateKey,
  localDayStart,
  localNextDayStart,
  localNextWeekStart,
  localParts,
  localWeekStart,
  nextDeliveryTime,
  plannedOpenerDays,
  reducedFrequency,
} from "./schedule";
import { supportFor } from "./scaffolding";
import { produceTurn } from "./turn";
import type { Vocab } from "./wordComfort";

export const JOB_LEASE_SECONDS = 120;
export const JOB_MAX_ATTEMPTS = 5;
/** Don't open a new conversation while the last opener is unanswered and this recent. */
export const RECENT_UNANSWERED_HOURS = 48;
/** Wait this long after the learner's last text before starting a new conversation. */
export const ACTIVE_CONVERSATION_HOURS = 3;
export const REDUCE_AFTER_UNANSWERED = 2;
export const CONTROL_AFTER_UNANSWERED = 3;

type Job = {
  id: string;
  user_id: string;
  kind: "journey_opener" | "scheduled_opener";
  journey_island_id: string | null;
  attempts: number;
};

type OpenerStats = {
  week_count: number;
  day_count: number;
  last: { started_at: string; inbound_count: number; status: string; last_inbound_at: string | null } | null;
  open_jobs: number;
  last_inbound_at: string | null;
};

type Material = {
  journey_island: { id: string; name: string | null; zh: string | null; completed_at: string | null } | null;
  recent: Vocab[];
  needs_practice: Vocab[];
  maintenance: Vocab[];
};

type Gate =
  | { action: "send" }
  | { action: "skip"; reason: string }
  | { action: "reschedule"; reason: string; at: Date };

// ---------------------------------------------------------------------------
// Journey trigger
// ---------------------------------------------------------------------------

/**
 * Called when a Journey step is completed. Only queues work; the opener is
 * sent by the job runner (same day inside the learner's window, otherwise
 * the next window). Idempotent per Journey step.
 */
export async function enqueueJourneyOpener(
  deps: { rpc: SmsRpc; now?: () => Date },
  input: { userId: string; journeyIslandId: string },
) {
  return deps.rpc<{ created: boolean; job_id?: string; status?: string }>("sms_enqueue_job", {
    p_user_id: input.userId,
    p_kind: "journey_opener",
    p_idempotency_key: `journey:${input.journeyIslandId}`,
    p_not_before: clock(deps).toISOString(),
    p_journey_island_id: input.journeyIslandId,
  });
}

// ---------------------------------------------------------------------------
// Content selection: 70% recent Journey, 20% needs practice, 10% maintenance
// ---------------------------------------------------------------------------

export const CONTENT_WEIGHTS = { recent: 0.7, needsPractice: 0.2, maintenance: 0.1 } as const;

/** Deterministic PRNG (mulberry32) seeded from a string, so retries pick the same words. */
export function seededRandom(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i += 1) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOpenerVocab(material: Pick<Material, "recent" | "needs_practice" | "maintenance">, random: () => number, count = 2) {
  const pools = {
    recent: material.recent.filter((word) => word.hanzi),
    needsPractice: material.needs_practice.filter((word) => word.hanzi),
    maintenance: material.maintenance.filter((word) => word.hanzi),
  };
  const used = new Set<string>();
  const picked: Vocab[] = [];
  const take = (pool: Vocab[]) => {
    const available = pool.filter((word) => !used.has(word.hanzi));
    if (available.length === 0) return false;
    const word = available[Math.floor(random() * available.length)];
    used.add(word.hanzi);
    picked.push(word);
    return true;
  };
  for (let slot = 0; slot < count; slot += 1) {
    const roll = random();
    const order =
      roll < CONTENT_WEIGHTS.recent
        ? [pools.recent, pools.needsPractice, pools.maintenance]
        : roll < CONTENT_WEIGHTS.recent + CONTENT_WEIGHTS.needsPractice
          ? [pools.needsPractice, pools.recent, pools.maintenance]
          : [pools.maintenance, pools.recent, pools.needsPractice];
    if (!order.some(take)) break;
  }
  return picked;
}

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

function hoursBefore(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 3600_000);
}

export function evaluateGates(input: {
  ctx: HuahuaContext;
  job: Pick<Job, "kind">;
  stats: OpenerStats;
  now: Date;
}): Gate {
  const { ctx, job, stats, now } = input;
  const contact = ctx.contact;
  if (!contact) return { action: "skip", reason: "no_contact" };
  if (!contact.verified_at || !contact.consent_at) return { action: "skip", reason: "no_consent" };
  if (contact.status !== "active") return { action: "skip", reason: `contact_${contact.status}` };
  if (!ctx.plan.proactiveOpeners) return { action: "skip", reason: "not_subscribed" };
  const country = getSmsCountry(ctx.countryCode);
  if (!country?.enabled || !country.outbound) return { action: "skip", reason: "country_disabled" };

  const tz = ctx.timezone;
  const windows = ctx.preferences.delivery_windows;
  const perWeek = effectiveOpenersPerWeek(ctx.preferences);
  if (perWeek <= 0) return { action: "skip", reason: "frequency_off" };

  const nextAllowedDay = () => {
    const start = localNextDayStart(now, tz);
    return nextDeliveryTime({ now: start, tz, windows }) ?? start;
  };

  if (stats.week_count >= perWeek) {
    return job.kind === "journey_opener"
      ? { action: "reschedule", reason: "weekly_cap", at: nextWeekWindow(now, tz, windows) }
      : { action: "skip", reason: "weekly_cap" };
  }
  if (stats.day_count >= 1) {
    return job.kind === "journey_opener"
      ? { action: "reschedule", reason: "daily_cap", at: nextAllowedDay() }
      : { action: "skip", reason: "daily_cap" };
  }

  const last = stats.last;
  if (last?.status === "open" && last.inbound_count === 0 && new Date(last.started_at) > hoursBefore(now, RECENT_UNANSWERED_HOURS)) {
    if (job.kind === "scheduled_opener") return { action: "skip", reason: "recent_unanswered" };
    const after = new Date(new Date(last.started_at).getTime() + RECENT_UNANSWERED_HOURS * 3600_000);
    return { action: "reschedule", reason: "recent_unanswered", at: nextDeliveryTime({ now: after, tz, windows }) ?? after };
  }
  if (stats.last_inbound_at && new Date(stats.last_inbound_at) > hoursBefore(now, ACTIVE_CONVERSATION_HOURS)) {
    const after = new Date(new Date(stats.last_inbound_at).getTime() + ACTIVE_CONVERSATION_HOURS * 3600_000);
    return { action: "reschedule", reason: "active_conversation", at: nextDeliveryTime({ now: after, tz, windows }) ?? after };
  }

  if (!isWithinWindow(now, tz, windows)) {
    const at = nextDeliveryTime({ now, tz, windows });
    return at ? { action: "reschedule", reason: "outside_window", at } : { action: "skip", reason: "no_window" };
  }
  return { action: "send" };
}

function nextWeekWindow(now: Date, tz: string, windows: { start: number; end: number }[]) {
  const start = localNextWeekStart(now, tz);
  return nextDeliveryTime({ now: start, tz, windows }) ?? start;
}

// ---------------------------------------------------------------------------
// Job runner
// ---------------------------------------------------------------------------

async function finishJob(
  rpc: SmsRpc,
  jobId: string,
  status: "pending" | "sent" | "skipped" | "failed",
  outcome: string,
  extra: { error?: string; notBefore?: Date; messageId?: string } = {},
) {
  await rpc("sms_finish_job", {
    p_job_id: jobId,
    p_status: status,
    p_outcome: outcome,
    p_error: extra.error ?? null,
    p_not_before: extra.notBefore?.toISOString() ?? null,
    p_message_id: extra.messageId ?? null,
  });
}

function journeyFacts(material: Material, job: Job, now: Date, tz: string) {
  const island = material.journey_island;
  if (job.kind !== "journey_opener" || !island?.completed_at) return { facts: [] as string[], journeyName: null };
  const name = island.name || island.zh || "a Journey lesson";
  const when = localDateKey(new Date(island.completed_at), tz) === localDateKey(now, tz) ? "today" : "recently";
  return { facts: [`The learner completed the Journey lesson "${name}" ${when}.`], journeyName: name };
}

export async function processOpenerJob(deps: HuahuaDeps, job: Job): Promise<string> {
  const now = clock(deps);
  const ctx = await loadHuahuaContext(deps, job.user_id, now);
  const tz = ctx.timezone;
  const stats = await deps.rpc<OpenerStats>("sms_get_opener_stats", {
    p_user_id: job.user_id,
    p_week_start: localWeekStart(now, tz).toISOString(),
    p_day_start: localDayStart(now, tz).toISOString(),
  });

  if (ctx.contact && ctx.plan.proactiveOpeners) {
    const used = await deps.rpc<{ used_segments: number } | null>("sms_get_usage", {
      p_user_id: job.user_id,
      p_period_start: ctx.period.start.toISOString(),
    });
    if ((used?.used_segments ?? 0) >= ctx.plan.allowanceSegments) {
      await finishJob(deps.rpc, job.id, "skipped", "allowance_exhausted");
      return "allowance_exhausted";
    }
  }

  const gate = evaluateGates({ ctx, job, stats, now });
  if (gate.action === "skip") {
    await finishJob(deps.rpc, job.id, "skipped", gate.reason);
    return gate.reason;
  }
  if (gate.action === "reschedule") {
    await finishJob(deps.rpc, job.id, "pending", gate.reason, { notBefore: gate.at });
    return `rescheduled_${gate.reason}`;
  }
  const contact = ctx.contact!;

  // Non-response rules. Closing the previous opener tells us if it went unanswered.
  const settled = await deps.rpc<{
    closed_origin: string | null;
    ignored: boolean;
    unanswered_openers: number;
    control_sent_at: string | null;
  }>("sms_settle_open_thread", { p_contact_id: contact.id, p_now: now.toISOString() });

  if (settled.control_sent_at && settled.closed_origin === "control" && settled.ignored) {
    await deps.rpc("sms_auto_pause", { p_contact_id: contact.id });
    await finishJob(deps.rpc, job.id, "skipped", "auto_paused");
    return "auto_paused";
  }

  if (settled.unanswered_openers >= CONTROL_AFTER_UNANSWERED && !settled.control_sent_at) {
    const sent = await sendTrackedSms(deps, {
      contactId: contact.id,
      idempotencyKey: `control:${job.id}`,
      kind: "control",
      requireActive: true,
      body: CONTROL_MESSAGE,
    });
    if (sent.status === "sent") {
      const thread = await deps.rpc<{ id: string } | null>("sms_open_thread", {
        p_contact_id: contact.id,
        p_origin: "control",
        p_job_id: job.id,
        p_journey_island_id: null,
        p_target_vocab: [],
        p_session: {},
        p_now: now.toISOString(),
      });
      if (thread?.id) {
        await deps.rpc("sms_record_thread_outbound", {
          p_thread_id: thread.id,
          p_message_id: sent.messageId,
          p_metadata: { kind: "control" },
          p_patch: {},
          p_now: now.toISOString(),
        });
      }
      await finishJob(deps.rpc, job.id, "sent", "control_sent", { messageId: sent.messageId });
      return "control_sent";
    }
    await finishJob(deps.rpc, job.id, sent.status === "failed" ? "failed" : "skipped", `control_${sent.status}`);
    return `control_${sent.status}`;
  }

  // Once per unanswered streak (replying resets the count).
  if (settled.ignored && settled.unanswered_openers === REDUCE_AFTER_UNANSWERED && ctx.preferences.auto_adjust) {
    const reduced = reducedFrequency(effectiveOpenersPerWeek(ctx.preferences));
    await deps.rpc("sms_reduce_frequency", {
      p_user_id: job.user_id,
      p_openers_per_week: reduced,
      p_now: now.toISOString(),
    });
    if (stats.week_count >= reduced) {
      await finishJob(deps.rpc, job.id, "skipped", "frequency_reduced");
      return "frequency_reduced";
    }
  }

  const material = await deps.rpc<Material>("sms_get_opener_material", {
    p_user_id: job.user_id,
    p_journey_island_id: job.journey_island_id,
    p_limit: 12,
  });
  const vocab = pickOpenerVocab(material, seededRandom(job.id));
  const { facts, journeyName } = journeyFacts(material, job, now, tz);
  const support = supportFor(ctx.level, ctx.preferences.scaffolding);
  const maxSegments = segmentLimitForCountry(ctx.countryCode);

  const input: HuahuaTurnInput = {
    mode: "opener",
    learnerName: contact.display_name || "Learner",
    level: ctx.level,
    persona: ctx.plan.personas.includes(ctx.preferences.persona) ? ctx.preferences.persona : "friendly_friend",
    correctionMode: ctx.preferences.correction_mode,
    support: { pinyin: support.includePinyin, translation: support.includeTranslation },
    language: "balanced",
    history: [],
    targetVocab: vocab,
    facts,
    exchangeCount: 0,
    maxChars: maxSegments * 60,
  };

  const captured: { metadata: Record<string, unknown> | null; vocab: Vocab[] } = { metadata: null, vocab };
  const sent = await sendTrackedSms(deps, {
    contactId: contact.id,
    idempotencyKey: `opener:${job.id}`,
    kind: "opener",
    requireActive: true,
    meter: meterFor(ctx),
    body: async () => {
      const fallback = fallbackOpener({ level: ctx.level, vocab, journeyName });
      const result = await produceTurn(deps.generateTurn, input, {
        fallback,
        timeoutMs: deps.turnTimeoutMs,
        allowFallback: async () => true,
      });
      const turn = result.turn.safety === "safe" ? result.turn : fallback;
      const composed = composeSms({
        message: turn.message,
        pinyin: turn.pinyin,
        translation: turn.translation,
        includePinyin: support.includePinyin,
        includeTranslation: support.includeTranslation,
        maxSegments,
        beginner: ctx.level <= 2,
      });
      captured.vocab = turn.targetVocab.length > 0 ? turn.targetVocab : vocab;
      captured.metadata = {
        pinyin: turn.pinyin ?? pinyinFor(turn.message),
        translation: turn.translation,
        target_vocab: captured.vocab,
        source: result.source,
      };
      return composed.body;
    },
  });

  if (sent.status === "sent") {
    const thread = await deps.rpc<{ id: string } | null>("sms_open_thread", {
      p_contact_id: contact.id,
      p_origin: "opener",
      p_job_id: job.id,
      p_journey_island_id: material.journey_island?.id ?? null,
      p_target_vocab: captured.vocab,
      p_session: {},
      p_now: now.toISOString(),
    });
    if (thread?.id) {
      await deps.rpc("sms_record_thread_outbound", {
        p_thread_id: thread.id,
        p_message_id: sent.messageId,
        p_metadata: captured.metadata,
        p_patch: {},
        p_now: now.toISOString(),
      });
    }
    await finishJob(deps.rpc, job.id, "sent", "opener_sent", { messageId: sent.messageId });
    return "opener_sent";
  }
  if (sent.status === "blocked") {
    await finishJob(deps.rpc, job.id, "skipped", "allowance_exhausted");
    return "allowance_exhausted";
  }
  if (sent.status === "skipped") {
    await finishJob(deps.rpc, job.id, "skipped", `opener_${sent.reason}`);
    return `opener_${sent.reason}`;
  }
  throw new Error(`opener send failed: ${sent.error}`);
}

export async function runDueJobs(deps: HuahuaDeps, options: { limit?: number } = {}) {
  const now = clock(deps);
  const jobs = await deps.rpc<Job[]>("sms_claim_jobs", {
    p_now: now.toISOString(),
    p_limit: options.limit ?? 25,
    p_lease_seconds: JOB_LEASE_SECONDS,
  });
  const outcomes: Record<string, number> = {};
  for (const job of jobs ?? []) {
    let outcome: string;
    try {
      outcome = await processOpenerJob(deps, job);
    } catch (error) {
      logSmsError("opener job failed", error, { jobId: job.id });
      const giveUp = job.attempts >= JOB_MAX_ATTEMPTS;
      await finishJob(deps.rpc, job.id, giveUp ? "failed" : "pending", "error", {
        error: describeSmsError(error),
        notBefore: new Date(now.getTime() + Math.min(60_000 * 2 ** job.attempts, 3600_000)),
      });
      outcome = giveUp ? "failed" : "retry_scheduled";
    }
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
  }
  return { processed: jobs?.length ?? 0, outcomes };
}

// ---------------------------------------------------------------------------
// Planner for scheduled (non-Journey) openers
// ---------------------------------------------------------------------------

export async function planScheduledOpeners(deps: HuahuaDeps, options: { batchSize?: number; maxUsers?: number } = {}) {
  const now = clock(deps);
  const batchSize = options.batchSize ?? 200;
  const maxUsers = options.maxUsers ?? 5000;
  let after: string | null = null;
  let scanned = 0;
  let queued = 0;

  while (scanned < maxUsers) {
    const users: string[] = await deps.rpc<string[]>("sms_list_active_contacts", { p_after: after, p_limit: batchSize });
    if (!users || users.length === 0) break;
    for (const userId of users) {
      scanned += 1;
      try {
        if (await planForUser(deps, userId, now)) queued += 1;
      } catch (error) {
        logSmsError("opener planning failed", error);
      }
    }
    after = users[users.length - 1];
    if (users.length < batchSize) break;
  }
  return { scanned, queued };
}

async function planForUser(deps: HuahuaDeps, userId: string, now: Date) {
  const ctx = await loadHuahuaContext(deps, userId, now);
  if (!ctx.contact || ctx.contact.status !== "active" || !ctx.plan.proactiveOpeners) return false;
  const tz = ctx.timezone;
  const today = localParts(now, tz);
  if (!plannedOpenerDays(ctx.preferences).includes(today.weekday)) return false;

  const stats = await deps.rpc<OpenerStats>("sms_get_opener_stats", {
    p_user_id: userId,
    p_week_start: localWeekStart(now, tz).toISOString(),
    p_day_start: localDayStart(now, tz).toISOString(),
  });
  if (stats.open_jobs > 0 || stats.day_count > 0) return false;
  if (stats.week_count >= effectiveOpenersPerWeek(ctx.preferences)) return false;

  const at = nextDeliveryTime({ now, tz, windows: ctx.preferences.delivery_windows, allowedDays: [today.weekday] });
  if (!at || localDateKey(at, tz) !== localDateKey(now, tz)) return false;

  const result = await deps.rpc<{ created: boolean }>("sms_enqueue_job", {
    p_user_id: userId,
    p_kind: "scheduled_opener",
    p_idempotency_key: `scheduled:${userId}:${localDateKey(now, tz)}`,
    p_not_before: at.toISOString(),
    p_journey_island_id: null,
  });
  return Boolean(result?.created);
}
