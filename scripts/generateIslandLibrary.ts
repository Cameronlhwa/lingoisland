import { GoogleGenAI } from '@google/genai/node'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { config } from 'dotenv'
import sharp from 'sharp'

// Load environment variables from .env.local (Next.js convention)
config({ path: path.join(process.cwd(), '.env.local') })

/**
 * Simple DFS flood fill to remove background starting from corners
 * (Same algorithm used in generate-island-image.ts)
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
  
  // Convert back to PNG with compression
  const resultBuffer = await sharp(data, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png({
      compressionLevel: 9,  // Maximum compression (0-9)
      quality: 80,          // Good quality/size balance
      palette: true,        // Use palette mode for smaller files
    })
    .toBuffer()
  
  return resultBuffer.toString('base64')
}

// EXACT prompt as required (NON-NEGOTIABLE)
const buildPromptExact = (topic: string) =>
  `Using the provided image, change ONLY the objects on top of the island surface to represent "${topic}". In this artstyle, keep it simple, clean, and cartoonish. Add at least one structure to the island that relates to the topic. Also add in a cute fat furry very cute smiling capybara (light brown caramel colour) standing on two feet that suits the topic. Please maintain the thickness that the original island has for any new graphics on it. Keep the island shape, ocean, sky, lighting, shadows, and composition EXACTLY the same. Do not regenerate or redraw the base island - just add themed elements on its surface. Match the existing art style. You can add one to two plain colours maximum. Try to use a bit of navy blue #182545 (RGB 24, 37, 69)`

// Slugify helper
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove punctuation
    .replace(/\s+/g, '-') // Spaces to hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .slice(0, 50) // Cap length
}

// Topics list (EXACT 20 as specified)
const TOPICS = [
  'Harbin ice city winter festival',
  'Modern China with advanced technology',
  'Ancient China',
  'Tropical Hainan island',
  'Singapore futuristic city',
  'China with flying cars future city',
  'Beijing traditional hutong area',
  'Shanghai night skyline neon',
  'Chengdu panda city vibe',
  'Xi\'an terracotta warriors history',
  'Guilin karst mountains river cruise',
  'Hong Kong',
  'Tibetan plateau mountains and prayer flags',
  'Silk Road desert caravan vibe',
  'Chinese high-speed rail travel',
  'Lantern festival night market',
  'Traditional chinese tea house',
  'Dragon boat festival',
  'Snowy northern China ice town',
  'Futuristic shenzhen',
]

// Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`  ⚠️  Attempt ${attempt + 1} failed, retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

// Generate one island image
async function generateOneIsland(
  topic: string,
  baseImageBase64: string,
  apiKey: string
): Promise<string> {
  // Force NanoBanana Pro model
  const model = 'gemini-3-pro-image-preview'

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
        { text: buildPromptExact(topic) },
      ],
    },
  ]

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  })

  if (!response) {
    throw new Error('No response from API')
  }

  const parts = response.candidates?.[0]?.content?.parts ?? []
  for (const part of parts) {
    if (part?.inlineData?.data) {
      // Apply background removal before returning
      const cleanedImage = await removeWhiteBackground(part.inlineData.data)
      return cleanedImage
    }
  }

  const blockReason = response.promptFeedback?.blockReason
  const blockMsg = blockReason ? ` (block reason: ${blockReason})` : ''
  throw new Error(`Image model returned no image${blockMsg}. Try again or use a different topic.`)
}

async function main() {
  console.log('🏝️  Island Library Generator')
  console.log('=' .repeat(60))
  console.log('Generating 20 pre-made island images using NanoBanana Pro')
  console.log('Model: gemini-3-pro-image-preview')
  console.log('=' .repeat(60))
  console.log()

  // Force NanoBanana Pro model via environment variable
  process.env.NANO_BANANA_MODEL = 'gemini-3-pro-image-preview'

  // Check for API key
  const apiKey =
    process.env.NANO_BANANA_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY

  if (!apiKey) {
    console.error('❌ API key not found!')
    console.error('Set NANO_BANANA_API_KEY (or GEMINI_API_KEY) in .env.local')
    process.exit(1)
  }

  // Create output directory
  const outputDir = path.join(process.cwd(), 'public', 'island-library')
  await mkdir(outputDir, { recursive: true })
  console.log(`✅ Output directory: ${outputDir}`)
  console.log()

  // Load base image
  const baseImagePath = path.join(process.cwd(), 'public', 'blank_island.png')
  const baseImage = await readFile(baseImagePath)
  const baseImageBase64 = baseImage.toString('base64')
  console.log(`✅ Loaded base image: ${baseImagePath}`)
  console.log()

  let successCount = 0
  let failCount = 0

  for (let i = 0; i < TOPICS.length; i++) {
    const topic = TOPICS[i]
    const slug = slugify(topic)
    const filename = `${slug}.png`
    const outputPath = path.join(outputDir, filename)

    console.log(`[${i + 1}/${TOPICS.length}] ${topic}`)
    console.log(`  📝 Filename: ${filename}`)

    try {
      // Generate with retries
      const imageData = await retryWithBackoff(
        () => generateOneIsland(topic, baseImageBase64, apiKey),
        2,
        2000
      )

      // Save to file
      const buffer = Buffer.from(imageData, 'base64')
      await writeFile(outputPath, buffer)

      console.log(`  ✅ Saved (${(buffer.length / 1024).toFixed(1)} KB)`)
      successCount++

      // Throttle: random delay between calls
      if (i < TOPICS.length - 1) {
        const delay = 1200 + Math.random() * 1300 // 1200-2500ms
        console.log(`  ⏱️  Waiting ${Math.round(delay)}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    } catch (error) {
      console.error(`  ❌ Failed: ${error instanceof Error ? error.message : String(error)}`)
      failCount++
    }

    console.log()
  }

  console.log('=' .repeat(60))
  console.log(`✅ Complete: ${successCount} successful, ${failCount} failed`)
  console.log('=' .repeat(60))

  if (failCount > 0) {
    console.log('⚠️  Some images failed to generate. Re-run the script to retry failed topics.')
  }
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
