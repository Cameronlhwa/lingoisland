"use client";

import Link from "next/link";
import Image from "next/image";

const LOGO_SIZES = { sm: 40, md: 56 } as const;

type LogoSize = keyof typeof LOGO_SIZES;

export default function AppLogo({
  size = "md",
  textClassName = "text-xl font-bold text-gray-900",
  href,
}: {
  size?: LogoSize;
  textClassName?: string;
  href?: string;
}) {
  const px = LOGO_SIZES[size];
  const content = (
    <>
      <Image
        src="/logo.png"
        alt="Lingo Island Logo"
        width={px}
        height={px}
        className="rounded-lg"
      />
      <span className={textClassName}>
        Lingo<span className="text-gray-500">Island</span>
      </span>
    </>
  );

  const wrapperClass = "flex items-center gap-0.5";

  if (href !== undefined) {
    return (
      <Link href={href} className={wrapperClass}>
        {content}
      </Link>
    );
  }

  return <div className={wrapperClass}>{content}</div>;
}
