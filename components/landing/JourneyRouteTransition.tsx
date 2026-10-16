"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const FADE_MS = 300;
const WAIT_MS = 8000;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function waitForJourneyPage() {
  return new Promise<void>((resolve) => {
    const started = performance.now();
    const tick = () => {
      if (document.querySelector(".hsk-onboarding-bg") || performance.now() - started > WAIT_MS) {
        resolve();
        return;
      }
      window.setTimeout(tick, 16);
    };
    window.setTimeout(tick, 16);
  });
}

/** Keep the current homepage on screen while the next route renders underneath. */
function holdHomepage() {
  const overlay = document.createElement("div");
  overlay.setAttribute("data-journey-freeze", "");
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:100000",
    "overflow:hidden",
    "pointer-events:auto",
    "background:#FFFEFC",
    "transform:translateZ(0)",
    "opacity:1",
  ].join(";");

  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script").forEach((node) => node.remove());
  clone.style.marginTop = `-${window.scrollY}px`;
  clone.style.pointerEvents = "none";
  overlay.appendChild(clone);
  document.documentElement.appendChild(overlay);
  return overlay;
}

function dissolve(overlay: HTMLElement) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== overlay || event.propertyName !== "opacity") return;
      overlay.removeEventListener("transitionend", onEnd);
      finish();
    };
    overlay.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, FADE_MS + 80);
    window.requestAnimationFrame(() => {
      overlay.style.transition = `opacity ${FADE_MS}ms ease`;
      overlay.style.opacity = "0";
    });
  });
}

/**
 * Dissolves the homepage into /onboarding/journey.
 * The homepage stays up until the next page has painted, then fades away
 * to reveal it. A slow load never flashes a blank screen.
 */
export default function JourneyRouteTransition() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    router.prefetch("/onboarding/journey");
    const img = new Image();
    img.src = "/onboarding/journey-bg.png";
  }, [pathname, router]);

  useEffect(() => {
    let leaving = false;

    const onClick = (event: MouseEvent) => {
      if (pathname !== "/") return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest("a[data-journey-transition]");
      if (!link || leaving) return;
      if (prefersReducedMotion()) return;

      event.preventDefault();
      leaving = true;
      const href = link.getAttribute("href") || "/onboarding/journey";
      const overlay = holdHomepage();
      const onPop = () => overlay.remove();
      window.addEventListener("popstate", onPop);

      router.push(href);
      void waitForJourneyPage()
        .then(() => dissolve(overlay))
        .finally(() => {
          leaving = false;
          window.removeEventListener("popstate", onPop);
        });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname, router]);

  return null;
}
