"use client";

import { useEffect, useState, type RefObject } from "react";

export function useElementWidth(
  ref: RefObject<HTMLElement>,
  initial = 700,
) {
  const [width, setWidth] = useState(initial);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      if (ref.current) {
        setWidth(ref.current.getBoundingClientRect().width);
      }
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}
