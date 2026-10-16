"use client";

import Link from "next/link";
import HomeWordmark from "@/components/landing/HomeWordmark";

const LOGO_HEIGHT = { sm: 40, md: 52 } as const;

type LogoSize = keyof typeof LOGO_HEIGHT;

export default function AppLogo({
  size = "md",
  textClassName = "text-xl font-bold text-gray-900",
  href,
  showMark = true,
}: {
  size?: LogoSize;
  textClassName?: string;
  href?: string;
  showMark?: boolean;
}) {
  const content = showMark ? (
    <HomeWordmark height={LOGO_HEIGHT[size]} />
  ) : (
    <span className={textClassName}>
      Lingo<span className="text-gray-500">Island</span>
    </span>
  );

  const wrapperClass = "flex items-center";

  if (href !== undefined) {
    return (
      <Link href={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
