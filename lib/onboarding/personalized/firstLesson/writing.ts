import type { WritingPractice } from "./curriculum";
export type WritingFeedback = { status: "correct" | "retry" | "review"; feedback: string };
export function normalizeWriting(text: string): string {
 return text.normalize("NFKC").replace(/[\s，。！？、；：,.!?;:“”‘’「」『』（）()]/g, "");
}
/** Local checks never claim to grade the meaning of an original opinion. */
export function reviewWriting(practice: WritingPractice, text: string): WritingFeedback {
 if (text.length > 600) return { status: "retry", feedback: "Keep your answer under 600 characters." };
 if ((text.match(/[\u3400-\u9fff]/g) ?? []).length < 4) return { status: "retry", feedback: "Write a short answer in Mandarin characters. You can use your Chinese keyboard." };
 const missing = practice.required.filter(word => !normalizeWriting(text).includes(normalizeWriting(word)));
 if (missing.length) return { status: "retry", feedback: `Include these pieces: ${missing.join("、")}. ${practice.hint}` };
 if (practice.required.includes("除了") && !/除了.+以外.+还.+/.test(normalizeWriting(text))) return { status: "retry", feedback: "Keep this order: 除了 + first idea + 以外，subject + 还 + second idea." };
 const sentences = text.split(/[。！？!?]+/).filter(s => /[\u3400-\u9fff]/.test(s)).length;
 if ((practice.minSentences && sentences < practice.minSentences) || (practice.maxSentences && sentences > practice.maxSentences)) return { status: "retry", feedback: `Write ${practice.minSentences}–${practice.maxSentences} sentences, using 。！？ to end them.` };
 if (normalizeWriting(text) === normalizeWriting(practice.sample.hanzi)) return { status: "correct", feedback: "That matches the model’s meaning and pattern. Well done!" };
 return { status: "review", feedback: "The required pieces are present. Now compare the meaning and word order with the model. Different wording and opinions can be valid." };
}

/** Only authored single-blank question tasks use the inline answer format. */
export function writingCompletion(prompt: string): { prefix: string; suffix: string; reply: string } | null {
 const match = /^Complete the question:\s*([^_]+?)\s*_{2,}([^_]*?)\s+The reply is:\s*(.+)$/.exec(prompt);
 return match ? { prefix: match[1].trim(), suffix: match[2].trim(), reply: match[3].trim() } : null;
}
