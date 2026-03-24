"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

export default function ProofDemo() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="demo"
      className="fade-section"
      style={{ background: "#F4F8FB", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Left: copy */}
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4 }}
          >
            <h2
              style={{
                fontFamily: "'Lora', Georgia, serif",
                fontWeight: 600,
                fontSize: 36,
                lineHeight: 1.15,
                color: "#071E2E",
                marginBottom: 16,
              }}
            >
              See a Topic Island{" "}
              <em style={{ fontStyle: "italic", color: "#2176AE" }}>in action</em>
            </h2>
            <p
              style={{
                fontSize: 16,
                color: "#3a6e88",
                lineHeight: 1.65,
                marginBottom: 24,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              Watch how we generate authentic, level-tuned sentences for topics
              you care about.
            </p>

            {/* Callout box */}
            <div
              style={{
                borderLeft: "3px solid #2176AE",
                background: "#EAF4FB",
                borderRadius: 12,
                padding: "18px 20px",
                marginBottom: 28,
              }}
            >
              <p
                style={{
                  fontWeight: 600,
                  color: "#071E2E",
                  fontSize: 14,
                  marginBottom: 6,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                Authentic sentences + Level tuning
              </p>
              <p
                style={{
                  color: "#3a6e88",
                  fontSize: 13,
                  lineHeight: 1.65,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                This is the core differentiator: vocabulary you can actually use
                in real life, calibrated to your current level.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
              <Link
                href="/onboarding/journey"
                style={{
                  background: "#071E2E",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "13px 26px",
                  fontSize: 15,
                  fontWeight: 500,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  textDecoration: "none",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  display: "inline-block",
                }}
                className="hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(7,30,46,0.22)]"
              >
                Build your first island — free
              </Link>
              <a
                href="#topics"
                style={{
                  color: "#2176AE",
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  textDecoration: "none",
                }}
              >
                See an example island ↓
              </a>
            </div>
          </motion.div>

          {/* Right: video mockup */}
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{
              background: "#071E2E",
              borderRadius: 20,
              padding: 12,
              boxShadow: "0 20px 60px rgba(7,30,46,0.25)",
            }}
          >
            <div style={{ borderRadius: 12, overflow: "hidden" }}>
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{ width: "100%", height: "100%", display: "block" }}
                aria-label="Demo video showing topic island creation"
              >
                <source src="/Recording of Lingoisland2.mov" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
