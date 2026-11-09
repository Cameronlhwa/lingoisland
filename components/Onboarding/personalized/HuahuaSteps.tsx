"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import { huahuaPrefsFor, isSimulatedMessaging, planFor, provisionalLevel, type PreviewStatus } from "@/lib/onboarding/personalized/flow";
import { getInterest } from "@/lib/onboarding/personalized/goals";
import {
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  formatMinuteOfDay,
  isValidTimeZone,
  minuteToTimeValue,
  timeValueToMinute,
  type CorrectionChoice,
  type FrequencyChoice,
  type OnboardingHuahuaPrefs,
} from "@/lib/onboarding/personalized/huahua";
import type { SupportStyle } from "@/lib/onboarding/personalized/plan";
import { browserTimeZone } from "@/lib/onboarding/personalized/storage";
import {
  advancePreview,
  initialPreviewState,
  previewIntro,
  type PreviewProfile,
  type PreviewState,
} from "@/lib/sms/huahua/previewScript";
import type { QuickReply } from "@/lib/sms/types";
import type { StepProps } from "./stepTypes";
import {
  CARD_BORDER,
  ChipButton,
  FieldError,
  GREEN,
  LiveRegion,
  MUTED,
  NAVY,
  PrimaryButton,
  SKY_PALE,
  StepFrame,
  TextButton,
} from "./ui";

const INPUT = "min-h-[44px] rounded-xl border bg-white px-3 py-2 text-[15px] focus:outline-none focus-visible:ring-2";

function timeZones(current: string): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const list = typeof intl.supportedValuesOf === "function" ? intl.supportedValuesOf("timeZone") : [];
  return list.includes(current) ? list : [current, ...list];
}

export function HuahuaPrefsStep({ state, next, back, progress, track }: StepProps) {
  const [prefs, setPrefs] = useState<OnboardingHuahuaPrefs>(() => huahuaPrefsFor(state.answers, browserTimeZone()));
  const [editingQuiet, setEditingQuiet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const simulated = isSimulatedMessaging(state.answers);
  const zones = useMemo(() => (editingQuiet ? timeZones(prefs.timezone) : []), [editingQuiet, prefs.timezone]);

  const set = <K extends keyof OnboardingHuahuaPrefs>(key: K, value: OnboardingHuahuaPrefs[K]) =>
    setPrefs((current) => ({ ...current, [key]: value }));

  const finish = () => {
    track(ONBOARDING_EVENTS.huahuaPreferencesCompleted, {
      writing_system: prefs.writingSystem,
      quiet_hours_default: prefs.quietStart === DEFAULT_QUIET_START && prefs.quietEnd === DEFAULT_QUIET_END,
    });
    next({ huahua: prefs });
  };

  const save = async () => {
    if (prefs.quietStart === prefs.quietEnd) {
      setError("Quiet hours need different start and end times.");
      return;
    }
    if (simulated || saveFailed) {
      finish();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding/huahua-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs, level: provisionalLevel(state.answers) }),
      });
      if (!response.ok) throw new Error("save_failed");
      finish();
    } catch {
      setSaveFailed(true);
      setError("We couldn’t save these to Huahua just now. You can continue and change them later in Account settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepFrame
      title="When should Huahua stay quiet?"
      subtitle="Huahua will ask how much help you want, how to correct you, and how often to text in your free chat next."
      progress={progress}
      onBack={back}
    >
      <section className="rounded-2xl p-4" style={{ background: SKY_PALE, border: `1px solid ${CARD_BORDER}` }} aria-labelledby="quiet-hours-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="quiet-hours-title" className="text-[15px] font-bold" style={{ color: NAVY }}>
            Quiet hours
          </h2>
          <TextButton className="!w-auto !min-h-[44px] px-2" onClick={() => setEditingQuiet((value) => !value)} aria-expanded={editingQuiet}>
            {editingQuiet ? "Done" : "Edit"}
          </TextButton>
        </div>
        <p className="mt-1 text-sm" style={{ color: NAVY }} data-testid="quiet-hours-summary">
          {formatMinuteOfDay(prefs.quietStart)} to {formatMinuteOfDay(prefs.quietEnd)} ({prefs.timezone.replace(/_/g, " ")})
        </p>
        <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
          Huahua won’t start a chat during these hours. If you message first, Huahua still replies.
        </p>
        {editingQuiet ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-semibold" style={{ color: NAVY }}>
              From
              <input
                type="time"
                className={INPUT}
                style={{ borderColor: CARD_BORDER }}
                value={minuteToTimeValue(prefs.quietStart)}
                onChange={(event) => {
                  const minute = timeValueToMinute(event.target.value);
                  if (minute !== null) set("quietStart", minute);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold" style={{ color: NAVY }}>
              Until
              <input
                type="time"
                className={INPUT}
                style={{ borderColor: CARD_BORDER }}
                value={minuteToTimeValue(prefs.quietEnd)}
                onChange={(event) => {
                  const minute = timeValueToMinute(event.target.value);
                  if (minute !== null) set("quietEnd", minute);
                }}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold" style={{ color: NAVY }}>
              Time zone
              {zones.length > 1 ? (
                <select className={INPUT} style={{ borderColor: CARD_BORDER }} value={prefs.timezone} onChange={(event) => set("timezone", event.target.value)}>
                  {zones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={INPUT}
                  style={{ borderColor: CARD_BORDER }}
                  defaultValue={prefs.timezone}
                  onBlur={(event) => {
                    if (isValidTimeZone(event.target.value)) set("timezone", event.target.value);
                  }}
                />
              )}
            </label>
          </div>
        ) : null}
      </section>

      <FieldError message={error} />
      <PrimaryButton className="mt-8" onClick={() => void save()} disabled={saving} data-testid="continue">
        {saving ? "Saving…" : saveFailed ? "Continue anyway" : "Save and continue"}
      </PrimaryButton>
    </StepFrame>
  );
}

type ChatLine = { id: string; from: "huahua" | "you"; body: string };

/** Preferences the learner chose in the preview chat. */
type ChatPrefs = { support: SupportStyle | null; correction: CorrectionChoice | null; frequency: FrequencyChoice | null };

const FREQUENCY_REPLIES: QuickReply[] = [
  { id: "2", title: "2 times" },
  { id: "3", title: "3 times" },
  { id: "5", title: "5 times" },
  { id: "7", title: "Every day" },
  { id: "auto", title: "Adjust automatically" },
];

const INTRO_REPLIES: QuickReply[] = [
  { id: "yes", title: "Let\u2019s do it" },
  { id: "not now", title: "Not now" },
];

function ChatWindow({ lines, label }: { lines: ChatLine[]; label: string }) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [lines.length]);
  return (
    <ul
      aria-label={label}
      className="flex max-h-[420px] flex-col gap-2 overflow-y-auto rounded-2xl p-3"
      style={{ background: SKY_PALE, border: `1px solid ${CARD_BORDER}` }}
      data-testid="preview-chat"
    >
      {lines.map((line) => (
        <li key={line.id} className={`flex ${line.from === "you" ? "justify-end" : "justify-start"}`}>
          <p
            className="max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-[15px] leading-snug"
            style={line.from === "you" ? { background: GREEN, color: "#fff" } : { background: "#fff", color: NAVY, border: `1px solid ${CARD_BORDER}` }}
          >
            <span className="sr-only">{line.from === "you" ? "You: " : "Huahua: "}</span>
            {line.body}
          </p>
        </li>
      ))}
      <li ref={endRef} aria-hidden />
    </ul>
  );
}

function withChatPrefs(base: OnboardingHuahuaPrefs, chat: ChatPrefs): OnboardingHuahuaPrefs {
  return {
    ...base,
    support: chat.support ?? base.support,
    correction: chat.correction ?? base.correction,
    frequency: chat.frequency ?? base.frequency,
  };
}

function previewProfile(state: StepProps["state"]): PreviewProfile {
  const plan = planFor(state.answers);
  const interests = [
    ...state.answers.interests.keys.map((key) => getInterest(key)?.label.toLowerCase()).filter((label): label is string => Boolean(label)),
    ...(state.answers.interests.custom ? [state.answers.interests.custom] : []),
  ];
  return { goalPhrase: plan.goalPhrase, interests, supportDefault: state.answers.huahua?.support ?? plan.defaultSupportStyle };
}

function SimulatedPreview({
  state,
  onFinished,
}: {
  state: StepProps["state"];
  onFinished: (status: PreviewStatus, prefs: ChatPrefs | null) => void;
}) {
  const profile = useMemo(() => previewProfile(state), [state]);
  const channel = state.answers.messaging.channel === "whatsapp" ? "whatsapp" : "sms";
  const [chat, setChat] = useState<PreviewState>(() => initialPreviewState(new Date()));
  const [lines, setLines] = useState<ChatLine[]>(() => [{ id: "intro", from: "huahua", body: previewIntro(profile, channel).body }]);
  const [replies, setReplies] = useState<QuickReply[]>(INTRO_REPLIES);
  const [draft, setDraft] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [finished, setFinished] = useState(false);

  const send = (text: string, shown: string) => {
    if (finished || !text.trim()) return;
    const step = advancePreview(chat, text, profile, new Date());
    const nextLines: ChatLine[] = [...lines, { id: `you-${lines.length}`, from: "you", body: shown }];
    if (step.reply) nextLines.push({ id: `hh-${lines.length}`, from: "huahua", body: step.reply.body });
    setLines(nextLines);
    setChat(step.state);
    setDraft("");
    setAnnouncement(step.reply ? `Huahua: ${step.reply.body}` : "");
    if (step.finished) {
      setFinished(true);
      setReplies([]);
      const declined = step.state.stage === "declined";
      const { support, correction, frequency } = step.state;
      onFinished(declined ? "declined" : "simulated", declined ? null : { support, correction, frequency });
      return;
    }
    setReplies(step.reply?.quickReplies ?? (step.state.stage === "frequency" ? FREQUENCY_REPLIES : []));
  };

  return (
    <div>
      <p className="mb-3 rounded-xl px-3 py-2 text-sm font-bold" style={{ background: "#FFF8E8", color: "#6B4A00", border: "1px dashed #C9A24A" }} data-testid="preview-simulation-label">
        Simulation. Nothing was sent.
      </p>
      <LiveRegion message={announcement} />
      <ChatWindow lines={lines} label="Simulated Huahua preview" />
      {replies.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Quick replies">
          {replies.map((reply) => (
            <ChipButton key={reply.id} onToggle={() => send(reply.id, reply.title)} testId={`preview-reply-${reply.id.replace(/\s+/g, "-")}`}>
              {reply.title}
            </ChipButton>
          ))}
        </div>
      ) : null}
      {!finished ? (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            send(draft, draft.trim());
          }}
        >
          <label htmlFor="preview-input" className="sr-only">
            Reply to Huahua
          </label>
          <input
            id="preview-input"
            value={draft}
            maxLength={160}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a reply"
            className={`${INPUT} min-w-0 flex-1`}
            style={{ borderColor: CARD_BORDER }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send reply"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50"
            style={{ background: GREEN }}
          >
            <Send size={18} aria-hidden />
          </button>
        </form>
      ) : null}
    </div>
  );
}

type RemoteMessage = { direction: "inbound" | "outbound"; body: string; at: string; status: string };

function LivePreview({
  initialStatus,
  onStatus,
}: {
  initialStatus: PreviewStatus;
  onStatus: (status: PreviewStatus, prefs?: ChatPrefs | null) => void;
}) {
  const [status, setStatus] = useState<PreviewStatus>(initialStatus);
  const [messages, setMessages] = useState<RemoteMessage[]>([]);
  const startedRef = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  const update = useCallback((next: PreviewStatus, prefs?: ChatPrefs | null) => {
    setStatus(next);
    onStatusRef.current(next, prefs);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (initialStatus === "sent" || initialStatus === "completed" || initialStatus === "declined") return;
    void fetch("/api/onboarding/huahua-preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { status?: string } | null;
        update(data?.status === "sent" || data?.status === "already_sent" ? "sent" : "unavailable");
      })
      .catch(() => update("unavailable"));
  }, [initialStatus, update]);

  useEffect(() => {
    if (status !== "sent") return;
    let cancelled = false;
    const poll = async () => {
      const response = await fetch("/api/onboarding/huahua-preview", { cache: "no-store" }).catch(() => null);
      const data = (await response?.json().catch(() => null)) as {
        thread: { stage: string } | null;
        preferences?: ChatPrefs | null;
        messages: RemoteMessage[];
      } | null;
      if (cancelled || !data) return;
      setMessages((data.messages ?? []).filter((message) => message.status !== "failed"));
      if (data.thread?.stage === "done") update("completed", data.preferences ?? null);
      else if (data.thread?.stage === "declined") update("declined");
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [status, update]);

  if (status === "unavailable") {
    return (
      <p className="rounded-xl p-3 text-sm" style={{ background: SKY_PALE, color: NAVY }} role="status" data-testid="preview-unavailable">
        We couldn’t start the preview right now. Huahua will still be ready once your plan is active.
      </p>
    );
  }

  const lines: ChatLine[] = messages.map((message, index) => ({
    id: `${message.at}-${index}`,
    from: message.direction === "inbound" ? "you" : "huahua",
    body: message.body,
  }));

  return (
    <div>
      <p className="mb-3 text-sm" style={{ color: NAVY }} role="status" data-testid="preview-live-status">
        {status === "not_started"
          ? "Starting your preview…"
          : status === "completed" || status === "declined"
            ? "Preview finished. Thanks for chatting with Huahua!"
            : "Huahua sent you a message. Reply on your phone and this page will follow along."}
      </p>
      {lines.length > 0 ? <ChatWindow lines={lines} label="Your Huahua preview conversation" /> : null}
    </div>
  );
}

export function HuahuaPreviewStep({ state, next, back, progress, track, update }: StepProps) {
  const simulated = isSimulatedMessaging(state.answers);
  const [status, setStatus] = useState<PreviewStatus>(state.answers.preview.status);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    track(ONBOARDING_EVENTS.previewStarted, { channel: state.answers.messaging.channel ?? undefined, simulated });
  }, [simulated, state.answers.messaging.channel, track]);

  const onStatus = (next: PreviewStatus, prefs?: ChatPrefs | null) => {
    setStatus(next);
    const huahua = prefs ? withChatPrefs(huahuaPrefsFor(state.answers, browserTimeZone()), prefs) : null;
    if (next === "completed" || next === "declined" || next === "simulated") {
      track(ONBOARDING_EVENTS.previewCompleted, {
        outcome: next,
        simulated,
        ...(huahua ? { support: huahua.support, correction: huahua.correction, frequency: huahua.frequency } : {}),
      });
    }
    if (next !== "simulated") update(huahua ? { preview: { status: next }, huahua } : { preview: { status: next } });
    else if (huahua) update({ huahua });
  };

  const done = status === "completed" || status === "declined" || status === "simulated" || status === "unavailable";

  return (
    <StepFrame
      title="Try a free chat with Huahua"
      subtitle="A few quick messages to set things up. This preview is free and doesn’t use your monthly texting allowance."
      progress={progress}
      onBack={back}
    >
      {simulated ? (
        <SimulatedPreview state={state} onFinished={onStatus} />
      ) : (
        <LivePreview initialStatus={state.answers.preview.status} onStatus={onStatus} />
      )}
      <PrimaryButton className="mt-6" onClick={() => next({ preview: { status: status === "not_started" ? "skipped" : status } })} data-testid="continue">
        {done ? "Continue" : "Continue to my plan"}
      </PrimaryButton>
    </StepFrame>
  );
}
