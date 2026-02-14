-- Create trending_topics table for Browse Topics feature
-- Topics are curated and shared across all users
-- Weekly batches rotate featured topics and rankings

CREATE TABLE IF NOT EXISTS trending_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title_en text NOT NULL,
  title_zh text,
  category text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  level text NOT NULL CHECK (level IN ('A2', 'B1', 'B2', 'C1')),
  starter_prompts text[] NOT NULL,
  sample_vocab jsonb,
  week_of date NOT NULL, -- Monday of the weekly batch
  rank int NOT NULL DEFAULT 9999,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  
  -- Composite unique constraint: same slug can appear in different weeks
  CONSTRAINT trending_topics_slug_week_unique UNIQUE (slug, week_of)
);

-- Index for fetching current week's topics sorted by rank
CREATE INDEX idx_trending_topics_week_rank ON trending_topics(week_of, rank);

-- Index for filtering featured topics
CREATE INDEX idx_trending_topics_week_featured ON trending_topics(week_of, is_featured);

-- Index for category filtering
CREATE INDEX idx_trending_topics_category ON trending_topics(category);

-- Index for level filtering
CREATE INDEX idx_trending_topics_level ON trending_topics(level);

-- RLS: Allow authenticated users to read topics
ALTER TABLE trending_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read trending topics"
  ON trending_topics
  FOR SELECT
  TO authenticated
  USING (true);

-- No write policies: topics are managed server-side only via cron/seed scripts

COMMENT ON TABLE trending_topics IS 'Curated topics for Browse Topics feature, rotated weekly';
COMMENT ON COLUMN trending_topics.slug IS 'Stable identifier for the topic (e.g., "at-the-bank-card-declining")';
COMMENT ON COLUMN trending_topics.week_of IS 'Monday date of the weekly batch this topic belongs to';
COMMENT ON COLUMN trending_topics.rank IS 'Lower rank = higher priority in listing (featured: 1-12, rest: 13+)';
COMMENT ON COLUMN trending_topics.starter_prompts IS 'Exactly 3 conversation starter prompts';
COMMENT ON COLUMN trending_topics.sample_vocab IS 'Optional vocabulary preview (future use)';
