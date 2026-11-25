/** Keep the optional guided-chat response safe to display and small enough to save. */
export function parseGuidedReply(raw: string): { message: string; suggestions: string[] } {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const data = JSON.parse(text);
    if (!data || typeof data.message !== "string" || !data.message.trim()) throw new Error("Missing conversation message");
    const suggestions: string[] = Array.isArray(data.suggestions)
      ? Array.from(new Set<string>(data.suggestions.filter((value: unknown): value is string => typeof value === "string")
          .map((value: string) => value.trim()).filter((value: string) => value.length > 0 && value.length <= 80 && /[\u3400-\u9fff]/.test(value)))).slice(0, 3)
      : [];
    return { message: data.message.trim().slice(0, 2000), suggestions };
  } catch {
    // A plain-text provider response remains usable by both old and new clients.
    if (text && !/^[{\[]/.test(text)) return { message: text.slice(0, 2000), suggestions: [] };
    throw new Error("Huahua couldn’t reply. Please try again.");
  }
}

/** Older saved turns mixed speech, pronunciation and hints in one string. */
export function conversationParts(content: string): { message: string; pinyin?: string; suggestions: string[]; hints: string[] } {
  const lines: string[] = [], pronunciation: string[] = [], hints: string[] = [], suggestions: string[] = [];
  const hasHanzi = (text: string) => /[\u3400-\u9fff]/.test(text);
  const hasTone = (text: string) => /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/i.test(text);
  for (const line of content.split(/\r?\n/).map(line => line.trim()).filter(Boolean)) {
    const hint = line.match(/^(?:hint|tip|提示)\s*[:：]\s*(.+)$/i);
    if (hint) {
      const quoted = Array.from(hint[1].matchAll(/[“"‘']([^”"’']+)[”"’']/g)).map(match => match[1].trim()).filter(text => hasHanzi(text) && text.length <= 80);
      if (quoted.length) suggestions.push(...quoted);
      else hints.push(hint[1]);
      continue;
    }
    if (/^(?:pinyin|拼音)\s*[:：]/i.test(line) || (!hasHanzi(line) && (hasTone(line) && (/^[（(].*[）)]$/.test(line) || (line.match(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/gi)?.length ?? 0) > 1)))) {
      pronunciation.push(line.replace(/^(?:pinyin|拼音)\s*[:：]\s*/i, "").replace(/^[（(]|[）)]$/g, ""));
      continue;
    }
    // Some providers append the pronunciation to the Mandarin on the same line.
    const inline = line.match(/^(.*[\u3400-\u9fff].*?)\s*[（(]([^()（）]+)[）)]\s*$/);
    if (inline && !hasHanzi(inline[2]) && hasTone(inline[2])) {
      lines.push(inline[1].trim()); pronunciation.push(inline[2].trim());
    } else lines.push(line);
  }
  // Never erase a turn that happens to contain only a hint or a Latin sentence.
  return { message: lines.join("\n") || content, ...(pronunciation.length ? { pinyin: pronunciation.join("\n") } : {}), suggestions: Array.from(new Set(suggestions)).slice(0, 3), hints };
}

export const UNAVAILABLE_CHAT_PLACEHOLDER = "Let's practice! Try using one of your new words in a sentence.";
export function isUnavailableChatMessage(content: string): boolean {
  return content.trim() === UNAVAILABLE_CHAT_PLACEHOLDER;
}
