# Sentence Regeneration Feature

## Summary

Added a double-checker system to automatically detect and regenerate missing example sentences for topic islands, plus improved loading animations.

## Problem

Sometimes when generating topic islands, example sentences would fail to generate for certain words due to:
- API timeouts
- Validation failures (duplicate detection, missing target word, etc.)
- Network errors during parallel generation

This left some words with 0, 1, or 2 sentences instead of the expected 3 (easy, same, hard).

## Solution

### 1. **New API Endpoint**: `/api/topic-islands/[id]/regenerate-sentences`

**Location**: `app/api/topic-islands/[id]/regenerate-sentences/route.ts`

**What it does**:
- Scans all words in a topic island
- Identifies words with fewer than 3 example sentences
- Deletes any incomplete sentences for those words
- Regenerates complete sentence sets (easy, same, hard)
- Returns a report of how many words were fixed

**Usage**:
```typescript
POST /api/topic-islands/[island-id]/regenerate-sentences

Response:
{
  "message": "Regenerated sentences for X out of Y words",
  "regenerated": 2,
  "total": 12,
  "wordsMissing": 2,
  "errors": ["..."] // if any
}
```

### 2. **Automatic Sentence Completion Check**

**Location**: `app/app/topic-islands/[id]/page.tsx` → `loadIsland()` function

**What it does**:
- Monitors island status changes
- When status changes from `"generating"` → `"ready"`, automatically calls the regenerate-sentences endpoint
- Reloads the island data after regeneration completes
- Runs silently in the background without user intervention

**Code**:
```typescript
if (previousStatus === "generating" && data.island.status === "ready") {
  checkAndRegenerateSentences();
}
```

### 3. **Enhanced Loading Animations**

**Location**: `app/app/topic-islands/[id]/page.tsx` → Word card rendering

**What it shows**:

| Condition | Visual | Color |
|-----------|--------|-------|
| `sentences.length === 0` | Spinner + "Example sentences loading..." | Gray |
| `sentences.length < 3` | Spinner + "Some sentences missing..." | Amber/Orange |
| `sentences.length === 3` | Normal sentence display | Normal |

**Benefits**:
- Users always see a loading indicator when sentences are missing
- The animation continues to show even after island generation completes
- Orange spinner indicates incomplete sentences (partial failure state)

## Edge Cases Handled

1. **No sentences at all**: Shows gray loading spinner
2. **Partial sentences (1-2)**: Shows amber warning spinner
3. **All 3 sentences present**: Displays normally
4. **Regeneration failure**: Logs errors but doesn't break the UI
5. **Concurrent regeneration**: Endpoint is idempotent and can be safely called multiple times

## User Experience

### Before
- Some words would have missing example sentences
- No indication that sentences failed to generate
- Users had to manually report issues

### After
- System automatically detects and fixes missing sentences
- Users see loading animations for incomplete sentences
- Happens transparently in the background
- Words appear complete within seconds of island generation finishing

## Technical Implementation Details

### Sentence Generation Flow

1. **Initial Generation** (`generate-batch/route.ts`):
   - Generates words and sentences in parallel
   - Some sentences may fail validation or API calls
   - Failures are logged but don't block word insertion

2. **Completion Check** (new):
   - Triggered when island status becomes "ready"
   - Scans for words with `sentence_count < 3`
   - Regenerates missing sentences individually

3. **Validation**:
   - Each word must have exactly 3 sentences (easy, same, hard)
   - Each sentence must contain the target word
   - Tiers must be unique per word

### Database Schema Reference

```sql
-- island_sentences table structure
island_sentences (
  id uuid,
  island_id uuid references topic_islands(id),
  word_id uuid references island_words(id),
  user_id uuid,
  tier text, -- 'easy' | 'same' | 'hard'
  hanzi text,
  pinyin text,
  english text,
  grammar_tag text,
  unique(word_id, tier) -- Ensures only one sentence per tier per word
)
```

## Future Enhancements

Potential improvements for later:

1. **Retry Button**: Add a manual "Regenerate sentences" button for users to trigger on demand
2. **Batch Endpoint**: Extend the endpoint to work across multiple islands
3. **Progress Indicator**: Show which specific words are being regenerated
4. **Sentence Quality Check**: Add validation for sentence diversity and quality
5. **Analytics**: Track regeneration success rates to identify systemic issues

## Testing

To test this feature:

1. Create a new topic island
2. Watch the generation process
3. If any words show the loading spinner after generation completes:
   - The system should automatically call the regeneration endpoint
   - Sentences should appear within 5-10 seconds
   - Loading spinner should disappear once complete

4. To manually test the endpoint:
```bash
curl -X POST http://localhost:3000/api/topic-islands/[island-id]/regenerate-sentences
```

## Files Modified

1. **New file**: `app/api/topic-islands/[id]/regenerate-sentences/route.ts`
   - Complete regeneration endpoint implementation

2. **Modified**: `app/app/topic-islands/[id]/page.tsx`
   - Added `checkAndRegenerateSentences()` function
   - Updated `loadIsland()` to trigger automatic check
   - Enhanced sentence loading UI with partial state handling

## Related Documentation

- `TTS_SETUP.md` - Text-to-speech for sentences
- `ISLAND_LIBRARY_QUICKSTART.md` - Island generation overview
- `A1_C1_LEVEL_SUPPORT.md` - Level-specific sentence generation
