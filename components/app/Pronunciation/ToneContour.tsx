import { toneName, toneShapeTip } from "@/lib/pronunciation/encouragement";
import { asTone, type ToneContext } from "@/lib/pronunciation/tones";

/** An instructional shape, not a measured pitch trace of the learner's voice. */
export default function ToneContour({ tone, ...context }: { tone: number | null | undefined } & ToneContext) {
  const value = asTone(tone);
  if (value === null) return null;
  const neutralY = context.previousTone === 3 ? 35 : context.previousTone === 4 ? 80 : 55;
  return <svg viewBox="0 0 200 110" className="h-24 w-44 text-[var(--lingo-blue)]" role="img" aria-label={`${toneName(value)}: ${toneShapeTip(value, context)}`}>
    <path d="M20 95H180" fill="none" stroke="currentColor" opacity="0.15" />
    <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
      {value === 1 && <path d="M30 25H170" />}
      {value === 2 && <path d="M30 65Q100 55 170 20" />}
      {value === 3 && <><path d="M30 55Q65 85 100 85" /><path d="M100 85Q135 85 170 30" opacity={context.connectedSpeech === false ? 1 : 0.5} /></>}
      {value === 4 && <path d="M35 20L165 85" />}
      {value === 5 && <path d={`M92 ${neutralY}H108`} strokeWidth="9" />}
    </g>
  </svg>;
}
