"use client";

import { useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SHADOW = "0 14px 40px rgba(44,105,128,0.08), 0 2px 8px rgba(44,105,128,0.05)";
const SHADOW_REST = "0 1px 2px rgba(7,30,46,0.04), 0 8px 16px -12px rgba(33,118,174,0.2)";

type FAQItem = {
  question: string;
  answer: string;
};

type FAQAccordionProps = {
  items: FAQItem[];
};

export default function FAQAccordion({ items }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${baseId}-${index}`;
        return (
          <div
            key={item.question}
            style={{
              background: "rgba(255,255,255,0.94)",
              border: "1px solid rgba(72,150,175,0.12)",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: isOpen ? SHADOW : SHADOW_REST,
              transition: "box-shadow 0.25s ease",
            }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "18px 24px",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                gap: 16,
              }}
            >
              <span
                style={{
                  fontSize: 15.5,
                  fontWeight: 700,
                  color: "var(--lingo-navy)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  lineHeight: 1.4,
                }}
              >
                {item.question}
              </span>
              <span
                style={{
                  fontSize: 18,
                  color: isOpen ? "var(--lingo-teal)" : "#7aA0b4",
                  flexShrink: 0,
                  fontWeight: 400,
                  lineHeight: 1,
                  transition: "color 0.15s, transform 0.2s",
                  transform: isOpen ? "rotate(45deg)" : "none",
                }}
              >
                +
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: "hidden" }}
                >
                  <p
                    style={{
                      padding: "0 24px 20px",
                      fontSize: 14.5,
                      color: "var(--lingo-text-muted)",
                      lineHeight: 1.65,
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
