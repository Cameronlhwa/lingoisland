# Google Cloud Text-to-Speech Setup Guide

This guide will help you set up Google Cloud Text-to-Speech for your language learning app.

## Step 1: Get Your Google Cloud TTS API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Cloud Text-to-Speech API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Cloud Text-to-Speech API"
   - Click "Enable"
4. Create an API Key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy your API key
5. (Optional but recommended) Restrict your API key:
   - Click on your API key to edit it
   - Under "API restrictions", select "Restrict key"
   - Choose "Cloud Text-to-Speech API"
   - Under "Application restrictions", you can restrict by HTTP referrers or IP addresses

## Step 2: Add the API Key to Your Environment

Open your `.env.local` file and replace the placeholder with your actual API key:

```bash
GOOGLE_TTS_API_KEY=your-actual-google-api-key-here
```

## Step 3: Restart Your Development Server

If your dev server is running, restart it to pick up the new environment variable:

```bash
npm run dev
```

## How It Works

### Architecture

1. **Client-side**: `SpeakerButton` component triggers audio playback
2. **API Route**: `/api/tts` securely calls Google TTS API (keeps your key server-side)
3. **Utility**: `/lib/utils/tts.ts` handles audio caching and playback

### Features

- ✅ High-quality Wavenet voice (Mandarin Chinese)
- ✅ Audio caching to minimize API calls
- ✅ Slightly slower speaking rate (0.9x) for language learning
- ✅ Only one audio plays at a time
- ✅ Secure API key handling (server-side only)

### Voice Options

The default voice is `cmn-CN-Wavenet-A` (female). You can change this in `/app/api/tts/route.ts`:

```typescript
voice: {
  languageCode: 'cmn-CN',
  name: 'cmn-CN-Wavenet-A', // female (default)
  // Other options:
  // 'cmn-CN-Wavenet-B' - male
  // 'cmn-CN-Wavenet-C' - male
  // 'cmn-CN-Wavenet-D' - female
}
```

## Where TTS is Used

Currently integrated in:
- **Topic Islands**: Words and example sentences
- **Grammar Focus**: Example sentences in all tiers (easy, same, hard)

## Testing

1. Navigate to any topic island: `/app/topic-islands/[id]`
2. Click the speaker icon (🔊) next to any Chinese word or sentence
3. Audio should play automatically
4. Check browser console for any errors

## Pricing

Google Cloud TTS pricing (as of 2024):
- **Wavenet voices**: $16 per 1 million characters
- **Free tier**: First 1 million characters/month for Wavenet voices

For a language learning app, this is very affordable. Example:
- Average sentence: 20 characters
- 1 million characters = ~50,000 sentences
- With audio caching, users rarely hit the same text twice

## Troubleshooting

### "Text-to-speech service not configured" error
- Make sure `GOOGLE_TTS_API_KEY` is set in `.env.local`
- Restart your dev server after adding the key

### Audio doesn't play
- Check browser console for errors
- Make sure the Cloud Text-to-Speech API is enabled in Google Cloud Console
- Verify your API key is correct and has no restrictions blocking the API

### API quota exceeded
- Check your Google Cloud Console > APIs & Services > Dashboard
- Monitor your usage and increase quotas if needed

## Future Enhancements

Consider adding TTS to:
- Stories page (`/app/app/stories/`)
- Quiz flashcards (`/app/app/quiz/[id]/`)
- Daily stories (`/app/app/story/daily/`)

Let me know if you'd like help integrating TTS in other areas of the app!
