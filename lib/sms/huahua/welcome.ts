import { logSmsError } from "../log";
import { sendTrackedSms } from "../outbound";
import type { SmsRpc } from "../rpc";
import type { SmsProvider } from "../types";
import { clock, loadHuahuaContext } from "./context";
import { PERSONAS } from "./personas";
import type { HskLevel } from "./scaffolding";
import { resolveTimeZone, defaultTimeZoneForCountry } from "./schedule";

/**
 * Level-appropriate welcome sent after verification and consent. Discloses
 * that Huahua is an AI. Subscribers can pick a persona by number; free
 * learners get the default persona and a short practice chat.
 */
export function buildWelcomeMessage(input: { level: HskLevel; subscribed: boolean }) {
  const menu = input.subscribed
    ? `Reply a number for my style: ${PERSONAS.map((persona) => `${persona.number} ${persona.shortLabel}`).join(", ")}.`
    : "Text me back for a short practice chat.";

  if (input.level <= 2) {
    return [
      "LingoIsland: Hi! I'm 华华 (Huahua), your AI Mandarin practice partner.",
      "你好！(Nǐ hǎo! Hello!)",
      menu,
      "Reply HELP for help, STOP to opt out.",
    ].join("\n");
  }
  if (input.level <= 4) {
    return [
      "LingoIsland: Hi! I'm 华华 (Huahua), your AI Mandarin practice partner. 很高兴认识你！",
      menu,
      "Reply HELP for help, STOP to opt out.",
    ].join("\n");
  }
  return [
    "LingoIsland: 你好！我是华华，你的AI中文练习伙伴 (Huahua, an AI practice partner). 很高兴认识你！",
    menu,
    "Reply HELP for help, STOP to opt out.",
  ].join("\n");
}

export async function sendHuahuaWelcome(
  deps: { rpc: SmsRpc; provider: SmsProvider; now?: () => Date },
  userId: string,
  contactId: string,
) {
  const now = clock(deps);
  const ctx = await loadHuahuaContext(deps, userId, now);

  if (!ctx.preferences.timezone) {
    await deps.rpc("sms_update_preferences", {
      p_user_id: userId,
      p_patch: { timezone: resolveTimeZone(ctx.profileTimezone, defaultTimeZoneForCountry(ctx.countryCode)) },
    });
  }

  const body = buildWelcomeMessage({ level: ctx.level, subscribed: ctx.subscribed });
  const sent = await sendTrackedSms(deps, {
    contactId,
    idempotencyKey: `welcome:${contactId}`,
    kind: "welcome",
    requireActive: true,
    body,
  });

  if (sent.status === "sent") {
    try {
      const thread = await deps.rpc<{ id: string } | null>("sms_open_thread", {
        p_contact_id: contactId,
        p_origin: "welcome",
        p_job_id: null,
        p_journey_island_id: null,
        p_target_vocab: [],
        p_session: { persona_menu: ctx.subscribed },
        p_now: now.toISOString(),
      });
      if (thread?.id) {
        await deps.rpc("sms_record_thread_outbound", {
          p_thread_id: thread.id,
          p_message_id: sent.messageId,
          p_metadata: { kind: "welcome" },
          p_patch: {},
          p_now: now.toISOString(),
        });
      }
    } catch (error) {
      logSmsError("welcome thread bookkeeping failed", error);
    }
  }
  return sent;
}
