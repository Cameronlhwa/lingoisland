// Free onboarding preview chat: short exchanges (topic, support style,
// corrections, frequency) that end with a summary pointing back to the web plan.
// These are the only place onboarding asks for those three preferences.
// Pure and browser-safe, so the local simulation and the real channel run
// exactly the same rules.

import {
  correctionModeFor,
  FREQUENCY_QUESTION,
  isCorrectionChoice,
  isFrequencyChoice,
  isSupportStyle,
  scaffoldingFor,
  supportPhrase,
  type CorrectionChoice,
  type FrequencyChoice,
} from "../../onboarding/personalized/huahua";
import { joinList } from "../../onboarding/personalized/goals";
import type { SupportStyle } from "../../onboarding/personalized/plan";
import type { MessageChannel, QuickReply } from "../types";

export const PREVIEW_MAX_LEARNER_MESSAGES = 8;
export const PREVIEW_MAX_MINUTES = 10;

export type PreviewStage = "intro" | "topic" | "support" | "correction" | "frequency" | "done" | "declined";

export const DEFAULT_PREVIEW_CORRECTION: CorrectionChoice = "gentle";

export type PreviewState = {
  stage: PreviewStage;
  learnerMessages: number;
  startedAt: string;
  topic: string | null;
  support: SupportStyle | null;
  correction: CorrectionChoice | null;
  frequency: FrequencyChoice | null;
  /** Times the current question was asked again after an unclear answer. */
  reasks: number;
};

export type PreviewProfile = {
  goalPhrase: string;
  /** Display labels, predefined ones lowercased, custom ones as typed. */
  interests: string[];
  supportDefault: SupportStyle;
};

export type PreviewMessage = { body: string; quickReplies?: QuickReply[] };

export type PreviewStep = {
  state: PreviewState;
  reply: PreviewMessage | null;
  finished: boolean;
  outcome: "declined" | "advanced" | "reasked" | "completed" | "limit_reached" | "ignored";
};

const OPT_OUT_LINE = "Reply HELP for help, STOP to opt out.";

export function interestsPhrase(profile: PreviewProfile) {
  return profile.interests.length > 0 ? joinList(profile.interests.slice(0, 3)) : "the things you enjoy";
}

function buttonTitle(text: string) {
  return text.length <= 20 ? text : `${text.slice(0, 19)}\u2026`;
}

export function previewIntroText(profile: PreviewProfile) {
  return `Hi! I\u2019m Huahua, your Mandarin practice buddy from LingoIsland. I\u2019ll help you practice Mandarin around ${interestsPhrase(profile)} at a level that feels comfortable. Ready to personalize how we chat?`;
}

export function previewIntro(profile: PreviewProfile, channel: MessageChannel): PreviewMessage {
  const intro = previewIntroText(profile);
  if (channel === "whatsapp") {
    return {
      body: `${intro}\n${OPT_OUT_LINE}`,
      quickReplies: [
        { id: "yes", title: "Let\u2019s do it" },
        { id: "not now", title: "Not now" },
      ],
    };
  }
  return { body: `${intro}\nReply 1 for Let\u2019s do it or 2 for Not now.\n${OPT_OUT_LINE}` };
}

export function initialPreviewState(now: Date): PreviewState {
  return { stage: "intro", learnerMessages: 0, startedAt: now.toISOString(), topic: null, support: null, correction: null, frequency: null, reasks: 0 };
}

export function previewTimedOut(state: PreviewState, now: Date) {
  return now.getTime() - new Date(state.startedAt).getTime() > PREVIEW_MAX_MINUTES * 60_000;
}

export function isPreviewOpen(state: PreviewState | null | undefined): state is PreviewState {
  return Boolean(state && state.stage !== "done" && state.stage !== "declined");
}

function normalize(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[.!?。！？,，~～]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topicOptions(profile: PreviewProfile) {
  const options = profile.interests.slice(0, 3);
  return options.length > 0 ? options : ["everyday life"];
}

function topicQuestion(profile: PreviewProfile): PreviewMessage {
  const options = topicOptions(profile);
  const list = options.map((label, index) => `${index + 1} ${label}`).join(", ");
  return {
    body: `Great! 我们开始吧 (Wǒmen kāishǐ ba, let\u2019s start). Which topic should we chat about first? Reply ${list}.`,
    quickReplies: options.map((label, index) => ({ id: String(index + 1), title: buttonTitle(label) })),
  };
}

const SUPPORT_CHOICES: ReadonlyArray<{ key: SupportStyle; title: string }> = [
  { key: "full", title: "Pinyin + English" },
  { key: "on_request", title: "Help when I ask" },
  { key: "mostly_chinese", title: "Mostly Chinese" },
];

function supportQuestion(topic: string): PreviewMessage {
  return {
    body: `${topic.charAt(0).toUpperCase()}${topic.slice(1)}, nice choice! How much help do you want in my messages? Reply 1 Pinyin and English, 2 Help only when I ask, 3 Mostly Chinese.`,
    quickReplies: SUPPORT_CHOICES.map((choice, index) => ({ id: String(index + 1), title: choice.title })),
  };
}

const CORRECTION_REPLIES: ReadonlyArray<{ key: CorrectionChoice; title: string }> = [
  { key: "gentle", title: "Gentle" },
  { key: "balanced", title: "Balanced" },
  { key: "direct", title: "Direct" },
];

function correctionQuestion(): PreviewMessage {
  return {
    body: "Got it! When you make a mistake, how should I correct you? Reply 1 Gentle (I show the right way without stopping the chat), 2 Balanced (a short note for bigger slips), 3 Direct (clear corrections), or AUTO and I\u2019ll adjust.",
    quickReplies: CORRECTION_REPLIES.map((choice, index) => ({ id: String(index + 1), title: choice.title })),
  };
}

function frequencyQuestion(): PreviewMessage {
  return { body: `${FREQUENCY_QUESTION} Reply 2, 3, 5, 7 for every day, or AUTO and I\u2019ll adjust.` };
}

export function previewFinalText(input: { goalPhrase: string; interests: string[]; support: SupportStyle; topic: string }) {
  const interests = input.interests.length > 0 ? joinList(input.interests.slice(0, 3)) : "the things you enjoy";
  return `Perfect! I\u2019ll remember that you want Mandarin for ${input.goalPhrase}, enjoy talking about ${interests}, and prefer ${supportPhrase(input.support)}. I\u2019m looking forward to talking more about ${input.topic} and joining you on your Mandarin learning journey! \u{1F331} Head back to LingoIsland to see the plan we made for you.`;
}

const DECLINED_TEXT =
  "No problem! Your plan is saved in LingoIsland whenever you are ready. Text me anytime if you want to practice.";

function parseIntro(text: string): "yes" | "no" | null {
  if (/^(2|no|nope|not now|later|maybe later|not yet|不|不要|下次|不用)( thanks| thank you)?$/.test(text)) return "no";
  if (/^(1|y|yes|yeah|yep|sure|ok|okay|let's do it|lets do it|let's go|go|ready|好|好的|可以|行)\b/.test(text)) return "yes";
  return null;
}

function parseTopic(text: string, profile: PreviewProfile): string | null {
  const options = topicOptions(profile);
  const n = Number(text);
  if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1];
  const match = profile.interests.find((label) => {
    const lower = label.toLowerCase();
    return text === lower || (text.length >= 3 && (lower.includes(text) || text.includes(lower)));
  });
  return match ?? null;
}

function parseSupport(text: string): SupportStyle | null {
  if (text === "1" || /pinyin|english|both|all|full/.test(text)) return "full";
  if (text === "2" || /when i ask|on request|only when|ask/.test(text)) return "on_request";
  if (text === "3" || /mostly|chinese|中文/.test(text)) return "mostly_chinese";
  return null;
}

function parseCorrection(text: string): CorrectionChoice | null {
  if (text === "1" || /gentle|soft/.test(text)) return "gentle";
  if (text === "2" || /balanced|middle|medium/.test(text)) return "balanced";
  if (text === "3" || /direct|strict/.test(text)) return "direct";
  if (/^(auto|adjust|adjust automatically|you decide|you choose|any|whatever|not sure|idk)$/.test(text)) return "auto";
  return null;
}

function parseFrequency(text: string): FrequencyChoice | null {
  if (/^(2|two|twice|2 times|two times)$/.test(text)) return "2";
  if (/^(3|three|3 times|three times)$/.test(text)) return "3";
  if (/^(5|five|5 times|five times)$/.test(text)) return "5";
  if (/^(7|seven|every day|everyday|daily|each day|7 times)$/.test(text)) return "7";
  if (/^(auto|adjust|adjust automatically|you decide|you choose|any|whatever|not sure|idk)$/.test(text)) return "auto";
  return null;
}

function finish(state: PreviewState, profile: PreviewProfile, outcome: PreviewStep["outcome"]): PreviewStep {
  const topic = state.topic ?? topicOptions(profile)[0];
  const support = state.support ?? profile.supportDefault;
  const correction = state.correction ?? DEFAULT_PREVIEW_CORRECTION;
  const frequency = state.frequency ?? "auto";
  return {
    state: { ...state, stage: "done", topic, support, correction, frequency, reasks: 0 },
    reply: { body: previewFinalText({ goalPhrase: profile.goalPhrase, interests: profile.interests, support, topic }) },
    finished: true,
    outcome,
  };
}

/**
 * Advances the preview by one learner message. Unclear answers are asked
 * again once, then the sensible default is used so the chat always finishes
 * within the message and time limits.
 */
export function advancePreview(state: PreviewState, rawText: string, profile: PreviewProfile, now: Date): PreviewStep {
  if (!isPreviewOpen(state)) return { state, reply: null, finished: true, outcome: "ignored" };
  const next: PreviewState = { ...state, learnerMessages: state.learnerMessages + 1 };
  const text = normalize(rawText);
  const atLimit = next.learnerMessages >= PREVIEW_MAX_LEARNER_MESSAGES || previewTimedOut(state, now);

  if (state.stage === "intro") {
    const answer = parseIntro(text);
    if (answer === "no") {
      return { state: { ...next, stage: "declined" }, reply: { body: DECLINED_TEXT }, finished: true, outcome: "declined" };
    }
    if (atLimit) return finish(next, profile, "limit_reached");
    // Anything other than a clear "not now" counts as interest.
    return { state: { ...next, stage: "topic", reasks: 0 }, reply: topicQuestion(profile), finished: false, outcome: "advanced" };
  }

  if (state.stage === "topic") {
    const topic = parseTopic(text, profile) ?? (state.reasks >= 1 || atLimit ? topicOptions(profile)[0] : null);
    if (!topic) {
      return { state: { ...next, reasks: state.reasks + 1 }, reply: topicQuestion(profile), finished: false, outcome: "reasked" };
    }
    if (atLimit) return finish({ ...next, topic }, profile, "limit_reached");
    return { state: { ...next, stage: "support", topic, reasks: 0 }, reply: supportQuestion(topic), finished: false, outcome: "advanced" };
  }

  if (state.stage === "support") {
    const support = parseSupport(text) ?? (state.reasks >= 1 || atLimit ? profile.supportDefault : null);
    if (!support) {
      return { state: { ...next, reasks: state.reasks + 1 }, reply: supportQuestion(state.topic ?? topicOptions(profile)[0]), finished: false, outcome: "reasked" };
    }
    if (atLimit) return finish({ ...next, support }, profile, "limit_reached");
    return { state: { ...next, stage: "correction", support, reasks: 0 }, reply: correctionQuestion(), finished: false, outcome: "advanced" };
  }

  if (state.stage === "correction") {
    const correction = parseCorrection(text) ?? (state.reasks >= 1 || atLimit ? DEFAULT_PREVIEW_CORRECTION : null);
    if (!correction) {
      return { state: { ...next, reasks: state.reasks + 1 }, reply: correctionQuestion(), finished: false, outcome: "reasked" };
    }
    if (atLimit) return finish({ ...next, correction }, profile, "limit_reached");
    return { state: { ...next, stage: "frequency", correction, reasks: 0 }, reply: frequencyQuestion(), finished: false, outcome: "advanced" };
  }

  const frequency = parseFrequency(text) ?? (state.reasks >= 1 || atLimit ? "auto" : null);
  if (!frequency) {
    return { state: { ...next, reasks: state.reasks + 1 }, reply: frequencyQuestion(), finished: false, outcome: "reasked" };
  }
  return finish({ ...next, frequency }, profile, "completed");
}

/** Reads the stored preview state defensively (it lives in thread.session). */
export function readPreviewState(value: unknown): PreviewState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const stages: PreviewStage[] = ["intro", "topic", "support", "correction", "frequency", "done", "declined"];
  if (!stages.includes(raw.stage as PreviewStage) || typeof raw.startedAt !== "string") return null;
  return {
    stage: raw.stage as PreviewStage,
    learnerMessages: Number(raw.learnerMessages) || 0,
    startedAt: raw.startedAt,
    topic: typeof raw.topic === "string" ? raw.topic : null,
    support: isSupportStyle(raw.support) ? raw.support : null,
    correction: isCorrectionChoice(raw.correction) ? raw.correction : null,
    frequency: isFrequencyChoice(raw.frequency) ? raw.frequency : null,
    reasks: Number(raw.reasks) || 0,
  };
}

/** Preference patch from the answers given in the preview. */
export function previewPreferencePatch(state: PreviewState) {
  const patch: Record<string, unknown> = {};
  if (state.support) patch.scaffolding = scaffoldingFor(state.support);
  if (state.correction) patch.correction_mode = correctionModeFor(state.correction);
  if (state.frequency) {
    patch.openers_per_week = state.frequency === "auto" ? null : Number(state.frequency);
    patch.auto_adjust = true;
  }
  return patch;
}
