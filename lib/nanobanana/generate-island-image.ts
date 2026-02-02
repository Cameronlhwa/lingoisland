import { GoogleGenAI } from '@google/genai'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

type NanoBananaImage = {
  data: string
  mimeType: string
}

// Using Pro model for high-fidelity detail preservation during editing
const DEFAULT_MODEL = 'gemini-3-pro-image-preview'

const buildPrompt = (topic: string) =>
  `Using the provided image, change ONLY the objects on top of the island surface to represent "${topic}". In this artstyle, keep it simple, clean, and cartoonish. Add at least one structure to the island that relates to the topic. Please maintain the thickness that the original island has for any new graphics on it. Keep the island shape, ocean, sky, lighting, shadows, and composition EXACTLY the same. Do not regenerate or redraw the base island - just add themed elements on its surface. Match the existing art style.`

export async function generateIslandImage({
  topic,
  baseImagePath,
}: {
  topic: string
  baseImagePath?: string
}): Promise<NanoBananaImage> {
  const model = process.env.NANO_BANANA_MODEL || DEFAULT_MODEL
  const trimmedTopic = topic.trim()
  const resolvedPath =
    baseImagePath || path.join(process.cwd(), 'public', 'blank_island.png')

  const baseImage = await readFile(resolvedPath)
  const baseImageBase64 = baseImage.toString('base64')

  const apiKey =
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NANO_BANANA_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_API_KEY not configured')
  }

  const ai = new GoogleGenAI({ apiKey })
  
  // Following the image editing pattern from docs
  // https://ai.google.dev/gemini-api/docs/image-generation#javascript
  // Image first, then edit instruction (as shown in inpainting examples)
  const prompt = [
    {
      inlineData: {
        mimeType: 'image/png',
        data: baseImageBase64,
      },
    },
    { text: buildPrompt(trimmedTopic) },
  ]

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  })

  const parts = response?.candidates?.[0]?.content?.parts || []
  for (const part of parts) {
    if (part?.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
      }
    }
  }

  throw new Error('Nano Banana response missing image data')
}
