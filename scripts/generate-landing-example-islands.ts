import { GoogleGenAI } from "@google/genai/node";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import sharp from "sharp";

config({ path: path.join(process.cwd(), ".env.local") });

/**
 * Simple DFS flood fill to remove background starting from corners
 * (Same algorithm used in generateProgressIslands.ts)
 */
async function removeWhiteBackground(imageBase64: string): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, "base64");
  const image = sharp(imageBuffer);

  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const channels = info.channels;

  const visited = new Uint8Array(width * height);
  const threshold = 30;

  const getIndex = (x: number, y: number) => y * width + x;

  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * channels;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3],
    };
  };

  const setTransparent = (x: number, y: number) => {
    const idx = (y * width + x) * channels;
    data[idx + 3] = 0;
  };

  const isSimilar = (
    c1: ReturnType<typeof getPixel>,
    c2: ReturnType<typeof getPixel>
  ) =>
    Math.abs(c1.r - c2.r) <= threshold &&
    Math.abs(c1.g - c2.g) <= threshold &&
    Math.abs(c1.b - c2.b) <= threshold;

  const floodFill = (startX: number, startY: number) => {
    const startColor = getPixel(startX, startY);
    const stack: [number, number][] = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const idx = getIndex(x, y);
      if (visited[idx]) continue;
      const currentColor = getPixel(x, y);
      if (!isSimilar(currentColor, startColor)) continue;
      visited[idx] = 1;
      setTransparent(x, y);
      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }
  };

  floodFill(0, 0);
  floodFill(width - 1, 0);
  floodFill(0, height - 1);
  floodFill(width - 1, height - 1);

  const resultBuffer = await sharp(data, {
    raw: { width, height, channels },
  })
    .png({
      compressionLevel: 9,
      quality: 80,
      palette: true,
    })
    .toBuffer();

  return resultBuffer.toString("base64");
}

function buildPromptForTopic(topicDescription: string): string {
  return `Using the provided image, change ONLY the objects on top of the island surface to represent: ${topicDescription}.
Keep the island shape, ocean, sky, lighting, shadows, and composition EXACTLY the same.
Do not regenerate or redraw the base island — only add themed elements on its surface.
Maintain the thickness that the original island has for any new graphics.
Keep it simple, clean, and cartoonish. Avoid gradients and textures.
Use one to two plain colours maximum.
Try to use a bit of navy blue #182545 (RGB 24, 37, 69).
IMPORTANT: The capybara MUST be a cute, happy, smiling capybara (light brown caramel colour) STANDING UPRIGHT ON TWO FEET like a person. Make the capybara look joyful and cheerful with a friendly expression.
Add more detail to the island props to make them clearly recognizable and well-defined. Make sure each prop is distinct and visible.`;
}

const LANDING_EXAMPLES = [
  {
    filename: "example-hospital.png",
    topicDescription:
      "GOING TO THE HOSPITAL. Add 3-5 detailed, clearly visible props on the surface: a small hospital building with a red cross or plus sign, a stethoscope, a clipboard with medical symbols, a medical bag or bandages. Make each prop detailed and recognizable. Keep it cute and friendly, not scary. IMPORTANT: Include a HAPPY, SMILING caramel capybara STANDING UPRIGHT ON TWO FEET like a person, looking cheerful and friendly with a big smile.",
  },
  {
    filename: "example-ai.png",
    topicDescription:
      "ARTIFICIAL INTELLIGENCE. Add 3-5 detailed, clearly visible props: a circuit board or microchip, a friendly robot with visible features, a laptop with 'AI' text in navy blue, neural network nodes or lines. Make each prop detailed and recognizable. IMPORTANT: Include a HAPPY, SMILING caramel capybara STANDING ON TWO FEET looking curious and confident with a joyful expression.",
  },
  {
    filename: "example-cafe.png",
    topicDescription:
      "GOING TO THE CAFE. Add 3-5 detailed, clearly visible props: a coffee cup with steam, a cafe sign or storefront, pastries or croissants, a menu board or coffee beans. Make each prop detailed and recognizable. Cute, cozy vibe. IMPORTANT: Include a HAPPY, SMILING caramel capybara STANDING ON TWO FEET, perhaps holding a coffee cup, looking cheerful and content.",
  },
];

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`  ⚠️  Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function generateOneLandingIsland(
  topicDescription: string,
  baseImageBase64: string,
  apiKey: string
): Promise<string> {
  const model = "gemini-3-pro-image-preview";
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          {
            inlineData: { mimeType: "image/png", data: baseImageBase64 },
          },
          { text: buildPromptForTopic(topicDescription) },
        ],
      },
    ],
    config: { responseModalities: ["IMAGE", "TEXT"] },
  });

  if (!response) throw new Error("No response from API");

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part?.inlineData?.data) {
      const cleaned = await removeWhiteBackground(part.inlineData.data);
      return cleaned;
    }
  }

  const blockReason = response.promptFeedback?.blockReason;
  throw new Error(
    `Image model returned no image${blockReason ? ` (block: ${blockReason})` : ""}.`
  );
}

async function main() {
  console.log("🏝️  Landing Example Islands Generator");
  console.log("=".repeat(60));
  console.log("Output: public/landing-examples/");
  console.log("Model: gemini-3-pro-image-preview");
  console.log("=".repeat(60));
  console.log();

  const apiKey =
    process.env.NANO_BANANA_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ API key not found. Set NANO_BANANA_API_KEY (or GEMINI_API_KEY) in .env.local");
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), "public", "landing-examples");
  await mkdir(outputDir, { recursive: true });
  console.log(`✅ Output directory: ${outputDir}`);

  const basePath = path.join(process.cwd(), "public", "blank_island.png");
  const baseImage = await readFile(basePath);
  const baseImageBase64 = baseImage.toString("base64");
  console.log(`✅ Loaded base image: ${basePath}`);
  console.log();

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < LANDING_EXAMPLES.length; i++) {
    const item = LANDING_EXAMPLES[i];
    const outputPath = path.join(outputDir, item.filename);
    console.log(`[${i + 1}/${LANDING_EXAMPLES.length}] ${item.filename}`);
    console.log(`  Topic: ${item.topicDescription.slice(0, 60)}...`);

    try {
      const imageData = await retryWithBackoff(
        () =>
          generateOneLandingIsland(item.topicDescription, baseImageBase64, apiKey),
        2,
        2000
      );
      const buffer = Buffer.from(imageData, "base64");
      await writeFile(outputPath, buffer);
      console.log(`  ✅ Saved (${(buffer.length / 1024).toFixed(1)} KB)`);
      successCount++;

      if (i < LANDING_EXAMPLES.length - 1) {
        const delay = 1200 + Math.random() * 1300;
        console.log(`  ⏱️  Waiting ${Math.round(delay)}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    } catch (error) {
      console.error(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      failCount++;
    }
    console.log();
  }

  console.log("=".repeat(60));
  console.log(`✅ Complete: ${successCount} successful, ${failCount} failed`);
  console.log("=".repeat(60));
  if (failCount > 0) {
    console.log("⚠️  Re-run the script to retry failed generations.");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
