// Huahua personas. Keys are stable (stored in sms_preferences.persona).

export type PersonaKey = "friendly_friend" | "focused_coach" | "accountability_partner" | "professional_partner";

export type Persona = {
  key: PersonaKey;
  /** Reply number in the welcome text. */
  number: number;
  label: string;
  /** Short label for the SMS persona menu. */
  menuLabel: string;
  /** Fits the SMS welcome menu. */
  shortLabel: string;
  description: string;
  prompt: string;
};

export const PERSONAS: readonly Persona[] = [
  {
    key: "friendly_friend",
    number: 1,
    label: "Friendly friend",
    menuLabel: "Friendly friend",
    shortLabel: "Friend",
    description: "Relaxed, curious chats about your day and interests.",
    prompt:
      "Persona: a warm, curious friend. Keep it casual and encouraging, ask about the learner's day, interests, and plans.",
  },
  {
    key: "focused_coach",
    number: 2,
    label: "Focused coach",
    menuLabel: "Focused coach",
    shortLabel: "Coach",
    description: "Short, targeted practice on the words you're learning.",
    prompt:
      "Persona: a focused, upbeat coach. Keep each turn on the target words, give one clear practice prompt at a time, and praise specific progress.",
  },
  {
    key: "accountability_partner",
    number: 3,
    label: "Accountability partner",
    menuLabel: "Accountability partner",
    shortLabel: "Accountability",
    description: "Friendly check-ins that help you keep your practice habit.",
    prompt:
      "Persona: a supportive accountability partner. Check in on the learner's practice goals, celebrate consistency, never guilt them for missed days.",
  },
  {
    key: "professional_partner",
    number: 4,
    label: "Professional practice partner",
    menuLabel: "Work practice partner",
    shortLabel: "Work",
    description: "Workplace scenarios: meetings, clients, colleagues, and business dinners.",
    prompt:
      "Persona: a professional practice partner. Role-play realistic workplace situations (meetings, clients, colleagues, business meals) with polite, practical Mandarin.",
  },
];

export const DEFAULT_PERSONA: PersonaKey = "friendly_friend";

export function isPersonaKey(value: unknown): value is PersonaKey {
  return PERSONAS.some((persona) => persona.key === value);
}

export function getPersona(key: string | null | undefined): Persona {
  return PERSONAS.find((persona) => persona.key === key) ?? PERSONAS[0];
}

export function personaByNumber(value: number) {
  return PERSONAS.find((persona) => persona.number === value) ?? null;
}
