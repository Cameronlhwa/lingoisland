import type { PronunciationPiece } from "./pronunciationResults";
import type { TemplatePlan } from "./templates";
import type { PersonalizedLesson } from "./personalization";
import type { LessonBand } from "../vocabRecognition";

export type LessonRoute = "travel" | "work" | "social";

export type LessonPhrase = {
  id: string;
  hanzi: string;
  pinyin: string;
  meaning: string;
  /** Vocab bank ids that appear in this phrase (for recognition-aware targeting). */
  vocabIds?: readonly string[];
};

export type MatchPair = {
  id: string;
  hanzi: string;
  pinyin: string;
  label: string;
  /** Emoji or short visual cue for the match target. */
  visual: string;
};

export type BuildPrompt = {
  prompt: string;
  slotId?: string;
  options?: MatchPair[];
  chunks: Array<{ id: string; label: string; pinyin?: string; meaning?: string }>;
  /** Correct chunk ids in order. */
  order: string[];
  result: LessonPhrase;
};

export type ChatTurn = {
  huahua: LessonPhrase;
  choices: LessonPhrase[];
  /** If set, only this choice id is correct; otherwise any choice is valid. */
  expectedChoiceId?: string;
  responses: Record<string, LessonPhrase>;
  /** Visual resolution key, e.g. coffee / tea / handshake. */
  outcomeVisual: Record<string, string>;
};

export type AuthoredLesson = {
  id: string;
  route: LessonRoute;
  band: LessonBand;
  /** Alternate lesson id when learner taps "I already know this". */
  alternativeId?: string;
  outcome: string;
  situation: string;
  huahuaPose: "speaking" | "listening" | "coaching" | "celebrating";
  targets: LessonPhrase[];
  skill: string;
  match: MatchPair[];
  build: BuildPrompt;
  sentenceWords: LessonPhrase[];
  questionWords: LessonPhrase[];
  starter: LessonPhrase;
  suffix?: LessonPhrase;
  transferBuild: BuildPrompt;
  mission: string;
  coach?: { hanzi: string; pinyin: string; tip: string };
  speakTargetId: string;
  chat: ChatTurn;
  completionLine: string;
  template?: { id: string; tier: number; scene: string; teaching: LessonPhrase[]; incomingTeaching: LessonPhrase[]; construction: string; shortRoute: boolean; quizPairs: MatchPair[] };
};

export type LessonXpKey = "meaning" | "build" | "speaking" | "exchange";

export const LESSON_XP: Record<LessonXpKey, number> = {
  meaning: 10,
  build: 10,
  speaking: 10,
  exchange: 20,
};

export const LESSON_XP_TOTAL = 50;

export type LessonPhase =
  | "intro"
  | "beginner_match" | "beginner_recall"
  | "teach_first" | "recognize" | "teach_second" | "listen" | "frame" | "supported" | "transfer" | "prepare" | "revisit"
  | "baseline"
  | "meaning"
  | "build"
  | "coach"
  | "chat"
  | "complete";

export type SpeakingAttempt = {
  at: string;
  /** Object URL or empty when listening-only. */
  playbackUrl: string | null;
  feedback: "great" | "close" | "retry" | "unavailable" | "skipped" | null;
  weakSyllable: string | null;
  characters?: PronunciationPiece[];
  overall?: number | null;
  tone?: number | null;
};

export type FirstLessonProgress = {
  templatePlan?: TemplatePlan | null;
  teachingIndex?: number;
  selectionKey?: string;
  generated?: PersonalizedLesson | null;
  version?: number;
  mistakes?: string[];
  lessonId: string | null;
  usedAlternative: boolean;
  phase: LessonPhase;
  xpAwarded: LessonXpKey[];
  selectedDrinkId: string | null;
  speakingPath: "spoken" | "listening" | "skipped" | null;
  baseline: SpeakingAttempt | null;
  latest: SpeakingAttempt | null;
  coachRetries: number;
  completedAt: string | null;
};

export const EMPTY_FIRST_LESSON: FirstLessonProgress = {
  version: 2,
  mistakes: [],
  lessonId: null,
  usedAlternative: false,
  phase: "intro",
  xpAwarded: [],
  selectedDrinkId: null,
  speakingPath: null,
  baseline: null,
  latest: null,
  coachRetries: 0,
  completedAt: null,
};
