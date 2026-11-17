import ToneContour from "./ToneContour";

/** The two spoken shapes together; the neutral dot retains its preceding-tone context. */
export default function ToneSequence({tones}:{tones:[number,number]}) {
  return <figure className="mx-auto mt-4 max-w-md">
    <figcaption className="text-center text-xs font-semibold text-[var(--lingo-text-muted)]">Spoken tone shapes · {tones.map(tone=>tone===5?"Neutral":tone).join(" + ")}</figcaption>
    <div className="flex items-center justify-center gap-2">
      <div className="min-w-0 flex-1 [&_svg]:w-full"><ToneContour tone={tones[0]} connectedSpeech/></div>
      <span aria-hidden="true" className="text-[var(--lingo-text-muted)]">→</span>
      <div className="min-w-0 flex-1 [&_svg]:w-full"><ToneContour tone={tones[1]} previousTone={tones[0]} connectedSpeech/></div>
    </div>
  </figure>;
}
