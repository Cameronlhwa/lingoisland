/** Shared fixed target keeps the public preview within the existing scoring allowlist. */
export const PREVIEW_SENTENCE = "我爱喝热茶。";
export const PREVIEW_PINYIN = "Wǒ ài hē rè chá.";
export const PREVIEW_MEANING = "I love drinking hot tea.";

export function previewFeedback(score: number) {
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Invalid pronunciation score");
  if (score < 50) return {
    title: "Your starting point, found.",
    quote: "Clear speech starts with small wins. One sound, then one word, then a conversation.",
    help: "Start with the four tones, hear the differences, and practise each sound before putting words together.",
  };
  if (score < 70) return {
    title: "You’re finding your voice.",
    quote: "You have something to build on. A little focused practice can make your words easier to follow.",
    help: "Use listening challenges and short speaking drills to work on the sounds that need more attention.",
  };
  if (score < 85) return {
    title: "A strong foundation to grow from.",
    quote: "Your Mandarin is taking shape. Now give the finer details a little more attention.",
    help: "Practise neutral tones and tone changes in connected speech, then bring that control into longer phrases.",
  };
  return {
    title: "Your practice is coming through.",
    quote: "You sounded strong on this sentence. Keep that clarity when the conversation gets more challenging.",
    help: "Build consistency with connected speech and tongue-twister challenges, with feedback on each attempt.",
  };
}
