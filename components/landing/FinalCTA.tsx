"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import PrimaryButton from "./PrimaryButton";

type FinalCTAProps = {
  heading?: ReactNode;
  subline?: ReactNode;
  cardTitle?: string;
  cardBody?: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
};

export default function FinalCTA({
  heading = (
    <>Ready to build vocabulary you can actually use?</>
  ),
  subline = "Create a Topic Island and start building vocabulary around topics that matter to your real life. Free to start — no account needed.",
  cardTitle = "Create Topic Island",
  cardBody = "Pick a topic → get 10–20 useful words with real-life sentences at your level. Free to start.",
  ctaLabel = "Build your first island — free",
  ctaHref = "/onboarding/journey",
}: FinalCTAProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(to bottom, rgba(239,249,252,0) 0%, var(--lingo-sky-pale) 45%, var(--lingo-sky-soft) 100%)",
      }}
    >
      <div style={{ padding: "100px 24px 100px" }}>
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.45 }}
          style={{ maxWidth: 1000, margin: "0 auto" }}
        >
          <div className="grid grid-cols-1 items-center gap-12 md:grid-cols-2">
            {/* Left: copy */}
            <div>
              <h2
                className="lingo-display"
                style={{
                  fontSize: 34,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  color: "var(--lingo-navy)",
                  marginBottom: 16,
                }}
              >
                {heading}
              </h2>
              <p
                style={{
                  fontSize: 17,
                  color: "var(--lingo-text-muted)",
                  lineHeight: 1.65,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  maxWidth: 460,
                }}
              >
                {subline}
              </p>
            </div>

            {/* Right: CTA card */}
            <div>
              <div
                style={{
                  background: "linear-gradient(160deg, #ffffff 0%, #F6FBFD 100%)",
                  border: "1px solid rgba(72,150,175,0.12)",
                  borderRadius: 24,
                  boxShadow: "0 14px 40px rgba(44,105,128,0.08), 0 2px 8px rgba(44,105,128,0.05)",
                  padding: 28,
                }}
              >
                <h3
                  className="lingo-display"
                  style={{
                    fontWeight: 600,
                    fontSize: 18,
                    color: "var(--lingo-navy)",
                    marginBottom: 8,
                  }}
                >
                  {cardTitle}
                </h3>
                <p
                  style={{
                    fontSize: 13.5,
                    color: "var(--lingo-text-muted)",
                    lineHeight: 1.65,
                    marginBottom: 22,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {cardBody}
                </p>
                <PrimaryButton href={ctaHref} className="w-full" style={{ display: "flex" }}>
                  {ctaLabel}
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-[3px]">
                    →
                  </span>
                </PrimaryButton>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
