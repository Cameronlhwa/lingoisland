import type { HTMLAttributes, ReactNode } from "react";

/** Shared width and gutters for the main app destinations. Navigation lives in AppLayoutClient. */
export default function AppPage({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`mx-auto w-full max-w-[1120px] px-4 py-8 md:px-6 ${className}`}>{children}</div>;
}

export const APP_PAGE_TITLE_CLASS = "lingo-display mt-1 max-w-2xl text-3xl font-bold leading-tight text-[var(--lingo-navy)] sm:text-4xl";

export function AppPageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--lingo-teal)]">{eyebrow}</p>}
      <h1 className={APP_PAGE_TITLE_CLASS}>{title}</h1>
      {description && <p className="mt-2 max-w-lg text-sm leading-relaxed text-[var(--lingo-text-muted)]">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}
