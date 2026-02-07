"use client";

type SpeechBubbleProps = {
  label: string;
  className?: string;
};

/**
 * Topic Islands–style speech bubble: white background, thick black border,
 * rounded corners, small tail pointing down, subtle shadow, uppercase label.
 */
export default function SpeechBubble({ label, className = "" }: SpeechBubbleProps) {
  return (
    <div
      className={`relative w-auto max-w-[90%] rounded-2xl border-[3px] border-black bg-white px-4 py-2 text-center shadow-md ${className}`}
    >
      <span className="text-sm font-bold uppercase tracking-wide text-gray-900 md:text-base leading-tight">
        {label}
      </span>
      {/* Tail pointing down (Topic Islands style) */}
      <div
        className="absolute left-1/2 -bottom-3 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-black"
        aria-hidden
      />
      <div
        className="absolute left-1/2 -bottom-[9px] -translate-x-1/2 w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[9px] border-t-white"
        aria-hidden
      />
    </div>
  );
}
