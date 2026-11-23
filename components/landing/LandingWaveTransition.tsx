"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import styles from "./NewLandingPage.module.css";

const LAYERS = [
  { file: "01_rear_seafoam", offsetY: -54, phaseX: -7 },
  { file: "02_middle_aqua", offsetY: -22, phaseX: 5 },
  { file: "03_front_turquoise_foam", offsetY: 10, phaseX: 0 },
];

// The full PNG canvases share one coordinate system. The 150% canvas provides
// overscan for the settled drift; desktop uses a wider 180% canvas.
// Each picture selects a desktop-specific shallow wave at 900px and above.
export default function LandingWaveTransition() {
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: stage,
    offset: ["start end", "end start"],
  });
  // Keep full-width coverage while the staggered swells move with the scroll.
  const rearX = useTransform(scrollYProgress, [0, 1], [-24, 24]);
  const middleX = useTransform(scrollYProgress, [0, 1], [36, -36]);
  const frontX = useTransform(scrollYProgress, [0, 1], [-48, 48]);
  const positions = [rearX, middleX, frontX];

  return (
    <div
      ref={stage}
      className={styles.waveTransition}
      data-wave-transition
      aria-hidden="true"
    >
      <div className={styles.waveCanvas}>
        {LAYERS.map((layer, index) => (
          <motion.div
            key={layer.file}
            className={styles.waveBand}
            data-wave-layer={index}
            initial={false}
            style={{
              // Stagger the crests to create overlapping swells.
              left: `${layer.phaseX}%`,
              top: `calc(${(layer.offsetY / 724) * 100}% * var(--wave-offset-scale))`,
              x: reduced ? 0 : positions[index],
            }}
          >
            <picture>
              <source
                media="(min-width: 900px)"
                srcSet={`/home/redesign-v2/waves/desktop-v2/${layer.file}.png`}
              />
              <Image
                src={`/home/redesign-v2/waves/${layer.file}.png`}
                alt=""
                fill
                unoptimized
                loading="eager"
                draggable={false}
              />
            </picture>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
