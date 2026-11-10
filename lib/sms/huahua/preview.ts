// Free onboarding preview chat: sending and thread bookkeeping. The pure
// conversation rules live in previewScript.ts so the browser simulation can
// use them too.

import { goalPhrase, isGoalKey } from "../../onboarding/personalized/goals";
import { isSupportStyle } from "../../onboarding/personalized/huahua";
import { defaultSupportStyle } from "../../onboarding/personalized/plan";
import { logSmsError } from "../log";
import { sendTrackedSms, type TrackedSendResult } from "../outbound";
import type { MessageChannel, WhatsAppTemplate } from "../types";
import { clock, type HuahuaDeps } from "./context";
import { initialPreviewState, interestsPhrase, previewIntro, previewIntroText, type PreviewProfile } from "./previewScript";

export * from "./previewScript";

// ---------------------------------------------------------------------------
// Server side
// ---------------------------------------------------------------------------

type OnboardingSnapshot = {
  primary_goal: string | null;
  primary_goal_label: string | null;
  goal_other_text: string | null;
  provisional_level: number | null;
  interests: Array<{ key: string; label: string; is_custom: boolean }>;
  huahua_preferences: { support?: unknown } | null;
} | null;

export async function loadPreviewProfile(deps: Pick<HuahuaDeps, "rpc">, userId: string): Promise<PreviewProfile> {
  const snapshot = await deps.rpc<OnboardingSnapshot>("sms_get_onboarding_snapshot", { p_user_id: userId });
  const goal = snapshot?.primary_goal;
  const level = snapshot?.provisional_level ?? 1;
  const support = snapshot?.huahua_preferences?.support;
  return {
    goalPhrase: goalPhrase(isGoalKey(goal) ? goal : null, snapshot?.goal_other_text ?? null),
    interests: (snapshot?.interests ?? []).map((interest) => (interest.is_custom ? interest.label : interest.label.toLowerCase())),
    supportDefault: isSupportStyle(support) ? support : defaultSupportStyle(level),
  };
}

function previewTemplate(deps: HuahuaDeps, profile: PreviewProfile): WhatsAppTemplate | null {
  const name = deps.config.whatsapp?.templates.previewIntro;
  if (!name) return null;
  return {
    name,
    language: deps.config.whatsapp.templateLanguage,
    bodyParams: [interestsPhrase(profile)],
    quickReplyPayloads: ["yes", "not now"],
    displayBody: previewIntroText(profile),
  };
}

export type PreviewStartResult =
  | { status: "sent"; messageId: string }
  | { status: "already_sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

/**
 * Sends the first preview message once per contact. Free and unmetered;
 * requires an active, verified, consented contact (enforced by the claim).
 */
export async function startHuahuaPreview(
  deps: HuahuaDeps,
  input: { userId: string; contactId: string; channel: MessageChannel },
): Promise<PreviewStartResult> {
  const now = clock(deps);
  const profile = await loadPreviewProfile(deps, input.userId);
  const intro = previewIntro(profile, input.channel);
  const sent: TrackedSendResult = await sendTrackedSms(deps, {
    contactId: input.contactId,
    idempotencyKey: `preview:${input.contactId}`,
    kind: "preview",
    requireActive: true,
    body: intro.body,
    quickReplies: intro.quickReplies,
    whatsappTemplate: previewTemplate(deps, profile),
  });
  if (sent.status === "skipped") {
    return sent.reason === "duplicate" ? { status: "already_sent" } : { status: "skipped", reason: sent.reason };
  }
  if (sent.status !== "sent") return { status: "failed", error: sent.status === "failed" ? sent.error : sent.reason };

  try {
    const thread = await deps.rpc<{ id: string } | null>("sms_open_thread", {
      p_contact_id: input.contactId,
      p_origin: "preview",
      p_job_id: null,
      p_journey_island_id: null,
      p_target_vocab: [],
      p_session: { preview: initialPreviewState(now) },
      p_now: now.toISOString(),
    });
    if (thread?.id) {
      await deps.rpc("sms_record_thread_outbound", {
        p_thread_id: thread.id,
        p_message_id: sent.messageId,
        p_metadata: { kind: "preview" },
        p_patch: {},
        p_now: now.toISOString(),
      });
    }
  } catch (error) {
    logSmsError("preview thread bookkeeping failed", error);
  }
  return { status: "sent", messageId: sent.messageId };
}
