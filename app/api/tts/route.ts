import { NextResponse } from 'next/server'

/**
 * POST /api/tts
 * Convert Chinese text to speech using Google Cloud Text-to-Speech API
 * 
 * Body: { text: string, rate?: number }
 * Returns: audio/mp3 file
 */
export async function POST(request: Request) {
  try {
    const { text, rate } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // Validate and clamp rate (default to 1.0)
    let speakingRate = 1.0
    if (rate !== undefined) {
      if (typeof rate !== 'number') {
        return NextResponse.json(
          { error: 'Rate must be a number' },
          { status: 400 }
        )
      }
      speakingRate = Math.max(0.25, Math.min(2.0, rate))
    }

    const apiKey = process.env.GOOGLE_TTS_API_KEY

    if (!apiKey) {
      console.error('GOOGLE_TTS_API_KEY is not configured')
      return NextResponse.json(
        { error: 'Text-to-speech service not configured' },
        { status: 500 }
      )
    }

    // Call Google Cloud Text-to-Speech API
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'cmn-CN', // Mandarin Chinese (Simplified)
            name: 'cmn-CN-Wavenet-A', // High-quality Wavenet voice (female)
            // Alternative voices:
            // 'cmn-CN-Wavenet-B' - male
            // 'cmn-CN-Wavenet-C' - male
            // 'cmn-CN-Wavenet-D' - female
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: speakingRate,
            pitch: 0,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      console.error('Google TTS API error:', error)
      return NextResponse.json(
        { error: 'Failed to generate speech' },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Return the base64-encoded audio
    return NextResponse.json({
      audioContent: data.audioContent,
    })
  } catch (error) {
    console.error('Error in POST /api/tts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
