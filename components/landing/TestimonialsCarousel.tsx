"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

const testimonials = [
  {
    quote:
      "I finally stopped memorizing random lists. Picking my own topics made my Mandarin actually usable in conversations.",
    name: "Ava",
    level: "B1 learner",
    image: "/testimonials/ava.png",
  },
  {
    quote:
      "The topic-island approach is the first thing that's helped me break the intermediate plateau. It feels targeted, not generic.",
    name: "Daniel",
    level: "B2 learner",
    image: "/testimonials/daniel.png",
  },
  {
    quote:
      "No gimmicks, just real sentences I can actually use. It's refreshingly straightforward.",
    name: "Mina",
    level: "Self-learner",
    image: "/testimonials/mina.png",
  },
  {
    quote:
      "I made an island for hospital visits and used the phrases the same week. This is the most practical Mandarin tool I've tried.",
    name: "Chris",
    level: "Busy professional",
    image: "/testimonials/chris.png",
  },
  {
    quote:
      "I grew up speaking Mandarin at home, but only knew how to talk about food and family stuff. This helped me finally sound fluent in work meetings and everyday situations.",
    name: "Jason",
    level: "Heritage learner",
    image: "/testimonials/jason.png",
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
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length,
    );
  }, []);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // Auto-advance every 6 seconds, unless paused or reduced motion
  useEffect(() => {
    if (prefersReducedMotion || isPaused) return;

    const interval = setInterval(goToNext, 6000);
    return () => clearInterval(interval);
  }, [goToNext, isPaused, prefersReducedMotion]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!carouselRef.current?.contains(document.activeElement)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious]);

  const currentTestimonial = testimonials[currentIndex];

  return (
    <div
      ref={carouselRef}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        // Only unpause if focus leaves the carousel entirely
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsPaused(false);
        }
      }}
      role="region"
      aria-label="Testimonials carousel"
      aria-live="polite"
    >
      {/* Title */}
      <h3 className="mb-6 text-lg font-semibold text-gray-900">
        What learners say
      </h3>

      {/* Testimonial content */}
      <div className="relative mb-6 min-h-[180px] md:min-h-[160px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentIndex}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 10 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -10 }
            }
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="space-y-4"
          >
            {/* Quote */}
            <blockquote className="text-lg leading-relaxed text-gray-800 md:text-xl">
              "{currentTestimonial.quote}"
            </blockquote>

            {/* Attribution */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-50 to-blue-100">
                  <Image
                    src={currentTestimonial.image}
                    alt={`${currentTestimonial.name}'s photo`}
                    width={48}
                    height={48}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {currentTestimonial.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {currentTestimonial.level}
                  </p>
                </div>
              </div>
              {/* Stars */}
              <div className="flex gap-0.5 text-blue-900" aria-hidden="true">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-lg">
                    ★
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        {/* Navigation arrows */}
        <div className="flex gap-2">
          <button
            onClick={goToPrevious}
            className="rounded-full border border-gray-300 p-2 text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goToNext}
            className="rounded-full border border-gray-300 p-2 text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Dot indicators */}
        <div className="flex gap-2" role="tablist" aria-label="Testimonials">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 w-2 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${
                index === currentIndex
                  ? "w-6 bg-gray-900"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Go to testimonial ${index + 1}`}
              aria-selected={index === currentIndex}
              role="tab"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
