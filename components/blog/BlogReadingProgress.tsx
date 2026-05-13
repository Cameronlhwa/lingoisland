"use client";

import { useEffect, useState } from "react";

export function BlogReadingProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = doc.scrollTop || document.body.scrollTop;
      const height = doc.scrollHeight - doc.clientHeight;
      const next = height > 0 ? Math.min(1, Math.max(0, scrollTop / height)) : 0;
      setP(next);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[200] h-1 bg-transparent"
      aria-hidden
    >
      <div
        className="h-full origin-left transition-[transform] duration-150 ease-out"
        style={{
          background: "#2176AE",
          transform: `scaleX(${p})`,
        }}
      />
    </div>
  );
}
