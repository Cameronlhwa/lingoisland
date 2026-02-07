import { GoogleGenAI } from "@google/genai/node";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import sharp from "sharp";

config({ path: path.join(process.cwd(), ".env.local") });

/**
 * DFS flood fill from corners to remove white background.
 * Same algorithm as boat-capybara and other capybara scripts.
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
    data[idx + 3] = 0; // Set alpha to 0
  };
  const isSimilar = (
    c1: ReturnType<typeof getPixel>,
    c2: ReturnType<typeof getPixel>
  ) =>
    Math.abs(c1.r - c2.r) <= threshold &&
    Math.abs(c1.g - c2.g) <= threshold &&
    Math.abs(c1.b - c2.b) <= threshold;

  const corners: [number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];

  const floodFill = (startX: number, startY: number) => {
    const startColor = getPixel(startX, startY);
    const stack: [number, number][] = [[startX, startY]];
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const idx = getIndex(x, y);
      if (visited[idx]) continue;
      const current = getPixel(x, y);
      if (!isSimilar(current, startColor)) continue;
      visited[idx] = 1;
      setTransparent(x, y);
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  };

  for (const [sx, sy] of corners) {
    visited.fill(0);
    floodFill(sx, sy);
  }

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

const CAPYBARA_FACE_PROMPT = `Create a capybara face profile icon matching the reference image EXACTLY. The ENTIRE face must be filled with warm caramel brown color (#C89968, RGB 200, 153, 104) - not white, not pale. Thick black outlines define the features. IMPORTANT: Include EXACTLY TWO large round black eyes (not four, just two eyes) with white highlights, positioned side by side. Add one small brown/black rounded nose below the eyes, and a subtle smile. The whole head/face area must be solid caramel brown, just like in the reference image. Add tiny darker brown or navy (#182545) shading for depth. Keep it simple and cute. White background only outside the capybara for transparency removal. Style: thick outlines, minimal colors, cartoon/sticker style matching reference. TWO EYES ONLY.`;

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
        console.log(`  ⚠️  Retry in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError!;
}

async function main() {
  console.log("🦫 Capybara Face Profile Picture Generator");
  console.log("Output: public/capybara-face.png");
  console.log("Model: gemini-3-pro-image-preview (Nano Banana Pro)");
  console.log();

  const apiKey =
    process.env.NANO_BANANA_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ API key not found. Set in .env.local");
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), "public");
  await mkdir(outputDir, { recursive: true });

  const ai = new GoogleGenAI({ apiKey });

  try {
    console.log("Generating capybara face icon...");
    
    // Load reference image
    const referencePath = path.join(process.cwd(), "public", "base_cappy.png");
    const referenceBuffer = await readFile(referencePath);
    const referenceBase64 = referenceBuffer.toString("base64");
    
    const response = await retryWithBackoff(() =>
      ai.models.generateContent({
        model: "gemini-3-pro-image-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: referenceBase64,
                },
              },
              { text: CAPYBARA_FACE_PROMPT },
            ],
          },
        ],
        config: { responseModalities: ["IMAGE", "TEXT"] },
      })
    );

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        console.log("Processing image (removing background)...");
        const cleaned = await removeWhiteBackground(part.inlineData.data);
        const outPath = path.join(outputDir, "capybara-face.png");
        await writeFile(outPath, Buffer.from(cleaned, "base64"));
        console.log("✅ Saved (transparent background):", outPath);
        return;
      }
    }
    throw new Error("No image in response");
  } catch (error) {
    console.error("❌ Generation failed:", error instanceof Error ? error.message : String(error));
    console.log("TODO: Add a placeholder PNG at public/capybara-face.png");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
