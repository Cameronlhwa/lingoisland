"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const testimonials = [
  {
    quote:
      "I finally stopped memorizing random lists. Picking my own topics made my Mandarin actually usable in conversations.",
  },
  {
    quote:
      "The topic-island approach is the first thing that's helped me break the intermediate plateau. It feels targeted, not generic.",
  },
  {
    quote:
      "No gimmicks, just real sentences I can actually use. It's refreshingly straightforward.",
  },
  {
    quote:
      "I made an island for hospital visits and used the phrases the same week. This is the most practical Mandarin tool I've tried.",
  },
  {
    quote:
      "I grew up speaking Mandarin at home, but only knew how to talk about food and family stuff. This helped me finally sound fluent in work meetings and everyday situations.",
  },
];

export default function TestimonialsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const carouselRef = useRef<HTMLDivElement>(null);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  }, []);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;
    const interval = setInterval(goToNext, 6000);
    return () => clearInterval(interval);
  }, [goToNext, isPaused, prefersReducedMotion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!carouselRef.current?.contains(document.activeElement)) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goToPrevious(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goToNext(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious]);

  const currentTestimonial = testimonials[currentIndex];

  return (
    <div
      ref={carouselRef}
      style={{
        background: "#EAF4FB",
        borderRadius: 16,
        border: "1px solid rgba(33,118,174,0.15)",
        padding: 28,
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsPaused(false);
      }}
      role="region"
      aria-label="Testimonials carousel"
      aria-live="polite"
    >
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#071E2E",
          marginBottom: 20,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        What learners say
      </h3>

      <div style={{ position: "relative", minHeight: 130, marginBottom: 20 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIndex}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <blockquote
              style={{
                fontFamily: "'Lora', Georgia, serif",
                fontStyle: "italic",
                fontSize: 16,
                lineHeight: 1.65,
                color: "#071E2E",
                marginBottom: 12,
              }}
            >
              &ldquo;{currentTestimonial.quote}&rdquo;
            </blockquote>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* Navigation arrows */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { fn: goToPrevious, label: "Previous testimonial", icon: ChevronLeft },
            { fn: goToNext, label: "Next testimonial", icon: ChevronRight },
          ].map(({ fn, label, icon: Icon }) => (
            <button
              key={label}
              onClick={fn}
              aria-label={label}
              style={{
                borderRadius: "50%",
                border: "1px solid rgba(33,118,174,0.2)",
                background: "#fff",
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#3a6e88",
                transition: "background 0.15s",
              }}
            >
              <Icon style={{ width: 16, height: 16 }} />
            </button>
          ))}
        </div>

        {/* Dot indicators */}
        <div style={{ display: "flex", gap: 6 }} role="tablist" aria-label="Testimonials">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              aria-label={`Go to testimonial ${index + 1}`}
              aria-selected={index === currentIndex}
              role="tab"
              style={{
                height: 6,
                width: index === currentIndex ? 18 : 6,
                borderRadius: index === currentIndex ? 3 : "50%",
                background: index === currentIndex ? "#2176AE" : "#C2D8E8",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
