"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardBaseClass } from "@/components/app/ui/styles";
import SmsPhoneSetup from "@/components/sms/SmsPhoneSetup";
import HuahuaStylePicker from "@/components/sms/HuahuaStylePicker";
import { huahuaApi } from "@/components/sms/huahuaApi";
import { useAnalytics } from "@/lib/posthog/client";
import type {
  HuahuaOverview,
  HuahuaOverviewResponse,
  HuahuaPreferencesPatch,
  HuahuaThreadSummary,
  HuahuaWord,
} from "@/lib/sms/huahua/publicTypes";
import type { SmsPhoneState } from "@/lib/sms/phoneState";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 14 }, (_, i) => 8 + i); // 8:00–21:00
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const DANGER_BUTTON =
  "inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60";
const SELECT = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none";

function formatHour(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const suffix = hour >= 12 ? "pm" : "am";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}${suffix}`;
}

function formatDate(iso: string | null, timeZone?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone });
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

function timeZones(current: string) {
  const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] };
  const zones = intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
  return zones.includes(current) ? zones : [current, ...zones];
}

function withoutNulls(patch: HuahuaPreferencesPatch) {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null)) as Partial<
    HuahuaOverview["preferences"]
  >;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className={`${cardBaseClass} flex flex-col gap-4 p-5 sm:p-6`}>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description ? <p className="text-sm text-gray-600">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function WordList({ title, words, empty }: { title: string; words: HuahuaWord[]; empty: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {words.length === 0 ? (
        <p className="text-xs text-gray-500">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {words.map((word) => (
            <li
              key={word.word}
              className="flex flex-col rounded-lg border border-gray-200 bg-white px-3 py-1.5"
              title={word.english ?? undefined}
            >
              <span className="text-base text-gray-900">{word.word}</span>
              {word.pinyin || word.english ? (
                <span className="text-[11px] text-gray-500">
                  {[word.pinyin, word.english].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ThreadItem({ thread, timeZone }: { thread: HuahuaThreadSummary; timeZone: string }) {
  const [open, setOpen] = useState(false);
  const preview = thread.messages[thread.messages.length - 1]?.body ?? "";
  return (
    <li className="rounded-xl border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-gray-500">
            {formatDate(thread.started_at, timeZone)}
            {thread.origin === "opener" ? " · 华华 started" : thread.origin === "inbound" ? " · You started" : ""}
          </span>
          <span className="truncate text-sm text-gray-900">{preview}</span>
        </span>
        <span className="text-xs text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <ol className="flex flex-col gap-2 border-t border-gray-100 px-4 py-3">
          {thread.messages.map((message, index) => (
            <li
              key={`${message.at}-${index}`}
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                message.direction === "inbound"
                  ? "self-end bg-gray-900 text-white"
                  : "self-start bg-gray-100 text-gray-900"
              }`}
            >
              {message.body}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function UsageMeter({ overview }: { overview: HuahuaOverview }) {
  const { usage, plan, preferences } = overview;
  const percent = Math.round(usage.ratio * 100);
  const label = plan.subscribed ? "practice texts this month" : "free practice texts";
  return (
    <div className="flex flex-col gap-2" data-testid="huahua-usage">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm text-gray-900">
          <span className="font-semibold">{usage.used}</span> of {usage.allowance} {label}
        </p>
        {usage.resetsAt ? (
          <p className="text-xs text-gray-500">Resets {formatDate(usage.resetsAt, preferences.timezone)}</p>
        ) : null}
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Texting allowance used"
      >
        <div
          className={`h-full rounded-full ${usage.state === "exhausted" ? "bg-red-500" : usage.state === "warning" ? "bg-amber-500" : "bg-gray-900"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {usage.state === "exhausted" ? (
        <p className="text-xs text-gray-700">
          {plan.subscribed
            ? "You've used this month's practice texts. 华华 will be back when they reset. Replies to STOP and HELP always work."
            : "You've used your free practice texts. Replies to STOP and HELP always work."}
        </p>
      ) : usage.state === "warning" ? (
        <p className="text-xs text-gray-700">You&apos;ve used most of your practice texts{plan.subscribed ? " for this month" : ""}.</p>
      ) : null}
      {usage.showUpgrade ? (
        <a href="/pricing" className="text-xs font-medium text-gray-900 underline underline-offset-2">
          See plans with more texts
        </a>
      ) : null}
    </div>
  );
}

function ScheduleEditor({
  overview,
  onChange,
}: {
  overview: HuahuaOverview;
  onChange: (patch: HuahuaPreferencesPatch) => void;
}) {
  const prefs = overview.preferences;
  const window = prefs.deliveryWindows[0] ?? { start: 18 * 60, end: 21 * 60 };
  const zones = useMemo(() => timeZones(prefs.timezone), [prefs.timezone]);

  const toggleDay = (day: number) => {
    const next = prefs.preferredDays.includes(day)
      ? prefs.preferredDays.filter((value) => value !== day)
      : [...prefs.preferredDays, day];
    onChange({ preferredDays: next });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="huahua-days" className="text-sm font-medium text-gray-900">
          How many days a week do you want to practice?
        </label>
        <select
          id="huahua-days"
          className={`${SELECT} max-w-[10rem]`}
          value={prefs.daysPerWeek}
          onChange={(event) => onChange({ daysPerWeek: Number(event.target.value), openersPerWeek: null })}
        >
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <option key={days} value={days}>
              {days} {days === 1 ? "day" : "days"}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-600" data-testid="huahua-frequency">
          华华 will start about {prefs.openersPerWeek} {prefs.openersPerWeek === 1 ? "conversation" : "conversations"} a
          week, at most one a day. You can text anytime.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-gray-900">Preferred days (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, day) => {
            const selected = prefs.preferredDays.includes(day);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={selected}
                      onClick={() => toggleDay(day)}
                className={`min-w-[3rem] rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selected ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-900">Best time to text you</span>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="huahua-window-start" className="sr-only">
            From
          </label>
          <select
            id="huahua-window-start"
            className={SELECT}
            value={window.start}
              onChange={(event) => {
              const start = Number(event.target.value);
              onChange({ deliveryWindows: [{ start, end: Math.max(window.end, start + 60) }] });
            }}
          >
            {HOURS.slice(0, -1).map((hour) => (
              <option key={hour} value={hour * 60}>
                {formatHour(hour * 60)}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-600">to</span>
          <label htmlFor="huahua-window-end" className="sr-only">
            Until
          </label>
          <select
            id="huahua-window-end"
            className={SELECT}
            value={window.end}
              onChange={(event) => onChange({ deliveryWindows: [{ start: window.start, end: Number(event.target.value) }] })}
          >
            {HOURS.slice(1)
              .filter((hour) => hour * 60 > window.start)
              .map((hour) => (
                <option key={hour} value={hour * 60}>
                  {formatHour(hour * 60)}
                </option>
              ))}
          </select>
        </div>
        <p className="text-xs text-gray-500">华华 never texts first before 8am or after 9pm.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="huahua-timezone" className="text-sm font-medium text-gray-900">
          Time zone
        </label>
        <select
          id="huahua-timezone"
          className={`${SELECT} max-w-xs`}
          value={prefs.timezone}
          onChange={(event) => onChange({ timezone: event.target.value })}
        >
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={prefs.autoAdjust}
          onChange={(event) => onChange({ autoAdjust: event.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-200"
        />
        <span>Text me less often when I&apos;m busy and don&apos;t reply.</span>
      </label>
    </div>
  );
}

export default function HuahuaSettings() {
  const { captureEvent } = useAnalytics();
  const [data, setData] = useState<HuahuaOverviewResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteWords, setDeleteWords] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    const result = await huahuaApi.load();
    if (result.ok) setData(result.data);
    else setLoadError(result.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 2000);
    return () => window.clearTimeout(id);
  }, [saved]);

  const requestRef = useRef(0);
  const update = async (patch: HuahuaPreferencesPatch) => {
    const previous = data;
    const requestId = ++requestRef.current;
    setError(null);
    setData((current) =>
      current && !("unavailable" in current)
        ? { ...current, preferences: { ...current.preferences, ...withoutNulls(patch) } }
        : current,
    );
    const result = await huahuaApi.update(patch);
    if (requestId !== requestRef.current) return;
    if (result.ok) {
      setData(result.data);
      setSaved(true);
      captureEvent("huahua_settings_changed", { fields: Object.keys(patch) });
    } else {
      setData(previous);
      setError(result.error);
    }
  };

  const removeHistory = async () => {
    setSaving(true);
    setError(null);
    const result = await huahuaApi.deleteHistory(deleteWords);
    setSaving(false);
    if (result.ok) {
      setData(result.data);
      setConfirmDelete(false);
      captureEvent("huahua_history_deleted", { includeWords: deleteWords });
    } else {
      setError(result.error);
    }
  };

  const phoneStatusRef = useRef<string | null | undefined>(undefined);
  const handlePhoneState = useCallback(
    (state: SmsPhoneState) => {
      const status = state.contact?.status ?? null;
      const changed = phoneStatusRef.current !== undefined && phoneStatusRef.current !== status;
      phoneStatusRef.current = status;
      setData((current) => (current ? { ...current, phone: state } : current));
      if (changed) void load();
    },
    [load],
  );

  if (loadError) {
    return (
      <div className={`${cardBaseClass} flex flex-col items-start gap-3 p-6`} role="alert">
        <p className="text-sm text-gray-900">Couldn&apos;t load your texting settings.</p>
        <p className="text-xs text-gray-600">{loadError}</p>
        <button type="button" className={SECONDARY_BUTTON} onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading texting settings">
        {[0, 1, 2].map((key) => (
          <div key={key} className={`${cardBaseClass} h-36 animate-pulse bg-gray-50`} />
        ))}
      </div>
    );
  }

  if ("unavailable" in data) {
    return (
      <Section title="Texting practice" description="Texting with 华华 isn't available right now. Check back soon.">
        <span />
      </Section>
    );
  }

  const overview = data;
  const contact = overview.phone.contact;
  const connected = Boolean(contact && contact.status !== "unverified");

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {saved ? "Saved" : ""}
      </p>

      <Section
        title="Your number"
        description="华华 is an AI practice partner. Pause, change, or disconnect your number anytime."
      >
        <SmsPhoneSetup source="account_settings" onStateChange={handlePhoneState} onVerified={() => void load()} />
      </Section>

      {connected ? (
        <>
          <Section title="Texting style">
            <HuahuaStylePicker
              persona={overview.preferences.persona}
              correctionMode={overview.preferences.correctionMode}
              allowedPersonas={overview.plan.personas}
              onChange={(patch) => void update(patch)}
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-900">Pinyin and English help</span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pinyin and English help">
                {(
                  [
                    ["auto", "Match my level"],
                    ["more", "More help"],
                    ["less", "Mostly Chinese"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={overview.preferences.scaffolding === value}
                    onClick={() => void update({ scaffolding: value })}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      overview.preferences.scaffolding === value
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                You can also text &ldquo;pinyin&rdquo;, &ldquo;translate&rdquo;, &ldquo;easier&rdquo;, or &ldquo;hint&rdquo; anytime.
              </p>
            </div>
          </Section>

          {overview.plan.proactiveOpeners ? (
            <Section
              title="Schedule"
              description="When 华华 starts a conversation, it's about what you've been learning, usually right after a Journey lesson."
            >
              <ScheduleEditor overview={overview} onChange={(patch) => void update(patch)} />
            </Section>
          ) : null}

          <Section title="Usage">
            <UsageMeter overview={overview} />
          </Section>

          <Section
            title="Words from your chats"
            description="Based on how you use words when texting. This doesn't change your quizzes or streaks."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <WordList
                title="Needs more practice"
                words={overview.words.needsPractice}
                empty="Words you find tricky in chats will show up here."
              />
              <WordList
                title="Getting comfortable"
                words={overview.words.gettingComfortable}
                empty="Words you use with confidence will show up here."
              />
            </div>
          </Section>

          <Section title="Recent conversations" description="Message text is kept for 90 days.">
            {overview.threads.length === 0 ? (
              <p className="text-sm text-gray-600">No conversations yet. Text 华华 to say hi!</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {overview.threads.map((thread) => (
                  <ThreadItem key={thread.id} thread={thread} timeZone={overview.preferences.timezone} />
                ))}
              </ul>
            )}
            {confirmDelete ? (
              <div className="flex flex-col gap-3 rounded-xl border border-red-100 bg-red-50/40 p-4">
                <p className="text-sm text-gray-900">Delete your texting history? This can&apos;t be undone.</p>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={deleteWords}
                    onChange={(event) => setDeleteWords(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                  />
                  <span>Also clear the word lists above</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={DANGER_BUTTON} disabled={saving} onClick={() => void removeHistory()}>
                    {saving ? "Deleting…" : "Delete history"}
                  </button>
                  <button type="button" className={SECONDARY_BUTTON} disabled={saving} onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="self-start text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
                onClick={() => setConfirmDelete(true)}
              >
                Delete texting history
              </button>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
