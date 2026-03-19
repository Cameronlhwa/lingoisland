"use client";

import {
  motion,
  useReducedMotion,
  AnimatePresence,
  useInView,
} from "framer-motion";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { Volume2 } from "lucide-react";

export default function WhyLingoIsland() {
  const prefersReducedMotion = useReducedMotion();
  const [mobileView, setMobileView] = useState<"traditional" | "topic">("topic");
  const [typedText, setTypedText] = useState("");
  const [showCards, setShowCards] = useState(false);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const targetText = "Apartment hunting";

  const playAudio = async (text: string) => {
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("TTS failed");
      const data = await response.json();
      if (!data.audioContent) throw new Error("No audio content");
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audioContent), (c) => c.charCodeAt(0))],
        { type: "audio/mp3" },
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => URL.revokeObjectURL(audioUrl);
    } catch (error) {
      console.error("Audio playback failed:", error);
    }
  };

  useEffect(() => {
    if (!isInView) return;
    if (prefersReducedMotion) {
      setTypedText(targetText);
      setShowCards(true);
      return;
    }
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      currentIndex++;
      setTypedText(targetText.slice(0, currentIndex));
      if (currentIndex >= targetText.length) {
        clearInterval(typingInterval);
        setTimeout(() => setShowCards(true), 300);
      }
    }, 100);
    return () => clearInterval(typingInterval);
  }, [isInView, prefersReducedMotion]);

  return (
    <section
      id="why"
      ref={sectionRef}
      className="fade-section"
      style={{ background: "#fff", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: 48 }}
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
            Why LingoIsland
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#3a6e88",
              lineHeight: 1.65,
              maxWidth: 560,
              margin: "0 auto",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            Build vocabulary around topics that interest you. Pick a topic and
            get words you actually need — with level-tuned sentences, audio, and
            review that makes them stick.
          </p>
        </motion.div>

        {/* Mobile toggle */}
        <div
          className="mb-6 flex md:hidden"
          style={{
            borderRadius: 10,
            border: "1px solid rgba(0,80,120,0.15)",
            background: "#F4F8FB",
            padding: 4,
          }}
        >
          {(["traditional", "topic"] as const).map((view) => (
            <button
              key={view}
              onClick={() => setMobileView(view)}
              style={{
                flex: 1,
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 500,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s",
                background: mobileView === view ? "#fff" : "transparent",
                color: mobileView === view ? "#071E2E" : "#3a6e88",
                boxShadow: mobileView === view ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {view === "traditional" ? "Curriculum-based" : "Topic-based"}
            </button>
          ))}
        </div>

        {/* Desktop: side-by-side */}
        <div className="hidden grid-cols-2 gap-6 md:grid" style={{ alignItems: "stretch" }}>
          <TraditionalPanel prefersReducedMotion={prefersReducedMotion} />
          <TopicPanel
            prefersReducedMotion={prefersReducedMotion}
            typedText={typedText}
            showCards={showCards}
            playAudio={playAudio}
          />
        </div>

        {/* Mobile: toggled */}
        <div className="md:hidden">
          {mobileView === "traditional" ? (
            <TraditionalPanel prefersReducedMotion={prefersReducedMotion} />
          ) : (
            <TopicPanel
              prefersReducedMotion={prefersReducedMotion}
              typedText={typedText}
              showCards={showCards}
              playAudio={playAudio}
            />
          )}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          style={{ marginTop: 48, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
        >
          <Link
            href="/onboarding/topic-island"
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
            }}
            className="hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(7,30,46,0.22)]"
          >
            Create your first Topic Island
          </Link>
          <a
            href="#demo"
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
        </motion.div>
      </div>
    </section>
  );
}

function TraditionalPanel({ prefersReducedMotion }: { prefersReducedMotion: boolean | null }) {
  const units = [
    { unit: "Unit 1", title: "Greetings", page: "p. 12" },
    { unit: "Unit 2", title: "Numbers", page: "p. 24" },
    { unit: "Unit 3", title: "Family", page: "p. 38" },
    { unit: "Unit 4", title: "Food", page: "p. 51" },
    { unit: "Unit 5", title: "Weather", page: "p. 67" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      aria-label="Traditional curriculum-based learning approach"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#fafafa",
        padding: 32,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "#9ab0bc",
          marginBottom: 12,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        Most Mandarin Apps
      </p>
      <div style={{ borderBottom: "2px solid #e2e8f0", paddingBottom: 16, marginBottom: 20 }}>
        <h3 style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 20, fontWeight: 600, color: "#334155" }}>
          Appendix • Table of Contents
        </h3>
      </div>
      <div
        style={{
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          background: "#f1f5f9",
          padding: 16,
          marginBottom: 16,
        }}
      >
        <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", marginBottom: 12 }}>
          Course Units
        </p>
        {units.map((unit, idx) => (
          <motion.div
            key={unit.unit}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "8px 0",
              borderBottom: idx < units.length - 1 ? "1px solid #e2e8f0" : "none",
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#475569" }}>{unit.unit}</span>
              <span style={{ fontFamily: "'Lora', Georgia, serif", fontSize: 13, color: "#64748b" }}>{unit.title}</span>
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>{unit.page}</span>
          </motion.div>
        ))}
      </div>
      <p
        style={{
          fontSize: 13,
          color: "#aaaaaa",
          fontStyle: "italic",
          lineHeight: 1.5,
          marginTop: "auto",
          paddingTop: 16,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        You follow their curriculum. Whether it matches your life or not.
      </p>
    </motion.div>
  );
}

function TopicPanel({
  prefersReducedMotion,
  typedText,
  showCards,
  playAudio,
}: {
  prefersReducedMotion: boolean | null;
  typedText: string;
  showCards: boolean;
  playAudio: (text: string) => Promise<void>;
}) {
  const isTyping = typedText.length > 0 && typedText.length < "Apartment hunting".length;

  const vocabRows = [
    { hanzi: "租房", pinyin: "zū fáng", en: "rent apartment", sentence: "我在这个区租房，很方便。", sentencePinyin: "Wǒ zài zhège qū zū fáng, hěn fāngbiàn.", sentenceEn: "I rent an apartment here — very convenient." },
    { hanzi: "地铁站", pinyin: "dìtiězhàn", en: "subway station", sentence: "地铁站离家走路十分钟。", sentencePinyin: "Dìtiězhàn lí jiā zǒulù shí fēnzhōng.", sentenceEn: "The subway station is a 10-min walk from home." },
    { hanzi: "房东", pinyin: "fángdōng", en: "landlord", sentence: "房东人很好，也很热心。", sentencePinyin: "Fángdōng rén hěn hǎo, yě hěn rèxīn.", sentenceEn: "The landlord is nice and very helpful." },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      aria-label="LingoIsland topic-based learning approach"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(33,118,174,0.2)",
        background: "#EAF4FB",
        padding: 32,
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "#2176AE",
          marginBottom: 12,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        LingoIsland&apos;s Personalized Approach
      </p>
      {/* Input area */}
      <div
        style={{
          borderRadius: 10,
          border: "1px solid rgba(33,118,174,0.2)",
          background: "#fff",
          padding: 16,
          marginBottom: 16,
        }}
      >
        <label style={{ fontSize: 11, fontWeight: 600, color: "#3a6e88", display: "block", marginBottom: 8, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
          Type a topic...
        </label>
        <div style={{ minHeight: 28 }}>
          <span style={{ fontSize: 16, color: "#071E2E", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            {typedText}
            {isTyping && !prefersReducedMotion && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ display: "inline-block", width: 2, height: 18, background: "#2176AE", marginLeft: 2, verticalAlign: "middle" }}
              />
            )}
          </span>
        </div>
      </div>

      {/* Word cards */}
      <AnimatePresence>
        {showCards && (
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {vocabRows.map((row) => (
              <div
                key={row.hanzi}
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(33,118,174,0.12)",
                  background: "#fff",
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => playAudio(row.hanzi)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: "50%", color: "#3a6e88" }}
                      aria-label={`Play audio for ${row.hanzi}`}
                    >
                      <Volume2 style={{ width: 16, height: 16 }} />
                    </button>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#071E2E" }}>{row.hanzi}</span>
                    <span style={{ fontSize: 12, color: "#7aA0b4" }}>{row.pinyin}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#7aA0b4" }}>{row.en}</span>
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <button
                    onClick={() => playAudio(row.sentence)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: "50%", color: "#3a6e88", flexShrink: 0, marginTop: 2 }}
                    aria-label="Play audio for sentence"
                  >
                    <Volume2 style={{ width: 14, height: 14 }} />
                  </button>
                  <div>
                    <div style={{ fontSize: 13, color: "#071E2E", lineHeight: 1.5 }}>{row.sentence}</div>
                    <div style={{ fontSize: 11, color: "#7aA0b4", marginTop: 2 }}>{row.sentencePinyin}</div>
                    <div style={{ fontSize: 11, color: "#3a6e88", marginTop: 2 }}>{row.sentenceEn}</div>
                  </div>
                </div>
              </div>
            ))}

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
