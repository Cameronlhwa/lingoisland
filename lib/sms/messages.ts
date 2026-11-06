// Fixed (non-AI) SMS copy. Keep verification codes GSM-7 so they fit in a
// single segment.

export const SMS_HELP_MESSAGE =
  "LingoIsland Mandarin texting practice. Msg frequency varies. Msg & data rates may apply. Manage it in Account settings at lingoisland.com. Reply STOP to unsubscribe.";

export const SMS_RESUBSCRIBED_MESSAGE =
  "LingoIsland: You're resubscribed. 华华 is back! Text me in Chinese anytime. Reply STOP to unsubscribe.";

export function verificationCodeMessage(code: string, ttlMinutes: number) {
  return `LingoIsland code: ${code}. It expires in ${ttlMinutes} min. If you didn't request this, ignore this text.`;
}

function shortDate(iso: string | null, timeZone: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function usageWarningMessage(resetsAt: string | null, timeZone: string) {
  const date = shortDate(resetsAt, timeZone);
  return `LingoIsland: Heads up, you've used 80% of this month's texts with 华华${date ? `. They reset on ${date}` : ""}. You can check usage on the Huahua page.`;
}

export function usageExhaustedMessage(plan: "free" | "subscriber", resetsAt: string | null, timeZone: string) {
  if (plan === "free") {
    return "LingoIsland: That's the end of your free practice chat with 华华. Thanks for trying it! Reply HELP for help or STOP to opt out.";
  }
  const date = shortDate(resetsAt, timeZone);
  return `LingoIsland: You've used this month's texts with 华华, so replies are paused${date ? ` until ${date}` : ""}. Nothing extra is charged. Reply HELP for help or STOP to opt out.`;
}

export const CONTROL_MESSAGE =
  "华华 here 👋 Still want practice texts? Reply YES to keep them, LESS for fewer, or PAUSE to take a break. Totally fine either way!";

export const PAUSED_BY_TEXT_MESSAGE =
  "Got it, I'll stop sending practice texts. You can still text me anytime, and reply RESUME to turn them back on.";

export const RESUMED_BY_TEXT_MESSAGE = "Welcome back! Practice texts are on again. 加油！";

export const ALREADY_ON_MESSAGE = "Practice texts are already on. 我们聊吧！";

export const KEEP_TEXTS_MESSAGE = "Great, I'll keep the practice texts coming. 加油！";

export function fewerTextsMessage(perWeek: number) {
  return `No problem, I'll text less often (about ${perWeek} ${perWeek === 1 ? "time" : "times"} a week). You can change this on the Huahua page.`;
}

export const RESUME_OFFER = "(Practice texts are paused. Reply RESUME anytime to turn them back on.)";

export const NO_PREVIOUS_MESSAGE = "Text me something in Chinese first, and I'll help with it! 我们聊吧！";
