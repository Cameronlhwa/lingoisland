/**
 * Generate all blog hero + island images via Google GenAI image models
 * ("Nano Banana" — same stack as lib/nanobanana and scripts/generate-boat-capybara.ts).
 *
 * Prompting conventions that work well with gemini-3-pro-image-preview in this repo:
 * - Lead with OUTPUT SPECS: aspect ratio, illustration vs UI mockup, resolution intent.
 * - Lock BRAND PALETTE with hex codes (LingoIsland blog: #D6EEF8 sky wash, #071E2E ink, #2176AE accent).
 * - Say what to EXCLUDE: no green as a dominant color, no watermarks, no tiny unreadable text blocks.
 * - For heroes: one clear focal subject, soft editorial lighting, no paragraph text (optional big abstract Hanzi OK).
 * - For "island screenshots": describe a plausible mobile app UI (cards, pinyin rows, accent buttons) — not a photo.
 *
 * Usage (from repo root):
 *   npm run gen:blog-images
 *   npm run gen:blog-images -- --dry-run          # print prompts only
 *   npm run gen:blog-images -- --only=gratitude-in-chinese
 *
 * Requires .env.local: NANO_BANANA_API_KEY (or GEMINI_API_KEY / GOOGLE_API_KEY).
 * Optional: NANO_BANANA_MODEL (default gemini-3-pro-image-preview).
 */

import { GoogleGenAI } from "@google/genai/node";
import { config } from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

config({ path: path.join(process.cwd(), ".env.local") });

const DEFAULT_MODEL = "gemini-3-pro-image-preview";
const FALLBACK_MODEL = "gemini-2.5-flash-image";

/** LingoIsland blog design — no green in UI/illustration palette */
const BRAND =
  "Color palette ONLY: soft sky blue wash #D6EEF8, deep ink navy #071E2E, accent azure #2176AE, optional deep navy #182545 for shadows. Do NOT use green as a dominant or accent color.";

const NO_WATERMARK =
  "No watermark, no stock-photo logo, no photographer credit, no frame or border around the image.";

const HERO_COMMON = [
  "OUTPUT: wide editorial illustration for a blog header, aspect ratio 2:1 (twice as wide as tall).",
  "Style: modern flat-ish digital illustration with soft gradients and gentle grain, friendly and premium EdTech — not childish clipart.",
  BRAND,
  NO_WATERMARK,
  "Do not render long sentences of readable text; at most a few large abstract Chinese characters as graphic shapes if it fits the topic.",
].join(" ");

const ISLAND_UI_COMMON = [
  "OUTPUT: a single clean mobile app screen mockup (portrait phone aspect ~9:19 crop shown as a centered phone frame), NOT a photograph.",
  "UI style: iOS-like rounded cards, generous whitespace, DM Sans–like geometric sans typography feel (no real font licensing text).",
  "Header bar small title + subtle back chevron. Primary button color #2176AE with white label text.",
  BRAND,
  "Show 3–4 vocabulary rows: Hanzi, pinyin, short English gloss — example content only, can be slightly blurred if needed for realism.",
  NO_WATERMARK,
  "No green UI accents.",
].join(" ");

type ImageJob = {
  slug: string;
  kind: "hero" | "island";
  /** basename including .jpg */
  filename: string;
  prompt: string;
};

function buildJobs(): ImageJob[] {
  const heroes: ImageJob[] = [
    {
      slug: "hsk-levels-guide",
      kind: "hero",
      filename: "hsk-levels-guide-hero.jpg",
      prompt: `${HERO_COMMON} Subject: a tidy student desk with a neat stack of HSK prep books, one open workbook showing multiple-choice bubbles as abstract circles (not readable questions), a pencil, soft morning window light. Mood: thoughtful, slightly skeptical but hopeful — "exam vs real life". Shallow depth of field.`,
    },
    {
      slug: "how-to-learn-mandarin",
      kind: "hero",
      filename: "how-to-learn-mandarin-hero.jpg",
      prompt: `${HERO_COMMON} Subject: abstract "personalization" metaphor — a winding path made of floating topic tiles (food, work, travel, friends) merging into a single glowing trail toward a stylized silhouette of a learner. Mood: empowering, bespoke journey.`,
    },
    {
      slug: "mandarin-numbers-complete-guide",
      kind: "hero",
      filename: "mandarin-numbers-complete-guide-hero.jpg",
      prompt: `${HERO_COMMON} Subject: elegant floating Hanzi numerals 一二三四五六七八九十 arranged in a logical ladder / staircase composition suggesting "pattern", subtle grid lines like graph paper fading into mist. Mood: clarity and structure.`,
    },
    {
      slug: "chinese-numbers-1-100",
      kind: "hero",
      filename: "chinese-numbers-1-100-hero.jpg",
      prompt: `${HERO_COMMON} Subject: dense but beautiful typographic mosaic of Chinese digits 1–10 repeating softly into the distance like a number wall, fading to lighter blue — suggests reference table. Mood: encyclopedic but calm.`,
    },
    {
      slug: "counting-in-chinese",
      kind: "hero",
      filename: "counting-in-chinese-hero.jpg",
      prompt: `${HERO_COMMON} Subject: still-life with two teacups, three apples, one book — each group subtly labeled with abstract classifier shapes (no readable sentences), emphasizing "number + classifier" learning. Warm tabletop, soft shadows.`,
    },
    {
      slug: "gratitude-in-chinese",
      kind: "hero",
      filename: "gratitude-in-chinese-hero.jpg",
      prompt: `${HERO_COMMON} Subject: two hands in a respectful light nod / thank-you gesture silhouette, soft paper-lantern bokeh in background (desaturated blues, not red-green holiday cliché). Mood: warm, sincere, cross-cultural politeness.`,
    },
    {
      slug: "bubble-tea-in-chinese",
      kind: "hero",
      filename: "bubble-tea-in-chinese-hero.jpg",
      prompt: `${HERO_COMMON} Subject: one photorealistic-but-illustrated cup of brown sugar bubble milk tea with dark pearls, condensation droplets, pastel blue counter, playful straw. Mood: fun, appetizing, Taipei cafe energy without neon magenta overload.`,
    },
    {
      slug: "horoscope-in-chinese",
      kind: "hero",
      filename: "horoscope-in-chinese-hero.jpg",
      prompt: `${HERO_COMMON} Subject: night sky with subtle constellations and twelve tiny zodiac glyphs as minimalist line icons in a circle (not photorealistic animals), soft moon glow in #D6EEF8 tones. Mood: curious, conversational, slightly magical — keep blues/teals, avoid purple haze cliché.`,
    },
    {
      slug: "zodiac-signs-in-chinese",
      kind: "hero",
      filename: "zodiac-signs-in-chinese-hero.jpg",
      prompt: `${HERO_COMMON} Subject: papercut-inspired circular zodiac wheel with twelve animals as simple flat icons in ink #071E2E on pale blue #D6EEF8, tiny accent stars in #2176AE. Mood: cultural, friendly, infographic-like.`,
    },
    {
      slug: "polite-mandarin",
      kind: "hero",
      filename: "polite-mandarin-hero.jpg",
      prompt: `${HERO_COMMON} Subject: abstract speech bubbles and polite nod silhouettes in a calm subway-or-cafe scene, soft depth, emphasis on social ease. Mood: practical etiquette, modern city learner.`,
    },
    {
      slug: "how-to-read-chinese",
      kind: "hero",
      filename: "how-to-read-chinese-hero.jpg",
      prompt: `${HERO_COMMON} Subject: magnifying glass over a block of Chinese characters where some radicals glow subtly in #2176AE — "density / pattern recognition" metaphor. Mood: intermediate learner breakthrough, cerebral but hopeful.`,
    },
    {
      slug: "what-is-mandarin",
      kind: "hero",
      filename: "what-is-mandarin-hero.jpg",
      prompt: `${HERO_COMMON} Subject: stylized globe with a soft highlight over East Asia, abstract sound wave arcs suggesting tones, open book edge. Mood: welcoming explainer, "start here", global classroom.`,
    },
    {
      slug: "meaningful-chinese-tattoos",
      kind: "hero",
      filename: "meaningful-chinese-tattoos-hero.jpg",
      prompt: `${HERO_COMMON} Subject: brush and ink stone on cream rice paper with one large calligraphic character 福 painted beautifully as ART ONLY (not on human skin). Mood: serious cultural respect, caution and beauty. No gore, no needles.`,
    },
  ];

  const islands: ImageJob[] = [
    {
      slug: "gratitude-in-chinese",
      kind: "island",
      filename: "gratitude-in-chinese-island.jpg",
      prompt: `${ISLAND_UI_COMMON} Topic title in header: "Gratitude". Subtitle: "Beyond 谢谢". Include sample rows like 谢谢 / xièxie, 非常感谢 / fēicháng gǎnxiè, 不客气 / bù kèqi. Small footer tab bar with one active "Learn" icon in #2176AE.`,
    },
    {
      slug: "bubble-tea-in-chinese",
      kind: "island",
      filename: "bubble-tea-in-chinese-island.jpg",
      prompt: `${ISLAND_UI_COMMON} Topic title: "Bubble Tea". Subtitle: "Order like a local". Rows: 珍珠奶茶, 半糖, 少冰 with pinyin and English. Decorative tiny boba cup icon in header (abstract).`,
    },
    {
      slug: "horoscope-in-chinese",
      kind: "island",
      filename: "horoscope-in-chinese-island.jpg",
      prompt: `${ISLAND_UI_COMMON} Topic title: "Horoscope". Subtitle: "星座". Rows for 双子座 / Gemini, 天秤座 / Libra with short English. Tiny starfield pattern in header background (subtle, monochrome blue).`,
    },
    {
      slug: "zodiac-signs-in-chinese",
      kind: "island",
      filename: "zodiac-signs-in-chinese-island.jpg",
      prompt: `${ISLAND_UI_COMMON} Topic title: "Chinese Zodiac". Subtitle: "生肖". Rows: 龙 / Dragon, 蛇 / Snake with pinyin and English. Optional small circular animal icons in monochrome ink style.`,
    },
  ];

  return [...heroes, ...islands];
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelay = 1200
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`   ⚠️  Retry in ${delay}ms…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

function getApiKey(): string {
  const key =
    process.env.NANO_BANANA_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "Missing API key. Set NANO_BANANA_API_KEY (or GEMINI_API_KEY) in .env.local"
    );
  }
  return key;
}

function modelsToTry(): string[] {
  const primary = process.env.NANO_BANANA_MODEL?.trim() || DEFAULT_MODEL;
  const secondary =
    primary === DEFAULT_MODEL ? FALLBACK_MODEL : DEFAULT_MODEL;
  return primary === secondary ? [primary] : [primary, secondary];
}

async function generateOne(
  ai: GoogleGenAI,
  prompt: string
): Promise<{ data: Buffer; mime: string }> {
  let lastErr: string | undefined;
  for (const model of modelsToTry()) {
    try {
      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model,
          contents: [{ parts: [{ text: prompt }] }],
          config: { responseModalities: ["IMAGE", "TEXT"] },
        })
      );
      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part?.inlineData?.data) {
          const mime = part.inlineData.mimeType || "image/png";
          return { data: Buffer.from(part.inlineData.data, "base64"), mime };
        }
      }
      lastErr = "Model returned no image part";
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`   [${model}] failed: ${lastErr}`);
    }
  }
  throw new Error(lastErr || "Image generation failed");
}

async function postProcess(
  input: Buffer,
  kind: "hero" | "island"
): Promise<Buffer> {
  const img = sharp(input).rotate();
  if (kind === "hero") {
    return img
      .resize(800, 400, { fit: "cover", position: "attention" })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  }
  /** Island: slightly taller "phone screenshot" feel, max width 900 */
  return img
    .resize(900, 900, {
      fit: "inside",
      withoutEnlargement: false,
    })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const onlyArg = argv.find((a) => a.startsWith("--only="));
  const only = onlyArg?.slice("--only=".length).trim();
  return { dryRun, only };
}

async function main() {
  const argv = process.argv.slice(2);
  const { dryRun, only } = parseArgs(argv);

  let jobs = buildJobs();
  if (only) {
    jobs = jobs.filter((j) => j.slug === only);
    if (jobs.length === 0) {
      console.error(`No jobs match --only=${only}`);
      process.exit(1);
    }
  }

  const outDir = path.join(process.cwd(), "public", "blog", "images");
  await mkdir(outDir, { recursive: true });

  console.log("LingoIsland blog image generator (Nano Banana / Gemini image)\n");
  console.log(`Jobs: ${jobs.length}${only ? ` (filtered: ${only})` : ""}`);
  console.log(`Output: ${outDir}/\n`);

  if (dryRun) {
    for (const j of jobs) {
      console.log("—".repeat(72));
      console.log(`${j.kind.toUpperCase()}  ${j.filename}\n`);
      console.log(j.prompt);
      console.log();
    }
    console.log("Dry run complete (--dry-run). No API calls made.");
    return;
  }

  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]!;
    const outPath = path.join(outDir, job.filename);
    console.log(`[${i + 1}/${jobs.length}] ${job.filename} …`);

    try {
      const { data, mime } = await generateOne(ai, job.prompt);
      console.log(`   raw mime: ${mime}, bytes: ${data.length}`);
      const jpeg = await postProcess(data, job.kind);
      await writeFile(outPath, jpeg);
      console.log(`   ✅ wrote ${outPath} (${jpeg.length} bytes)`);
    } catch (e) {
      console.error(
        `   ❌ failed:`,
        e instanceof Error ? e.message : String(e)
      );
    }

    if (i < jobs.length - 1) {
      const waitMs = 2200;
      console.log(`   ⏳ waiting ${waitMs}ms…\n`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  console.log("\nDone. Replace any weak images manually and re-run with --only=slug if needed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
