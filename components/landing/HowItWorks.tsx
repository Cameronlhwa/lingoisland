"use client";

import { HOW_IT_WORKS_STEPS } from "@/lib/landing-content";
import { motion, useReducedMotion } from "framer-motion";

export default function HowItWorks() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      className="fade-section"
      style={{ background: "#F4F8FB", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontWeight: 600,
              fontSize: 36,
              lineHeight: 1.15,
              color: "#071E2E",
              marginBottom: 12,
            }}
          >
            How it works
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#3a6e88",
              lineHeight: 1.65,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            A simple loop designed for consistent, real-life vocabulary growth.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3" style={{ position: "relative" }}>
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              style={{ position: "relative" }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.07)",
                  padding: "28px 24px",
                  height: "100%",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Watermark step number */}
                <div
                  aria-hidden
                  style={{
                    fontFamily: "'Lora', Georgia, serif",
                    fontSize: 72,
                    fontWeight: 600,
                    color: "#D6EEF8",
                    lineHeight: 1,
                    position: "absolute",
                    top: 12,
                    right: 16,
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  {index + 1}
                </div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#071E2E",
                    marginBottom: 10,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "#5a7a88",
                    lineHeight: 1.65,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {step.description}
                </p>
              </div>

              {/* Dashed connector */}
              {index < HOW_IT_WORKS_STEPS.length - 1 && (
                <div
                  className="hidden md:block"
                  style={{
                    position: "absolute",
                    right: -13,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 24,
                    borderTop: "2px dashed #C2D8E8",
                    zIndex: 2,
                  }}
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
