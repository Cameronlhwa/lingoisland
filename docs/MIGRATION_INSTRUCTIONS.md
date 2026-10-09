# Universal SRS System Migration Instructions

## Overview

This migration unifies `quiz_cards` and `flashcards` into a single `cards` table with a `card_collections` mapping table, and updates `card_review_state` to use the new universal system.

## Files Changed

### Database Migrations
- `supabase/migrations/20260115_000001_universal_cards_srs.sql` - Main schema changes
- `supabase/migrations/20260115_000002_backfill_universal_cards.sql` - Data migration

### API Routes (Refactored)
- `app/api/quiz-islands/[id]/queue/route.ts` - NEW: Get quiz queue
- `app/api/quiz-islands/[id]/grade/route.ts` - NEW: Grade cards
- `app/api/quiz-islands/[id]/cards/route.ts` - UPDATED: Uses cards + card_collections
- `app/api/quiz-islands/[id]/cards/[cardId]/route.ts` - UPDATED: Deletes from card_collections
- `app/api/quiz-islands/add-from-topic-item/route.ts` - UPDATED: Uses cards + card_collections
- `app/api/quiz-islands/[id]/route.ts` - UPDATED: Counts via card_collections
- `app/api/quiz-islands/route.ts` - UPDATED: Counts via card_collections

### UI Components
- `app/app/quiz/[id]/session/page.tsx` - NEW: Quiz session page
- `app/app/quiz/[id]/page.tsx` - UPDATED: Wired Start Quiz button
- `components/app/QuizMasteryStats.tsx` - NEW: Mastery breakdown graph

## Migration Steps

### 1. Run the main migration

```bash
# Connect to your Supabase project
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the main migration
\i supabase/migrations/20260115_000001_universal_cards_srs.sql
```

### 2. Run the backfill script (ONE TIME ONLY)

```bash
# Run the backfill to migrate existing data
\i supabase/migrations/20260115_000002_backfill_universal_cards.sql
```

### 3. Verify the migration

```sql
-- Check card counts
SELECT 'cards' as table_name, COUNT(*) FROM cards
UNION ALL
SELECT 'card_collections', COUNT(*) FROM card_collections
UNION ALL
SELECT 'card_review_state', COUNT(*) FROM card_review_state;

-- Check quiz island card counts
SELECT qi.name, COUNT(cc.card_id) as card_count
FROM quiz_islands qi
LEFT JOIN card_collections cc ON cc.collection_id = qi.id AND cc.collection_type = 'quiz_island'
GROUP BY qi.id, qi.name;

-- Test the RPC functions
SELECT * FROM get_quiz_stats('[YOUR-QUIZ-ISLAND-ID]');
SELECT * FROM get_quiz_queue('[YOUR-QUIZ-ISLAND-ID]', 80, 20);
```

### 4. Test the application

1. Navigate to a quiz island page
2. Verify the mastery breakdown graph appears at the bottom
3. Click "Start Quiz" - should navigate to quiz session
4. Complete a few cards with Forgot/Hard/Good/Easy ratings
5. Return to quiz island page and verify stats updated

## New Database Schema

### `cards` table
- Universal card storage for all card types
- Fields: `id`, `user_id`, `front`, `back`, `front_lang`, `back_lang`, `pinyin`, `source_type`, `source_ref_id`, `created_at`

### `card_collections` table
- Maps cards to collections (quiz islands or decks)
- Fields: `id`, `user_id`, `collection_type`, `collection_id`, `card_id`, `created_at`
- Unique constraint: `(user_id, collection_type, collection_id, card_id)`

### `card_review_state` (updated)
- Now references `cards(id)` instead of `flashcards(id)`
- New fields: `state`, `lapses`, `streak`, `suspended`

## RPC Functions

### `get_quiz_queue(p_quiz_island_id, p_review_limit, p_new_limit)`
Returns cards for review (due reviews + new cards)

### `grade_card(p_card_id, p_rating)`
Grades a card using SM2-like algorithm
- Ratings: `'forgot'`, `'hard'`, `'good'`, `'easy'`

### `get_quiz_stats(p_quiz_island_id)`
Returns mastery breakdown counts:
- `forgot_count`, `hard_count`, `good_count`, `easy_count`, `new_count`, `total_count`

## Rollback (if needed)

If you need to rollback:

```sql
-- Drop new tables
DROP TABLE IF EXISTS card_collections CASCADE;
DROP TABLE IF EXISTS cards CASCADE;

-- Drop RPC functions
DROP FUNCTION IF EXISTS get_quiz_queue;
DROP FUNCTION IF EXISTS grade_card;
DROP FUNCTION IF EXISTS get_quiz_stats;

-- Restore old card_review_state FK
ALTER TABLE card_review_state DROP CONSTRAINT IF EXISTS card_review_state_card_id_fkey;
ALTER TABLE card_review_state 
  ADD CONSTRAINT card_review_state_card_id_fkey 
  FOREIGN KEY (card_id) REFERENCES flashcards(id) ON DELETE CASCADE;

-- Remove new columns
ALTER TABLE card_review_state DROP COLUMN IF EXISTS state;
ALTER TABLE card_review_state DROP COLUMN IF EXISTS lapses;
ALTER TABLE card_review_state DROP COLUMN IF EXISTS streak;
ALTER TABLE card_review_state DROP COLUMN IF EXISTS suspended;
```

Then revert the code changes via git.

## Notes

- Legacy `quiz_cards` and `flashcards` tables are NOT dropped automatically - you can drop them manually after verifying the migration
- Card deletion now removes from `card_collections` (not the card itself) - cards can belong to multiple collections
- Review states are preserved during migration using deterministic matching (user_id + front + back)
- The backfill script is idempotent and can be run multiple times safely

