"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { hskLabelForCefr } from "@/lib/levelBands";

const LEVELS = ["A2", "B1", "B2"] as const;

const DEMO_CONTENT = {
  A2: [
    {
      hanzi: "租房",
      pinyin: "zū fáng",
      meaning: "rent an apartment",
      sentence: "我在这个区租房，很方便。",
      sentencePinyin: "Wǒ zài zhège qū zū fáng, hěn fāngbiàn.",
      highlight: "租房",
    },
    {
      hanzi: "地铁站",
      pinyin: "dì tiě zhàn",
      meaning: "subway station",
      sentence: "地铁站离家走路十分钟。",
      sentencePinyin: "Dìtiězhàn lí jiā zǒulù shí fēnzhōng.",
      highlight: "地铁站",
    },
    {
      hanzi: "房东",
      pinyin: "fáng dōng",
      meaning: "landlord",
      sentence: "房东人很好，也很热心。",
      sentencePinyin: "Fángdōng rén hěn hǎo, yě hěn rèxīn.",
      highlight: "房东",
    },
  ],
  B1: [
    {
      hanzi: "押金",
      pinyin: "yā jīn",
      meaning: "security deposit",
      sentence: "房东要求提前支付一个月的押金。",
      sentencePinyin: "Fángdōng yāoqiú tíqián zhīfù yí gè yuè de yājīn.",
      highlight: "押金",
    },
    {
      hanzi: "合租",
      pinyin: "hé zū",
      meaning: "share rent",
      sentence: "我和朋友合租一间带阳台的房子。",
      sentencePinyin: "Wǒ hé péngyǒu hézū yì jiān dài yángtái de fángzi.",
      highlight: "合租",
    },
    {
      hanzi: "物业",
      pinyin: "wù yè",
      meaning: "property management",
      sentence: "物业可以帮忙处理水电问题。",
      sentencePinyin: "Wùyè kěyǐ bāngmáng chǔlǐ shuǐdiàn wèntí.",
      highlight: "物业",
    },
  ],
  B2: [
    {
      hanzi: "租约",
      pinyin: "zū yuē",
      meaning: "lease contract",
      sentence: "签租约前要确认条款是否合理。",
      sentencePinyin: "Qiān zūyuē qián yào quèrèn tiáokuǎn shìfǒu hélǐ.",
      highlight: "租约",
    },
    {
      hanzi: "交通枢纽",
      pinyin: "jiāo tōng shū niǔ",
      meaning: "transport hub",
      sentence: "附近是重要的交通枢纽，通勤很快。",
      sentencePinyin:
        "Fùjìn shì zhòngyào de jiāotōng shūniǔ, tōngqín hěn kuài.",
      highlight: "交通枢纽",
    },
    {
      hanzi: "居住体验",
      pinyin: "jū zhù tǐ yàn",
      meaning: "living experience",
      sentence: "安静的小区让居住体验更舒适。",
      sentencePinyin: "Ānjìng de xiǎoqū ràng jūzhù tǐyàn gèng shūshì.",
      highlight: "居住体验",
    },
  ],
};

export default function DemoIslandCard() {
  const [level, setLevel] = useState<keyof typeof DEMO_CONTENT>("A2");
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      className="rounded-3xl border bg-white p-6"
      style={{ borderColor: "var(--lingo-border)", boxShadow: "var(--lingo-card-shadow)" }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--lingo-teal)]">
            Topic Island
          </p>
          <h3 className="lingo-display text-xl text-[var(--lingo-navy)]">
            Apartment hunting
          </h3>
        </div>
        <div className="flex items-center rounded-full border bg-[var(--lingo-sky-pale)] p-1 text-xs" style={{ borderColor: "var(--lingo-border)" }}>
          {LEVELS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLevel(item)}
              className={`rounded-full px-3 py-1 font-medium transition-all ${
                level === item
                  ? "bg-white text-[var(--lingo-navy)] shadow-sm"
                  : "text-[var(--lingo-text-muted)] hover:text-[var(--lingo-navy)]"
              }`}
            >
              {hskLabelForCefr(item)}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={level}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -6 }}
          transition={{ duration: 0.2 }}
          className="mt-6 space-y-4"
        >
          {DEMO_CONTENT[level].map((word) => {
            const [before, after] = word.sentence.split(word.highlight);
            return (
              <div
                key={word.hanzi}
                className="rounded-2xl border bg-[var(--lingo-card-muted)] p-4"
                style={{ borderColor: "var(--lingo-border)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-[var(--lingo-navy)]">
                      {word.hanzi}
                    </p>
                    <p className="text-sm text-[var(--lingo-text-muted)]">{word.pinyin}</p>
                  </div>
                  <span className="text-sm font-medium text-[var(--lingo-navy-soft)]">
                    {word.meaning}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-[var(--lingo-text)]">
                    {before}
                    <span className="rounded bg-[var(--lingo-accent-tint)] px-1 text-[var(--lingo-navy)]">
                      {word.highlight}
                    </span>
                    {after ?? ""}
                  </p>
                  <p className="mt-1 text-xs text-[var(--lingo-text-muted)]">
                    {word.sentencePinyin}
                  </p>
                </div>
              </div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6">
        <Link
          href="/onboarding/journey"
          className="inline-block rounded-full bg-[var(--lingo-btn-bg)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--lingo-btn-shadow)] transition-all hover:opacity-90"
        >
          Create your own topic island!
        </Link>
      </div>
    </motion.div>
  );
}
