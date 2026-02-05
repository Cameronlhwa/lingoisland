# Island Library - Quick Start

This is a **TL;DR** version. For full details, see `ISLAND_LIBRARY_IMPLEMENTATION.md`.

## What is this?

Instead of generating island images on-the-fly (expensive, slow), we now use 20 pre-generated images stored in `public/island-library/`. Each new island gets randomly assigned one of these pre-made images.

**Benefits:**
- ✅ Zero ongoing API costs for island images
- ✅ Instant loading (local files, not API calls)
- ✅ ~99% cost reduction
- ✅ Consistent visual quality

## Setup (3 steps)

### 1. Run the database migration

```bash
# Apply migration to add cover_key column
supabase db push
# OR run the SQL manually in Supabase dashboard
```

Migration file: `supabase/migrations/20260205_000001_add_cover_key.sql`

### 2. Generate the library images (one-time)

```bash
# Make sure NANO_BANANA_API_KEY is in .env.local
npm run gen:island-library
```

**Takes:** ~5-10 minutes  
**Cost:** ~$1-2 (one-time)  
**Output:** 20 PNG files in `public/island-library/`

### 3. Backfill existing islands (if you have any)

```bash
# Make sure SUPABASE_SERVICE_ROLE_KEY is in .env.local
npm run backfill:island-covers
```

This assigns random cover images to islands that don't have one yet.

## Verify it works

1. Create a new island in the UI
2. It should immediately show a themed image (no 5-15 second generation wait)
3. Check database: the island should have a `cover_key` value

## Important Notes

- ⚠️ **Premium users DO NOT get custom island images**. Everyone uses the library.
- ⚠️ Generation code is kept but **disabled in normal product flow**.
- ⚠️ Old islands with `image_url` will continue to work (legacy support).

## What changed?

**New:**
- `lib/islandLibrary.ts` - Helpers for picking and using library images
- `scripts/generateIslandLibrary.ts` - One-time generator
- `scripts/backfillIslandCovers.ts` - Backfill existing islands
- `public/island-library/` - Directory with 20 pre-generated PNGs
- Database column: `topic_islands.cover_key`

**Modified:**
- `app/api/topic-islands/route.ts` - Assigns `cover_key` at creation
- `app/app/topic-islands/page.tsx` - Uses `cover_key` for display
- `app/app/topic-islands/[id]/page.tsx` - Disabled auto-generation
- Several other files - removed generate-image API calls

## Troubleshooting

**Images not showing?**
- Check files exist: `ls public/island-library/`
- Verify migration ran: Check if `cover_key` column exists in `topic_islands` table

**Generation failing?**
- Verify `NANO_BANANA_API_KEY` is set in `.env.local`
- Check that `public/blank_island.png` exists

**Need help?**
See the full implementation guide: `ISLAND_LIBRARY_IMPLEMENTATION.md`
