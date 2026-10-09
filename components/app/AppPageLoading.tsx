export default function AppPageLoading({
  label = "Loading…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-1 items-center justify-center px-4 py-16 min-h-[calc(100svh-4rem)] md:min-h-screen ${className}`}
    >
      <div className="flex items-center gap-3 text-sm text-(--lingo-text-muted,#6b7280)">
        <svg
          className="h-5 w-5 animate-spin text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
        <span>{label}</span>
      </div>
    </div>
  );
}
