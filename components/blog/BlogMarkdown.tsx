import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const text = {
  color: "#071E2E",
  fontFamily: "'DM Sans', system-ui, sans-serif",
} as const;

const linkClass =
  "font-medium underline decoration-[#2176AE]/35 underline-offset-[3px] hover:decoration-[#2176AE]";

export function BlogMarkdown({ markdown }: { markdown: string }) {
  return (
    <div
      className="blog-md space-y-4 text-[18px] leading-[1.75]"
      style={{ color: "#071E2E", fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2
              className="mt-10 scroll-mt-24 text-2xl font-semibold md:text-[1.75rem]"
              style={{
                color: "#071E2E",
                fontFamily: "'Lora', Georgia, serif",
                lineHeight: 1.2,
              }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="mt-8 text-xl font-semibold"
              style={{ ...text, lineHeight: 1.3 }}
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-4 first:mt-0" style={text}>
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold" style={{ color: "#071E2E" }}>
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic" style={{ color: "#071E2E" }}>
              {children}
            </em>
          ),
          a: ({ href, children }) => {
            if (href?.startsWith("/")) {
              return (
                <Link href={href} className={linkClass} style={{ color: "#2176AE" }}>
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={href}
                className={linkClass}
                style={{ color: "#2176AE" }}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          },
          ul: ({ children }) => (
            <ul className="my-4 list-disc space-y-2 pl-6" style={text}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-4 list-decimal space-y-2 pl-6" style={text}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="pl-1">{children}</li>,
          hr: () => <hr className="my-10 border-t border-[#2176AE]/15" />,
          blockquote: ({ children }) => (
            <blockquote
              className="my-6 border-l-4 pl-4 italic"
              style={{ borderColor: "#2176AE", color: "#071E2E" }}
            >
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-6 overflow-x-auto rounded-xl border border-[#2176AE]/15 bg-white/60">
              <table className="w-full min-w-[520px] border-collapse text-left text-[15px] leading-snug">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#EAF5FB]" style={{ color: "#071E2E" }}>
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-[#2176AE]/10 last:border-b-0">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 font-semibold first:rounded-tl-xl last:rounded-tr-xl">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-3 py-2 align-top">{children}</td>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
