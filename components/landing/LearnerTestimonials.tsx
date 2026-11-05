"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LEARNER_TESTIMONIALS, type LearnerTestimonial } from "@/lib/landing-content";

const AUTOPLAY_MS = 7000;
/** Matches the `.learner-tst-track` transition duration in globals.css. */
const SLIDE_MS = 480;
const SWIPE_THRESHOLD_PX = 48;
/** Matches the breakpoint where `--tst-per-view` becomes 2 in globals.css. */
const TWO_UP_QUERY = "(min-width: 900px)";
/** Clones before/after the real slides so wrapping can keep sliding in one direction. */
const LEAD_CLONES = 1;
const TAIL_CLONES = 2;

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

/** `null` until mounted, so nothing autoplays before the real preference is known. */
function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

type DragState = { id: number; x: number; y: number; axis: "x" | "y" | null };

export default function LearnerTestimonials({
  id = "testimonials",
  eyebrow = "Learner reviews",
  title = "Mandarin built around real life",
  subtitle = "Real feedback from LingoIsland learners",
  testimonials = LEARNER_TESTIMONIALS,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  testimonials?: LearnerTestimonial[];
}) {
  const count = testimonials.length;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const twoUp = useMediaQuery(TWO_UP_QUERY);
  const perView = twoUp ? 2 : 1;
  const motionOK = reducedMotion === false;

  // `pos` may sit one step outside 0..count-1 while sliding onto a clone; it is
  // snapped back to the matching real slide once the slide finishes.
  const [pos, setPos] = useState(0);
  const [animated, setAnimated] = useState(false);
  const [dragPx, setDragPx] = useState(0);
  const posRef = useRef(0);
  const dragRef = useRef<DragState | null>(null);

  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);

  const active = mod(pos, count);

  const commit = useCallback((next: number, animate: boolean) => {
    posRef.current = next;
    setPos(next);
    setAnimated(animate);
  }, []);

  const shift = useCallback(
    (delta: number) => {
      const current = posRef.current;
      const settled = mod(current, count);
      const target = settled + delta;
      if (!motionOK) {
        commit(mod(target, count), false);
        return;
      }
      if (current !== settled) {
        // Still on a clone from the previous slide: jump to the real slide
        // without a transition, then slide from there on the next paint.
        commit(settled, false);
        requestAnimationFrame(() => requestAnimationFrame(() => commit(target, true)));
        return;
      }
      commit(target, true);
    },
    [commit, count, motionOK]
  );

  const goTo = useCallback(
    (index: number) => shift(index - mod(posRef.current, count)),
    [count, shift]
  );

  const settleClone = useCallback(() => {
    const current = posRef.current;
    if (current < 0 || current >= count) commit(mod(current, count), false);
  }, [commit, count]);

  // Fallback for when `transitionend` never fires (hidden tab, interrupted transition).
  useEffect(() => {
    if (pos >= 0 && pos < count) return;
    const t = window.setTimeout(settleClone, SLIDE_MS + 60);
    return () => window.clearTimeout(t);
  }, [pos, count, settleClone]);

  useEffect(() => {
    const update = () => setPageHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const autoplay =
    motionOK && !hovered && !focused && !dragging && !pageHidden && count > perView;

  useEffect(() => {
    if (!autoplay) return;
    const t = window.setTimeout(() => shift(1), AUTOPLAY_MS);
    return () => window.clearTimeout(t);
  }, [autoplay, pos, shift]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" || !e.isPrimary || count < 2) return;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, axis: null };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (drag.axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (drag.axis === "x") setDragging(true);
    }
    if (drag.axis !== "x") return;
    setAnimated(false);
    setDragPx(dx);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    dragRef.current = null;
    if (drag.axis !== "x") return;
    const dx = e.clientX - drag.x;
    setDragging(false);
    setDragPx(0);
    if (e.type !== "pointercancel" && Math.abs(dx) > SWIPE_THRESHOLD_PX) {
      shift(dx < 0 ? 1 : -1);
    } else {
      commit(posRef.current, motionOK);
    }
  };

  const slides = [
    ...testimonials.slice(count - LEAD_CLONES).map((t, k) => ({
      t,
      real: count - LEAD_CLONES + k,
      clone: true,
    })),
    ...testimonials.map((t, i) => ({ t, real: i, clone: false })),
    ...testimonials.slice(0, TAIL_CLONES).map((t, i) => ({ t, real: i, clone: true })),
  ];

  const trackStyle = {
    "--tst-index": pos + LEAD_CLONES,
    "--tst-drag": `${dragPx}px`,
  } as CSSProperties;

  return (
    <section id={id} className="fade-section learner-tst-section" aria-labelledby={`${id}-title`}>
      <div className="learner-tst-inner">
        <div className="learner-tst-header">
          {eyebrow ? <span className="learner-tst-eyebrow">{eyebrow}</span> : null}
          <h2 id={`${id}-title`} className="lingo-display learner-tst-title">
            {title}
          </h2>
          {subtitle ? <p className="learner-tst-sub">{subtitle}</p> : null}
        </div>

        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Learner testimonials"
          data-testid="testimonial-carousel"
          className="learner-tst-carousel"
          onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
          }}
        >
          <div
            className="learner-tst-window"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <div
              className="learner-tst-track"
              data-testid="testimonial-track"
              data-animated={animated ? "" : undefined}
              aria-live={autoplay ? "off" : "polite"}
              style={trackStyle}
              onTransitionEnd={(e) => {
                if (e.target === e.currentTarget && e.propertyName === "transform") settleClone();
              }}
            >
              {slides.map(({ t, real, clone }, i) => {
                const inView = mod(real - active, count) < perView;
                return (
                  <figure
                    key={`${clone ? "clone" : "slide"}-${i}`}
                    className="learner-tst-card"
                    data-testid={clone ? undefined : "testimonial-card"}
                    data-clone={clone ? "" : undefined}
                    data-active={!clone && real === active ? "true" : undefined}
                    role={clone ? undefined : "group"}
                    aria-roledescription={clone ? undefined : "slide"}
                    aria-label={clone ? undefined : `${real + 1} of ${count}`}
                    aria-hidden={clone || !inView ? true : undefined}
                  >
                    <span className="learner-tst-mark" aria-hidden>
                      &ldquo;
                    </span>
                    <blockquote className="learner-tst-quote">
                      <p>{t.quote}</p>
                    </blockquote>
                    <figcaption className="learner-tst-role">{t.role}</figcaption>
                  </figure>
                );
              })}
            </div>
          </div>

          {count > 1 ? (
            <div className="learner-tst-controls">
              <button
                type="button"
                className="learner-tst-arrow"
                aria-label="Previous testimonial"
                data-testid="testimonial-previous"
                onClick={() => shift(-1)}
              >
                <ChevronLeft size={20} strokeWidth={2.2} aria-hidden />
              </button>
              <div className="learner-tst-dots">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="learner-tst-dot"
                    aria-label={`Show testimonial ${i + 1}`}
                    aria-current={i === active ? "true" : undefined}
                    data-testid="testimonial-dot"
                    onClick={() => goTo(i)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="learner-tst-arrow"
                aria-label="Next testimonial"
                data-testid="testimonial-next"
                onClick={() => shift(1)}
              >
                <ChevronRight size={20} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
