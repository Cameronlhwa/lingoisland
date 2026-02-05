# Island Library Implementation Guide

This document describes the island image library system that replaces expensive on-the-fly image generation with pre-generated assets.

## Overview

Instead of generating a unique island image for every user's topic island (which costs ~$0.05-0.10 per generation via Gemini API), we now:

1. Generate 20 beautiful island images once using NanoBanana Pro
2. Store them in `public/island-library/`
3. Randomly assign one to each new island at creation time
4. Persist the assignment in the database via `cover_key`

**Result**: Zero API costs for island images in normal product flow, instant loading, consistent quality.

## What Changed

### Database

- **New column**: `topic_islands.cover_key` (text) stores the filename from the library
- **Migration**: `supabase/migrations/20260205_000001_add_cover_key.sql`

### Code Structure

```
lib/
  islandLibrary.ts              # Manifest & helper functions
scripts/
  generateIslandLibrary.ts      # One-time generator (20 images)
  backfillIslandCovers.ts       # Assigns covers to existing islands
public/
  island-library/               # Pre-generated PNG files
    harbin-ice-city-winter-festival.png
    modern-china-skyline-with-advanced-technology.png
    ... (18 more)
```

### Modified Files

1. **`app/api/topic-islands/route.ts`**
   - Imports `pickRandomCoverKey()`
   - Assigns `cover_key` when creating new islands

2. **`app/app/topic-islands/page.tsx`**
   - Imports `coverUrlFromKey()`
   - Uses `cover_key` to display island images
   - Removed generate-image API calls

3. **`app/app/topic-islands/[id]/page.tsx`**
   - Added `cover_key` to Island interface
   - Disabled automatic image generation
   - Legacy support for old `image_url` during migration

4. **`components/app/HomeDashboard.tsx`**
   - Removed generate-image API call

5. **`lib/nanobanana/generate-island-image.ts`**
   - Added comment: "Generation disabled for cost; using pre-generated library"
   - Code kept for manual use if needed

6. **`app/api/topic-islands/[id]/generate-image/route.ts`**
   - Added comment explaining it's disabled in normal flow
   - Route kept for legacy support

## Step-by-Step Setup

### 1. Apply Database Migration

Run the migration to add the `cover_key` column:

```bash
# Via Supabase CLI (if you're using it)
supabase db push

# Or manually run the SQL in your Supabase dashboard
```

The migration file is at: `supabase/migrations/20260205_000001_add_cover_key.sql`

### 2. Generate Island Library (One-time)

Make sure you have the required API keys in `.env.local`:

```bash
NANO_BANANA_API_KEY=your_api_key_here
# OR any of: GOOGLE_API_KEY, GOOGLE_AI_API_KEY, GEMINI_API_KEY
```

Then run the generator:

```bash
npm run gen:island-library
```

**What it does:**
- Forces model to `gemini-3-pro-image-preview`
- Uses the EXACT prompt specified in requirements
- Generates 20 themed island PNGs
- Saves to `public/island-library/`
- Includes throttling (1200-2500ms between calls)
- Includes retry logic (2 retries with exponential backoff)

**Expected duration**: ~5-10 minutes for all 20 images

**Cost estimate**: ~$1-2 for the entire library (one-time)

### 3. Backfill Existing Islands (If Needed)

If you have existing islands without `cover_key`, assign them random covers:

```bash
npm run backfill:island-covers
```

**Requirements:**
- Set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- Already have `NEXT_PUBLIC_SUPABASE_URL` set

**What it does:**
- Finds all islands where `cover_key IS NULL`
- Assigns a random key from the library
- Updates the database

### 4. Verify Setup

1. Create a new island via the UI
2. Check that it immediately shows a themed image (no generation delay)
3. Verify in database that the island has a `cover_key` value

## Usage in Code

### Creating Islands

```typescript
import { pickRandomCoverKey } from '@/lib/islandLibrary'

// In your island creation logic
const { data: island } = await supabase
  .from('topic_islands')
  .insert({
    user_id: userId,
    topic: 'My Topic',
    cover_key: pickRandomCoverKey(), // ✅ Randomly assigned
    // ...other fields
  })
```

### Displaying Islands

```typescript
import { coverUrlFromKey } from '@/lib/islandLibrary'

// In your UI component
const imageSrc = island.cover_key 
  ? coverUrlFromKey(island.cover_key)  // ✅ Use library image
  : island.image_url || '/blank_island.png'  // Fallback for legacy
```

### Getting a Random Key

```typescript
import { pickRandomCoverKey } from '@/lib/islandLibrary'

const key = pickRandomCoverKey()
// Returns: "harbin-ice-city-winter-festival.png"
```

### Converting Key to URL

```typescript
import { coverUrlFromKey } from '@/lib/islandLibrary'

const url = coverUrlFromKey("harbin-ice-city-winter-festival.png")
// Returns: "/island-library/harbin-ice-city-winter-festival.png"
```

## The 20 Topics

1. Harbin ice city winter festival
2. Modern China skyline with advanced technology
3. Ancient China palace courtyard
4. Tropical Hainan beach vacation
5. Singapore Marina Bay futuristic city
6. China with flying cars future city
7. Beijing hutong street life
8. Shanghai night skyline neon
9. Chengdu panda city vibe
10. Xi'an terracotta warriors history
11. Guilin karst mountains river cruise
12. Hong Kong dense skyline trams
13. Tibetan plateau mountains and prayer flags
14. Silk Road desert caravan vibe
15. Chinese high-speed rail travel
16. Lantern festival night market
17. Traditional tea house calm vibes
18. Dragon boat festival river race
19. Snowy northern China countryside
20. Futuristic smart city with robots

## The Exact Prompt

(Non-negotiable, used verbatim in the generator)

```
Using the provided image, change ONLY the objects on top of the island surface to represent "[TOPIC]". In this artstyle, keep it simple, clean, and cartoonish. Add at least one structure to the island that relates to the topic. Also add in a cute fat furry very cute smiling capybara (light brown caramel colour) standing on two feet that suits the topic. Please maintain the thickness that the original island has for any new graphics on it. Keep the island shape, ocean, sky, lighting, shadows, and composition EXACTLY the same. Do not regenerate or redraw the base island - just add themed elements on its surface. Match the existing art style. You can add one to two plain colours maximum. Try to use a bit of navy blue #182545 (RGB 24, 37, 69)
```

## Cost Analysis

### Before (On-the-fly Generation)

- **Per island**: ~$0.05-0.10 (Gemini API call)
- **100 users creating 1 island each**: ~$5-10
- **1000 users**: ~$50-100
- **Loading time**: 5-15 seconds per island

### After (Pre-generated Library)

- **One-time generation**: ~$1-2 for all 20 images
- **Per island**: $0 (using local files)
- **Any number of users**: $0 additional cost
- **Loading time**: Instant (local file)

**Savings**: ~99% cost reduction + instant loading

## Premium Users

**Important**: Premium users DO NOT get custom island images. All users (free and premium) use the same pre-generated library for consistency and cost control.

Premium benefits remain:
- Unlimited islands & stories
- Full word access (words 11-20)
- All other pro features

## Legacy Support

During migration period:
- Old islands may still have `image_url` (base64 data URI)
- UI checks `cover_key` first, falls back to `image_url`
- Generation code kept but disabled in normal flow
- Generation API route still exists for manual use if needed

## Manual Generation (If Needed)

The generation code is preserved but disabled. To manually generate an image:

```bash
# Via API (if you re-enable the route)
curl -X POST http://localhost:3002/api/topic-islands/[ISLAND_ID]/generate-image \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

## Troubleshooting

### Images not loading

1. Verify files exist: `ls -la public/island-library/`
2. Check migration applied: Query `topic_islands` for `cover_key` column
3. Check Next.js is serving: Visit `http://localhost:3002/island-library/harbin-ice-city-winter-festival.png`

### Backfill fails

1. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
2. Check DB permissions (service role needs UPDATE on `topic_islands`)
3. Run with verbose logging: Add console.logs to the script

### Generation fails

1. Check API key is valid
2. Verify `public/blank_island.png` exists
3. Check rate limits (add longer delays if needed)
4. Review error messages for blocked content

## Files Reference

**New Files:**
- `lib/islandLibrary.ts` - Manifest and helpers
- `scripts/generateIslandLibrary.ts` - One-time generator
- `scripts/backfillIslandCovers.ts` - Backfill script
- `supabase/migrations/20260205_000001_add_cover_key.sql` - DB migration
- `public/island-library/README.md` - Library documentation
- `public/island-library/*.png` - 20 pre-generated images (after generation)

**Modified Files:**
- `app/api/topic-islands/route.ts` - Assigns cover_key at creation
- `app/app/topic-islands/page.tsx` - Uses cover_key for display
- `app/app/topic-islands/[id]/page.tsx` - Disabled generation
- `components/app/HomeDashboard.tsx` - Removed generation call
- `lib/nanobanana/generate-island-image.ts` - Added disabled comment
- `app/api/topic-islands/[id]/generate-image/route.ts` - Added disabled comment
- `package.json` - Added generator and backfill scripts

## Next Steps

1. Run the migration
2. Generate the library (one-time)
3. Backfill existing islands (if any)
4. Monitor for any issues
5. Eventually remove legacy `image_url` support when all islands migrated

## Success Criteria

✅ 20 PNGs exist in `public/island-library/`
✅ New islands get `cover_key` assigned automatically
✅ UI displays library images instantly
✅ No generate-image API calls in normal flow
✅ Premium users use library (not custom generation)
✅ Zero ongoing image generation costs
