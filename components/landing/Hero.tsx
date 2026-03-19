"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { LANDING_EXAMPLE_ISLANDS } from "@/data/landingExampleIslands";
import {
  MdLocalCafe,
  MdAttachMoney,
  MdLocalHospital,
  MdFlight,
  MdSmartToy,
} from "react-icons/md";

// ─── Typing animation topics ───────────────────────────────────────────────────
const TOPICS = [
  "Coffee Shop",
  "Finance",
  "AI & Tech",
  "Hospital Visit",
  "Travel",
];

// Order must match TOPICS exactly so activeTopic index aligns
const CHIPS: { label: string; icon: React.ElementType }[] = [
  { label: "Coffee Shop",    icon: MdLocalCafe },
  { label: "Finance",        icon: MdAttachMoney },
  { label: "AI & Tech",      icon: MdSmartToy },
  { label: "Hospital Visit", icon: MdLocalHospital },
  { label: "Travel",         icon: MdFlight },
];

// ─── Step 1: Pick a topic ──────────────────────────────────────────────────────
function Step1() {
  const [typedText, setTypedText] = useState("Coffee Shop");
  const [activeTopic, setActiveTopic] = useState(0);
  const topicIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function typeNext() {
      topicIndexRef.current = (topicIndexRef.current + 1) % TOPICS.length;
      const next = TOPICS[topicIndexRef.current];
      let i = 0;
      setTypedText("");
      setActiveTopic(topicIndexRef.current);
      intervalRef.current = setInterval(() => {
        i++;
        setTypedText(next.slice(0, i));
        if (i >= next.length) {
          clearInterval(intervalRef.current!);
          timerRef.current = setTimeout(typeNext, 2200);
        }
      }, 60);
    }

    timerRef.current = setTimeout(typeNext, 3000);
    return () => {
      clearTimeout(timerRef.current!);
      clearInterval(intervalRef.current!);
    };
  }, []);

  return (
    <div>
      {/* Mock input */}
      <div
        style={{
          background: "#F4F8FB",
          border: "1.5px solid #2176AE",
          borderRadius: 8,
          padding: "9px 12px",
          fontSize: 13,
          color: "#071E2E",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          minHeight: 38,
        }}
      >
        <span>{typedText}</span>
        <span className="cursor-blink" />
      </div>

      {/* Mini chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {CHIPS.map((chip, i) => {
          const isActive = i === activeTopic;
          return (
            <span
              key={chip.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: isActive ? "#2176AE" : "#EAF4FB",
                border: `1px solid ${isActive ? "#2176AE" : "rgba(33,118,174,0.2)"}`,
                borderRadius: 12,
                padding: "3px 9px",
                fontSize: 10,
                color: isActive ? "#fff" : "#1a5f8a",
                fontWeight: 500,
                fontFamily: "'DM Sans', system-ui, sans-serif",
                transition: "all 0.2s",
              }}
            >
              <chip.icon style={{ width: 10, height: 10, flexShrink: 0 }} />
              {chip.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2: Get your island ───────────────────────────────────────────────────
const VOCAB_ROWS = [
  { hanzi: "咖啡", pinyin: "kāfēi", en: "coffee", highlight: true },
  { hanzi: "拿铁", pinyin: "nǎtiě", en: "latte", highlight: false },
  { hanzi: "外卖", pinyin: "wàimài", en: "takeaway", highlight: false },
];

function Step2() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {VOCAB_ROWS.map((row, i) => (
        <div
          key={row.hanzi}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: row.highlight ? "#EAF4FB" : "#F4F8FB",
            border: row.highlight
              ? "1px solid rgba(33,118,174,0.2)"
              : "1px solid transparent",
            borderRadius: 7,
            padding: "7px 10px",
          }}
        >
          {/* Audio dot */}
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "#D6EEF8",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <polygon
                points="2,2 8,5 2,8"
                fill={i === 0 ? "#2176AE" : "#9ab0bc"}
              />
            </svg>
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#071E2E",
                lineHeight: 1.2,
              }}
            >
              {row.hanzi}
            </div>
            <div style={{ fontSize: 10, color: "#7a9aaa", marginTop: 1 }}>
              {row.pinyin}
            </div>
          </div>

          {/* English */}
          <div
            style={{
              fontSize: 11,
              color: "#9ab0bc",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            {row.en}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Step 3: Use it in a sentence ─────────────────────────────────────────────
const SENTENCE_PARTS: { text: string; pinyin: string; en: string }[] = [
  { text: "我", pinyin: "wǒ", en: "I" },
  { text: "想", pinyin: "xiǎng", en: "want to" },
  { text: "喝", pinyin: "hē", en: "drink" },
  { text: "一杯", pinyin: "yī bēi", en: "a cup of" },
  { text: "咖啡", pinyin: "kāfēi", en: "coffee" },
  { text: "。", pinyin: "", en: "" },
];

function HoverWord({
  text,
  pinyin,
  en,
}: {
  text: string;
  pinyin: string;
  en: string;
}) {
  const [hovered, setHovered] = useState(false);
  const isPunct = !pinyin;

  if (isPunct) return <span style={{ color: "#071E2E" }}>{text}</span>;

  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          background: hovered ? "#EAF4FB" : "transparent",
          borderRadius: 4,
          padding: "0 2px",
          borderBottom: "2px solid rgba(33,118,174,0.4)",
          color: "#071E2E",
          cursor: "default",
          transition: "background 0.15s, border-color 0.15s",
          borderBottomColor: hovered ? "#2176AE" : "rgba(33,118,174,0.4)",
        }}
      >
        {text}
      </span>
      {hovered && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 7px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#071E2E",
            color: "#fff",
            borderRadius: 6,
            padding: "5px 10px",
            fontSize: 11,
            whiteSpace: "nowrap",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontWeight: 500,
            zIndex: 10,
            pointerEvents: "none",
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "block",
              color: "#A0C4D8",
              fontSize: 10,
              marginBottom: 1,
            }}
          >
            {pinyin}
          </span>
          {en}
          {/* Caret */}
          <span
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid #071E2E",
            }}
          />
        </span>
      )}
    </span>
  );
}

function Step3() {
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          color: "#7aA0b4",
          fontWeight: 600,
          marginBottom: 12,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          letterSpacing: "0.04em",
        }}
      >
        Example sentence
      </p>

      {/* Sentence */}
      <p
        style={{
          fontSize: 20,
          lineHeight: 1.5,
          color: "#071E2E",
          marginBottom: 10,
        }}
      >
        {SENTENCE_PARTS.map((part, i) => (
          <HoverWord
            key={i}
            text={part.text}
            pinyin={part.pinyin}
            en={part.en}
          />
        ))}
      </p>

      {/* Pinyin */}
      <p
        style={{
          fontSize: 11,
          color: "#7aA0b4",
          marginBottom: 6,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          lineHeight: 1.6,
        }}
      >
        Wǒ xiǎng hē yī bēi kāfēi.
      </p>

      {/* Translation */}
      <p
        style={{
          fontSize: 12,
          color: "#3a6e88",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          lineHeight: 1.6,
        }}
      >
        I&apos;d like a cup of coffee.
      </p>

      {/* Hint */}
      <p
        style={{
          fontSize: 10,
          color: "#A0C4D8",
          marginTop: 12,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        Hover any word to see its meaning
      </p>
    </div>
  );
}

// ─── Step 4: Quiz & review ─────────────────────────────────────────────────────
const QUIZ_OPTS = [
  { label: "coffee", state: "wrong" },
  { label: "takeaway ✓", state: "correct" },
  { label: "order food", state: "neutral" },
  { label: "menu", state: "neutral" },
] as const;

function Step4() {
  return (
    <div>
      <p
        style={{
          fontSize: 12,
          color: "#5a7a88",
          fontWeight: 500,
          marginBottom: 10,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        What does this mean?
      </p>
      <p
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: "#071E2E",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        外卖
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {QUIZ_OPTS.map((opt) => (
          <div
            key={opt.label}
            style={{
              background:
                opt.state === "correct"
                  ? "#EAF4FB"
                  : opt.state === "wrong"
                    ? "#FEF0EE"
                    : "#F4F8FB",
              border:
                opt.state === "correct"
                  ? "1px solid #2176AE"
                  : opt.state === "wrong"
                    ? "1px solid #E8705A"
                    : "1px solid rgba(0,80,120,0.1)",
              borderRadius: 8,
              padding: "7px 10px",
              fontSize: 11,
              color:
                opt.state === "correct"
                  ? "#2176AE"
                  : opt.state === "wrong"
                    ? "#c0442a"
                    : "#071E2E",
              fontWeight: opt.state === "correct" ? 600 : 400,
              textAlign: "center",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Flow section ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: "step1", label: "Pick a Topic", num: 1, content: <Step1 /> },
  { id: "step2", label: "Get Your Island", num: 2, content: <Step2 /> },
  { id: "step3", label: "Use It in a Sentence", num: 3, content: <Step3 /> },
  { id: "step4", label: "Quiz & Review", num: 4, content: <Step4 /> },
];

function HowItWorksFlow() {
  const [visible, setVisible] = useState([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);

  useEffect(() => {
    const delays = [200, 550, 700, 1050, 1200, 1550, 1700];
    const timers = delays.map((delay, i) =>
      setTimeout(
        () =>
          setVisible((v) => {
            const n = [...v];
            n[i] = true;
            return n;
          }),
        delay,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  // visible[0]=step1, [1]=arrow1, [2]=step2, [3]=arrow2, [4]=step3
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 24px" }}>
      {/* Desktop: horizontal 3-column */}
      <div
        className="hidden md:flex"
        style={{ alignItems: "flex-start", justifyContent: "center", gap: 0 }}
      >
        {STEPS.map((step, i) => (
          <>
            {/* Step card */}
            <div
              key={step.id}
              className={`flow-step${visible[i * 2] ? " visible" : ""}`}
              style={{ flex: 1 }}
            >
              {/* Label row */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#7aA0b4",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#2176AE",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </div>
                {step.label}
              </div>
              {/* Card */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid rgba(0,80,120,0.12)",
                  padding: "16px 18px",
                  width: "100%",
                  minHeight: 130,
                }}
              >
                {step.content}
              </div>
            </div>

            {/* Arrow between steps */}
            {i < STEPS.length - 1 && (
              <div
                className={`flow-arrow${visible[i * 2 + 1] ? " visible" : ""}`}
                style={{
                  flexShrink: 0,
                  paddingTop: 36,
                  color: "#A0C4D8",
                  fontSize: 18,
                  padding: "36px 12px 0",
                }}
              >
                →
              </div>
            )}
          </>
        ))}
      </div>

      {/* Mobile: vertical stack with dashed connector */}
      <div className="flex flex-col gap-0 md:hidden">
        {STEPS.map((step, i) => (
          <div key={step.id}>
            <div className={`flow-step${visible[i * 2] ? " visible" : ""}`}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#7aA0b4",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#2176AE",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </div>
                {step.label}
              </div>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: "1px solid rgba(0,80,120,0.12)",
                  padding: "16px 18px",
                  width: "100%",
                  minHeight: 130,
                }}
              >
                {step.content}
              </div>
            </div>
            {/* Vertical dashed connector */}
            {i < STEPS.length - 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "6px 0",
                }}
              >
                <div
                  style={{
                    width: 1,
                    height: 28,
                    borderLeft: "2px dashed #C2D8E8",
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
export default function Hero() {
  return (
    <section
      style={{
        background: "#D6EEF8",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ocean stroke background lines */}
      <svg
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.25,
          pointerEvents: "none",
        }}
      >
        {[40, 80, 120, 160, 200, 240].map((y, i) => (
          <path
            key={i}
            d={`M${i * 120},${y} Q${i * 120 + 80},${y - 20} ${i * 120 + 160},${y}`}
            fill="none"
            stroke="#9ecfe0"
            strokeWidth="1.5"
          />
        ))}
        {[60, 100, 140, 180, 220].map((y, i) => (
          <path
            key={`b${i}`}
            d={`M${i * 200 + 60},${y} Q${i * 200 + 160},${y + 18} ${i * 200 + 260},${y}`}
            fill="none"
            stroke="#8ab8cc"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* ── Text content ── */}
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
          textAlign: "center",
          padding: "72px 24px 0",
        }}
      >
        {/* H1 */}
        <h1
          className="hero-headline"
          style={{
            fontFamily: "'Lora', Georgia, serif",
            fontWeight: 600,
            fontSize: "clamp(40px, 5vw, 62px)",
            lineHeight: 1.15,
            color: "#071E2E",
            marginBottom: 20,
          }}
        >
          Learn the Words You{" "}
          <em
            style={{ fontStyle: "italic", color: "#2176AE", fontWeight: 600 }}
          >
            Actually Need
          </em>
        </h1>

        {/* Subheadline */}
        <p
          className="hero-sub"
          style={{
            fontSize: 16,
            color: "#3a6e88",
            lineHeight: 1.65,
            maxWidth: 480,
            margin: "0 auto 28px",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          Build vocabulary around{" "}
          <strong style={{ color: "#071E2E", fontWeight: 500 }}>
            topics that matter to your real life
          </strong>{" "}
          — with real sentences, audio, and review that makes it stick.
        </p>

        {/* CTAs */}
        <div
          className="hero-ctas"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <Link
            href="/onboarding/topic-island"
            style={{
              background: "#071E2E",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              padding: "13px 26px",
              fontSize: "15px",
              fontWeight: 500,
              fontFamily: "'DM Sans', system-ui, sans-serif",
              cursor: "pointer",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              textDecoration: "none",
              display: "inline-block",
            }}
            className="hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(7,30,46,0.22)] active:translate-y-0 active:shadow-none"
          >
            Try for free →
          </Link>
          <Link
            href="/#demo"
            style={{
              color: "#2176AE",
              fontWeight: 500,
              fontSize: "15px",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              textDecoration: "none",
            }}
          >
            Watch demo →
          </Link>
        </div>

        {/* Trust line */}
        <p
          style={{
            fontSize: "12px",
            color: "#7aA0b4",
            textAlign: "center",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            marginBottom: 40,
          }}
        >
          No account needed. No credit card. Your first island is on us.
        </p>
      </div>

      {/* ── How it works flow ── */}
      <HowItWorksFlow />

      {/* ── Island illustrations — decorative strip ── */}
      <div
        className="hero-illustration hidden md:block"
        style={{ position: "relative", zIndex: 1, opacity: 0.5, marginTop: 8 }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "0 24px",
            padding: "0 32px",
            alignItems: "end",
          }}
        >
          {LANDING_EXAMPLE_ISLANDS.map((island, index) => {
            const offsets = [
              { marginTop: 0 },
              { marginTop: -40 },
              { marginTop: 0 },
            ];
            return (
              <Link
                key={island.id}
                href={`/onboarding/topic-island?example=${island.id}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textDecoration: "none",
                  ...offsets[index],
                }}
              >
                <div
                  className="island-float"
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "4/3",
                  }}
                >
                  <Image
                    src={island.image}
                    alt={island.title}
                    fill
                    className="object-contain"
                    sizes="(max-width: 1100px) 33vw, 340px"
                    priority={index < 2}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile: single island at reduced opacity */}
      <div
        className="hero-illustration flex justify-center px-6 md:hidden"
        style={{ opacity: 0.5, marginTop: 16 }}
      >
        <Link
          href={`/onboarding/topic-island?example=${LANDING_EXAMPLE_ISLANDS[1].id}`}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textDecoration: "none",
            maxWidth: 280,
            width: "100%",
          }}
        >
          <div
            className="island-float"
            style={{ position: "relative", width: "100%", aspectRatio: "4/3" }}
          >
            <Image
              src={LANDING_EXAMPLE_ISLANDS[1].image}
              alt={LANDING_EXAMPLE_ISLANDS[1].title}
              fill
              className="object-contain"
              sizes="280px"
              priority
            />
          </div>
        </Link>
      </div>

      {/* ── Wave transition ── */}
      <svg
        className="hero-wave-svg"
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        aria-hidden
        style={{ display: "block", marginTop: -2 }}
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
          fill="#94CADF"
          opacity="0.6"
        />
      </svg>
    </section>
  );
}
