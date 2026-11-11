// Which messaging channels a learner may choose. Eligibility comes from the
// country of the number they enter (validated again on the server when the
// code is sent), never from IP location alone.

export type Channel = "sms" | "whatsapp";

export type ChannelEligibility = {
  country: string | null;
  smsSupported: boolean;
  whatsappAvailable: boolean;
  /** "choose": both offered. "sms"/"whatsapp": the only option. "none": continue without messaging. */
  recommendation: "choose" | "sms" | "whatsapp" | "none";
  options: Array<{ channel: Channel; recommended: boolean }>;
};

export function channelEligibility(input: {
  country: string | null;
  smsEnabled: boolean;
  smsCountries: readonly string[];
  whatsappEnabled: boolean;
  /** Empty list means any country. */
  whatsappCountries: readonly string[];
}): ChannelEligibility {
  const country = input.country ? input.country.toUpperCase() : null;
  const smsSupported = Boolean(country && input.smsEnabled && input.smsCountries.includes(country));
  // Where we can send SMS, offer WhatsApp as an alternative too. This keeps the
  // channel choice simple for learners while preserving WhatsApp-only availability
  // rules for countries outside our SMS footprint.
  const whatsappAvailable = Boolean(
    country &&
      input.whatsappEnabled &&
      (smsSupported || input.whatsappCountries.length === 0 || input.whatsappCountries.includes(country)),
  );
  const options: ChannelEligibility["options"] = [];
  if (smsSupported) options.push({ channel: "sms", recommended: false });
  if (whatsappAvailable) options.push({ channel: "whatsapp", recommended: !smsSupported });
  const recommendation = smsSupported && whatsappAvailable ? "choose" : smsSupported ? "sms" : whatsappAvailable ? "whatsapp" : "none";
  return { country, smsSupported, whatsappAvailable, recommendation, options };
}

/** The learner's explicit choice must be one of the offered channels; nothing is switched for them. */
export function isChannelAllowed(eligibility: ChannelEligibility, channel: Channel) {
  return eligibility.options.some((option) => option.channel === channel);
}

export function channelLabel(channel: Channel) {
  return channel === "whatsapp" ? "WhatsApp" : "text message (SMS)";
}
