"use client";

import { HOW_IT_WORKS_STEPS } from "@/lib/landing-content";
import { motion, useReducedMotion } from "framer-motion";
import SectionHeader from "./SectionHeader";

type Step = { title: string; description: string };

type HowItWorksProps = {
  id?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  steps?: Step[];
};

const SHADOW = "0 14px 40px rgba(44,105,128,0.08), 0 2px 8px rgba(44,105,128,0.05)";
const SHADOW_HOVER = "0 20px 48px rgba(44,105,128,0.12), 0 5px 12px rgba(44,105,128,0.06)";

export default function HowItWorks({
  id = "how-it-works",
  eyebrow = "How it works",
  title = "How it works",
  subtitle = "A simple loop designed for consistent, real-life vocabulary growth.",
  steps = HOW_IT_WORKS_STEPS,
}: HowItWorksProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id={id}
      className="fade-section"
      style={{
        background:
          "radial-gradient(circle at 85% 15%, rgba(160,224,239,0.16), transparent 30%), radial-gradient(circle at 10% 70%, var(--lingo-accent-tint), transparent 32%), #FCFEFF",
        padding: "120px 24px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <SectionHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3" style={{ position: "relative" }}>
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.45, delay: index * 0.08 }}
              style={{ position: "relative" }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(72,150,175,0.12)",
                  borderRadius: 24,
                  padding: "28px 24px",
                  height: "100%",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: SHADOW,
                  transition: "box-shadow 0.25s ease, transform 0.25s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = SHADOW_HOVER;
                  e.currentTarget.style.transform = "translateY(-5px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = SHADOW;
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {/* Watermark step number */}
                <div
                  aria-hidden
                  className="lingo-display"
                  style={{
                    fontSize: 72,
                    fontWeight: 700,
                    color: "var(--lingo-sky)",
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
                  className="lingo-display"
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--lingo-navy)",
                    marginBottom: 10,
                    position: "relative",
                    zIndex: 1,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--lingo-text-muted)",
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
              {index < steps.length - 1 && (
                <div
                  className="hidden md:block"
                  style={{
                    position: "absolute",
                    right: -13,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 24,
                    borderTop: "2px dashed rgba(75,145,170,0.35)",
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
