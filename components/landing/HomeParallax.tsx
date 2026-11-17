"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import styles from "./HomeParallax.module.css";

// Back-to-front order. Small offsets keep the reconstructed overlap concealed.
const LAYERS = [
  { file: "01_sky.png", speed: 0.12 },
  { file: "02_distance.png", speed: 0.085 },
  { file: "03_ocean_beach.png", speed: 0.055 },
  { file: "04_characters_land.png", speed: 0.025 },
  { file: "05_speech_bubbles-vector.svg", speed: 0.025 },
  { file: "06_foreground.png", speed: -0.025 },
];

export default function HomeParallax() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const hero = scene?.closest("section");
    if (!scene || !hero) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 1024px)");
    let frame = 0;
    let visible = true;
    let origin = hero.getBoundingClientRect().top + window.scrollY;
    const layers = Array.from(scene.children) as HTMLElement[];

    const bubbles = Array.from(scene.querySelectorAll<HTMLElement>("[data-bubble]"));

    function positionPivots() {
      // Match hero-home-img: contain on mobile, cover on desktop, center bottom.
      const { width, height } = scene!.getBoundingClientRect();
      const scale = mobile.matches
        ? Math.min(width / 1585, height / 992)
        : Math.max(width / 1585, height / 992);
      const left = (width - 1585 * scale) / 2;
      const top = height - 992 * scale;
      const tips = [{ x: 297, y: 614 }, { x: 1312, y: 636 }];
      bubbles.forEach((bubble, index) => {
        bubble.style.transformOrigin = `${left + tips[index].x * scale}px ${top + tips[index].y * scale}px`;
      });
    }

    function update() {
      frame = 0;
      // At the initial scroll position the artwork stays exactly aligned.
      const travel = reducedMotion.matches
        ? 0
        : Math.min(500, Math.max(0, window.scrollY - Math.max(0, origin)));
      const strength = mobile.matches ? 1 : 2.5;
      // Scroll position drives a gentle rocking motion; there is no idle loop.
      const angle = reducedMotion.matches ? 0 : Math.sin(travel / 45) * (mobile.matches ? 2.2 : 4);
      bubbles.forEach((bubble, index) => {
        bubble.style.transform = `rotate(${(angle * (index === 0 ? 1 : -0.85)).toFixed(3)}deg)`;
      });
      layers.forEach((layer, index) => {
        layer.style.transform = `translate3d(0, ${(travel * LAYERS[index].speed * strength).toFixed(2)}px, 0)`;
      });
    }

    function schedule() {
      if (!frame && visible) frame = window.requestAnimationFrame(update);
    }

    function resize() {
      origin = hero!.getBoundingClientRect().top + window.scrollY;
      positionPivots();
      schedule();
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    });
    observer.observe(hero);
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(hero);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize);
    reducedMotion.addEventListener("change", update);
    mobile.addEventListener("change", resize);
    positionPivots();
    update();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      sizeObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      reducedMotion.removeEventListener("change", update);
      mobile.removeEventListener("change", resize);
    };
  }, []);

  return (
    <div ref={sceneRef} aria-hidden="true" className={`hero-scene-media ${styles.scene}`}>
      {LAYERS.map(({ file }) => (
        <div key={file} className={styles.layer} data-parallax-layer={file}>
          {file === "05_speech_bubbles-vector.svg" ? (
            ["left", "right"].map((side) => (
              <div key={side} data-bubble={side} className={`${styles.bubble} ${side === "left" ? styles.leftBubble : styles.rightBubble}`}>
                <Image src={`/home/parallax-v3/${file}`} alt="" fill priority sizes="100vw" quality={90} className="hero-home-img" draggable={false} />
              </div>
            ))
          ) : <Image
            src={`/home/parallax-v3/${file}`}
            alt=""
            fill
            priority
            sizes="100vw"
            quality={90}
            className="hero-home-img"
            draggable={false}
          />}
        </div>
      ))}
    </div>
  );
}
