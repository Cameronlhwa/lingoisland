"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

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
      className="rounded-2xl border border-gray-900 bg-gray-900 p-6 shadow-lg"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Topic Island
          </p>
          <h3 className="text-xl font-semibold text-white">
            Apartment hunting
          </h3>
        </div>
        <div className="flex items-center rounded-full border border-gray-700 bg-gray-800 p-1 text-xs">
          {LEVELS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setLevel(item)}
              className={`rounded-full px-3 py-1 font-medium transition-all ${
                level === item
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {item}
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
                className="rounded-xl border border-gray-700 bg-gray-800 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {word.hanzi}
                    </p>
                    <p className="text-sm text-gray-400">{word.pinyin}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-300">
                    {word.meaning}
                  </span>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-300">
                    {before}
                    <span className="rounded bg-gray-700 px-1 text-white">
                      {word.highlight}
                    </span>
                    {after ?? ""}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
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
          href="/onboarding/topic-island"
          className="inline-block rounded-lg border border-white bg-white px-4 py-2 text-xs font-semibold text-gray-900 transition-all hover:bg-gray-100"
        >
          Create your own topic island!
        </Link>
      </div>
    </motion.div>
  );
}
