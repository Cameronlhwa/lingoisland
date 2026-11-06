import { fitToSmsSegments } from "./segments";

type ConversationMessage = { direction: "inbound" | "outbound"; body: string };

export const SMS_REPLY_MAX_SEGMENTS = 2;
const REQUEST_TIMEOUT_MS = 20_000;

export async function generateSmsReply({
  learnerName,
  level,
  persona,
  history,
  maxSegments = SMS_REPLY_MAX_SEGMENTS,
}: {
  learnerName: string;
  level: string;
  persona: string;
  history: ConversationMessage[];
  maxSegments?: number;
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      temperature: 0.8,
      max_tokens: 160,
      messages: [
        {
          role: "system",
          content: `You are ${persona}, a warm Mandarin-speaking texting friend for ${learnerName}. Their level is ${level}. Keep the conversation natural and useful for language practice. Primarily use Simplified Chinese, but briefly explain difficult words in English when helpful. Match the learner's level, ask at most one question, and use no markdown. This is SMS: keep every reply under 120 characters in total (about 50 Chinese characters). Never claim to be human.`,
        },
        ...history.map((message) => ({
          role: message.direction === "inbound" ? "user" : "assistant",
          content: message.body,
        })),
      ],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`DeepSeek reply failed (${response.status})`);
  }

  const reply = String(data?.choices?.[0]?.message?.content || "")
    .replace(/\*\*|__|`/g, "")
    .trim();
  if (!reply) throw new Error("DeepSeek returned an empty SMS reply");
  return fitToSmsSegments(reply, maxSegments);
}
