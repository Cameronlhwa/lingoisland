/**
 * Text-to-Speech utility for playing Chinese audio
 */

// Cache audio to avoid redundant API calls
const audioCache = new Map<string, string>()

// Track currently playing audio
let currentAudio: HTMLAudioElement | null = null

/**
 * Play Chinese text using Google Cloud Text-to-Speech
 * @param text - Chinese text to speak
 * @returns Promise that resolves when audio starts playing
 */
export async function playTextToSpeech(text: string): Promise<void> {
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
    let audioUrl = audioCache.get(text)

    if (!audioUrl) {
      // Fetch audio from API
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
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
      audioCache.set(text, audioUrl)
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
