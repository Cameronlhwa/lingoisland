import Link from "next/link";

export type BlogCalloutProps = {
  emoji?: string;
  hook: string;
  line: string;
  cta: string;
  href: string;
  children?: React.ReactNode;
};

export function BlogCallout({
  emoji = "💡",
  hook,
  line,
  cta,
  href,
  children,
}: BlogCalloutProps) {
  return (
    <div
      className="my-8 rounded-lg border-l-4 p-5"
      style={{
        background: "#EAF5FB",
        borderColor: "#2176AE",
      }}
    >
      <p
        className="text-[15px] font-medium leading-relaxed"
        style={{ color: "#071E2E", fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        <span className="mr-1">{emoji}</span>
        {hook}
      </p>
      <p
        className="mt-3 text-[15px] leading-relaxed"
        style={{ color: "#071E2E", fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {line}
      </p>
      {children}
      <Link
        href={href}
        className="mt-3 inline-block text-sm font-semibold underline-offset-2 hover:underline"
        style={{ color: "#2176AE", fontFamily: "'DM Sans', system-ui, sans-serif" }}
      >
        {cta} →
      </Link>
    </div>
  );
}
