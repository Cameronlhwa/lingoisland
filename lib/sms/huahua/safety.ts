// Deterministic safety checks that run before (and after) the AI model.
// The model's system prompt carries the full content policy; these guards
// cover the cases where a fixed, reliable response matters most.

export type SafetyClass = "safe" | "redirected" | "refused" | "crisis";

const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill|hurt|harm)\s+myself\b/i,
  /\b(want|going|plan(ning)?)\s+to\s+die\b/i,
  /\bend\s+(my|it)\s+(life|all)\b/i,
  /\bsuicid(e|al)\b.*\b(i|i'm|im|me|my)\b|\b(i|i'm|im|me|my)\b.*\bsuicid(e|al)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\bself[-\s]?harm(ing)?\b.*\b(i|i'm|me)\b/i,
  /我想(要)?(自杀|去死|死)/,
  /(不想活|活不下去|想结束(自己的)?生命|结束我的生命)/,
  /我要自杀/,
];

// Learning vocabulary about a sensitive topic is fine ("how do you say …").
const VOCAB_QUESTION = /(how (do|would) (you|i) say|what('s| is) .* in (chinese|mandarin)|怎么说|中文怎么)/i;

const CREDENTIAL_SHARE_PATTERNS: RegExp[] = [
  /\b(my\s+)?(password|passcode|pin)\s*(is|:)\s*\S+/i,
  /\b(verification|login|security|one[-\s]?time)\s+code\s*(is|:)?\s*\d{4,8}\b/i,
  /\b(api|secret)\s+key\s*(is|:)?\s*\S{8,}/i,
  /\b(?:\d[ -]?){13,19}\b/,
  /(密码|验证码)(是|:|：)\s*\S+/,
];

export function classifyInboundSafety(text: string): "crisis" | "credentials" | null {
  const body = text.slice(0, 1000);
  if (CRISIS_PATTERNS.some((pattern) => pattern.test(body)) && !VOCAB_QUESTION.test(body)) return "crisis";
  if (CREDENTIAL_SHARE_PATTERNS.some((pattern) => pattern.test(body))) return "credentials";
  return null;
}

export function crisisMessage(countryCode: string | null | undefined) {
  const local =
    countryCode === "US" || countryCode === "CA"
      ? "Please call or text 988 (Suicide & Crisis Lifeline) to talk to someone now, or call 911 if you're in danger."
      : "Please contact your local emergency number or a crisis line to talk to someone now.";
  return `LingoIsland: I can't provide crisis support, but you deserve support right now. ${local}`;
}

export const CREDENTIALS_MESSAGE =
  "LingoIsland: Please don't text passwords, codes, or card numbers here, even to me. 华华 will never ask for them. Let's keep practicing! 我们继续吧。";

// Huahua must never ask for these.
const OUTBOUND_CREDENTIAL_REQUEST = [
  /\b(send|give|tell|share|text)\s+(me\s+)?(your\s+)?(password|passcode|pin|verification code|login code|api key|card number|bank (account|details))/i,
  /\bwhat('s| is) your (password|passcode|pin|card number|verification code)/i,
  /(告诉|发给|给)我.{0,6}(密码|验证码|银行卡号|卡号)/,
];

export function outboundAsksForCredentials(text: string) {
  return OUTBOUND_CREDENTIAL_REQUEST.some((pattern) => pattern.test(text));
}

const ASKS_IF_HUMAN = /\b(are|r) (you|u) (a |an )?(real|human|person|bot|robot|ai|machine)\b|你是(真人|人|机器人|ai|AI|人工智能)吗?|你是不是(真人|机器人)/i;
const MENTIONS_AI = /\b(ai|a\.i\.|artificial intelligence|bot)\b|人工智能|机器人|AI/i;

export function asksIfHuman(text: string) {
  return ASKS_IF_HUMAN.test(text);
}

/** Guarantees an honest AI disclosure when the learner asks. */
export function ensureAiDisclosure(reply: string, inbound: string) {
  if (!asksIfHuman(inbound) || MENTIONS_AI.test(reply)) return reply;
  return `I'm an AI practice partner, not a person. ${reply}`;
}

export const SAFETY_POLICY = [
  "Safety rules (always follow):",
  "- You are an AI. If asked, say so plainly. Never claim to be human or to do physical things (eating, travelling, sleeping, meeting people).",
  "- Refuse or redirect: sexual content involving minors; instructions for violence or weapons; help with illegal wrongdoing; hate or harassment; encouraging self-harm; scams or impersonation; requests for passwords, codes, API keys, or financial credentials; explicit sexual roleplay; personalized medical, legal, or financial advice (suggest a qualified professional).",
  "- Neutral vocabulary on these topics is fine (e.g. how to say 'hospital', 'lawyer', 'police', 'sad').",
  "- If the learner seems at risk of self-harm, set safety to \"crisis\".",
  "- Never ask for personal secrets, codes, or payment details.",
].join("\n");
