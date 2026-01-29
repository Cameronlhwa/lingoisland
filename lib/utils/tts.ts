/**
 * Text-to-Speech utility for playing Chinese audio
 */

// Cache audio to avoid redundant API calls
// Key format: "text|rate" to cache different speeds separately
const audioCache = new Map<string, string>()

// Track currently playing audio
let currentAudio: HTMLAudioElement | null = null

/**
 * Generate cache key for audio
 */
function getCacheKey(text: string, rate: number): string {
  return `${text}|${rate.toFixed(2)}`
}

/**
 * Play Chinese text using Google Cloud Text-to-Speech
 * @param text - Chinese text to speak
 * @param rate - Speaking rate (0.25 - 2.0, default 1.0)
 * @returns Promise that resolves when audio starts playing
 */
export async function playTextToSpeech(
  text: string,
  rate: number = 1.0,
): Promise<void> {
  if (!text) {
    console.warn('playTextToSpeech: No text provided')
    return
  }

  try {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }

    // Check cache first
    const cacheKey = getCacheKey(text, rate)
    let audioUrl = audioCache.get(cacheKey)

    if (!audioUrl) {
      // Fetch audio from API
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, rate }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to generate speech')
      }

      const data = await response.json()

      // Convert base64 to blob URL
      const audioBlob = base64ToBlob(data.audioContent, 'audio/mp3')
      audioUrl = URL.createObjectURL(audioBlob)

      // Cache the audio URL
      audioCache.set(cacheKey, audioUrl)
    }

    // Play audio
    const audio = new Audio(audioUrl)
    currentAudio = audio

    await audio.play()

    // Clean up when audio finishes
    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null
      }
    }
  } catch (error) {
    console.error('Error playing text-to-speech:', error)
    throw error
  }
}

/**
 * Stop any currently playing audio
 */
export function stopTextToSpeech(): void {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }

  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

/**
 * Clear the audio cache
 */
export function clearAudioCache(): void {
  // Revoke all blob URLs to free memory
  audioCache.forEach((url) => {
    URL.revokeObjectURL(url)
  })
  audioCache.clear()
}
