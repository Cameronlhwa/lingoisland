"use client";

import Link from "next/link";
import Image from "next/image";
import { FOUNDER_STRIP } from "@/lib/landing-content";
import { motion, useReducedMotion } from "framer-motion";

const FOUNDER_IMAGE = "/Cameron Lim Profile Photo.jpg";

export default function FounderStrip() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="founder-strip"
      className="fade-section"
      style={{ background: "#fff", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4 }}
          style={{
            background: "#EAF4FB",
            borderRadius: 20,
            border: "1px solid rgba(33,118,174,0.15)",
            padding: "36px 40px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 32,
            flexWrap: "wrap",
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              overflow: "hidden",
              flexShrink: 0,
              border: "3px solid #fff",
              boxShadow: "0 2px 12px rgba(33,118,174,0.15)",
            }}
          >
            <Image
              src={FOUNDER_IMAGE}
              alt="Cameron Lim, founder of LingoIsland"
              width={80}
              height={80}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
              sizes="80px"
            />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 600,
                fontSize: 18,
                color: "#071E2E",
                marginBottom: 6,
              }}
            >
              {FOUNDER_STRIP.headline}
            </h2>
            <p
              style={{
                fontSize: 14,
                color: "#3a6e88",
                lineHeight: 1.65,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                marginBottom: 14,
              }}
            >
              {FOUNDER_STRIP.blurb}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FOUNDER_STRIP.metrics.map((m) => (
                <span
                  key={m.value}
                  style={{
                    background: "#fff",
                    border: "1px solid rgba(0,80,120,0.15)",
                    borderRadius: 20,
                    padding: "4px 14px",
                    fontSize: 12,
                    color: "#2176AE",
                    fontWeight: 500,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {m.value}
                </span>
              ))}
            </div>
          </div>

          {/* CTA */}
          <Link
            href={FOUNDER_STRIP.ctaHref}
            style={{
              background: "#071E2E",
              color: "#fff",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              textDecoration: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            className="hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(7,30,46,0.2)]"
          >
            {FOUNDER_STRIP.ctaLabel} →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
