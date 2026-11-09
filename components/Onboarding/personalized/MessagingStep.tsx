"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, Smartphone } from "lucide-react";
import SmsPhoneSetup from "@/components/sms/SmsPhoneSetup";
import OnboardingCheckoutAuth, { CheckoutHandoff } from "@/components/Onboarding/OnboardingCheckoutAuth";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import type { ChannelEligibility, Channel } from "@/lib/onboarding/personalized/messaging";
import type { AccountKind } from "@/lib/onboarding/personalized/storage";
import {
  MESSAGING_CONSENT_JOURNEY_TEXT,
  MESSAGING_CONSENT_SCHEDULED_TEXT,
  MESSAGING_CONSENT_VERSION,
  messagingDisclosure,
} from "@/lib/sms/consent";
import type { SmsPhoneErrorBody, SmsPhoneState } from "@/lib/sms/phoneState";
import type { StepProps } from "./stepTypes";
import {
  CARD_BORDER,
  FieldError,
  GREEN,
  MUTED,
  NAVY,
  OptionCard,
  PrimaryButton,
  SecondaryButton,
  SKY_PALE,
  StepFrame,
  TextButton,
} from "./ui";

type View = "loading" | "account" | "unavailable" | "connected" | "number" | "channel" | "verify";

type Config = { smsAvailable: boolean; whatsappAvailable: boolean; simulationAvailable: boolean };

type Eligibility = ChannelEligibility & { simulationAvailable?: boolean };

type CountryOption = { code: string; name: string; dialCode: string };

const INPUT =
  "w-full min-h-[48px] rounded-xl border bg-white px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2";

function regionName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function guessCountry(codes: string[]) {
  if (typeof navigator !== "undefined") {
    for (const locale of navigator.languages ?? [navigator.language]) {
      const region = locale.split("-")[1]?.toUpperCase();
      if (region && codes.includes(region)) return region;
    }
  }
  return codes.includes("US") ? "US" : codes[0] ?? "US";
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, status: response.status, data };
}

export function MessagingStep({
  state,
  next,
  back,
  progress,
  track,
  accountKind,
  authReturnPath,
  onAccountReady,
  onSkip,
}: StepProps & {
  accountKind: AccountKind;
  authReturnPath: string;
  onAccountReady: () => Promise<void>;
  onSkip: (reason: "skipped" | "unavailable") => void;
}) {
  const [view, setView] = useState<View>("loading");
  const [config, setConfig] = useState<Config | null>(null);
  const [phoneState, setPhoneState] = useState<SmsPhoneState | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [consentScheduled, setConsentScheduled] = useState(false);
  const [consentJourney, setConsentJourney] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    setView("loading");
    setError(null);
    const configResponse = await fetch("/api/onboarding/messaging/eligibility", { cache: "no-store" }).catch(() => null);
    const nextConfig = ((await configResponse?.json().catch(() => null)) as Config | null) ?? {
      smsAvailable: false,
      whatsappAvailable: false,
      simulationAvailable: false,
    };
    setConfig(nextConfig);
    if (!nextConfig.smsAvailable && !nextConfig.whatsappAvailable) {
      setView("unavailable");
      return;
    }
    if (accountKind !== "user") {
      setView("account");
      return;
    }
    const phoneResponse = await fetch("/api/sms/phone", { cache: "no-store" }).catch(() => null);
    const current = phoneResponse?.ok ? ((await phoneResponse.json().catch(() => null)) as SmsPhoneState | null) : null;
    setPhoneState(current);
    if (current?.pending) {
      setChannel(current.pending.channel);
      setView("verify");
    } else if (current?.contact && current.contact.status === "active") {
      setView("connected");
    } else {
      setView("number");
    }
  }, [accountKind]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (startedRef.current || view === "loading") return;
    startedRef.current = true;
    track(ONBOARDING_EVENTS.messagingStarted, { sms_supported: Boolean(config?.smsAvailable), whatsapp_available: Boolean(config?.whatsappAvailable) });
  }, [config, track, view]);

  // libphonenumber metadata is loaded only once the learner reaches the number form.
  useEffect(() => {
    if (view !== "number" || countries.length > 0) return;
    let cancelled = false;
    void import("libphonenumber-js/min").then(({ getCountries, getCountryCallingCode }) => {
      if (cancelled) return;
      const list = getCountries()
        .map((code) => ({ code, name: regionName(code), dialCode: `+${getCountryCallingCode(code)}` }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setCountries(list);
      setCountry((current) => current || phoneState?.contact?.countryCode || guessCountry(list.map((item) => item.code)));
    });
    return () => {
      cancelled = true;
    };
  }, [countries.length, phoneState, view]);

  const finishVerified = (verifiedChannel: Channel, detail: Record<string, unknown> = {}) => {
    track(ONBOARDING_EVENTS.verificationCompleted, { channel: verifiedChannel, ...detail });
    next({ messaging: { channel: verifiedChannel, status: "verified" } });
  };

  const checkOptions = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await postJson("/api/onboarding/messaging/eligibility", { country, phoneNumber: phone });
      if (!result.ok || !result.data) {
        setError("We couldn’t check that number. Try again.");
        return;
      }
      if (result.data.valid === false) {
        setError(typeof result.data.error === "string" ? result.data.error : "That doesn’t look like a valid phone number.");
        return;
      }
      const options = result.data as unknown as Eligibility;
      setEligibility(options);
      const only = options.options.length === 1 ? options.options[0].channel : null;
      setChannel(only);
      if (only) track(ONBOARDING_EVENTS.channelSelected, { channel: only, sms_supported: options.smsSupported, whatsapp_available: options.whatsappAvailable });
      setView("channel");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const chooseChannel = (value: Channel) => {
    setChannel(value);
    track(ONBOARDING_EVENTS.channelSelected, { channel: value, sms_supported: eligibility?.smsSupported, whatsapp_available: eligibility?.whatsappAvailable });
  };

  const sendCode = async () => {
    if (!channel || !eligibility || (!consentScheduled && !consentJourney)) return;
    setBusy(true);
    setError(null);
    track(ONBOARDING_EVENTS.consentGranted, { channel, consent_scheduled: consentScheduled, consent_journey: consentJourney });
    track(ONBOARDING_EVENTS.verificationStarted, { channel });
    try {
      const result = await postJson("/api/sms/phone/start", {
        country: eligibility.country,
        phoneNumber: phone,
        channel,
        consentVersion: MESSAGING_CONSENT_VERSION,
        consentScheduled,
        consentJourney,
        source: "onboarding",
      });
      if (!result.ok) {
        const body = result.data as SmsPhoneErrorBody | null;
        setError(body?.error ?? "We couldn’t send a code. Try again.");
        return;
      }
      if (result.data?.alreadyActive) {
        finishVerified(channel, { status: "already_active" });
        return;
      }
      setView("verify");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const skip = (reason: "skipped" | "unavailable") => {
    if (channel && view === "channel") track(ONBOARDING_EVENTS.consentDeclined, { channel });
    onSkip(reason);
  };

  const simulate = (value: Channel) => next({ messaging: { channel: value, status: "simulated" } });

  const simulationCard = config?.simulationAvailable ? (
    <div className="mt-6 rounded-2xl p-4" style={{ background: "#FFF8E8", border: "1px dashed #C9A24A" }} data-testid="messaging-simulation">
      <p className="text-sm font-bold" style={{ color: "#6B4A00" }}>
        Local development only
      </p>
      <p className="mt-1 text-sm" style={{ color: "#6B4A00" }}>
        Messaging isn’t configured here. You can simulate the Huahua steps. Nothing is sent and no number is stored.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <SecondaryButton onClick={() => simulate("sms")} data-testid="simulate-sms">
          Simulate SMS
        </SecondaryButton>
        <SecondaryButton onClick={() => simulate("whatsapp")} data-testid="simulate-whatsapp">
          Simulate WhatsApp
        </SecondaryButton>
      </div>
    </div>
  ) : null;

  const skipButton = (
    <TextButton className="mt-3" onClick={() => skip("skipped")} data-testid="messaging-skip">
      Continue without messaging
    </TextButton>
  );

  const disclosure = useMemo(() => (channel ? messagingDisclosure(channel) : ""), [channel]);

  if (view === "loading") {
    return (
      <StepFrame title="Let Huahua message you" progress={progress} onBack={back}>
        <p className="text-sm" style={{ color: MUTED }} role="status">
          Loading…
        </p>
      </StepFrame>
    );
  }

  if (view === "unavailable") {
    return (
      <StepFrame
        title="Huahua messaging isn’t available yet"
        subtitle="You can keep going and turn on Huahua later in Account settings."
        progress={progress}
        onBack={back}
      >
        <PrimaryButton onClick={() => skip("unavailable")} data-testid="messaging-continue-unavailable">
          Continue
        </PrimaryButton>
        {simulationCard}
      </StepFrame>
    );
  }

  if (view === "account") {
    return (
      <StepFrame
        title="Let Huahua message you"
        subtitle="Create a free account first so your number stays private and Huahua remembers your plan."
        progress={progress}
        onBack={back}
      >
        <PrimaryButton onClick={() => setAuthOpen(true)} data-testid="messaging-create-account">
          Create a free account
        </PrimaryButton>
        {skipButton}
        {simulationCard}
        {authOpen ? (
          <OnboardingCheckoutAuth
            plan="monthly"
            purpose="texting"
            returnPath={authReturnPath}
            onComplete={() => {
              setAuthOpen(false);
              setHandoff(false);
              void onAccountReady();
            }}
            onCancel={() => setAuthOpen(false)}
            onHandoffStart={() => setHandoff(true)}
            onHandoffEnd={() => setHandoff(false)}
          />
        ) : null}
        {handoff && !authOpen ? <CheckoutHandoff /> : null}
      </StepFrame>
    );
  }

  if (view === "connected" && phoneState?.contact) {
    const contact = phoneState.contact;
    return (
      <StepFrame
        title="Huahua is already connected"
        subtitle={`Huahua can reach you at ${contact.maskedNumber} on ${contact.channel === "whatsapp" ? "WhatsApp" : "SMS"}.`}
        progress={progress}
        onBack={back}
      >
        <PrimaryButton onClick={() => finishVerified(contact.channel, { status: "existing" })} data-testid="messaging-keep">
          Keep this number
        </PrimaryButton>
        <SecondaryButton className="mt-3" onClick={() => setView("number")}>
          Use a different number or app
        </SecondaryButton>
        {skipButton}
      </StepFrame>
    );
  }

  if (view === "verify") {
    return (
      <StepFrame
        title="Enter your code"
        subtitle={channel === "whatsapp" ? "We sent a 6-digit code to your WhatsApp." : "We texted you a 6-digit code."}
        progress={progress}
        onBack={() => setView("number")}
      >
        <SmsPhoneSetup
          source="onboarding"
          welcome="deferred"
          hideStatusActions
          onChangeNumber={() => setView("number")}
          onStateChange={(next) => {
            if (!next.pending && next.contact?.status !== "active") setView("number");
          }}
          onVerified={(next) => {
            const verifiedChannel = next.contact?.channel ?? channel ?? "sms";
            finishVerified(verifiedChannel);
          }}
        />
        {skipButton}
      </StepFrame>
    );
  }

  if (view === "channel" && eligibility) {
    const noOptions = eligibility.options.length === 0;
    return (
      <StepFrame
        title={noOptions ? "Huahua can’t message that number yet" : "How should Huahua message you?"}
        subtitle={
          noOptions
            ? `Messaging isn’t available for numbers in ${regionName(eligibility.country ?? "")} yet. You can keep going without it.`
            : eligibility.smsSupported
              ? "Choose the app you’d like to use. You can change it later."
              : "Text messages aren’t available for your number yet, but WhatsApp is."
        }
        progress={progress}
        onBack={() => setView("number")}
      >
        {noOptions ? (
          <>
            <PrimaryButton onClick={() => skip("unavailable")}>Continue without messaging</PrimaryButton>
            <SecondaryButton className="mt-3" onClick={() => setView("number")}>
              Try a different number
            </SecondaryButton>
          </>
        ) : (
          <>
            <div role="group" aria-labelledby="onboarding-step-title" className="grid gap-2.5">
              {eligibility.options.map((option) => (
                <OptionCard
                  key={option.channel}
                  testId={`channel-${option.channel}`}
                  selected={channel === option.channel}
                  onSelect={() => chooseChannel(option.channel)}
                  title={
                    <span className="inline-flex items-center gap-2">
                      {option.channel === "whatsapp" ? <MessageSquareText size={18} aria-hidden /> : <Smartphone size={18} aria-hidden />}
                      {option.channel === "whatsapp" ? "WhatsApp" : "Text message (SMS)"}
                    </span>
                  }
                  description={option.channel === "whatsapp" ? "Chat with Huahua in WhatsApp" : "Chat with Huahua in your Messages app"}
                  badge={option.recommended ? "Recommended" : undefined}
                />
              ))}
            </div>

            {channel ? (
              <fieldset className="mt-6">
                <legend className="text-[15px] font-bold" style={{ color: NAVY }}>
                  Which messages would you like? Choose at least one.
                </legend>
                {[
                  { id: "consent-scheduled", checked: consentScheduled, set: setConsentScheduled, text: MESSAGING_CONSENT_SCHEDULED_TEXT },
                  { id: "consent-journey", checked: consentJourney, set: setConsentJourney, text: MESSAGING_CONSENT_JOURNEY_TEXT },
                ].map((item) => (
                  <label
                    key={item.id}
                    htmlFor={item.id}
                    className="mt-2.5 flex cursor-pointer items-start gap-3 rounded-xl p-3 text-sm leading-relaxed"
                    style={{ border: `1px solid ${item.checked ? GREEN : CARD_BORDER}`, color: NAVY }}
                  >
                    <input
                      id={item.id}
                      type="checkbox"
                      checked={item.checked}
                      onChange={(event) => item.set(event.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#20674F]"
                      data-testid={item.id}
                    />
                    <span>{item.text}</span>
                  </label>
                ))}
                <p className="mt-3 rounded-xl p-3 text-[13px] leading-relaxed" style={{ background: SKY_PALE, color: MUTED }} data-testid="messaging-disclosure">
                  {disclosure}
                </p>
              </fieldset>
            ) : null}

            <FieldError message={error} />
            <PrimaryButton
              className="mt-6"
              disabled={!channel || (!consentScheduled && !consentJourney) || busy}
              onClick={() => void sendCode()}
              data-testid="messaging-send-code"
            >
              {busy ? "Sending…" : channel === "whatsapp" ? "Send my code on WhatsApp" : "Text me a code"}
            </PrimaryButton>
          </>
        )}
        {noOptions ? null : skipButton}
      </StepFrame>
    );
  }

  return (
    <StepFrame
      title="Where should Huahua message you?"
      subtitle="Enter your mobile number and we’ll show which messaging apps work for it. Nothing is sent yet."
      progress={progress}
      onBack={back}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && phone.trim().length >= 6) void checkOptions();
        }}
      >
        <label htmlFor="messaging-country" className="text-sm font-semibold" style={{ color: NAVY }}>
          Country
        </label>
        <select
          id="messaging-country"
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className={`${INPUT} mt-1.5`}
          style={{ borderColor: CARD_BORDER, color: NAVY }}
        >
          {countries.length === 0 ? <option value="">Loading countries…</option> : null}
          {countries.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name} ({option.dialCode})
            </option>
          ))}
        </select>
        <label htmlFor="messaging-phone" className="mt-4 block text-sm font-semibold" style={{ color: NAVY }}>
          Mobile number
        </label>
        <input
          id="messaging-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value.slice(0, 32))}
          className={`${INPUT} mt-1.5`}
          style={{ borderColor: CARD_BORDER, color: NAVY }}
          data-testid="messaging-phone"
        />
        <FieldError message={error} />
        <PrimaryButton type="submit" className="mt-6" disabled={busy || phone.trim().length < 6 || !country} data-testid="messaging-check">
          {busy ? "Checking…" : "See my options"}
        </PrimaryButton>
      </form>
      {skipButton}
    </StepFrame>
  );
}
