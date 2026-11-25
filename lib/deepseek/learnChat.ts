import { conversationParts, isUnavailableChatMessage, parseGuidedReply } from "../journey/teaching/chatReply";

export class ChatProviderError extends Error {
  constructor(message = "Huahua couldn’t reply just now. Please try again.", public status = 502) { super(message); }
}

type ChatInput = {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  exerciseMode?: boolean; guidedReply?: boolean;
};

/** A provider success is usable reply text, never reasoning or a canned fallback. */
export async function generateLearnChat(input: ChatInput): Promise<{ message: string; suggestions?: string[] }> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new ChatProviderError("Huahua is temporarily unavailable. Please try again later.", 503);
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim().replace(/\/$/, "");
  // Keep prior assistant turns consistent with the requested JSON response format.
  const history = input.messages.filter(message => message.role !== "assistant" || !isUnavailableChatMessage(message.content))
    .map(message => input.guidedReply && message.role === "assistant"
      ? { role: message.role, content: JSON.stringify({ message: conversationParts(message.content).message, suggestions: [] }) }
      : { role: message.role, content: message.content });
  const deadline = Date.now() + 15000;
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(`${base}/v1/chat/completions`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        body: JSON.stringify({
          model: "deepseek-v4-flash",
          messages: [{ role: "system", content: input.systemPrompt }, ...history],
          thinking: { type: "disabled" },
          // JSON mode can return spaces for a non-JSON generation. On the one
          // recovery attempt, use the same JSON instructions without its filter.
          ...(input.guidedReply && attempt === 0 ? { response_format: { type: "json_object" } } : {}),
          temperature: input.exerciseMode ? 0.3 : 0.7,
          max_tokens: input.exerciseMode ? 2000 : 1200,
        }),
      });
    } catch { throw new ChatProviderError(); }
    if (!response.ok) throw new ChatProviderError();
    let data;
    try { data = await response.json(); } catch { throw new ChatProviderError(); }
    const choice = data?.choices?.[0];
    const content = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
    const usable = content && choice?.finish_reason !== "length" && choice?.finish_reason !== "content_filter" && !isUnavailableChatMessage(content);
    if (usable) {
      if (!input.guidedReply) return { message: content };
      try {
        const reply = parseGuidedReply(content);
        if (/[\u3400-\u9fff]/.test(reply.message) && !isUnavailableChatMessage(reply.message)) return reply;
      } catch { /* Retry an unusable structured reply once, within the same deadline. */ }
    }
    if (choice?.finish_reason === "content_filter" || Date.now() >= deadline) break;
  }
  throw new ChatProviderError();
}
