import { onboardingVariant, type OnboardingVariant } from "./experiment";
import { parsePronunciationPieces } from "./firstLesson/pronunciationResults";
import { parseTemplatePlan } from "./firstLesson/templates";
import { parsePersonalizedLesson } from "./firstLesson/personalization";
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
import {
  EMPTY_VOCAB_SCREEN,
  estimateLevelFromVocab,
  parseVocabScreen,
  type VocabScreenAnswer,
} from "./vocabRecognition";
import {
  EMPTY_FIRST_LESSON,
  LESSON_XP,
  type FirstLessonProgress,
  type LessonPhase,
  type LessonXpKey,
  type SpeakingAttempt,
} from "./firstLesson/types";

export const FLOW_VERSION = 2;
export const LOCAL_STORAGE_KEY = "lingo_onboarding_v2";

export const STEP_ORDER = [
  "goal",
  "interests",
  "level",
  "vocab_basic",
  "vocab_advanced",
  "experience",
  "using_pain",
  "learning_pain",
  "reviews",
  // Kept for old saved progress; filtered out of the live Dec 11 path.
  "calibration",
  "pronunciation",
  "availability",
  "building",
  "reflect",
  "first_lesson",
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
  onboardingVariant: OnboardingVariant;
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
  vocabBasic: VocabScreenAnswer;
  vocabAdvanced: VocabScreenAnswer;
  /** Estimated level from self-report + recognition (conservative). */
  estimatedLevel: InternalLevel | null;
  firstLesson: FirstLessonProgress;
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

export function emptyAnswers(variant: OnboardingVariant = "control"): OnboardingAnswers {
  return {
    version: FLOW_VERSION,
    onboardingVariant: variant,
    goal: { primary: null, secondary: null, otherText: null },
    interests: { keys: [], custom: null },
    level: { selfReport: null },
    experience: { key: null },
    usingPain: { keys: [], timing: null, upcomingText: null, customText: null },
    learningPain: { keys: [], hesitations: [] },
    insight: null,
    calibration: { attemptId: null, claimedLevel: null, items: [], answers: [], placement: null, writingSystem: "simplified" },
    pronunciation: { status: "not_started", toneSupport: null },
    vocabBasic: { ...EMPTY_VOCAB_SCREEN },
    vocabAdvanced: { ...EMPTY_VOCAB_SCREEN },
    estimatedLevel: null,
    firstLesson: { ...EMPTY_FIRST_LESSON },
    availability: { minutes: null, days: null, session: null },
    messaging: { channel: null, status: "not_started" },
    huahua: null,
    preview: { status: "not_started" },
    commitment: { name: null, committedAt: null },
  };
}

export function initialState(now: Date, variant: OnboardingVariant = "control"): OnboardingState {
  return { answers: emptyAnswers(variant), events: {}, revision: null, updatedAt: now.toISOString() };
}

export function claimedLevel(answers: OnboardingAnswers): InternalLevel {
  return levelForSelfReport(answers.level.selfReport) ?? 0;
}

/**
 * Best available level estimate: vocab+self-report blend, else old calibration
 * placement, else self-report. Never locked.
 */
export function provisionalLevel(answers: OnboardingAnswers): InternalLevel {
  if (answers.onboardingVariant === "test" && answers.estimatedLevel !== null) return answers.estimatedLevel;
  if (answers.calibration.placement?.provisionalLevel !== undefined) {
    return answers.calibration.placement.provisionalLevel;
  }
  return claimedLevel(answers);
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

/**
 * The test variant replaces the placement quiz and standalone pronunciation.
 * Legacy steps stay parseable, and the control variant retains its original sequence.
 */
const HIDDEN_STEPS: readonly StepId[] = [
  "calibration",
  "pronunciation",
  "huahua",
  "messaging",
  "huahua_prefs",
  "preview",
];

/** Completely new learners skip experience; the test variant keeps its vocab screens. */
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
  if (answers.onboardingVariant !== "test") {
    const hidden: StepId[] = ["vocab_basic", "vocab_advanced", "first_lesson", "huahua", "messaging", "huahua_prefs", "preview"];
    if (isCompletelyNew(answers)) hidden.push("experience", "calibration");
    return STEP_ORDER.filter(step => !hidden.includes(step));
  }
  const skipped: StepId[] = isCompletelyNew(answers) ? ["experience"] : [];
  return STEP_ORDER.filter((step) => !HIDDEN_STEPS.includes(step) && !skipped.includes(step));
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
    case "vocab_basic":
      return (
        answers.vocabBasic.shownIds.length > 0 &&
        (answers.vocabBasic.noneKnown || answers.vocabBasic.selectedIds.length > 0)
      );
    case "vocab_advanced":
      return (
        answers.vocabAdvanced.skipped === true ||
        (answers.vocabAdvanced.shownIds.length > 0 &&
          (answers.vocabAdvanced.noneKnown || answers.vocabAdvanced.selectedIds.length > 0))
      );
    case "experience":
      return answers.experience.key !== null;
    case "first_lesson":
      return answers.firstLesson.completedAt !== null;
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

/**
 * Progress for the overall onboarding indicator.
 * Building folds into availability; the first lesson uses its own in-lesson meter.
 */
export function progressFor(step: StepId, answers: OnboardingAnswers) {
  const steps: StepId[] = stepsFor(answers).filter(
    (candidate) => candidate !== "building" && candidate !== "paywall" && candidate !== "first_lesson",
  );
  const current: StepId =
    step === "building" ? "availability" : step === "first_lesson" ? "reflect" : step;
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

/** Applies an answer patch. Changing level or vocab resets the estimated placement. */
export function updateAnswers(state: OnboardingState, patch: Partial<OnboardingAnswers>, now: Date): OnboardingState {
  const answers: OnboardingAnswers = { ...state.answers, ...patch };
  if (patch.level && patch.level.selfReport !== state.answers.level.selfReport) {
    answers.calibration = { ...emptyAnswers().calibration, writingSystem: state.answers.calibration.writingSystem };
    answers.vocabBasic = { ...EMPTY_VOCAB_SCREEN };
    answers.vocabAdvanced = { ...EMPTY_VOCAB_SCREEN };
    answers.estimatedLevel = null;
    answers.firstLesson = { ...EMPTY_FIRST_LESSON };
    if (patch.level.selfReport === "new") answers.experience = { key: null };
  }
  if (patch.vocabBasic || patch.vocabAdvanced || (patch.level && patch.level.selfReport !== state.answers.level.selfReport)) {
    const basic = answers.vocabBasic;
    const advanced = answers.vocabAdvanced;
    const basicDone = basic.shownIds.length > 0 && (basic.noneKnown || basic.selectedIds.length > 0);
    const advancedDone =
      advanced.skipped === true ||
      (advanced.shownIds.length > 0 && (advanced.noneKnown || advanced.selectedIds.length > 0));
    if (basicDone && advancedDone && answers.level.selfReport) {
      answers.estimatedLevel = estimateLevelFromVocab({
        selfReport: answers.level.selfReport,
        basic,
        advanced,
      });
    }
  }
  if (patch.interests || patch.goal || patch.vocabBasic || patch.vocabAdvanced) {
    // Lesson choice depends on these signals; clear an unfinished lesson.
    if (!answers.firstLesson.completedAt) answers.firstLesson = { ...EMPTY_FIRST_LESSON };
  }
  let events = state.events;
  // Upstream changes mean the plan must be rebuilt and shown again.
  const affectsPlan = [
    "goal",
    "interests",
    "level",
    "vocabBasic",
    "vocabAdvanced",
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
    delete events.first_lesson;
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
const LESSON_PHASES: LessonPhase[] = ["beginner_match", "beginner_recall", "teach_first", "recognize", "teach_second", "listen", "frame", "supported", "transfer", "prepare", "revisit", "intro", "baseline", "meaning", "build", "coach", "chat", "complete"];
const LESSON_XP_KEYS: LessonXpKey[] = ["meaning", "build", "speaking", "exchange"];

function parseSpeakingAttempt(raw: unknown): SpeakingAttempt | null {
  const value = obj(raw);
  const at = isoOrNull(value.at);
  if (!at) return null;
  const feedback =
    value.feedback === "great" ||
    value.feedback === "close" ||
    value.feedback === "retry" ||
    value.feedback === "unavailable" ||
    value.feedback === "skipped"
      ? value.feedback
      : null;
  return {
    at,
    characters: parsePronunciationPieces(value.characters),
    overall: typeof value.overall === "number" && Number.isFinite(value.overall) ? Math.max(0, Math.min(100, value.overall)) : null,
    tone: typeof value.tone === "number" && Number.isFinite(value.tone) ? Math.max(0, Math.min(100, value.tone)) : null,
    // Recordings stay in-session only; never rehydrate blob URLs from storage.
    playbackUrl: null,
    feedback,
    weakSyllable: typeof value.weakSyllable === "string" ? value.weakSyllable.slice(0, 8) : null,
  };
}

export function parseFirstLesson(raw: unknown): FirstLessonProgress {
  const value = obj(raw);
  const xpAwarded = Array.isArray(value.xpAwarded)
    ? value.xpAwarded.filter((key): key is LessonXpKey => LESSON_XP_KEYS.includes(key as LessonXpKey))
    : [];
  const uniqueXp = LESSON_XP_KEYS.filter((key) => xpAwarded.includes(key));
  return {
    templatePlan: parseTemplatePlan(value.templatePlan),
    teachingIndex: Math.max(0, Math.min(20, Math.trunc(Number(value.teachingIndex) || 0))),
    selectionKey: typeof value.selectionKey === "string" ? value.selectionKey.slice(0, 80) : undefined,
    generated: parsePersonalizedLesson(value.generated),
    version: value.version === 2 ? 2 : 1,
    mistakes: Array.isArray(value.mistakes) ? value.mistakes.filter((id): id is string => typeof id === "string").slice(0, 8) : [],
    lessonId: typeof value.lessonId === "string" ? value.lessonId.slice(0, 80) : null,
    usedAlternative: value.usedAlternative === true,
    phase: LESSON_PHASES.includes(value.phase as LessonPhase) ? (value.phase as LessonPhase) : "intro",
    xpAwarded: uniqueXp,
    selectedDrinkId: typeof value.selectedDrinkId === "string" ? value.selectedDrinkId.slice(0, 40) : null,
    speakingPath:
      value.speakingPath === "spoken" || value.speakingPath === "listening" || value.speakingPath === "skipped"
        ? value.speakingPath
        : null,
    baseline: parseSpeakingAttempt(value.baseline),
    latest: parseSpeakingAttempt(value.latest),
    coachRetries: Math.max(0, Math.min(3, Number(value.coachRetries) || 0)),
    completedAt: isoOrNull(value.completedAt),
  };
}

/** Awards lesson XP once per milestone. */
export function awardLessonXp(progress: FirstLessonProgress, key: LessonXpKey): FirstLessonProgress {
  if (progress.xpAwarded.includes(key)) return progress;
  return { ...progress, xpAwarded: [...progress.xpAwarded, key] };
}

export function lessonXpTotal(progress: FirstLessonProgress) {
  return progress.xpAwarded.reduce((sum, key) => sum + LESSON_XP[key], 0);
}

/**
 * Rebuilds answers from untrusted input. Unknown keys are dropped, free text
 * is normalized, and the placement is always re-scored from the answers so a
 * client cannot choose its own level.
 */
export function parseAnswers(input: unknown, timezone = "UTC"): OnboardingAnswers {
  const raw = obj(input);
  const base = emptyAnswers(onboardingVariant(raw.onboardingVariant));

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

  base.vocabBasic = parseVocabScreen(raw.vocabBasic);
  base.vocabAdvanced = parseVocabScreen(raw.vocabAdvanced);
  base.firstLesson = parseFirstLesson(raw.firstLesson);
  if (raw.estimatedLevel === null || raw.estimatedLevel === undefined) {
    base.estimatedLevel = null;
  } else {
    const estimated = Number(raw.estimatedLevel);
    base.estimatedLevel = Number.isFinite(estimated) ? clampLevel(estimated) : null;
  }
  if (
    base.estimatedLevel === null &&
    base.level.selfReport &&
    base.vocabBasic.shownIds.length > 0 &&
    (base.vocabAdvanced.skipped || base.vocabAdvanced.shownIds.length > 0)
  ) {
    base.estimatedLevel = estimateLevelFromVocab({
      selfReport: base.level.selfReport,
      basic: base.vocabBasic,
      advanced: base.vocabAdvanced,
    });
  }

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
