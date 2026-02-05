import { GoogleGenAI } from '@google/genai/node'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

type NanoBananaImage = {
  data: string
  mimeType: string
}

/**
 * Simple DFS flood fill to remove background starting from corners
 */
async function removeWhiteBackground(imageBase64: string): Promise<string> {
  const imageBuffer = Buffer.from(imageBase64, 'base64')
  const image = sharp(imageBuffer)
  
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  
  const width = info.width
  const height = info.height
  const channels = info.channels // Should be 4 (RGBA)
  
  // Create a visited array
  const visited = new Uint8Array(width * height)
  
  // Color similarity threshold
  const threshold = 30
  
  // Get pixel index
  const getIndex = (x: number, y: number) => y * width + x
  
  // Get pixel color
  const getPixel = (x: number, y: number) => {
    const idx = (y * width + x) * channels
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      a: data[idx + 3],
    }
  }
  
  // Set pixel transparent
  const setTransparent = (x: number, y: number) => {
    const idx = (y * width + x) * channels
    data[idx + 3] = 0 // Set alpha to 0
  }
  
  // Check if two colors are similar
  const isSimilar = (c1: ReturnType<typeof getPixel>, c2: ReturnType<typeof getPixel>) => {
    return (
      Math.abs(c1.r - c2.r) <= threshold &&
      Math.abs(c1.g - c2.g) <= threshold &&
      Math.abs(c1.b - c2.b) <= threshold
    )
  }
  
  // DFS flood fill
  const floodFill = (startX: number, startY: number) => {
    const startColor = getPixel(startX, startY)
    const stack: [number, number][] = [[startX, startY]]
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      
      const idx = getIndex(x, y)
      if (visited[idx]) continue
      
      const currentColor = getPixel(x, y)
      if (!isSimilar(currentColor, startColor)) continue
      
      visited[idx] = 1
      setTransparent(x, y)
      
      // Add neighbors (4-directional)
      stack.push([x + 1, y])
      stack.push([x - 1, y])
      stack.push([x, y + 1])
      stack.push([x, y - 1])
    }
  }
  
  // Start flood fill from all four corners
  floodFill(0, 0) // Top-left
  floodFill(width - 1, 0) // Top-right
  floodFill(0, height - 1) // Bottom-left
  floodFill(width - 1, height - 1) // Bottom-right
  
  // Convert back to PNG
  const resultBuffer = await sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png()
    .toBuffer()
  
  return resultBuffer.toString('base64')
}

// Pro as main model for image editing; flash as fallback
const DEFAULT_MODEL = 'gemini-3-pro-image-preview'
const FALLBACK_MODEL = 'gemini-2.5-flash-image'

// NOTE: Generation disabled for cost savings in normal product flow.
// All islands now use pre-generated library images (cover_key).
// This code is kept for legacy support and manual generation if needed.
const buildPrompt = (topic: string) =>
  `Using the provided image, change ONLY the objects on top of the island surface to represent "${topic}". In this artstyle, keep it simple, clean, and cartoonish. Add at least one structure to the island that relates to the topic. Also add in a cute fat furry very cute smiling capybara (light brown caramel colour) standing on two feet that suits the topic. Please maintain the thickness that the original island has for any new graphics on it. Keep the island shape, ocean, sky, lighting, shadows, and composition EXACTLY the same. Do not regenerate or redraw the base island - just add themed elements on its surface. Match the existing art style. You can add one to two plain colours maximum. Try to use a bit of navy blue #182545 (RGB 24, 37, 69)`

export async function generateIslandImage({
  topic,
  baseImagePath,
  removeBackgroundEnabled = false,
}: {
  topic: string
  baseImagePath?: string
  removeBackgroundEnabled?: boolean
}): Promise<NanoBananaImage> {
  const model = process.env.NANO_BANANA_MODEL || DEFAULT_MODEL
  const trimmedTopic = topic.trim()
  const resolvedPath =
    baseImagePath || path.join(process.cwd(), 'public', 'blank_island.png')

  const baseImage = await readFile(resolvedPath)
  const baseImageBase64 = baseImage.toString('base64')

  const apiKey =
    process.env.NANO_BANANA_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error(
      'Island image API key not set. Add NANO_BANANA_API_KEY (or GEMINI_API_KEY) to .env.local'
    )
  }

  const ai = new GoogleGenAI({ apiKey })

  const contents = [
    {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: baseImageBase64,
          },
        },
        { text: buildPrompt(trimmedTopic) },
      ],
    },
  ]

  type GenResponse = Awaited<ReturnType<typeof ai.models.generateContent>>
  let response: GenResponse | undefined
  const modelsToTry = [model, model === DEFAULT_MODEL ? FALLBACK_MODEL : DEFAULT_MODEL].filter(
    (m, i, arr) => arr.indexOf(m) === i
  )

  for (const tryModel of modelsToTry) {
    try {
      response = await ai.models.generateContent({
        model: tryModel,
        contents,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      })
      break
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (tryModel === modelsToTry[modelsToTry.length - 1]) {
        throw new Error(
          msg.includes('API key') ? msg : `Island image generation failed: ${msg}`
        )
      }
      console.warn(`[generate-island-image] ${tryModel} failed, trying next:`, msg)
    }
  }

  if (!response) {
    throw new Error('Island image generation failed: no response from API')
  }

  const parts = response.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part?.inlineData?.data) {
      let imageData = part.inlineData.data
      if (removeBackgroundEnabled) {
        imageData = await removeWhiteBackground(imageData)
      }
      return {
        data: imageData,
        mimeType: 'image/png',
      }
    }
  }

  const blockReason = response.promptFeedback?.blockReason
  const blockMsg = blockReason ? ` (block reason: ${blockReason})` : ''
  throw new Error(`Image model returned no image${blockMsg}. Try again or use a different topic.`)
}
