"use client";

import { useState } from "react";

const HUAHUA_AVATAR = "/capybara-profile.png";

export default function HuahuaAvatar({
  className = "h-9 w-9",
}: {
  className?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg`}
        aria-hidden
      >
        🦫
      </span>
    );
  }

  return (
    <img
      src={HUAHUA_AVATAR}
      alt="华华"
      className={`${className} shrink-0 rounded-full object-cover`}
      onError={() => setImgError(true)}
    />
  );
}
