"use client";

import { motion, useReducedMotion, useScroll, useTransform, useSpring } from "framer-motion";
import { useMemo } from "react";

// Navy color matching the island outline style from base_cappy.png and blank_island.png
// Matches the clean line-art stroke used in the island illustrations
const NAVY = "#0B1B3A";

// Calm Mode: if true, waves ONLY move with scroll (no auto-drift)
// if false, waves drift extremely slowly + respond to scroll
const CALM_SCROLL_ONLY = false; // Enable infinite loop

// WaveSquiggle: A single hand-drawn wave ripple SVG
// C-shaped single crest waves (most common) or double crest waves (rare)
function WaveSquiggle({ 
  className,
  size = "medium",
  variant = "single"
}: { 
  className?: string;
  size?: "small" | "medium" | "large";
  variant?: "single" | "double";
}) {
  // Wave configurations with C-shaped single crests or double crests
  const sizeConfig = {
    small: { 
      width: 50, 
      height: 20, 
      // Single C-shaped wave crest
      single: "M 2 16 Q 10 14, 18 8 Q 24 4, 32 8 Q 40 12, 48 14", 
      // Rare: double crest
      double: "M 2 16 Q 8 12, 14 8 Q 18 6, 22 8 Q 26 10, 30 8 Q 34 6, 38 8 Q 44 12, 48 14",
      strokeWidth: 2.5 
    },
    medium: { 
      width: 70, 
      height: 26, 
      // Single C-shaped wave crest (more pronounced)
      single: "M 2 22 Q 14 18, 26 10 Q 34 4, 44 10 Q 54 16, 68 20", 
      // Rare: double crest
      double: "M 2 22 Q 10 16, 18 10 Q 24 6, 30 10 Q 36 14, 42 10 Q 48 6, 54 10 Q 62 16, 68 20",
      strokeWidth: 3 
    },
    large: { 
      width: 90, 
      height: 30, 
      // Single C-shaped wave crest (large and flowing)
      single: "M 2 26 Q 18 22, 34 12 Q 46 4, 58 12 Q 72 20, 88 24", 
      // Rare: double crest
      double: "M 2 26 Q 12 20, 22 12 Q 30 6, 38 12 Q 46 18, 54 12 Q 62 6, 70 12 Q 80 20, 88 24",
      strokeWidth: 3.5 
    },
  };

  const config = sizeConfig[size];
  const pathData = variant === "single" ? config.single : config.double;

  return (
    <svg
      width={config.width}
      height={config.height}
      viewBox={`0 0 ${config.width} ${config.height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d={pathData}
        stroke={NAVY}
        strokeWidth={config.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

interface WaveParticle {
  id: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  scale: number;
  size: "small" | "medium" | "large"; // wave squiggle size
  variant: "single" | "double"; // single crest (most) or double crest (rare)
  driftDuration?: number; // only used if CALM_SCROLL_ONLY is false
  animationDelay?: number; // stagger animation start times
}

interface WaveLayer {
  particles: WaveParticle[];
  opacity: number;
  scrollXOffset: number; // how many pixels this layer shifts horizontally per full scroll
  scrollYMultiplier: number; // how much scroll affects vertical parallax
  driftSpeed?: number; // only used if CALM_SCROLL_ONLY is false
}

export function OceanBackground() {
  const shouldReduceMotion = useReducedMotion();
  const { scrollY } = useScroll();

  // Smooth scroll value with spring physics for nicer feel
  const smoothScrollY = useSpring(scrollY, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Baby blue gradient for the sea background - soft and calm
  const seaGradient = {
    top: "#EAF6FF",
    mid: "#CFEFFF",
    bottom: "#B7E5FF",
  };

  // Generate wave particles for each layer (memoized for performance)
  const waveLayers: WaveLayer[] = useMemo(() => {
    const generateParticles = (count: number, baseDuration: number): WaveParticle[] => {
      const sizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
      return Array.from({ length: count }, (_, i) => {
        // Mix of sizes with bias toward medium/large for more visibility
        const sizeWeights = [0.3, 0.4, 0.3]; // 30% small, 40% medium, 30% large
        const rand = Math.random();
        let size: "small" | "medium" | "large" = "medium";
        if (rand < sizeWeights[0]) size = "small";
        else if (rand < sizeWeights[0] + sizeWeights[1]) size = "medium";
        else size = "large";

        // Most waves are single crest (80%), only 20% are double crest
        const variant: "single" | "double" = Math.random() > 0.2 ? "single" : "double";

        const duration = baseDuration + Math.random() * 40;

        return {
          id: `wave-${count}-${i}`,
          x: Math.random() * 100,
          y: Math.random() * 100,
          scale: 0.7 + Math.random() * 0.5, // 0.7 - 1.2
          size,
          variant,
          driftDuration: duration,
          // Stagger animation start times so waves are distributed throughout the cycle
          animationDelay: -(Math.random() * duration), // negative delay = start partway through
        };
      });
    };

    return [
      {
        particles: generateParticles(40, 80), // increased count + base duration
        opacity: 0.18, // increased opacity for more visibility
        scrollXOffset: -150, // dramatic horizontal shift with scroll
        scrollYMultiplier: -0.6,
        driftSpeed: 100, // very slow baseline drift (if enabled)
      },
      {
        particles: generateParticles(35, 100), // increased count + base duration
        opacity: 0.12, // increased opacity
        scrollXOffset: -220, // dramatic medium horizontal shift
        scrollYMultiplier: -1.0,
        driftSpeed: 140,
      },
      {
        particles: generateParticles(30, 120), // increased count + base duration
        opacity: 0.08, // increased opacity
        scrollXOffset: -300, // dramatic larger horizontal shift
        scrollYMultiplier: -1.4,
        driftSpeed: 180,
      },
    ];
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Baby blue sea gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${seaGradient.top} 0%, ${seaGradient.mid} 50%, ${seaGradient.bottom} 100%)`,
        }}
      />

      {/* Wave particle layers */}
      {!shouldReduceMotion && waveLayers.map((layer, layerIndex) => {
        // Scroll-coupled horizontal motion: primary movement
        // Maps scroll position to horizontal offset for this layer
        const xOffset = useTransform(
          smoothScrollY,
          [0, 2000], // scroll range
          [0, layer.scrollXOffset] // horizontal shift range for this layer
        );

        // Scroll-reactive vertical parallax: subtle depth effect
        const yOffset = useTransform(
          smoothScrollY,
          [0, 2000],
          [0, layer.scrollYMultiplier * 100]
        );

        return (
          <motion.div
            key={`layer-${layerIndex}`}
            className="absolute inset-0"
            style={{ 
              x: xOffset, // scroll-coupled horizontal movement
              y: yOffset, // scroll-coupled vertical parallax
            }}
          >
            {layer.particles.map((particle) => {
              // Build animation props based on CALM_SCROLL_ONLY mode
              const animateProps = CALM_SCROLL_ONLY
                ? {} // no auto-drift, scroll-only movement
                : {
                    // Infinite horizontal loop - waves travel across screen and wrap
                    animate: {
                      x: ["-20vw", "120vw"], // Start off-screen left, end off-screen right
                    },
                    transition: {
                      duration: particle.driftDuration,
                      repeat: Infinity,
                      ease: "linear",
                      repeatType: "loop" as const, // Loop (not reverse) for continuous flow
                      delay: particle.animationDelay, // Stagger start times
                    },
                  };

              return (
                <motion.div
                  key={particle.id}
                  className="absolute"
                  style={{
                    left: `${particle.x}%`,
                    top: `${particle.y}%`,
                    opacity: layer.opacity,
                  }}
                  {...animateProps}
                >
                  <div style={{ transform: `scale(${particle.scale})` }}>
                    <WaveSquiggle size={particle.size} variant={particle.variant} />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        );
      })}
    </div>
  );
}
