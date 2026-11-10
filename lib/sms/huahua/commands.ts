import { personaByNumber, type PersonaKey } from "./personas";

// In-message commands, handled before the AI model. Carrier keywords
// (STOP/START/HELP) are handled earlier in lib/sms/keywords.ts.

export type HuahuaCommand =
  | { type: "pinyin" }
  | { type: "translate" }
  | { type: "hint" }
  | { type: "easier" }
  | { type: "harder" }
  | { type: "explain" }
  | { type: "language"; mode: "english" | "chinese" }
  | { type: "correction"; mode: "conversation_only" | "coach" }
  | { type: "persona"; persona: PersonaKey }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "keep" }
  | { type: "less" }
  | { type: "support" };

export type ParsedCommand = {
  command: HuahuaCommand;
  /** The learner clearly asked for a lasting change ("always pinyin"). */
  persistent: boolean;
};

const BASE: Record<string, HuahuaCommand> = {
  pinyin: { type: "pinyin" },
  "show pinyin": { type: "pinyin" },
  拼音: { type: "pinyin" },
  translate: { type: "translate" },
  translation: { type: "translate" },
  翻译: { type: "translate" },
  hint: { type: "hint" },
  提示: { type: "hint" },
  easier: { type: "easier" },
  简单一点: { type: "easier" },
  简单点: { type: "easier" },
  harder: { type: "harder" },
  难一点: { type: "harder" },
  explain: { type: "explain" },
  解释一下: { type: "explain" },
  解释: { type: "explain" },
  english: { type: "language", mode: "english" },
  "in english": { type: "language", mode: "english" },
  中文: { type: "language", mode: "chinese" },
  "stop correcting": { type: "correction", mode: "conversation_only" },
  "stop correcting me": { type: "correction", mode: "conversation_only" },
  "no corrections": { type: "correction", mode: "conversation_only" },
  "correct me": { type: "correction", mode: "coach" },
  "please correct me": { type: "correction", mode: "coach" },
  pause: { type: "pause" },
  "pause texts": { type: "pause" },
  resume: { type: "resume" },
  "resume texts": { type: "resume" },
  support: { type: "support" },
  human: { type: "support" },
  "talk to a human": { type: "support" },
  "real person": { type: "support" },
  "contact support": { type: "support" },
  "customer support": { type: "support" },
  "customer service": { type: "support" },
  客服: { type: "support" },
};

const CONTROL_REPLIES: Record<string, HuahuaCommand> = {
  yes: { type: "keep" },
  keep: { type: "keep" },
  "keep them": { type: "keep" },
  好: { type: "keep" },
  好的: { type: "keep" },
  less: { type: "less" },
  fewer: { type: "less" },
  "less often": { type: "less" },
  少一点: { type: "less" },
};

const PERSIST_PATTERNS: RegExp[] = [
  /^always\s+/,
  /\s+always$/,
  /\s+from now on$/,
  /^from now on[,\s]+/,
  /\s+every time$/,
  /\s+permanently$/,
  /^以后(都)?/,
  /^一直/,
  /^总是/,
];

function normalize(body: string) {
  return body
    .trim()
    .toLowerCase()
    .replace(/[\s.!?。！？~～,，]+$/g, "")
    .replace(/^[\s"'“”]+|[\s"'“”]+$/g, "")
    .replace(/\s+please$/, "")
    .replace(/^please\s+/, "")
    .replace(/\s+/g, " ");
}

export function parseCommand(
  body: string,
  context: { personaMenuOpen?: boolean; controlPending?: boolean } = {},
): ParsedCommand | null {
  const text = normalize(body);
  if (!text || text.length > 40) return null;

  if (context.personaMenuOpen && /^[1-4]$/.test(text)) {
    const persona = personaByNumber(Number(text));
    if (persona) return { command: { type: "persona", persona: persona.key }, persistent: true };
  }

  if (context.controlPending && CONTROL_REPLIES[text]) {
    return { command: CONTROL_REPLIES[text], persistent: true };
  }

  if (BASE[text]) {
    const command = BASE[text];
    const lasting = command.type === "pause" || command.type === "resume";
    return { command, persistent: lasting };
  }

  if (text === "never correct me" || text === "don't correct me" || text === "dont correct me") {
    return { command: { type: "correction", mode: "conversation_only" }, persistent: true };
  }

  for (const pattern of PERSIST_PATTERNS) {
    if (!pattern.test(text)) continue;
    const stripped = text.replace(pattern, "").replace(/^(加|给我|用|show|use|add)\s*/, "").trim();
    const command = BASE[stripped];
    if (command && command.type !== "hint" && command.type !== "explain") {
      return { command, persistent: true };
    }
  }
  return null;
}
