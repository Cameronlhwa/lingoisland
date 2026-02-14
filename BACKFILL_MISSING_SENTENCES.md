# Backfill Missing Sentences

## Problem

Older free user accounts created when the position-based paywall was active (words 11-20 locked) may have words without example sentences. This leaves islands showing "Example sentences loading..." indefinitely.

## Solution

Run the backfill script to regenerate missing sentences for all affected islands.

## Prerequisites

1. Environment variables set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DEEPSEEK_API_KEY`

2. Dependencies installed:
   ```bash
   npm install
   ```

## Usage

### Dry Run (recommended first)

See which islands would be affected without making changes:

```bash
npm run backfill:missing-sentences -- --dry-run
```

### Run for a Single User

Test on one user first:

```bash
npm run backfill:missing-sentences -- --user-id=USER_ID_HERE
```

### Run for All Users

Regenerate sentences for all affected islands:

```bash
npm run backfill:missing-sentences
```

## What It Does

1. Scans all `ready` topic islands
2. For each island, checks if any words are missing sentences (< 3 sentences per word)
3. Regenerates missing sentences using the same AI generation pipeline
4. Inserts the new sentences into the database

## Output

The script provides detailed progress:

```
Found 15 islands. Checking each for missing sentences...

✗ Military Vocab (abc123...): 8/18 words missing sentences
✗ Weather Terms (def456...): 3/12 words missing sentences

Found 2 island(s) with missing sentences.

🔄 Regenerating sentences for "Military Vocab"...
  Found 8 words needing sentences
    ✓ 防守
    ✓ 进攻
    ...
✓ Regenerated 8/8 words for "Military Vocab"

Summary:
Islands processed: 2
Successful: 2
Failed: 0
Total words regenerated: 11
```

## Notes

- Safe to run multiple times (idempotent)
- Uses service role key for direct database access
- Small delay between islands to avoid rate limiting
- Skips words that already have 3 sentences
