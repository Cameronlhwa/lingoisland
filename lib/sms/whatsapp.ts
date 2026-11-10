// WhatsApp's customer-service window: free-form messages (text, buttons) are
// only allowed within 24 hours of the learner's last message. Outside it,
// only a Meta-approved template may be sent, otherwise nothing is sent.

import type { WhatsAppTemplate } from "./types";

export const WHATSAPP_WINDOW_HOURS = 24;

export function withinWhatsAppWindow(lastInboundAt: string | null | undefined, now: Date) {
  if (!lastInboundAt) return false;
  const last = new Date(lastInboundAt).getTime();
  if (!Number.isFinite(last)) return false;
  return now.getTime() - last < WHATSAPP_WINDOW_HOURS * 3600_000;
}

export type WhatsAppSendPlan =
  | { mode: "freeform" }
  | { mode: "template"; template: WhatsAppTemplate }
  | { mode: "skip"; reason: "whatsapp_window_closed" };

export function planWhatsAppSend(input: {
  lastInboundAt: string | null | undefined;
  now: Date;
  template?: WhatsAppTemplate | null;
}): WhatsAppSendPlan {
  if (withinWhatsAppWindow(input.lastInboundAt, input.now)) return { mode: "freeform" };
  if (input.template?.name) return { mode: "template", template: input.template };
  return { mode: "skip", reason: "whatsapp_window_closed" };
}
