"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import {
  CELEBRATION_DURATION_MS, claimCelebration, isCelebrationEligible,
  playCelebrationSound, stopCelebrationSound, type CelebrationResult,
} from "@/lib/pronunciation/celebration";

type Particle = { x: number; y: number; vx: number; vy: number; angle: number; spin: number; width: number; height: number; color: string; round: boolean };
const COLORS = ["#20674F", "#8EDAD9", "#EFBF56", "#E99076", "#70A894"];

export default function ScoreCelebration({ result, anchorRef }: {
  result: CelebrationResult;
  anchorRef: RefObject<HTMLDivElement>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!isCelebrationEligible(result)) return;
    setVisible(true);
    let frame = 0;
    let startedAt: number | null = null;
    let particles: Particle[] = [];
    let context: CanvasRenderingContext2D | null = null;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hide = () => {
      cancelAnimationFrame(frame);
      context?.clearRect(0, 0, innerWidth, innerHeight);
      setVisible(false);
    };
    const stop = () => { hide(); stopCelebrationSound(); };
    const onVisibility = () => { if (document.hidden) stop(); };
    const onMotionChange = () => { if (motion.matches) hide(); };
    document.addEventListener("visibilitychange", onVisibility);
    motion.addEventListener("change", onMotionChange);
    window.addEventListener("resize", hide);

    // Claim inside the animation frame: React Strict Mode's setup/cleanup probe
    // cancels the first frame without consuming the celebration.
    frame = requestAnimationFrame(() => {
      if (document.hidden || !claimCelebration(result)) { setVisible(false); return; }
      void playCelebrationSound();
      const canvas = canvasRef.current;
      if (motion.matches || !canvas) { setVisible(false); return; }
      context = canvas.getContext("2d");
      if (!context) { setVisible(false); return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      context.scale(dpr, dpr);
      const rect = anchorRef.current?.getBoundingClientRect();
      const x = Math.max(48, Math.min(innerWidth - 48, rect ? rect.left + rect.width / 2 : innerWidth / 2));
      const y = Math.max(100, Math.min(innerHeight - 80, rect ? rect.top + rect.height / 2 : innerHeight * 0.6));
      particles = Array.from({ length: 56 }, (_, index) => ({
        x, y, vx: (Math.random() - 0.5) * 310, vy: -170 - Math.random() * 210,
        angle: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 12,
        width: 4 + Math.random() * 5, height: 4 + Math.random() * 8,
        color: COLORS[index % COLORS.length], round: index % 5 === 0,
      }));
      const draw = (timestamp: number) => {
        if (!context) return;
        if (startedAt === null) startedAt = timestamp;
        const elapsed = timestamp - startedAt;
        if (elapsed >= CELEBRATION_DURATION_MS) { hide(); return; }
        const t = elapsed / 1000;
        context.clearRect(0, 0, innerWidth, innerHeight);
        context.globalAlpha = Math.min(1, (CELEBRATION_DURATION_MS - elapsed) / 400);
        for (const particle of particles) {
          context.save();
          context.translate(particle.x + particle.vx * t, particle.y + particle.vy * t + 270 * t * t);
          context.rotate(particle.angle + particle.spin * t);
          context.fillStyle = particle.color;
          if (particle.round) {
            context.beginPath();
            context.arc(0, 0, particle.width / 2, 0, Math.PI * 2);
            context.fill();
          } else {
            context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
          }
          context.restore();
        }
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    });
    return () => {
      cancelAnimationFrame(frame);
      stopCelebrationSound();
      document.removeEventListener("visibilitychange", onVisibility);
      motion.removeEventListener("change", onMotionChange);
      window.removeEventListener("resize", hide);
    };
  }, [result.attemptId, result.overallScore, result.newlyScored, anchorRef]);

  if (!visible || !isCelebrationEligible(result) || typeof document === "undefined") return null;
  return createPortal(<canvas ref={canvasRef} aria-hidden="true" data-pronunciation-celebration=""
    className="pointer-events-none fixed inset-0 z-[80] h-full w-full" />, document.body);
}
