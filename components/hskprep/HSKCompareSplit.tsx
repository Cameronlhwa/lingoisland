"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HSK_COMPARE } from "@/lib/hskprep-content";
import SectionHeader from "@/components/landing/SectionHeader";

type IslandUnit = {
  title: string;
  word?: string;
  pinyin?: string;
  level?: string;
  wordCount?: string;
};

type CompareData = {
  textbookUnits: { unit: string; title: string; page: string }[];
  textbookEyebrow?: string;
  textbookTitle?: string;
  islandEyebrow?: string;
  reasonPrompt?: string;
  reasonAnswer?: string;
  topics?: string[];
  islandUnits?: IslandUnit[];
};

export default function HSKCompareSplit({
  id,
  eyebrow = "Your pace",
  title = "Not a rigid textbook order",
  compare = HSK_COMPARE,
  textbookFootnote = "Fixed order, fixed pace — whether it fits your life or not.",
  islandFootnote = "Your order, your pace.",
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  compare?: CompareData;
  textbookFootnote?: string;
  islandFootnote?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const {
    textbookUnits,
    textbookEyebrow = "A Textbook",
    textbookTitle,
    islandEyebrow = "LingoIsland",
    reasonPrompt,
    reasonAnswer,
    topics,
    islandUnits,
  } = compare;

  const units: IslandUnit[] = islandUnits ?? (topics ?? []).map((t) => ({ title: t }));
  const quoteDelay = prefersReducedMotion ? 0 : 0.5;
  const unitBaseDelay = prefersReducedMotion ? 0 : reasonAnswer ? 1.4 : 0.35;
  const unitStagger = prefersReducedMotion ? 0 : 0.55;

  return (
    <section
      id={id}
      className="fade-section"
      style={{
        background:
          "radial-gradient(circle at 90% 10%, rgba(160,224,239,0.14), transparent 30%), #FCFEFF",
        padding: "120px 24px",
      }}
    >
      <style jsx>{`
        .hsk-textbook-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 4px;
          border-bottom: 1px solid rgba(75, 145, 170, 0.14);
        }
        .hsk-textbook-row:last-of-type {
          border-bottom: none;
        }
        .hsk-textbook-num {
          width: 26px;
          height: 26px;
          border-radius: 999px;
          flex-shrink: 0;
          background: rgba(102, 134, 154, 0.12);
          color: var(--lingo-text-muted);
          font-weight: 700;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "DM Sans", system-ui, sans-serif;
        }
        .hsk-textbook-title {
          flex: 1;
          font-size: 13.5px;
          color: var(--lingo-text-muted);
          font-weight: 500;
          font-family: "DM Sans", system-ui, sans-serif;
        }
        .hsk-textbook-page {
          font-size: 11px;
          color: var(--lingo-text-muted);
          opacity: 0.7;
          font-family: "DM Sans", system-ui, sans-serif;
        }

        .hsk-compare-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid var(--lingo-border);
          background: #fff;
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease,
            background 200ms ease;
        }
        .hsk-compare-row + .hsk-compare-row {
          margin-top: 10px;
        }
        .hsk-compare-unit {
          display: block;
        }
        .hsk-compare-unit + .hsk-compare-unit {
          margin-top: 10px;
        }
        .hsk-compare-row:hover {
          transform: translateY(-2px);
          box-shadow: var(--lingo-shadow-card-hover);
          border-color: var(--lingo-accent-border);
          background: var(--lingo-sky-pale);
        }
        .hsk-row-num {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          flex-shrink: 0;
          background: var(--lingo-accent-gradient);
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "DM Sans", system-ui, sans-serif;
          box-shadow: 0 4px 10px -3px rgba(33, 118, 174, 0.4);
        }
        .hsk-row-body {
          flex: 1;
          min-width: 0;
        }
        .hsk-row-title {
          font-weight: 700;
          font-size: 14.5px;
          color: var(--lingo-navy);
          font-family: "DM Sans", system-ui, sans-serif;
          margin-bottom: 6px;
        }
        .hsk-row-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .hsk-level-pill {
          background: var(--lingo-navy);
          color: #fff;
          font-size: 10.5px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 999px;
          letter-spacing: 0.02em;
          font-family: "DM Sans", system-ui, sans-serif;
        }
        .hsk-word-tag {
          background: var(--lingo-accent-tint);
          color: var(--lingo-navy);
          border: 1px solid var(--lingo-accent-border);
          font-size: 11.5px;
          font-weight: 600;
          padding: 3px 9px;
          border-radius: 999px;
          font-family: "DM Sans", system-ui, sans-serif;
        }
        .hsk-word-count {
          color: var(--lingo-text-muted);
          font-size: 11.5px;
          font-family: "DM Sans", system-ui, sans-serif;
        }
        .hsk-row-start {
          flex-shrink: 0;
          font-size: 12.5px;
          font-weight: 700;
          color: var(--lingo-navy);
          background: var(--lingo-sky-pale);
          border: 1px solid var(--lingo-border);
          padding: 7px 12px;
          border-radius: var(--lingo-radius-btn);
          transition: background 180ms ease, border-color 180ms ease;
          font-family: "DM Sans", system-ui, sans-serif;
        }
        .hsk-compare-row:hover .hsk-row-start {
          background: #fff;
          border-color: var(--lingo-accent-border);
        }

        @media (prefers-reduced-motion: reduce) {
          .hsk-compare-row,
          .hsk-row-start {
            transition: none;
          }
          .hsk-compare-row:hover {
            transform: none;
          }
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <SectionHeader eyebrow={eyebrow} title={title} />

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            aria-label="A traditional textbook's fixed unit order"
            style={{
              borderRadius: "var(--lingo-radius-card)",
              border: "1px solid var(--lingo-border)",
              background: "#F5F8FA",
              boxShadow: "var(--lingo-shadow-card)",
              padding: 28,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--lingo-text-muted)",
                marginBottom: textbookTitle ? 6 : 14,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {textbookEyebrow}
            </p>
            {textbookTitle && (
              <p
                className="lingo-display"
                style={{
                  fontSize: 17,
                  color: "var(--lingo-navy)",
                  marginBottom: 18,
                }}
              >
                {textbookTitle}
              </p>
            )}
            {textbookUnits.map((u, idx) => (
              <div className="hsk-textbook-row" key={u.unit}>
                <div className="hsk-textbook-num">{idx + 1}</div>
                <span className="hsk-textbook-title">{u.title}</span>
                <span className="hsk-textbook-page">{u.page}</span>
              </div>
            ))}
            <p
              style={{
                fontSize: 12.5,
                color: "var(--lingo-text-muted)",
                fontStyle: "italic",
                lineHeight: 1.5,
                marginTop: 16,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              {textbookFootnote}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            aria-label="LingoIsland's flexible, personalized topic order"
            style={{ position: "relative" }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: -24,
                borderRadius: 32,
                background:
                  "radial-gradient(60% 60% at 50% 40%, rgba(89,198,222,0.22), transparent 70%)",
                filter: "blur(28px)",
                zIndex: 0,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "relative",
                zIndex: 1,
                borderRadius: "var(--lingo-radius-card)",
                background: "#fff",
                border: "1px solid var(--lingo-border)",
                boxShadow: "var(--lingo-shadow-card-hover)",
                padding: 28,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--lingo-teal)",
                  background: "var(--lingo-accent-tint)",
                  border: "1px solid var(--lingo-accent-border)",
                  borderRadius: 999,
                  padding: "4px 12px",
                  marginBottom: 16,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {islandEyebrow}
              </span>

              {reasonPrompt && reasonAnswer && (
                <div style={{ marginBottom: 18 }}>
                  <motion.p
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
                    style={{
                      fontSize: 12.5,
                      color: "var(--lingo-text-muted)",
                      marginBottom: 4,
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    {reasonPrompt}
                  </motion.p>
                  <motion.p
                    className="lingo-display"
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.6,
                      delay: quoteDelay,
                    }}
                    style={{ fontSize: 17, color: "var(--lingo-navy)" }}
                  >
                    “{reasonAnswer}”
                  </motion.p>
                </div>
              )}

              <div>
                {units.map((u, idx) => (
                  <motion.div
                    className="hsk-compare-unit"
                    key={u.title}
                    initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.55,
                      delay: unitBaseDelay + idx * unitStagger,
                    }}
                  >
                    <div className="hsk-compare-row">
                      <div className="hsk-row-num">{idx + 1}</div>
                      <div className="hsk-row-body">
                        <div className="hsk-row-title">{u.title}</div>
                        {(u.level || u.word || u.wordCount) && (
                          <div className="hsk-row-meta">
                            {u.level && <span className="hsk-level-pill">{u.level}</span>}
                            {u.word && (
                              <span className="hsk-word-tag">
                                {u.word}
                                {u.pinyin ? ` · ${u.pinyin}` : ""}
                              </span>
                            )}
                            {u.wordCount && <span className="hsk-word-count">{u.wordCount}</span>}
                          </div>
                        )}
                      </div>
                      <span className="hsk-row-start">Start →</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--lingo-teal)",
                  fontWeight: 700,
                  marginTop: 18,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {islandFootnote}
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
