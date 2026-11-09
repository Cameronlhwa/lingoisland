import { SMS_LIMITS } from "../config";
import { logSmsError } from "../log";
import {
  ALREADY_ON_MESSAGE,
  fewerTextsMessage,
  KEEP_TEXTS_MESSAGE,
  NO_PREVIOUS_MESSAGE,
  PAUSED_BY_TEXT_MESSAGE,
  RESUME_OFFER,
  RESUMED_BY_TEXT_MESSAGE,
  SUPPORT_MESSAGE,
  usageExhaustedMessage,
  usageWarningMessage,
} from "../messages";
import { sendTrackedSms, type OutboundKind, type TrackedSendResult } from "../outbound";
import { isE164 } from "../phone";
import { consumeSmsRateLimits } from "../rateLimit";
import { estimateSmsSegments } from "../segments";
import { segmentLimitForCountry } from "../countries";
import type { HuahuaTurnInput, TurnCommand } from "./ai";
import { parseCommand, type ParsedCommand } from "./commands";
import { cleanModelText, composeSms, pinyinFor } from "./compose";
import { clock, loadHuahuaContext, meterFor, type HuahuaContext, type HuahuaDeps } from "./context";
import { getPersona } from "./personas";
import { crossedWarning, summarizeUsage } from "./plans";
import { classifyInboundSafety, CREDENTIALS_MESSAGE, crisisMessage, ensureAiDisclosure } from "./safety";
import { effectiveLevel, supportFor, type LanguageMode } from "./scaffolding";
import { effectiveOpenersPerWeek, reducedFrequency } from "./schedule";
import { fallbackReply } from "./fallbacks";
import { writingSystemConverter } from "./openers";
import { advancePreview, isPreviewOpen, loadPreviewProfile, previewPreferencePatch, readPreviewState, type PreviewState } from "./preview";
import { produceTurn } from "./turn";
import { buildWordSignals, type ComfortSignal, type Vocab } from "./wordComfort";

export const THREAD_STALE_SECONDS = 6 * 60 * 60;
const HISTORY_LIMIT = 12;

type ThreadSession = {
  persona_menu?: boolean;
  pinyin?: boolean;
  translation?: boolean;
  language?: LanguageMode;
  difficulty?: number;
  correction?: "conversation_only" | "coach";
  preview?: PreviewState;
};

type Thread = {
  id: string;
  origin: string;
  inbound_count: number;
  outbound_count: number;
  conversation_state: string;
  session: ThreadSession;
  target_vocab: Vocab[];
  journey_island_id: string | null;
};

type AttachResult = {
  thread: Thread;
  already_attached: boolean;
  control_sent_at: string | null;
};

type LastOutbound = {
  id: string;
  kind: string;
  body: string;
  metadata: { pinyin?: string | null; translation?: string | null; target_vocab?: Vocab[] } | null;
} | null;

export type InboundContact = {
  id: string;
  user_id: string;
  status: string;
  display_name: string | null;
  paused_reason?: string | null;
};

type Turnout = {
  deps: HuahuaDeps;
  ctx: HuahuaContext;
  contact: InboundContact;
  thread: Thread;
  inboundId: string;
  body: string;
  from?: string;
  now: Date;
};

function idempotencyKey(t: Turnout) {
  return `reply:${t.inboundId}`;
}

async function updateThread(t: Turnout, messageId: string | null, metadata: Record<string, unknown> | null, patch: Record<string, unknown>) {
  try {
    await t.deps.rpc("sms_record_thread_outbound", {
      p_thread_id: t.thread.id,
      p_message_id: messageId,
      p_metadata: metadata,
      p_patch: patch,
      p_now: t.now.toISOString(),
    });
  } catch (error) {
    logSmsError("thread update failed", error);
  }
}

/** Account-control and safety texts: never metered, never blocked by the allowance. */
async function sendExempt(t: Turnout, kind: OutboundKind, body: string, metadata: Record<string, unknown> | null = null) {
  const sent = await sendTrackedSms(t.deps, {
    contactId: t.contact.id,
    idempotencyKey: idempotencyKey(t),
    kind,
    requireActive: true,
    from: t.from,
    body,
  });
  if (sent.status === "sent") await updateThread(t, sent.messageId, metadata, {});
  return sent;
}

function outcomeOf(prefix: string, sent: TrackedSendResult) {
  if (sent.status === "sent") return prefix;
  if (sent.status === "skipped") return `${prefix}_skipped_${sent.reason}`;
  if (sent.status === "blocked") return "allowance_exhausted";
  return `${prefix}_failed`;
}

async function applySignals(t: Turnout, signals: ReturnType<typeof buildWordSignals>) {
  if (signals.length === 0) return;
  try {
    await t.deps.rpc("sms_apply_word_signals", {
      p_user_id: t.ctx.userId,
      p_signals: signals,
      p_now: t.now.toISOString(),
    });
  } catch (error) {
    logSmsError("word comfort update failed", error);
  }
}

async function sendUsageNotice(t: Turnout, notice: "warned" | "exhausted_notice") {
  const claimed = await t.deps.rpc<{ claimed: boolean }>("sms_usage_claim_notice", {
    p_user_id: t.ctx.userId,
    p_period_start: t.ctx.period.start.toISOString(),
    p_notice: notice,
  });
  if (!claimed?.claimed) return;
  const summary = summarizeUsage(t.ctx.plan, 0, t.ctx.period.end);
  const body =
    notice === "warned"
      ? usageWarningMessage(summary.resetsAt, t.ctx.timezone)
      : usageExhaustedMessage(t.ctx.plan.key, summary.resetsAt, t.ctx.timezone);
  await sendTrackedSms(t.deps, {
    contactId: t.contact.id,
    idempotencyKey: `notice:${notice}:${t.ctx.userId}:${t.ctx.period.start.toISOString()}`,
    kind: "notice",
    requireActive: true,
    from: t.from,
    body,
  });
}

async function afterMeteredSend(t: Turnout, sent: TrackedSendResult) {
  if (sent.status === "blocked") {
    await sendUsageNotice(t, "exhausted_notice");
  } else if (sent.status === "sent" && sent.usage && crossedWarning(t.ctx.plan, sent.usage.usedBefore, sent.usage.used)) {
    await sendUsageNotice(t, "warned");
  }
}

async function handleAccountCommand(t: Turnout, parsed: ParsedCommand): Promise<string | null> {
  const { command } = parsed;
  const rpc = t.deps.rpc;
  switch (command.type) {
    case "pause": {
      await rpc("sms_set_paused", { p_user_id: t.ctx.userId, p_paused: true });
      return outcomeOf("paused_by_text", await sendExempt(t, "notice", PAUSED_BY_TEXT_MESSAGE));
    }
    case "resume": {
      if (t.contact.status !== "paused") {
        return outcomeOf("already_on", await sendExempt(t, "notice", ALREADY_ON_MESSAGE));
      }
      await rpc("sms_set_paused", { p_user_id: t.ctx.userId, p_paused: false });
      return outcomeOf("resumed_by_text", await sendExempt(t, "notice", RESUMED_BY_TEXT_MESSAGE));
    }
    case "keep":
      return outcomeOf("kept_texts", await sendExempt(t, "notice", KEEP_TEXTS_MESSAGE));
    case "support":
      return outcomeOf("support_sent", await sendExempt(t, "notice", SUPPORT_MESSAGE));
    case "less": {
      const next = reducedFrequency(effectiveOpenersPerWeek(t.ctx.preferences));
      await rpc("sms_reduce_frequency", { p_user_id: t.ctx.userId, p_openers_per_week: next, p_now: t.now.toISOString() });
      return outcomeOf("fewer_texts", await sendExempt(t, "notice", fewerTextsMessage(next)));
    }
    case "persona": {
      const allowed = t.ctx.plan.personas.includes(command.persona);
      if (allowed) {
        await rpc("sms_update_preferences", { p_user_id: t.ctx.userId, p_patch: { persona: command.persona } });
      }
      await updateThread(t, null, null, { session: { persona_menu: false } });
      const persona = getPersona(allowed ? command.persona : t.ctx.preferences.persona);
      const body = allowed
        ? `好！Got it, I'll be your ${persona.label.toLowerCase()}. You can change this anytime on the Huahua page. 我们开始吧！`
        : `Right now I'm your ${persona.label.toLowerCase()}. 我们聊聊吧！How's your day going?`;
      return outcomeOf(allowed ? "persona_set" : "persona_unavailable", await sendExempt(t, "persona", body));
    }
    case "correction": {
      if (parsed.persistent) {
        await rpc("sms_update_preferences", { p_user_id: t.ctx.userId, p_patch: { correction_mode: command.mode } });
      }
      await updateThread(t, null, null, { session: { correction: command.mode } });
      const lasting = parsed.persistent ? " from now on" : " for this chat";
      const body =
        command.mode === "conversation_only"
          ? `好的！No more corrections${lasting}. Text "correct me" anytime to turn them back on.`
          : `好的！I'll point out mistakes and explain them${lasting}.`;
      return outcomeOf("correction_updated", await sendExempt(t, "notice", body));
    }
    case "language": {
      if (parsed.persistent) {
        await rpc("sms_update_preferences", {
          p_user_id: t.ctx.userId,
          p_patch: { scaffolding: command.mode === "english" ? "more" : "less" },
        });
      }
      await updateThread(t, null, null, {
        session: command.mode === "english" ? { language: "english" } : { language: "chinese", pinyin: false, translation: false },
      });
      const body =
        command.mode === "english"
          ? "OK! I'll add more English to help. 我们继续吧！"
          : "好的！我们只说中文吧。";
      return outcomeOf("language_updated", await sendExempt(t, "notice", body));
    }
    default:
      return null;
  }
}

/** pinyin / translate for Huahua's last text, from stored structured output. */
async function handleSupportCommand(t: Turnout, parsed: ParsedCommand, type: "pinyin" | "translate"): Promise<string | null> {
  const last = await t.deps.rpc<LastOutbound>("sms_last_outbound", { p_contact_id: t.contact.id });
  if (!last) return outcomeOf("no_previous_message", await sendExempt(t, "notice", NO_PREVIOUS_MESSAGE));

  const sessionPatch = type === "pinyin" ? { pinyin: true } : { translation: true };
  if (parsed.persistent) {
    await t.deps.rpc("sms_update_preferences", { p_user_id: t.ctx.userId, p_patch: { scaffolding: "more" } });
  }
  await updateThread(t, null, null, { session: sessionPatch });

  const firstLine = last.body.split("\n")[0] ?? last.body;
  let text: string | null = null;
  if (type === "pinyin") {
    text = last.metadata?.pinyin || pinyinFor(firstLine) || null;
  } else {
    text = last.metadata?.translation ?? null;
  }
  if (!text) return null; // Ask the model (e.g. no stored translation).

  const sent = await sendTrackedSms(t.deps, {
    contactId: t.contact.id,
    idempotencyKey: idempotencyKey(t),
    kind: "command",
    requireActive: true,
    from: t.from,
    meter: meterFor(t.ctx),
    body: type === "pinyin" ? `${firstLine}\n${text}` : `${firstLine}\n(${text})`,
  });
  if (sent.status === "sent") {
    await updateThread(t, sent.messageId, last.metadata, {});
    await applySignals(
      t,
      buildWordSignals({
        targetVocab: last.metadata?.target_vocab ?? [],
        learnerText: t.body,
        commandSignal: type === "pinyin" ? "requested_pinyin" : "requested_translation",
      }),
    );
  }
  await afterMeteredSend(t, sent);
  return outcomeOf(type === "pinyin" ? "pinyin_sent" : "translation_sent", sent);
}

async function modelTurn(
  t: Turnout,
  options: { command?: TurnCommand; commandSignal?: ComfortSignal | null; session: ThreadSession },
) {
  const { ctx, thread, deps } = t;
  const session = options.session;
  const level = effectiveLevel(ctx.level, session.difficulty ?? 0);
  const support = supportFor(level, ctx.preferences.scaffolding, session);
  const maxSegments = segmentLimitForCountry(ctx.countryCode);
  const history =
    (await deps.rpc<Array<{ direction: "inbound" | "outbound"; body: string }>>("sms_get_conversation", {
      p_contact_id: t.contact.id,
      p_until_message_id: t.inboundId,
      p_limit: HISTORY_LIMIT,
    })) ?? [];

  const input: HuahuaTurnInput = {
    mode: options.command ? "command" : "reply",
    command: options.command,
    learnerName: t.contact.display_name || "Learner",
    level,
    persona: ctx.plan.personas.includes(ctx.preferences.persona) ? ctx.preferences.persona : "friendly_friend",
    correctionMode: session.correction ?? ctx.preferences.correction_mode,
    support: { pinyin: support.includePinyin, translation: support.includeTranslation },
    language: session.language ?? "balanced",
    history,
    targetVocab: thread.target_vocab ?? [],
    facts: [],
    exchangeCount: Math.max(thread.inbound_count - 1, 0),
    maxChars: maxSegments * 60,
  };

  const captured: {
    value: { turn: Awaited<ReturnType<typeof produceTurn>> } | null;
  } = { value: null };
  const sent = await sendTrackedSms(deps, {
    contactId: t.contact.id,
    idempotencyKey: idempotencyKey(t),
    kind: options.command ? "command" : "reply",
    requireActive: true,
    from: t.from,
    meter: meterFor(ctx),
    body: async () => {
      const result = await produceTurn(deps.generateTurn, input, {
        fallback: fallbackReply(level),
        timeoutMs: deps.turnTimeoutMs,
        allowFallback: async () => {
          const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
            { name: "fallback:contact:hour", identifier: t.contact.id, ...SMS_LIMITS.fallbackPerContactHour },
          ]);
          return limit.allowed;
        },
      });
      if (result.turn.safety === "crisis") {
        captured.value = { turn: result };
        return { body: crisisMessage(ctx.countryCode), exempt: true };
      }
      const composed = composeSms({
        message: ensureAiDisclosure(cleanModelText(result.turn.message), t.body),
        pinyin: result.turn.pinyin,
        translation: result.turn.translation,
        includePinyin: support.includePinyin,
        includeTranslation: support.includeTranslation,
        maxSegments,
        beginner: level <= 2,
        convert: writingSystemConverter(ctx.preferences),
      });
      let body = composed.body;
      if (t.contact.status === "paused") {
        const withOffer = `${body}\n${RESUME_OFFER}`;
        if (estimateSmsSegments(withOffer).segments <= maxSegments + 1) body = withOffer;
      }
      captured.value = { turn: result };
      return body;
    },
  });

  const done = captured.value;
  if (sent.status === "sent" && done) {
    const turn = done.turn.turn;
    const targetVocab = turn.targetVocab.length > 0 ? turn.targetVocab : thread.target_vocab ?? [];
    await updateThread(
      t,
      sent.messageId,
      {
        pinyin: turn.pinyin ?? pinyinFor(turn.message),
        translation: turn.translation,
        target_vocab: targetVocab,
        correction: turn.correction,
        safety: turn.safety,
        source: done.turn.source,
        difficulty: turn.detectedDifficulty,
      },
      {
        conversation_state: turn.conversationState,
        target_vocab: targetVocab,
        close: turn.conversationState === "closed" || turn.suggestedNextAction === "end",
      },
    );
    if (turn.safety === "safe") {
      await applySignals(
        t,
        buildWordSignals({
          targetVocab: thread.target_vocab ?? [],
          learnerText: t.body,
          modelUpdates: done.turn.source === "model" ? turn.wordComfortUpdates : undefined,
          commandSignal: options.commandSignal,
          journeyIslandId: thread.journey_island_id,
          source: thread.journey_island_id ? "journey" : "conversation",
        }),
      );
    }
  }
  await afterMeteredSend(t, sent);
  if (sent.status === "sent") {
    return done?.turn.turn.safety === "crisis" ? "crisis_support_sent" : options.command ? `${options.command}_sent` : "replied";
  }
  if (sent.status === "skipped") return `reply_skipped_${sent.reason}`;
  if (sent.status === "blocked") return "allowance_exhausted";
  return "reply_failed";
}

/**
 * One step of the free onboarding preview. Unmetered and outside the AI rate
 * limits; the preview itself caps the exchange at a few messages. State only
 * advances once the reply is actually sent, so a retry repeats the same step.
 */
async function handlePreviewTurn(t: Turnout, state: PreviewState) {
  const profile = await loadPreviewProfile(t.deps, t.ctx.userId);
  const step = advancePreview(state, t.body, profile, t.now);
  if (!step.reply) return "preview_ignored";
  if (step.state.stage === "done") {
    const patch = previewPreferencePatch(step.state);
    if (Object.keys(patch).length > 0) {
      await t.deps.rpc("sms_update_preferences", { p_user_id: t.ctx.userId, p_patch: patch });
    }
  }
  const sent = await sendTrackedSms(t.deps, {
    contactId: t.contact.id,
    idempotencyKey: idempotencyKey(t),
    kind: "preview",
    requireActive: true,
    from: t.from,
    body: step.reply.body,
    quickReplies: step.reply.quickReplies,
  });
  if (sent.status === "sent") {
    await updateThread(t, sent.messageId, { kind: "preview", stage: step.state.stage }, {
      session: { preview: step.state },
      close: step.finished,
    });
  }
  return outcomeOf(`preview_${step.outcome}`, sent);
}

/**
 * Replies to a learner's text. Order: safety, commands, rate limits, then the
 * model. Runs from the webhook background task and the retry cron, so every
 * step is idempotent (one reply per inbound message).
 */
export async function respondToInbound(
  deps: HuahuaDeps,
  input: { contact: InboundContact; inboundId: string; body: string; ownNumber: string },
) {
  const now = clock(deps);
  const ctx = await loadHuahuaContext(deps, input.contact.user_id, now);
  const attach = await deps.rpc<AttachResult | null>("sms_attach_inbound", {
    p_contact_id: input.contact.id,
    p_message_id: input.inboundId,
    p_now: now.toISOString(),
    p_stale_seconds: THREAD_STALE_SECONDS,
  });
  if (!attach?.thread) return "reply_missing_thread";

  const t: Turnout = {
    deps,
    ctx,
    contact: input.contact,
    thread: attach.thread,
    inboundId: input.inboundId,
    body: input.body,
    from: isE164(input.ownNumber) ? input.ownNumber : undefined,
    now,
  };
  const session: ThreadSession = { ...(attach.thread.session ?? {}) };

  const safety = classifyInboundSafety(input.body);
  if (safety === "crisis") return outcomeOf("crisis_support_sent", await sendExempt(t, "safety", crisisMessage(ctx.countryCode)));
  if (safety === "credentials") return outcomeOf("credentials_warning_sent", await sendExempt(t, "safety", CREDENTIALS_MESSAGE));

  const parsed = parseCommand(input.body, {
    personaMenuOpen: session.persona_menu === true,
    controlPending: Boolean(attach.control_sent_at),
  });

  // Paused after unanswered invitations: any reply other than PAUSE turns practice back on.
  if (input.contact.status === "paused" && input.contact.paused_reason === "no_response" && parsed?.command.type !== "pause") {
    await deps.rpc("sms_set_paused", { p_user_id: ctx.userId, p_paused: false });
    t.contact = { ...t.contact, status: "active", paused_reason: null };
    if (parsed?.command.type === "resume") {
      return outcomeOf("resumed_by_text", await sendExempt(t, "notice", RESUMED_BY_TEXT_MESSAGE));
    }
  }

  if (parsed) {
    const handled = await handleAccountCommand(t, parsed);
    if (handled) return handled;
  }

  const preview = attach.thread.origin === "preview" ? readPreviewState(session.preview) : null;
  if (isPreviewOpen(preview)) return handlePreviewTurn(t, preview);

  const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
    { name: "ai:contact:hour", identifier: input.contact.id, ...SMS_LIMITS.aiRepliesPerContactHour },
    { name: "ai:contact:day", identifier: input.contact.id, ...SMS_LIMITS.aiRepliesPerContactDay },
  ]);
  if (!limit.allowed) return "ai_rate_limited";

  if (session.persona_menu) {
    session.persona_menu = false;
    await updateThread(t, null, null, { session: { persona_menu: false } });
  }

  if (parsed) {
    const { command } = parsed;
    if (command.type === "pinyin" || command.type === "translate") {
      const handled = await handleSupportCommand(t, parsed, command.type);
      if (handled) return handled;
      return modelTurn(t, { command: "translate", commandSignal: "requested_translation", session: { ...session, translation: true } });
    }
    if (command.type === "easier" || command.type === "harder") {
      const offset = Math.max(-2, Math.min(2, (session.difficulty ?? 0) + (command.type === "easier" ? -1 : 1)));
      if (parsed.persistent) {
        await deps.rpc("sms_update_preferences", {
          p_user_id: ctx.userId,
          p_patch: { scaffolding: command.type === "easier" ? "more" : "less" },
        });
      }
      await updateThread(t, null, null, { session: { difficulty: offset } });
      return modelTurn(t, {
        command: command.type,
        commandSignal: command.type === "easier" ? "requested_easier" : null,
        session: { ...session, difficulty: offset },
      });
    }
    if (command.type === "hint" || command.type === "explain") {
      return modelTurn(t, { command: command.type, session });
    }
  }

  return modelTurn(t, { session });
}
