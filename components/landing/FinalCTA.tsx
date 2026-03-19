"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

export default function FinalCTA() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      style={{ background: "#D6EEF8", position: "relative", overflow: "hidden" }}
    >
      {/* Inverted wave at top — transitions from #F4F8FB (FAQ) into #D6EEF8 */}
      <svg
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        aria-hidden
        style={{
          display: "block",
          width: "100%",
          transform: "scaleY(-1)",
          marginBottom: -2,
        }}
      >
        <path
          d="M0,40 C240,80 480,10 720,45 C960,80 1200,15 1440,45 L1440,90 L0,90 Z"
          fill="#C2E4F0"
          opacity="0.55"
        />
        <path
          d="M0,55 C300,25 600,75 900,50 C1100,32 1280,65 1440,55 L1440,90 L0,90 Z"
          fill="#ACD8EC"
          opacity="0.5"
        />
        <path
          d="M0,68 C200,55 500,78 800,65 C1050,54 1250,72 1440,65 L1440,90 L0,90 Z"
          fill="#D6EEF8"
          opacity="1"
        />
      </svg>

      <div style={{ padding: "40px 24px 80px" }}>
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4 }}
          style={{ maxWidth: 900, margin: "0 auto" }}
        >
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            {/* Left: copy */}
            <div>
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
                Ready to build vocabulary you can{" "}
                <em style={{ fontStyle: "italic", color: "#2176AE" }}>
                  actually use?
                </em>
              </h2>
              <p
                style={{
                  fontSize: 16,
                  color: "#3a6e88",
                  lineHeight: 1.65,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                Create a Topic Island and start building vocabulary around topics
                that matter to your real life. Free to start — no account needed.
              </p>
            </div>

            {/* Right: CTA card */}
            <div>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  border: "1px solid rgba(0,80,120,0.12)",
                  padding: 28,
                }}
              >
                <h3
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontWeight: 600,
                    fontSize: 18,
                    color: "#071E2E",
                    marginBottom: 8,
                  }}
                >
                  Create Topic Island
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "#3a6e88",
                    lineHeight: 1.65,
                    marginBottom: 20,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  Pick a topic → get 10–20 useful words with real-life sentences
                  at your level. Free to start.
                </p>
                <Link
                  href="/onboarding/topic-island"
                  style={{
                    display: "block",
                    width: "100%",
                    background: "#071E2E",
                    color: "#fff",
                    borderRadius: 10,
                    padding: "13px 26px",
                    fontSize: 15,
                    fontWeight: 500,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    textDecoration: "none",
                    textAlign: "center",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  }}
                  className="hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(7,30,46,0.22)]"
                >
                  Build your first island — free →
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
