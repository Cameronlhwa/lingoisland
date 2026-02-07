"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";

const BOAT_IMAGE = "/boats/boat-capybara.png";

function getCenter(el: HTMLElement | null, container: DOMRect): { x: number; y: number } | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - container.left,
    y: rect.top + rect.height / 2 - container.top,
  };
}

/**
 * Build smooth SVG path through three points in a V-shape that loops back.
 * Path: island1 → island2 → island3 → island1
 */
function buildPathD(p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }): string {
  // Forward path: p1 → p2 → p3
  const mid1x = (p1.x + p2.x) / 2;
  const mid1y = (p1.y + p2.y) / 2;
  const mid2x = (p2.x + p3.x) / 2;
  const mid2y = (p2.y + p3.y) / 2;
  
  // Return path: p3 → p1 (closing the loop)
  const mid3x = (p3.x + p1.x) / 2;
  const mid3y = (p3.y + p1.y) / 2;
  
  return `M ${p1.x} ${p1.y} Q ${mid1x} ${mid1y} ${p2.x} ${p2.y} Q ${mid2x} ${mid2y} ${p3.x} ${p3.y} Q ${mid3x} ${mid3y} ${p1.x} ${p1.y}`;
}

interface BoatRouteProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  islandRefs: React.RefObject<HTMLAnchorElement | null>[];
}

export default function BoatRoute({ containerRef, islandRefs }: BoatRouteProps) {
  const [pathD, setPathD] = useState<string | null>(null);
  const [boatLoaded, setBoatLoaded] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  const updatePath = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const p1 = getCenter(islandRefs[0]?.current ?? null, containerRect);
    const p2 = getCenter(islandRefs[1]?.current ?? null, containerRect);
    const p3 = getCenter(islandRefs[2]?.current ?? null, containerRect);
    if (p1 && p2 && p3) {
      setPathD(buildPathD(p1, p2, p3));
    }
  }, [containerRef, islandRefs]);

  useEffect(() => {
    updatePath();
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(updatePath);
    ro.observe(container);

    return () => {
      ro.disconnect();
    };
  }, [containerRef, updatePath]);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden
    >
      {/* Boat: continuously loops along the path unless motion is reduced */}
      {pathD && boatLoaded && !prefersReducedMotion && (
        <motion.div
          className="absolute w-48 h-48 md:w-56 md:h-56 z-20"
          style={{
            offsetPath: `path("${pathD}")`,
            offsetRotate: "0deg",
            transform: "translateY(100px)", // Move boat even lower than island centers
          }}
          animate={{
            offsetDistance: ["0%", "100%"],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BOAT_IMAGE}
            alt=""
            className="h-full w-full object-contain"
            onError={() => setBoatLoaded(false)}
          />
        </motion.div>
      )}
    </div>
  );
}
