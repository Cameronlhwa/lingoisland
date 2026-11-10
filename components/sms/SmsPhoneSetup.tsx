"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAnalytics } from "@/lib/posthog/client";
import { interestSmsCountries } from "@/lib/sms/countries";
import { SMS_CONSENT_TEXT, SMS_CONSENT_VERSION, type SmsConsentSource } from "@/lib/sms/consent";
import type { SmsPhoneErrorBody, SmsPhoneState } from "@/lib/sms/phoneState";

type Props = {
  source: SmsConsentSource;
  /** Called whenever the server state changes (including first load). */
  onStateChange?: (state: SmsPhoneState) => void;
  /** Called after a number is verified and active. */
  onVerified?: (state: SmsPhoneState) => void;
  /** "deferred": skip the generic welcome text (onboarding sends its own preview). */
  welcome?: "default" | "deferred";
  /** Replaces the built-in number form, e.g. when onboarding collects the number itself. */
  onChangeNumber?: () => void;
  /** Hide pause, change, and disconnect controls (they live in account settings). */
  hideStatusActions?: boolean;
};

type View = "form" | "code" | "transfer" | "status";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 px-4 py-2 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50";
const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full border border-transparent bg-[var(--lingo-btn-bg)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60";
const LINK_BUTTON_CLASS =
  "text-sm font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline";

function flagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function guessCountry(supported: string[]) {
  if (typeof navigator === "undefined") return supported[0] ?? "US";
  for (const locale of navigator.languages ?? [navigator.language]) {
    const region = locale.split("-")[1]?.toUpperCase();
    if (region && supported.includes(region)) return region;
  }
  return supported[0] ?? "US";
}

async function smsRequest(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
) {
  const response = await fetch(path, {
    method,
    headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | (SmsPhoneState & { replaced?: boolean; transferred?: boolean; alreadyActive?: boolean })
    | SmsPhoneErrorBody
    | null;
  if (!response.ok || !data || "code" in data) {
    const error = (data && "code" in data ? data : null) as SmsPhoneErrorBody | null;
    return {
      ok: false as const,
      error: error ?? { error: "Something went wrong. Please try again.", code: "server_error" as const },
    };
  }
  return { ok: true as const, state: data };
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

export default function SmsPhoneSetup({
  source,
  onStateChange,
  onVerified,
  welcome = "default",
  onChangeNumber,
  hideStatusActions = false,
}: Props) {
  const { captureEvent } = useAnalytics();
  const [state, setState] = useState<SmsPhoneState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<View>("status");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const viewedRef = useRef(false);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const onStateChangeRef = useRef(onStateChange);
  const onVerifiedRef = useRef(onVerified);
  onStateChangeRef.current = onStateChange;
  onVerifiedRef.current = onVerified;

  const applyState = useCallback((next: SmsPhoneState, nextView?: View) => {
    setState(next);
    onStateChangeRef.current?.(next);
    if (nextView) {
      setView(nextView);
    } else if (next.pending) {
      setView("code");
    } else if (next.contact && next.contact.status !== "unverified") {
      setView("status");
    } else {
      setView("form");
    }
  }, []);

  const load = useCallback(async () => {
    setLoadError(false);
    const result = await smsRequest("/api/sms/phone", "GET");
    if (!result.ok) {
      setLoadError(true);
      return;
    }
    applyState(result.state);
    setCountry((current) => current || result.state.contact?.countryCode || guessCountry(result.state.supportedCountries.map((c) => c.code)));
    if (!viewedRef.current) {
      viewedRef.current = true;
      captureEvent("sms_setup_viewed", {
        source,
        status: result.state.contact?.status ?? (result.state.pending ? "pending" : "not_configured"),
        available: result.state.available,
      });
    }
  }, [applyState, captureEvent, source]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (view === "code") codeInputRef.current?.focus();
  }, [view]);

  const pending = state?.pending ?? null;
  const contact = state?.contact ?? null;
  const now = useNow(view === "code" && Boolean(pending));
  const resendIn = pending
    ? Math.max(0, Math.ceil((new Date(pending.resendAvailableAt).getTime() - now) / 1000))
    : 0;
  const lingoNumber = state?.lingoNumber ?? "LingoIsland";

  const countryOptions = useMemo(
    () =>
      (state?.supportedCountries ?? []).map((option) => ({
        ...option,
        label: `${flagEmoji(option.code)} ${countryName(option.code)} (${option.dialCode})`,
      })),
    [state?.supportedCountries],
  );

  const run = async (
    key: string,
    action: () => Promise<Awaited<ReturnType<typeof smsRequest>>>,
    handlers: {
      onSuccess?: (next: SmsPhoneState & { replaced?: boolean; transferred?: boolean; alreadyActive?: boolean }) => void;
      onError?: (error: SmsPhoneErrorBody) => boolean | void;
    } = {},
  ) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const result = await action();
      if (result.ok) {
        handlers.onSuccess?.(result.state);
      } else {
        const handled = handlers.onError?.(result.error);
        if (!handled) setError(result.error.error);
        if (result.error.state) applyState(result.error.state);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const sendCode = () =>
    run(
      "start",
      () =>
        smsRequest("/api/sms/phone/start", "POST", {
          country,
          phoneNumber: phone,
          consent,
          consentVersion: SMS_CONSENT_VERSION,
          source,
        }),
      {
        onSuccess: (next) => {
          captureEvent("sms_code_requested", { source, country, replacing: Boolean(contact) });
          setCode("");
          if (next.alreadyActive) {
            applyState(next, "status");
            setNotice("That number is already connected.");
          } else {
            applyState(next, "code");
          }
        },
        onError: (err) => {
          captureEvent("sms_code_request_failed", { source, reason: err.code });
        },
      },
    );

  const resendCode = () =>
    run("resend", () => smsRequest("/api/sms/phone/resend", "POST", {}), {
      onSuccess: (next) => {
        captureEvent("sms_code_resent", { source });
        setCode("");
        applyState(next, "code");
        setNotice("New code sent.");
      },
    });

  const verifyCode = (confirmTransfer = false) =>
    run(
      confirmTransfer ? "transfer" : "verify",
      () =>
        smsRequest("/api/sms/phone/verify", "POST", {
          code,
          confirmTransfer,
          ...(welcome === "deferred" ? { welcome } : {}),
        }),
      {
        onSuccess: (next) => {
          captureEvent("sms_code_verified", {
            source,
            replaced: Boolean(next.replaced),
            transferred: Boolean(next.transferred),
          });
          setCode("");
          setPhone("");
          setConsent(false);
          onVerifiedRef.current?.(next);
          applyState(next, "status");
        },
        onError: (err) => {
          captureEvent("sms_code_verify_failed", { source, reason: err.code });
          if (err.code === "transfer_required") {
            setView("transfer");
            return true;
          }
          if (err.code === "incorrect_code" && typeof err.attemptsRemaining === "number") {
            setError(
              `${err.error} ${err.attemptsRemaining} ${err.attemptsRemaining === 1 ? "try" : "tries"} left.`,
            );
            return true;
          }
          if (err.code === "expired" || err.code === "too_many_attempts" || err.code === "no_pending") {
            void load();
          }
          return false;
        },
      },
    );

  const setPaused = (paused: boolean) =>
    run(paused ? "pause" : "resume", () => smsRequest("/api/sms/phone", "PATCH", { action: paused ? "pause" : "resume" }), {
      onSuccess: (next) => {
        captureEvent(paused ? "sms_texting_paused" : "sms_texting_resumed", { source });
        applyState(next, "status");
      },
    });

  const disconnect = () =>
    run("disconnect", () => smsRequest("/api/sms/phone", "DELETE"), {
      onSuccess: (next) => {
        captureEvent("sms_phone_disconnected", { source });
        setConfirmDisconnect(false);
        applyState(next, "form");
        setNotice("Your number was disconnected.");
      },
    });

  const startReplace = () => {
    captureEvent("sms_replace_started", { source, status: contact?.status ?? null });
    if (onChangeNumber) {
      onChangeNumber();
      return;
    }
    setPhone("");
    setConsent(false);
    setError(null);
    setNotice(null);
    setView("form");
  };

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs text-red-600">Couldn&apos;t load texting settings.</p>
        <button type="button" className={LINK_BUTTON_CLASS} onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  if (!state) {
    return <p className="text-xs text-gray-600">Loading…</p>;
  }

  if (!state.available && !contact) {
    return (
      <p className="text-xs text-gray-600">
        Texting practice isn&apos;t available right now. Check back soon.
      </p>
    );
  }

  const messages = (
    <>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      ) : null}
      {notice ? <p className="text-xs font-medium text-green-600">{notice}</p> : null}
    </>
  );

  if (view === "transfer") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-900">
          This number is connected to another LingoIsland account.
        </p>
        <p className="text-xs text-gray-600">
          Move it to this account? The other account will stop receiving practice texts, and its
          conversations stay with that account.
        </p>
        {messages}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy !== null}
            onClick={() => void verifyCode(true)}
          >
            {busy === "transfer" ? "Moving…" : "Move to this account"}
          </button>
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            disabled={busy !== null}
            onClick={() => {
              setCode("");
              setView(pending ? "code" : "form");
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (view === "code" && pending) {
    const codeReady = /^\d{6}$/.test(code.replace(/\D/g, ""));
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (codeReady && busy === null) void verifyCode(false);
        }}
      >
        {contact ? (
          <p className="text-xs text-gray-600">
            Replacing {contact.maskedNumber}. Your current number keeps working until the new one is verified.
          </p>
        ) : null}
        <label htmlFor="sms-code" className="text-sm text-gray-900">
          {pending.channel === "whatsapp" ? "Enter the 6-digit code we sent on WhatsApp to " : "Enter the 6-digit code we texted to "}
          <span className="font-medium">{pending.maskedNumber}</span>.
        </label>
        {pending.expired ? (
          <p className="text-xs text-amber-700">This code expired. Send a new one.</p>
        ) : pending.deliveryFailed ? (
          <p className="text-xs text-amber-700">
            We couldn&apos;t deliver the code. Check the number, or send a new code.
          </p>
        ) : null}
        <input
          id="sms-code"
          ref={codeInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))}
          placeholder="123456"
          disabled={busy !== null}
          className={`${INPUT_CLASS} max-w-[12rem] tracking-[0.3em]`}
        />
        {messages}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={!codeReady || busy !== null}>
            {busy === "verify" ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            className={LINK_BUTTON_CLASS}
            disabled={busy !== null || resendIn > 0 || pending.sendsRemaining === 0}
            onClick={() => void resendCode()}
          >
            {busy === "resend"
              ? "Sending…"
              : pending.sendsRemaining === 0
                ? "No more codes"
                : resendIn > 0
                  ? `Resend in ${resendIn}s`
                  : "Resend code"}
          </button>
          <button type="button" className={LINK_BUTTON_CLASS} disabled={busy !== null} onClick={startReplace}>
            Use a different number
          </button>
        </div>
      </form>
    );
  }

  if (view === "status" && contact && contact.status !== "unverified") {
    const statusLabel = {
      active: { text: "Active", dot: "bg-green-500" },
      paused: { text: "Paused", dot: "bg-gray-400" },
      opted_out: { text: "Unsubscribed", dot: "bg-amber-500" },
      disabled: { text: "Delivery problem", dot: "bg-red-500" },
    }[contact.status];

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{contact.maskedNumber}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            <span className={`h-1.5 w-1.5 rounded-full ${statusLabel.dot}`} aria-hidden />
            {statusLabel.text}
          </span>
        </div>

        {contact.status === "active" && contact.channel === "whatsapp" ? (
          <p className="text-xs text-gray-600">
            Message 华华 on WhatsApp anytime to practice. Reply STOP to unsubscribe.
          </p>
        ) : contact.status === "active" ? (
          <p className="text-xs text-gray-600">
            Text 华华 at <span className="font-medium text-gray-900">{lingoNumber}</span> anytime to practice. Reply STOP to unsubscribe.
          </p>
        ) : contact.status === "paused" ? (
          <p className="text-xs text-gray-600">
            {contact.pausedReason === "no_response"
              ? "We paused practice texts while you're busy. "
              : "Practice texts are paused. "}
            华华 won&apos;t text you first, but you can still text{" "}
            <span className="font-medium text-gray-900">{lingoNumber}</span> anytime.
          </p>
        ) : contact.status === "opted_out" ? (
          <p className="text-xs text-gray-600">
            You replied STOP, so we won&apos;t text this number. To turn texting back on, text{" "}
            <span className="font-medium text-gray-900">START</span> to{" "}
            <span className="font-medium text-gray-900">{lingoNumber}</span>, then refresh this page.
          </p>
        ) : (
          <p className="text-xs text-gray-600">
            We couldn&apos;t deliver texts to this number. Verify it again or use a different number.
          </p>
        )}

        {messages}

        {hideStatusActions ? null : confirmDisconnect ? (
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-700">
              Disconnect {contact.maskedNumber}? 华华 will stop texting it and won&apos;t reply to it.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy !== null}
                onClick={() => void disconnect()}
              >
                {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
              </button>
              <button
                type="button"
                className={LINK_BUTTON_CLASS}
                disabled={busy !== null}
                onClick={() => setConfirmDisconnect(false)}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {contact.status === "active" ? (
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy !== null}
                onClick={() => void setPaused(true)}
              >
                {busy === "pause" ? "Pausing…" : "Pause texts"}
              </button>
            ) : contact.status === "paused" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy !== null}
                onClick={() => void setPaused(false)}
              >
                {busy === "resume" ? "Resuming…" : "Resume texts"}
              </button>
            ) : contact.status === "opted_out" ? (
              <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy !== null} onClick={() => void load()}>
                Refresh status
              </button>
            ) : (
              <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy !== null} onClick={startReplace}>
                Verify again
              </button>
            )}
            {contact.status !== "disabled" ? (
              <button type="button" className={LINK_BUTTON_CLASS} disabled={busy !== null} onClick={startReplace}>
                Change number
              </button>
            ) : null}
            <button
              type="button"
              className={LINK_BUTTON_CLASS}
              disabled={busy !== null}
              onClick={() => setConfirmDisconnect(true)}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Entering (or replacing) a number.
  const canSend = consent && phone.trim().length >= 7 && Boolean(country) && state.available;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend && busy === null) void sendCode();
      }}
    >
      {contact && contact.status !== "unverified" ? (
        <p className="text-xs text-gray-600">
          Replacing {contact.maskedNumber}. It keeps working until the new number is verified.
        </p>
      ) : contact?.status === "unverified" ? (
        <p className="text-xs text-gray-600">Verify your number to start texting practice.</p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="sms-country" className="sr-only">
          Country
        </label>
        <select
          id="sms-country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          disabled={busy !== null}
          className={`${INPUT_CLASS} sm:max-w-[13rem]`}
        >
          {countryOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
        <label htmlFor="sms-phone" className="sr-only">
          Mobile number
        </label>
        <input
          id="sms-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={phone}
          onChange={(event) => setPhone(event.target.value.slice(0, 32))}
          placeholder="Mobile number"
          disabled={busy !== null}
          className={INPUT_CLASS}
        />
      </div>

      <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-600">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
          disabled={busy !== null}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-200"
        />
        <span>{SMS_CONSENT_TEXT}</span>
      </label>

      {messages}

      <CountryInterest supported={state.supportedCountries.map((option) => option.code)} source={source} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={!canSend || busy !== null}>
          {busy === "start" ? "Sending…" : "Text me a code"}
        </button>
        {pending ? (
          <button type="button" className={LINK_BUTTON_CLASS} disabled={busy !== null} onClick={() => setView("code")}>
            I already have a code
          </button>
        ) : contact && contact.status !== "unverified" ? (
          <button type="button" className={LINK_BUTTON_CLASS} disabled={busy !== null} onClick={() => setView("status")}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function CountryInterest({ supported, source }: { supported: string[]; source: SmsConsentSource }) {
  const { captureEvent } = useAnalytics();
  const options = useMemo(() => interestSmsCountries(supported), [supported]);
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (options.length === 0) return null;
  if (!open) {
    return (
      <button type="button" className={`${LINK_BUTTON_CLASS} self-start text-xs`} onClick={() => setOpen(true)}>
        My country isn&apos;t listed
      </button>
    );
  }
  if (status === "saved") {
    return <p className="text-xs text-gray-600">Thanks! We&apos;ll let you know when texting is available there.</p>;
  }

  const submit = async () => {
    setStatus("saving");
    try {
      const response = await fetch("/api/sms/huahua/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country }),
      });
      if (!response.ok) throw new Error("failed");
      captureEvent("sms_country_interest", { source, country });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
      <label htmlFor="sms-interest-country" className="text-xs text-gray-700">
        Texting is available in {supported.map(countryName).join(" and ")} for now. Where are you?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          id="sms-interest-country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className={`${INPUT_CLASS} sm:max-w-[13rem]`}
        >
          <option value="">Choose a country</option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {flagEmoji(option.code)} {option.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={!country || status === "saving"}
          onClick={() => void submit()}
        >
          {status === "saving" ? "Saving…" : "Tell me when it's ready"}
        </button>
      </div>
      {status === "error" ? <p className="text-xs text-red-600">Couldn&apos;t save that. Try again.</p> : null}
    </div>
  );
}
