// Hidden calibration: deterministic question selection and scoring. The
// self-reported level is the prior; five answers nudge it into a provisional
// starting level that Journeys and Huahua keep adjusting later.

import { activeQuestions, getQuestion, type AssessmentTopic, type BankQuestion } from "./questionBank";
import { clampLevel, type InternalLevel } from "./levels";
import type { TopicFamily } from "./goals";

export const ASSESSMENT_LENGTH = 5;

export type AssessmentRole = "warmup" | "representative" | "interest" | "diagnostic" | "confidence";

/** Questions 2 and 4 carry double weight. */
export const ROLE_WEIGHTS: Record<AssessmentRole, number> = {
  warmup: 1,
  representative: 2,
  interest: 1,
  diagnostic: 2,
  confidence: 1,
};

export type AssessmentItem = {
  position: number;
  role: AssessmentRole;
  targetLevel: InternalLevel;
  questionId: string;
  /** Display order of choice ids, shuffled deterministically per attempt. */
  choiceOrder: string[];
};

export type AssessmentAnswer = {
  position: number;
  questionId: string;
  choiceId: string;
};

export type ScoredResponse = AssessmentAnswer & {
  role: AssessmentRole;
  level: InternalLevel;
  correct: boolean;
  weight: number;
};

export type Placement = {
  selfReportedLevel: InternalLevel;
  provisionalLevel: InternalLevel;
  adjustment: number;
  weightedScore: number;
  rule: "raise_one" | "confirm" | "lower_one" | "lower_two" | "no_answers";
  confidence: "low" | "medium" | "high";
  responses: ScoredResponse[];
  source: "onboarding_calibration";
  locked: false;
};

/** FNV-1a; stable across server and browser. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

type Slot = { role: AssessmentRole; level: InternalLevel; topic: AssessmentTopic | null; maxDifficulty?: number };

/** Targets per position relative to the claimed level. */
export function assessmentSlots(claimed: InternalLevel, topic: TopicFamily): Slot[] {
  const L = claimed;
  return [
    { role: "warmup", level: clampLevel(L - 2), topic: null, maxDifficulty: 2 },
    { role: "representative", level: L, topic: null },
    { role: "interest", level: clampLevel(L - 1), topic },
    // Absolute beginners get the gentlest HSK 1 items as their stretch question.
    { role: "diagnostic", level: clampLevel(L + 1), topic: null, maxDifficulty: L === 0 ? 1 : undefined },
    { role: "confidence", level: clampLevel(L - 1), topic: null, maxDifficulty: 2 },
  ];
}

export function selectAssessment(input: {
  claimedLevel: InternalLevel;
  topic: TopicFamily;
  seed: string;
  bank?: readonly BankQuestion[];
}): AssessmentItem[] {
  const bank = (input.bank ?? activeQuestions()).filter((question) => question.active);
  const random = seededRandom(hashSeed(input.seed));
  const used = new Set<string>();
  const usedTypes: string[] = [];

  return assessmentSlots(input.claimedLevel, input.topic).map((slot, index) => {
    const atLevel = bank.filter((question) => question.level === slot.level && !used.has(question.id));
    const withinDifficulty = slot.maxDifficulty
      ? atLevel.filter((question) => question.difficulty <= slot.maxDifficulty!)
      : atLevel;
    const pool = withinDifficulty.length ? withinDifficulty : atLevel;

    let candidates = pool;
    if (slot.topic) {
      const topical = pool.filter((question) => question.topic === slot.topic);
      if (topical.length) candidates = topical;
    }
    // Prefer a question type not used yet for variety.
    const fresh = candidates.filter((question) => !usedTypes.includes(question.type));
    if (fresh.length) candidates = fresh;
    if (!candidates.length) {
      candidates = bank.filter((question) => !used.has(question.id));
    }

    const ordered = shuffle(
      [...candidates].sort((a, b) => a.id.localeCompare(b.id)),
      random,
    );
    const question = ordered[0];
    used.add(question.id);
    usedTypes.push(question.type);

    return {
      position: index + 1,
      role: slot.role,
      targetLevel: slot.level,
      questionId: question.id,
      choiceOrder: shuffle(question.choices.map((choice) => choice.id), random),
    };
  });
}

export function isCorrect(questionId: string, choiceId: string): boolean {
  const question = getQuestion(questionId);
  return Boolean(question && question.answer === choiceId);
}

/**
 * Scores the attempt. Answers are re-checked against the bank so a client
 * cannot submit its own correctness flags.
 */
export function scoreAssessment(input: {
  claimedLevel: InternalLevel;
  items: readonly AssessmentItem[];
  answers: readonly AssessmentAnswer[];
}): Placement {
  const L = input.claimedLevel;
  const responses: ScoredResponse[] = [];

  input.items.forEach((item) => {
    const answer = input.answers.find((entry) => entry.position === item.position && entry.questionId === item.questionId);
    const question = getQuestion(item.questionId);
    if (!answer || !question) return;
    if (!question.choices.some((choice) => choice.id === answer.choiceId)) return;
    responses.push({
      ...answer,
      role: item.role,
      level: question.level,
      correct: question.answer === answer.choiceId,
      weight: ROLE_WEIGHTS[item.role] * question.weight,
    });
  });

  if (!responses.length) {
    return {
      selfReportedLevel: L,
      provisionalLevel: L,
      adjustment: 0,
      weightedScore: 0,
      rule: "no_answers",
      confidence: "low",
      responses,
      source: "onboarding_calibration",
      locked: false,
    };
  }

  const total = responses.reduce((sum, response) => sum + response.weight, 0);
  const earned = responses.reduce((sum, response) => sum + (response.correct ? response.weight : 0), 0);
  const weightedScore = Math.round((earned / total) * 1000) / 1000;
  const allCorrect = responses.every((response) => response.correct);
  const complete = responses.length === ASSESSMENT_LENGTH;
  const diagnosticAboveClaim = responses.some((response) => response.role === "diagnostic" && response.level > L && response.correct);

  let adjustment = 0;
  let rule: Placement["rule"] = "confirm";
  if (allCorrect && complete && diagnosticAboveClaim) {
    adjustment = 1;
    rule = "raise_one";
  } else if (weightedScore >= 0.6) {
    adjustment = 0;
    rule = "confirm";
  } else if (weightedScore >= 0.3) {
    adjustment = -1;
    rule = "lower_one";
  } else {
    adjustment = -2;
    rule = "lower_two";
  }

  const provisionalLevel = clampLevel(L + adjustment);
  const confidence: Placement["confidence"] = !complete ? "low" : weightedScore >= 0.85 || weightedScore <= 0.15 ? "high" : "medium";

  return {
    selfReportedLevel: L,
    provisionalLevel,
    adjustment: provisionalLevel - L,
    weightedScore,
    rule,
    confidence,
    responses,
    source: "onboarding_calibration",
    locked: false,
  };
}

/** Feedback copy after each answer. Never red, never a percentage. */
export function feedbackFor(correct: boolean): string {
  return correct ? "Nice!" : "Got it. We\u2019re adjusting your plan.";
}
