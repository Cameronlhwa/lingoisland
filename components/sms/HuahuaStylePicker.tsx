"use client";

import { CORRECTION_MODES, type CorrectionMode } from "@/lib/sms/huahua/correction";
import { PERSONAS, type PersonaKey } from "@/lib/sms/huahua/personas";

type Props = {
  persona: PersonaKey;
  correctionMode: CorrectionMode;
  /** Personas this learner can pick. Others are not shown. */
  allowedPersonas: readonly PersonaKey[];
  disabled?: boolean;
  onChange: (patch: { persona?: PersonaKey; correctionMode?: CorrectionMode }) => void;
};

function OptionCard({
  name,
  selected,
  title,
  description,
  disabled,
  onSelect,
}: {
  name: string;
  selected: boolean;
  title: string;
  description: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        selected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input
        type="radio"
        name={name}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 border-gray-300 text-gray-900 focus:ring-gray-300"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="text-xs text-gray-600">{description}</span>
      </span>
    </label>
  );
}

/** Persona and correction choices for Huahua texts. */
export default function HuahuaStylePicker({ persona, correctionMode, allowedPersonas, disabled, onChange }: Props) {
  const personas = PERSONAS.filter((option) => allowedPersonas.includes(option.key));

  return (
    <div className="flex flex-col gap-5">
      {personas.length > 1 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-gray-900">How should 华华 text with you?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {personas.map((option) => (
              <OptionCard
                key={option.key}
                name="huahua-persona"
                selected={persona === option.key}
                title={option.label}
                description={option.description}
                disabled={disabled}
                onSelect={() => onChange({ persona: option.key })}
              />
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-gray-900">When you make a mistake</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CORRECTION_MODES.map((option) => (
            <OptionCard
              key={option.key}
              name="huahua-correction"
              selected={correctionMode === option.key}
              title={option.label}
              description={option.description}
              disabled={disabled}
              onSelect={() => onChange({ correctionMode: option.key })}
            />
          ))}
        </div>
      </fieldset>
    </div>
  );
}
