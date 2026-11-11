// Onboarding state: answers, step order, resume rules, and per-step
// timestamps. Pure and shared by the browser (local persistence before an
// account exists) and the server (validation before saving).

import {
  ASSESSMENT_LENGTH,
  scoreAssessment,
  type AssessmentAnswer,
  type AssessmentItem,
  type AssessmentRole,
  type Placement,
} from "./assessment";
import {
  CUSTOM_TEXT_MAX,
  getGoal,
  getInterest,
  isGoalKey,
  isInterestKey,
  normalizeCustomText,
  topicFamilyFor,
  type GoalKey,
} from "./goals";
import {
  defaultHuahuaPrefs,
  isWritingSystem,
  parseHuahuaPrefs,
  type OnboardingHuahuaPrefs,
  type WritingSystem,
} from "./huahua";
import { clampLevel, isSelfReportKey, levelForSelfReport, type InternalLevel, type SelfReportKey } from "./levels";
import {
  buildPlan,
  isDaysKey,
  isMinutesKey,
  isSessionPreference,
  needsSessionPreference,
  type DaysKey,
  type LearningPlan,
  type MinutesKey,
  type SessionPreference,
} from "./plan";
import { getQuestion } from "./questionBank";
import {
  CUSTOM_PAIN_KEY,
  CUSTOM_PAIN_MAX,
  NO_PAIN_KEY,
  cleanPicks,
  isExperienceKey,
  isHesitationKey,
  isLearningPainKey,
  isTimingKey,
  isUsingPainKey,
  timingHasEvent,
  type ExperienceKey,
  type HesitationKey,
  type LearningPainKey,
  type TimingKey,
  type UsingPainKey,
} from "./painPoints";
import { parseInsight, type InsightAnswer } from "./insightTypes";
import type { PronunciationStatus, ToneSupport } from "./pronunciation";

export const FLOW_VERSION = 1;
export const LOCAL_STORAGE_KEY = "lingo_onboarding_v2";

export const STEP_ORDER = [
  "goal",
  "interests",
  "level",
  "experience",
  "using_pain",
  "learning_pain",
  "reviews",
  "calibration",
  "pronunciation",
  "availability",
  "building",
  "reflect",
  "huahua",
  "messaging",
  "huahua_prefs",
  "preview",
  "commitment",
  "paywall",
] as const;

export type StepId = (typeof STEP_ORDER)[number];

export function isStepId(value: unknown): value is StepId {
  return typeof value === "string" && (STEP_ORDER as readonly string[]).includes(value);
}

export type StepEvent = { started_at?: string; completed_at?: string; skipped_at?: string; abandoned_at?: string };
export type StepEvents = Partial<Record<StepId, StepEvent>>;

/** "simulated" exists only in local development, where nothing is sent. */
export type MessagingStatus = "not_started" | "skipped" | "unavailable" | "verified" | "simulated";
export type PreviewStatus = "not_started" | "skipped" | "sent" | "completed" | "declined" | "simulated" | "unavailable";

export type OnboardingAnswers = {
  version: number;
  goal: { primary: GoalKey | null; secondary: GoalKey | null; otherText: string | null };
  interests: { keys: string[]; custom: string | null };
  level: { selfReport: SelfReportKey | null };
  experience: { key: ExperienceKey | null };
  usingPain: {
    keys: UsingPainKey[];
    timing: TimingKey | null;
    upcomingText: string | null;
    /** Their own words when they pick "Something else". */
    customText?: string | null;
  };
  learningPain: { keys: LearningPainKey[]; hesitations: HesitationKey[] };
  /** "Did we get this right?" playback, written during the building screen. */
  insight: InsightAnswer | null;
  calibration: {
    attemptId: string | null;
    claimedLevel: InternalLevel | null;
    items: AssessmentItem[];
    answers: AssessmentAnswer[];
    placement: Placement | null;
    writingSystem: WritingSystem;
  };
  pronunciation: { status: PronunciationStatus; toneSupport: ToneSupport | null };
  availability: { minutes: MinutesKey | null; days: DaysKey | null; session: SessionPreference | null };
  messaging: { channel: "sms" | "whatsapp" | "none" | null; status: MessagingStatus };
  huahua: OnboardingHuahuaPrefs | null;
  preview: { status: PreviewStatus };
  commitment: { name: string | null; committedAt: string | null };
};

export type OnboardingState = {
  answers: OnboardingAnswers;
  events: StepEvents;
  /** Server revision for optimistic concurrency; null before the first save. */
  revision: number | null;
  updatedAt: string;
};

export function emptyAnswers(): OnboardingAnswers {
  return {
    version: FLOW_VERSION,
    goal: { primary: null, secondary: null, otherText: null },
    interests: { keys: [], custom: null },
    level: { selfReport: null },
    experience: { key: null },
    usingPain: { keys: [], timing: null, upcomingText: null, customText: null },
    learningPain: { keys: [], hesitations: [] },
    insight: null,
    calibration: { attemptId: null, claimedLevel: null, items: [], answers: [], placement: null, writingSystem: "simplified" },
    pronunciation: { status: "not_started", toneSupport: null },
    availability: { minutes: null, days: null, session: null },
    messaging: { channel: null, status: "not_started" },
    huahua: null,
    preview: { status: "not_started" },
    commitment: { name: null, committedAt: null },
  };
}

export function initialState(now: Date): OnboardingState {
  return { answers: emptyAnswers(), events: {}, revision: null, updatedAt: now.toISOString() };
}

export function claimedLevel(answers: OnboardingAnswers): InternalLevel {
  return levelForSelfReport(answers.level.selfReport) ?? 0;
}

/** Calibrated level when available, otherwise the self-report. Never locked. */
export function provisionalLevel(answers: OnboardingAnswers): InternalLevel {
  return answers.calibration.placement?.provisionalLevel ?? claimedLevel(answers);
}

export function topicFamily(answers: OnboardingAnswers) {
  return topicFamilyFor(answers.goal.primary, answers.interests.keys);
}

export function hasMessaging(answers: OnboardingAnswers) {
  return (
    (answers.messaging.channel === "sms" || answers.messaging.channel === "whatsapp") &&
    (answers.messaging.status === "verified" || answers.messaging.status === "simulated")
  );
}

export function isSimulatedMessaging(answers: OnboardingAnswers) {
  return answers.messaging.status === "simulated";
}

/** "I am completely new": no experience question and no placement quiz. */
export function isCompletelyNew(answers: OnboardingAnswers): boolean {
  return answers.level.selfReport === "new";
}

/**
 * Beginner framing (hesitation instead of learning pain, "say your first
 * word"): completely new, or says they haven't really started.
 */
export function isBeginnerPath(answers: OnboardingAnswers): boolean {
  return isCompletelyNew(answers) || answers.experience.key === "not_started";
}

/** Steps that apply to this learner, in order. */
export function stepsFor(answers: OnboardingAnswers): StepId[] {
  const skipped: StepId[] = isCompletelyNew(answers) ? ["experience", "calibration"] : [];
  return STEP_ORDER.filter((step) => {
    if (skipped.includes(step)) return false;
    if (step === "huahua_prefs" || step === "preview") return hasMessaging(answers);
    return true;
  });
}

export function isStepComplete(step: StepId, state: OnboardingState): boolean {
  const { answers, events } = state;
  switch (step) {
    case "goal":
      return answers.goal.primary !== null;
    case "interests":
      return answers.interests.keys.length > 0 || Boolean(answers.interests.custom);
    case "level":
      return answers.level.selfReport !== null;
    case "experience":
      return answers.experience.key !== null;
    case "using_pain":
      return (
        answers.usingPain.keys.length > 0 &&
        answers.usingPain.timing !== null &&
        (!answers.usingPain.keys.includes(CUSTOM_PAIN_KEY) || Boolean(answers.usingPain.customText))
      );
    case "learning_pain":
      return isBeginnerPath(answers) ? answers.learningPain.hesitations.length > 0 : answers.learningPain.keys.length > 0;
    case "calibration":
      return answers.calibration.placement !== null;
    case "pronunciation":
      return answers.pronunciation.status !== "not_started";
    case "availability":
      return Boolean(
        answers.availability.minutes &&
          answers.availability.days &&
          (!needsSessionPreference(answers.availability.minutes) || answers.availability.session),
      );
    case "messaging":
      return answers.messaging.status !== "not_started";
    case "huahua_prefs":
      return answers.huahua !== null && Boolean(events.huahua_prefs?.completed_at);
    case "preview":
      return answers.preview.status !== "not_started" && answers.preview.status !== "sent";
    case "commitment":
      return answers.commitment.committedAt !== null;
    case "paywall":
      return false;
    default:
      return Boolean(events[step]?.completed_at);
  }
}

/** The latest incomplete step: where a returning learner continues. */
export function resumeStep(state: OnboardingState): StepId {
  const steps = stepsFor(state.answers);
  return steps.find((step) => !isStepComplete(step, state)) ?? "paywall";
}

/** A step can be visited when every applicable step before it is complete. */
export function canVisit(step: StepId, state: OnboardingState) {
  const steps = stepsFor(state.answers);
  const index = steps.indexOf(step);
  if (index < 0) return false;
  return steps.slice(0, index).every((prior) => isStepComplete(prior, state));
}

export function previousStep(step: StepId, answers: OnboardingAnswers): StepId | null {
  const steps: StepId[] = stepsFor(answers).filter((candidate) => candidate !== "building");
  const index = steps.indexOf(step);
  return index > 0 ? steps[index - 1] : null;
}

export function nextStep(step: StepId, answers: OnboardingAnswers): StepId | null {
  const steps = stepsFor(answers);
  const index = steps.indexOf(step);
  return index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;
}

/** Progress for the indicator: index among the visible steps (building is folded into availability). */
export function progressFor(step: StepId, answers: OnboardingAnswers) {
  const steps: StepId[] = stepsFor(answers).filter((candidate) => candidate !== "building" && candidate !== "paywall");
  const current: StepId = step === "building" ? "availability" : step;
  const index = Math.max(0, steps.indexOf(current));
  return { index: index + 1, total: steps.length };
}

function stamp(state: OnboardingState, step: StepId, field: keyof StepEvent, now: Date, overwrite = false): OnboardingState {
  const existing = state.events[step] ?? {};
  if (existing[field] && !overwrite) return state;
  return {
    ...state,
    events: { ...state.events, [step]: { ...existing, [field]: now.toISOString() } },
    updatedAt: now.toISOString(),
  };
}

export function markStarted(state: OnboardingState, step: StepId, now: Date) {
  return stamp(state, step, "started_at", now);
}
export function markCompleted(state: OnboardingState, step: StepId, now: Date) {
  return stamp(state, step, "completed_at", now, true);
}
export function markSkipped(state: OnboardingState, step: StepId, now: Date) {
  return stamp(stamp(state, step, "skipped_at", now, true), step, "completed_at", now, true);
}
export function markAbandoned(state: OnboardingState, step: StepId, now: Date) {
  return stamp(state, step, "abandoned_at", now, true);
}

export function lastCompletedStep(state: OnboardingState): StepId | null {
  const done = stepsFor(state.answers).filter((step) => isStepComplete(step, state));
  return done.length > 0 ? done[done.length - 1] : null;
}

/** Applies an answer patch. Changing the self-reported level restarts calibration. */
export function updateAnswers(state: OnboardingState, patch: Partial<OnboardingAnswers>, now: Date): OnboardingState {
  const answers: OnboardingAnswers = { ...state.answers, ...patch };
  if (patch.level && patch.level.selfReport !== state.answers.level.selfReport) {
    answers.calibration = { ...emptyAnswers().calibration, writingSystem: state.answers.calibration.writingSystem };
    if (patch.level.selfReport === "new") answers.experience = { key: null };
  }
  let events = state.events;
  // Upstream changes mean the plan must be rebuilt and shown again.
  const affectsPlan = [
    "goal",
    "interests",
    "level",
    "experience",
    "usingPain",
    "learningPain",
    "calibration",
    "pronunciation",
    "availability",
  ].some((key) => key in patch);
  if (affectsPlan) {
    events = { ...events };
    delete events.building;
    delete events.reflect;
  }
  return { ...state, answers, events, updatedAt: now.toISOString() };
}

export function planFor(answers: OnboardingAnswers): LearningPlan {
  return buildPlan({
    goal: answers.goal.primary,
    secondaryGoal: answers.goal.secondary,
    goalOtherText: answers.goal.otherText,
    interestKeys: answers.interests.keys,
    customInterest: answers.interests.custom,
    provisionalLevel: provisionalLevel(answers),
    minutes: answers.availability.minutes,
    days: answers.availability.days,
    sessionPreference: answers.availability.session,
    toneSupport: answers.pronunciation.toneSupport ?? "standard",
  });
}

export function huahuaPrefsFor(answers: OnboardingAnswers, timezone: string): OnboardingHuahuaPrefs {
  const defaults = defaultHuahuaPrefs(provisionalLevel(answers), timezone);
  const base = answers.huahua ?? { ...defaults, writingSystem: answers.calibration.writingSystem };
  return base;
}

// ---------------------------------------------------------------------------
// Validation of untrusted saved state (localStorage or a request body)
// ---------------------------------------------------------------------------

const ROLES: AssessmentRole[] = ["warmup", "representative", "interest", "diagnostic", "confidence"];

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function parseItems(value: unknown): AssessmentItem[] {
  if (!Array.isArray(value)) return [];
  const items: AssessmentItem[] = [];
  value.slice(0, ASSESSMENT_LENGTH).forEach((raw, index) => {
    const item = obj(raw);
    const question = typeof item.questionId === "string" ? getQuestion(item.questionId) : null;
    const role = ROLES.includes(item.role as AssessmentRole) ? (item.role as AssessmentRole) : null;
    if (!question || !role || item.position !== index + 1) return;
    const ids = question.choices.map((choice) => choice.id);
    const order = Array.isArray(item.choiceOrder) ? item.choiceOrder.filter((id): id is string => typeof id === "string" && ids.includes(id)) : [];
    items.push({
      position: index + 1,
      role,
      targetLevel: clampLevel(Number(item.targetLevel) || 0),
      questionId: question.id,
      choiceOrder: order.length === ids.length && new Set(order).size === ids.length ? order : ids,
    });
  });
  return items.length === ASSESSMENT_LENGTH ? items : [];
}

function parseResponses(value: unknown, items: AssessmentItem[]): AssessmentAnswer[] {
  if (!Array.isArray(value) || items.length === 0) return [];
  const answers: AssessmentAnswer[] = [];
  value.slice(0, ASSESSMENT_LENGTH).forEach((raw) => {
    const answer = obj(raw);
    const item = items.find((candidate) => candidate.position === answer.position && candidate.questionId === answer.questionId);
    if (!item || typeof answer.choiceId !== "string" || !item.choiceOrder.includes(answer.choiceId)) return;
    if (answers.some((existing) => existing.position === item.position)) return;
    answers.push({ position: item.position, questionId: item.questionId, choiceId: answer.choiceId });
  });
  return answers.sort((a, b) => a.position - b.position);
}

const PRONUNCIATION_STATUSES: PronunciationStatus[] = ["not_started", "skipped", "denied", "failed", "completed"];
const MESSAGING_STATUSES: MessagingStatus[] = ["not_started", "skipped", "unavailable", "verified", "simulated"];
const PREVIEW_STATUSES: PreviewStatus[] = ["not_started", "skipped", "sent", "completed", "declined", "simulated", "unavailable"];

/**
 * Rebuilds answers from untrusted input. Unknown keys are dropped, free text
 * is normalized, and the placement is always re-scored from the answers so a
 * client cannot choose its own level.
 */
export function parseAnswers(input: unknown, timezone = "UTC"): OnboardingAnswers {
  const raw = obj(input);
  const base = emptyAnswers();

  const goal = obj(raw.goal);
  const primary = isGoalKey(goal.primary) ? goal.primary : null;
  const secondary = isGoalKey(goal.secondary) && goal.secondary !== primary ? goal.secondary : null;
  base.goal = {
    primary,
    secondary: primary ? secondary : null,
    otherText: primary === "other" || secondary === "other" ? normalizeCustomText(goal.otherText, CUSTOM_TEXT_MAX) : null,
  };

  const interests = obj(raw.interests);
  const keys = Array.isArray(interests.keys) ? interests.keys.filter(isInterestKey) : [];
  base.interests = {
    keys: keys.filter((key, index) => keys.indexOf(key) === index).slice(0, 12),
    custom: normalizeCustomText(interests.custom, CUSTOM_TEXT_MAX),
  };

  const level = obj(raw.level);
  base.level = { selfReport: isSelfReportKey(level.selfReport) ? level.selfReport : null };

  const experience = obj(raw.experience);
  base.experience = { key: base.level.selfReport !== "new" && isExperienceKey(experience.key) ? experience.key : null };

  const usingPain = obj(raw.usingPain);
  const timing = isTimingKey(usingPain.timing) ? usingPain.timing : null;
  const painKeys = cleanPicks(usingPain.keys, isUsingPainKey, undefined, NO_PAIN_KEY);
  base.usingPain = {
    keys: painKeys,
    customText: painKeys.includes(CUSTOM_PAIN_KEY) ? normalizeCustomText(usingPain.customText, CUSTOM_PAIN_MAX) : null,
    timing,
    upcomingText: timingHasEvent(timing) ? normalizeCustomText(usingPain.upcomingText, CUSTOM_TEXT_MAX) : null,
  };

  const learningPain = obj(raw.learningPain);
  base.learningPain = {
    keys: cleanPicks(learningPain.keys, isLearningPainKey),
    hesitations: cleanPicks(learningPain.hesitations, isHesitationKey),
  };
  base.insight = parseInsight(raw.insight);

  const calibration = obj(raw.calibration);
  const claimed = levelForSelfReport(base.level.selfReport);
  const items = claimed === null ? [] : parseItems(calibration.items);
  const answers = parseResponses(calibration.answers, items);
  base.calibration = {
    attemptId: typeof calibration.attemptId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(calibration.attemptId) ? calibration.attemptId : null,
    claimedLevel: claimed,
    items,
    answers,
    placement:
      claimed !== null && items.length === ASSESSMENT_LENGTH && answers.length === ASSESSMENT_LENGTH
        ? scoreAssessment({ claimedLevel: claimed, items, answers })
        : null,
    writingSystem: isWritingSystem(calibration.writingSystem) ? calibration.writingSystem : "simplified",
  };

  const pronunciation = obj(raw.pronunciation);
  base.pronunciation = {
    status: PRONUNCIATION_STATUSES.includes(pronunciation.status as PronunciationStatus)
      ? (pronunciation.status as PronunciationStatus)
      : "not_started",
    toneSupport: pronunciation.toneSupport === "extra" || pronunciation.toneSupport === "standard" ? pronunciation.toneSupport : null,
  };

  const availability = obj(raw.availability);
  base.availability = {
    minutes: isMinutesKey(availability.minutes) ? availability.minutes : null,
    days: isDaysKey(availability.days) ? availability.days : null,
    session: isSessionPreference(availability.session) ? availability.session : null,
  };

  const messaging = obj(raw.messaging);
  const channel = messaging.channel === "sms" || messaging.channel === "whatsapp" || messaging.channel === "none" ? messaging.channel : null;
  base.messaging = {
    channel,
    status: MESSAGING_STATUSES.includes(messaging.status as MessagingStatus) ? (messaging.status as MessagingStatus) : "not_started",
  };

  base.huahua = raw.huahua ? parseHuahuaPrefs(raw.huahua, defaultHuahuaPrefs(provisionalLevel(base), timezone)) : null;

  const preview = obj(raw.preview);
  base.preview = {
    status: PREVIEW_STATUSES.includes(preview.status as PreviewStatus) ? (preview.status as PreviewStatus) : "not_started",
  };

  const commitment = obj(raw.commitment);
  base.commitment = {
    name: normalizeCustomText(commitment.name, 40),
    committedAt: isoOrNull(commitment.committedAt),
  };
  return base;
}

export function parseEvents(input: unknown): StepEvents {
  const raw = obj(input);
  const events: StepEvents = {};
  STEP_ORDER.forEach((step) => {
    const event = obj(raw[step]);
    const parsed: StepEvent = {};
    (["started_at", "completed_at", "skipped_at", "abandoned_at"] as const).forEach((field) => {
      const value = isoOrNull(event[field]);
      if (value) parsed[field] = value;
    });
    if (Object.keys(parsed).length > 0) events[step] = parsed;
  });
  return events;
}

export function parseState(input: unknown, timezone = "UTC"): OnboardingState | null {
  const raw = obj(input);
  if (!raw.answers) return null;
  return {
    answers: parseAnswers(raw.answers, timezone),
    events: parseEvents(raw.events),
    revision: typeof raw.revision === "number" && Number.isInteger(raw.revision) && raw.revision >= 0 ? raw.revision : null,
    updatedAt: isoOrNull(raw.updatedAt) ?? new Date(0).toISOString(),
  };
}

/** Prefers whichever copy has more progress; ties go to the newer copy. */
export function mergeStates(local: OnboardingState | null, remote: OnboardingState | null): OnboardingState | null {
  if (!local) return remote;
  if (!remote) return local;
  const score = (state: OnboardingState) => stepsFor(state.answers).filter((step) => isStepComplete(step, state)).length;
  const localScore = score(local);
  const remoteScore = score(remote);
  const winner =
    localScore !== remoteScore ? (localScore > remoteScore ? local : remote) : Date.parse(local.updatedAt) >= Date.parse(remote.updatedAt) ? local : remote;
  return { ...winner, revision: remote.revision };
}

// ---------------------------------------------------------------------------
// Normalized columns for onboarding_progress (computed on the server)
// ---------------------------------------------------------------------------

export function progressColumns(state: OnboardingState, currentStep: StepId) {
  const { answers } = state;
  const level = provisionalLevel(answers);
  const plan = isStepComplete("availability", state) ? planFor(answers) : null;
  const primary = getGoal(answers.goal.primary);
  const secondary = getGoal(answers.goal.secondary);
  return {
    version: FLOW_VERSION,
    status: answers.commitment.committedAt ? "completed" : "in_progress",
    current_step: currentStep,
    last_completed_step: lastCompletedStep(state),
    primary_goal: answers.goal.primary,
    primary_goal_label: primary?.label ?? null,
    secondary_goal: answers.goal.secondary,
    secondary_goal_label: secondary?.label ?? null,
    goal_other_text: answers.goal.otherText,
    custom_interest: answers.interests.custom,
    self_reported_key: answers.level.selfReport,
    self_reported_level: levelForSelfReport(answers.level.selfReport),
    provisional_level: answers.level.selfReport ? level : null,
    placement: answers.calibration.placement,
    assessment_attempt_id: answers.calibration.attemptId,
    pronunciation_status: answers.pronunciation.status,
    pronunciation_recommendation: answers.pronunciation.toneSupport,
    minutes_key: answers.availability.minutes,
    minutes_per_day: plan?.minutesPerDay ?? null,
    days_key: answers.availability.days,
    days_per_week: plan?.daysPerWeek ?? null,
    session_preference: answers.availability.session,
    support_recommendation: plan?.support ?? null,
    milestone_key: plan?.milestone.key ?? null,
    milestone_range: plan?.milestone.range ?? null,
    plan,
    messaging_channel: answers.messaging.channel,
    messaging_status: answers.messaging.status,
    huahua_preferences: answers.huahua,
    preview_status: answers.preview.status,
    committed_at: answers.commitment.committedAt,
    completed_at: answers.commitment.committedAt,
  };
}

export function interestRows(answers: OnboardingAnswers) {
  const rows = answers.interests.keys.map((key) => ({ key, label: getInterest(key)?.label ?? key, is_custom: false }));
  if (answers.interests.custom) rows.push({ key: "custom", label: answers.interests.custom, is_custom: true });
  return rows;
}

/** What is stored as the resumable snapshot: everything except the learner's typed name. */
export function answersForServer(answers: OnboardingAnswers): OnboardingAnswers {
  return { ...answers, commitment: { ...answers.commitment, name: null } };
}
