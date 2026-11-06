import { getCorrectionMode, type CorrectionMode } from "./correction";
import { getPersona, type PersonaKey } from "./personas";
import { SAFETY_POLICY, type SafetyClass } from "./safety";
import { SCAFFOLD_RULES, type HskLevel, type LanguageMode } from "./scaffolding";
import { isComfortSignal, type ComfortSignal, type Vocab } from "./wordComfort";

export type TurnMode = "reply" | "opener" | "command";
export type TurnCommand = "hint" | "easier" | "harder" | "explain" | "translate";
export type ConversationState = "opening" | "practicing" | "wrapping_up" | "closed";
export type NextAction = "continue" | "wrap_up" | "end" | "offer_easier" | "offer_harder";

export type HuahuaTurnInput = {
  mode: TurnMode;
  command?: TurnCommand;
  learnerName: string;
  level: HskLevel;
  persona: PersonaKey;
  correctionMode: CorrectionMode;
  support: { pinyin: boolean; translation: boolean };
  language: LanguageMode;
  history: Array<{ direction: "inbound" | "outbound"; body: string }>;
  targetVocab: Vocab[];
  /** Only facts that are true; openers may reference nothing else. */
  facts: string[];
  exchangeCount: number;
  maxChars: number;
};

export type HuahuaTurn = {
  message: string;
  targetVocab: Vocab[];
  detectedDifficulty: HskLevel | null;
  correction: { original: string; corrected: string; explanation: string } | null;
  pinyin: string | null;
  translation: string | null;
  wordComfortUpdates: Array<{ word: string; signal: ComfortSignal }>;
  conversationState: ConversationState;
  suggestedNextAction: NextAction;
  safety: SafetyClass;
};

export type TurnGenerator = (input: HuahuaTurnInput) => Promise<unknown>;

export const TARGET_EXCHANGES = { min: 2, max: 5 } as const;

const STATES: readonly ConversationState[] = ["opening", "practicing", "wrapping_up", "closed"];
const ACTIONS: readonly NextAction[] = ["continue", "wrap_up", "end", "offer_easier", "offer_harder"];
const SAFETY: readonly SafetyClass[] = ["safe", "redirected", "refused", "crisis"];

export class TurnValidationError extends Error {
  constructor(readonly reason: string) {
    super(`Invalid Huahua turn: ${reason}`);
    this.name = "TurnValidationError";
  }
}

function optionalString(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function vocabList(value: unknown): Vocab[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): Vocab | null => {
      if (typeof item === "string") return { hanzi: item.trim().slice(0, 32) };
      const hanzi = optionalString((item as Record<string, unknown>)?.hanzi ?? (item as Record<string, unknown>)?.word, 32);
      if (!hanzi) return null;
      return {
        hanzi,
        pinyin: optionalString((item as Record<string, unknown>).pinyin, 80),
        english: optionalString((item as Record<string, unknown>).english, 120),
      };
    })
    .filter((item): item is Vocab => Boolean(item?.hanzi))
    .slice(0, 6);
}

/** Runtime validation of the model's JSON. Throws TurnValidationError. */
export function validateTurn(raw: unknown): HuahuaTurn {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new TurnValidationError("not an object");
  const data = raw as Record<string, unknown>;

  const message = optionalString(data.message, 600);
  if (!message) throw new TurnValidationError("missing message");

  const safety = SAFETY.includes(data.safety as SafetyClass) ? (data.safety as SafetyClass) : null;
  if (!safety) throw new TurnValidationError("invalid safety classification");

  const state = STATES.includes(data.conversation_state as ConversationState)
    ? (data.conversation_state as ConversationState)
    : "practicing";
  const action = ACTIONS.includes(data.suggested_next_action as NextAction)
    ? (data.suggested_next_action as NextAction)
    : "continue";

  const difficulty = Number(data.detected_difficulty);
  const correctionRaw = data.correction as Record<string, unknown> | null | undefined;
  const corrected = optionalString(correctionRaw?.corrected, 200);

  const updates = Array.isArray(data.word_comfort_updates)
    ? (data.word_comfort_updates as Array<Record<string, unknown>>)
        .map((update) => ({ word: optionalString(update?.word, 32), signal: update?.signal }))
        .filter((update): update is { word: string; signal: ComfortSignal } =>
          Boolean(update.word) && isComfortSignal(update.signal),
        )
        .slice(0, 10)
    : [];

  return {
    message,
    targetVocab: vocabList(data.target_vocab),
    detectedDifficulty: Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 6 ? (difficulty as HskLevel) : null,
    correction: corrected
      ? {
          original: optionalString(correctionRaw?.original, 200) ?? "",
          corrected,
          explanation: optionalString(correctionRaw?.explanation, 300) ?? "",
        }
      : null,
    pinyin: optionalString(data.pinyin, 400),
    translation: optionalString(data.translation, 400),
    wordComfortUpdates: updates,
    conversationState: state,
    suggestedNextAction: action,
    safety,
  };
}

const OUTPUT_SPEC = `Reply with ONLY a JSON object:
{
  "message": string,               // the SMS text in Simplified Chinese (plus brief English only where the rules allow)
  "pinyin": string | null,         // tone-marked pinyin for the Chinese in "message"
  "translation": string | null,    // natural English translation of "message"
  "target_vocab": [{"hanzi": string, "pinyin": string, "english": string}],
  "detected_difficulty": 1-6 | null, // HSK level of the learner's last message
  "correction": {"original": string, "corrected": string, "explanation": string} | null,
  "word_comfort_updates": [{"word": string, "signal": "understood" | "used_successfully" | "requested_pinyin" | "requested_translation" | "requested_easier" | "error" | "ignored"}],
  "conversation_state": "opening" | "practicing" | "wrapping_up" | "closed",
  "suggested_next_action": "continue" | "wrap_up" | "end" | "offer_easier" | "offer_harder",
  "safety": "safe" | "redirected" | "refused" | "crisis"
}`;

const COMMAND_INSTRUCTIONS: Record<TurnCommand, string> = {
  hint: "The learner asked for a hint. Give a short hint (in English plus one Chinese example) that helps them answer your last message. Don't give the full answer.",
  easier: "The learner asked for an easier version. Rephrase your last message more simply, with shorter words and sentences.",
  harder: "The learner asked for something harder. Continue the conversation one step more challenging.",
  explain: "The learner asked you to explain. Briefly explain your last message or correction in simple English, with the key Chinese word.",
  translate: "The learner asked for a translation. Put the English translation of your last message in \"translation\" and repeat the Chinese in \"message\".",
};

export function buildSystemPrompt(input: HuahuaTurnInput) {
  const rule = SCAFFOLD_RULES[input.level];
  const persona = getPersona(input.persona);
  const correction = getCorrectionMode(input.correctionMode);
  const vocab = input.targetVocab
    .map((word) => `${word.hanzi}${word.pinyin ? ` (${word.pinyin})` : ""}${word.english ? ` = ${word.english}` : ""}`)
    .join("; ");

  const lines = [
    `You are 华华 (Huahua), LingoIsland's AI Mandarin practice partner, texting ${input.learnerName} by SMS.`,
    persona.prompt,
    `Level: ${rule.guidance} Keep "message" under ${Math.min(input.maxChars, rule.maxChineseChars * 2)} characters.`,
    correction.prompt,
    input.support.pinyin ? "Always fill \"pinyin\"." : "Set \"pinyin\" to null unless asked.",
    input.support.translation ? "Always fill \"translation\"." : "Set \"translation\" to null unless asked.",
    input.language === "english"
      ? "The learner wants more English: explanations may be in English."
      : input.language === "chinese"
        ? "The learner wants Chinese only: no English in \"message\"."
        : "Use Chinese in \"message\"; English only for brief glosses the level allows.",
    vocab ? `Target words to weave in naturally: ${vocab}.` : "No fixed target words; use level-appropriate everyday words.",
    `Conversation length: aim for ${TARGET_EXCHANGES.min}–${TARGET_EXCHANGES.max} exchanges (about 5–10 minutes). This is exchange ${input.exchangeCount + 1}. From exchange ${TARGET_EXCHANGES.max - 1} on, start wrapping up warmly (quick recap or encouragement) without ending abruptly; the learner can always keep texting.`,
    "Ask at most one question. No markdown, no emoji spam (one emoji max).",
    "Disclose that you are an AI if asked. Do not invent personal experiences or physical activities.",
    input.facts.length > 0
      ? `True facts you may mention (and nothing else about the learner's activity): ${input.facts.join(" ")}`
      : "Do not claim anything about the learner's recent activity.",
    SAFETY_POLICY,
  ];
  if (input.mode === "opener") {
    lines.push(
      "This is the FIRST text of a new conversation that you are starting. One short friendly opener with one easy question. Do not follow up on anything the learner hasn't said.",
    );
  }
  if (input.command) lines.push(COMMAND_INSTRUCTIONS[input.command]);
  lines.push(OUTPUT_SPEC);
  return lines.join("\n");
}

const REQUEST_TIMEOUT_MS = 15_000;

export function createDeepSeekTurnGenerator(
  options: {
    apiKey?: string;
    baseUrl?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): TurnGenerator {
  return async (input) => {
    const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");
    const base = (options.baseUrl ?? process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
    const doFetch = options.fetchImpl ?? fetch;

    const messages = [
      { role: "system", content: buildSystemPrompt(input) },
      ...input.history.slice(-12).map((message) => ({
        role: message.direction === "inbound" ? "user" : "assistant",
        content: message.body,
      })),
    ];
    if (input.mode === "opener") {
      messages.push({ role: "user", content: "(Start the conversation now.)" });
    }

    const response = await doFetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`DeepSeek request failed (${response.status})`);
    const data = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek returned an empty response");
    try {
      return JSON.parse(content) as unknown;
    } catch {
      throw new TurnValidationError("response was not JSON");
    }
  };
}
