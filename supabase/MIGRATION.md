# Database Migration Guide

If you already ran the initial schema, you need to update it with the new tables for Topic Island vocabulary generation.

## Migration Steps

1. Go to your Supabase dashboard → SQL Editor

2. Run this migration SQL:

```sql
-- Update topic_islands table
ALTER TABLE public.topic_islands
  ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'B1',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Rename word_count to word_target if it exists (safe version)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'topic_islands'
    AND column_name = 'word_count'
  ) THEN
    ALTER TABLE public.topic_islands RENAME COLUMN word_count TO word_target;
  END IF;
END $$;

-- Create island_words table
CREATE TABLE IF NOT EXISTS public.island_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES topic_islands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hanzi text NOT NULL,
  pinyin text NOT NULL,
  english text NOT NULL,
  difficulty_tag text NOT NULL DEFAULT 'core',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (island_id, hanzi)
);

-- Create island_sentences table
CREATE TABLE IF NOT EXISTS public.island_sentences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES topic_islands(id) ON DELETE CASCADE,
  word_id uuid NOT NULL REFERENCES island_words(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL,
  hanzi text NOT NULL,
  pinyin text NOT NULL,
  english text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (word_id, tier)
);

-- Enable RLS
ALTER TABLE public.island_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.island_sentences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for island_words
CREATE POLICY "Users can view their own island words"
  ON public.island_words FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own island words"
  ON public.island_words FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own island words"
  ON public.island_words FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own island words"
  ON public.island_words FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for island_sentences
CREATE POLICY "Users can view their own island sentences"
  ON public.island_sentences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own island sentences"
  ON public.island_sentences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own island sentences"
  ON public.island_sentences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own island sentences"
  ON public.island_sentences FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS island_words_user_id_island_id_created_at_idx
  ON public.island_words(user_id, island_id, created_at);

CREATE INDEX IF NOT EXISTS island_sentences_user_id_island_id_created_at_idx
  ON public.island_sentences(user_id, island_id, created_at);
```

3. Verify tables were created:

   - Go to Table Editor in Supabase dashboard
   - You should see `island_words` and `island_sentences` tables

4. If you have existing topic islands, you may want to update them:

```sql
-- Set default level and status for existing islands
UPDATE public.topic_islands
SET level = 'B1', status = 'draft'
WHERE level IS NULL OR status IS NULL;
```
