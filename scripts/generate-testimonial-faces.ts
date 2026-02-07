import { GoogleGenAI } from "@google/genai/node";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

const testimonials = [
  {
    name: "Ava",
    description: "30s professional woman with shoulder-length brown hair, B1 Mandarin learner, friendly and approachable smile, wearing business casual",
    filename: "ava.png",
  },
  {
    name: "Daniel",
    description: "Mid-30s tech professional man with short dark hair and glasses, B2 learner, focused and determined expression, wearing casual button-up shirt",
    filename: "daniel.png",
  },
  {
    name: "Mina",
    description: "Late 20s woman with long black hair, self-learner, calm and thoughtful expression, wearing simple modern clothing",
    filename: "mina.png",
  },
  {
    name: "Chris",
    description: "40s busy professional man with short grey-speckled hair, practical and efficient looking, wearing white medical coat or business attire",
    filename: "chris.png",
  },
  {
    name: "Jason",
    description: "Early 30s Asian American man with modern short hairstyle, heritage learner, confident and articulate expression, wearing casual professional attire",
    filename: "jason.png",
  },
];

function createPrompt(person: { name: string; description: string }): string {
  return `Photorealistic professional headshot portrait of ${person.name}. ${person.description}. Natural lighting, clean white or neutral soft-focus background. Warm friendly expression, looking slightly at camera. Professional business casual attire. High quality DSLR photography, sharp focus on face, shallow depth of field. Natural skin tones, professional retouching. Headshot suitable for LinkedIn or professional profile. Real person, photographic quality, modern professional portrait photography.`;
}

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
  console.log("👤 Testimonial Face Generator");
  console.log("Output: public/testimonials/");
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

  const outputDir = path.join(process.cwd(), "public", "testimonials");
  await mkdir(outputDir, { recursive: true });

  const ai = new GoogleGenAI({ apiKey });

  for (const person of testimonials) {
    console.log(`\n🎨 Generating face for ${person.name}...`);
    
    try {
      const prompt = createPrompt(person);
      console.log(`   Prompt: ${prompt.substring(0, 80)}...`);

      const response = await retryWithBackoff(() =>
        ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: { responseModalities: ["IMAGE", "TEXT"] },
        })
      );

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part?.inlineData?.data) {
          const outPath = path.join(outputDir, person.filename);
          await writeFile(outPath, Buffer.from(part.inlineData.data, "base64"));
          console.log(`   ✅ Saved: ${person.filename}`);
          break;
        }
      }
    } catch (error) {
      console.error(
        `   ❌ Failed for ${person.name}:`,
        error instanceof Error ? error.message : String(error)
      );
      console.log(`   TODO: Add placeholder at public/testimonials/${person.filename}`);
    }

    // Add delay between requests to avoid rate limiting
    if (person !== testimonials[testimonials.length - 1]) {
      console.log("   ⏳ Waiting 2s before next generation...");
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log("\n✅ All testimonial faces generated!");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
