"use client";

import {
  motion,
  useReducedMotion,
  AnimatePresence,
  useInView,
} from "framer-motion";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";

export default function WhyLingoIsland() {
  const prefersReducedMotion = useReducedMotion();
  const [mobileView, setMobileView] = useState<"traditional" | "topic">(
    "topic",
  );
  const [typedText, setTypedText] = useState("");
  const [showCards, setShowCards] = useState(false);
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });

  const targetText = "Apartment hunting";

  // Typing animation - only starts when section is in view
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
        // Show cards after typing completes
        setTimeout(() => {
          setShowCards(true);
        }, 300);
      }
    }, 100);

    return () => clearInterval(typingInterval);
  }, [isInView, prefersReducedMotion]);

  return (
    <section
      id="why"
      ref={sectionRef}
      className="bg-white px-6 pb-24 pt-8 md:px-12 md:pb-32 md:pt-12"
    >
      <div className="mx-auto max-w-7xl">
        {/* Part 1: Primer */}
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl text-center"
        >
          <h3 className="mb-12 text-4xl font-semibold text-gray-900 md:text-5xl">
            Why LingoIsland
          </h3>
          <h2 className="mx-auto mb-6 max-w-2xl text-2xl font-semibold leading-relaxed text-gray-800 md:text-3xl">
            Build vocabulary around topics that interest you
          </h2>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-gray-600 md:text-xl">
            LingoIsland helps you remember Mandarin with topic-based
            vocabulary—built around your life. Pick a topic and the words you
            want. We turn them into a "Topic Island" with level-tuned sentences,
            then reuse them in stories + review so they stick.
          </p>
        </motion.div>

        {/* Part 2: Split-screen animation */}
        <div className="mt-16 md:mt-20">
          {/* Mobile segmented control */}
          <div className="mb-6 flex rounded-lg border border-gray-300 bg-gray-50 p-1 md:hidden">
            <button
              onClick={() => setMobileView("traditional")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                mobileView === "traditional"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              Curriculum-based
            </button>
            <button
              onClick={() => setMobileView("topic")}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${
                mobileView === "topic"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600"
              }`}
            >
              Topic-based
            </button>
          </div>

          {/* Desktop: side-by-side */}
          <div className="hidden grid-cols-2 gap-8 md:grid">
            <TraditionalPanel prefersReducedMotion={prefersReducedMotion} />
            <TopicPanel
              prefersReducedMotion={prefersReducedMotion}
              typedText={typedText}
              showCards={showCards}
            />
          </div>

          {/* Mobile: stacked with toggle */}
          <div className="md:hidden">
            {mobileView === "traditional" ? (
              <TraditionalPanel prefersReducedMotion={prefersReducedMotion} />
            ) : (
              <TopicPanel
                prefersReducedMotion={prefersReducedMotion}
                typedText={typedText}
                showCards={showCards}
              />
            )}
          </div>
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          className="mt-16 flex flex-col items-center gap-4 text-center"
        >
          <Link
            href="/onboarding/topic-island"
            className="rounded-lg bg-gray-900 px-8 py-4 text-base font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md"
          >
            Create your first Topic Island
          </Link>
          <a
            href="#demo"
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            See an example island ↓
          </a>
        </motion.div>
      </div>
    </section>
  );
}

// Traditional Panel Component
function TraditionalPanel({
  prefersReducedMotion,
}: {
  prefersReducedMotion: boolean | null;
}) {
  const units = [
    { unit: "Unit 1", title: "Greetings", page: "p. 12" },
    { unit: "Unit 2", title: "Numbers", page: "p. 24" },
    { unit: "Unit 3", title: "Family", page: "p. 38" },
    { unit: "Unit 4", title: "Food", page: "p. 51" },
    { unit: "Unit 5", title: "Weather", page: "p. 67" },
  ];

  const vocabularyList = [
    "1. earthquake (地震)",
    "2. typhoon (台风)",
    "3. temperature (温度)",
    "4. forecast (预报)",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border-2 border-slate-300 bg-white p-8 shadow-sm"
      aria-label="Traditional curriculum-based learning approach"
    >
      <div className="mb-6 border-b-2 border-slate-300 pb-4">
        <h3 className="font-serif text-2xl font-bold text-slate-800">
          Most Mandarin Apps
        </h3>
        <p className="mt-1 font-serif text-sm text-slate-500">
          Appendix • Table of Contents
        </p>
      </div>

      {/* Units table of contents */}
      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 font-serif text-xs font-semibold uppercase tracking-wide text-slate-600">
          Course Units
        </p>
        {units.map((unit, idx) => (
          <motion.div
            key={unit.unit}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
            className="mb-2 flex items-baseline justify-between border-b border-slate-200 py-2 last:border-b-0"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs font-bold text-slate-700">
                {unit.unit}
              </span>
              <span className="font-serif text-sm text-slate-600">
                {unit.title}
              </span>
            </div>
            <span className="font-mono text-xs text-slate-400">
              {unit.page}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Unit 5 content */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 font-serif text-sm font-bold uppercase tracking-wide text-slate-700">
          Unit 5: Weather
        </p>
        <div className="space-y-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Vocabulary:</p>
          {vocabularyList.map((item, idx) => (
            <motion.div
              key={item}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: 0.5 + idx * 0.1 }}
              className="font-mono"
            >
              {item}
            </motion.div>
          ))}
          <div className="mt-4 border-t border-slate-200 pt-3">
            <p className="mb-2 font-semibold text-slate-700">Grammar Point:</p>
            <p className="italic">
              The particle 吗 (ma) is used to form yes/no questions.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Topic Panel Component - With typing animation
function TopicPanel({
  prefersReducedMotion,
  typedText,
  showCards,
}: {
  prefersReducedMotion: boolean | null;
  typedText: string;
  showCards: boolean;
}) {
  const isTyping =
    typedText.length > 0 && typedText.length < "Apartment hunting".length;

  return (
    <motion.div
      initial={{ opacity: 0, x: prefersReducedMotion ? 0 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-gray-900 bg-gray-900 p-8"
      aria-label="LingoIsland topic-based learning approach"
    >
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white">
          LingoIsland's Topic-based Approach
        </h3>
      </div>

      {/* Input area */}
      <div className="mb-6 rounded-xl border border-gray-700 bg-gray-800 p-4">
        <label className="mb-2 block text-xs font-medium text-gray-400">
          Type a topic...
        </label>
        <div className="flex items-center min-h-[28px]">
          <span className="text-lg text-white">
            {typedText}
            {isTyping && !prefersReducedMotion && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="ml-0.5 inline-block h-5 w-0.5 bg-white"
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
            className="mb-4 space-y-3"
          >
            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-semibold text-white">
                    租房
                  </span>
                  <span className="ml-2 text-xs text-gray-400">zū fáng</span>
                </div>
                <span className="text-xs text-gray-300">rent apartment</span>
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-sm text-gray-200">
                  我在这个区租房，很方便。
                </div>
                <p className="text-xs text-gray-400">
                  Wǒ zài zhège qū zū fáng, hěn fāngbiàn.
                </p>
                <p className="text-xs text-gray-500">
                  I rent an apartment in this area, it&apos;s very convenient.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-semibold text-white">
                    地铁站
                  </span>
                  <span className="ml-2 text-xs text-gray-400">dìtiězhàn</span>
                </div>
                <span className="text-xs text-gray-300">subway station</span>
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-sm text-gray-200">
                  地铁站离家走路十分钟。
                </div>
                <p className="text-xs text-gray-400">
                  Dìtiězhàn lí jiā zǒulù shí fēnzhōng.
                </p>
                <p className="text-xs text-gray-500">
                  The subway station is a 10-minute walk from home.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-semibold text-white">
                    房东
                  </span>
                  <span className="ml-2 text-xs text-gray-400">fángdōng</span>
                </div>
                <span className="text-xs text-gray-300">landlord</span>
              </div>
              <div className="mt-3 space-y-1">
                <div className="text-sm text-gray-200">
                  房东人很好，也很热心。
                </div>
                <p className="text-xs text-gray-400">
                  Fángdōng rén hěn hǎo, yě hěn rèxīn.
                </p>
                <p className="text-xs text-gray-500">
                  The landlord is nice and very helpful.
                </p>
              </div>
            </div>

            {/* Feature chips */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "Choose your words",
                "Reuse recent words",
                "Sentences tuned to your level",
              ].map((feature) => (
                <div
                  key={feature}
                  className="rounded-full border border-gray-700 bg-gray-800 px-3 py-1 text-xs text-gray-300"
                >
                  {feature}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
