// Fixed (non-AI) SMS copy. Keep verification codes GSM-7 so they fit in a
// single segment.

export const SMS_WELCOME_MESSAGE =
  "LingoIsland: You're verified! 华华 here 👋 Text me in Chinese anytime. Reply STOP to unsubscribe.";

export const SMS_HELP_MESSAGE =
  "LingoIsland Mandarin texting practice. Msg frequency varies. Msg & data rates may apply. Manage it in Account settings at lingoisland.com. Reply STOP to unsubscribe.";

export const SMS_RESUBSCRIBED_MESSAGE =
  "LingoIsland: You're resubscribed. 华华 is back! Text me in Chinese anytime. Reply STOP to unsubscribe.";

export const SMS_FALLBACK_REPLY =
  "抱歉，我刚才走神了 😅 Sorry, I couldn't reply just now. Try texting me again in a minute!";

export function verificationCodeMessage(code: string, ttlMinutes: number) {
  return `LingoIsland code: ${code}. It expires in ${ttlMinutes} min. If you didn't request this, ignore this text.`;
}
