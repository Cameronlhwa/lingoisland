-- Add grammar_focus_data table to store structured grammar information
CREATE TABLE IF NOT EXISTS public.island_grammar_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  island_id uuid NOT NULL REFERENCES topic_islands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hanzi text NOT NULL,
  pinyin text NOT NULL,
  english text NOT NULL,
  pattern text NOT NULL,
  when_to_use text,
  position int NOT NULL, -- Order of grammar points (1, 2, 3)
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (island_id, position)
);

-- Grammar examples table (2 per grammar point: warmup + target)
CREATE TABLE IF NOT EXISTS public.island_grammar_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grammar_focus_id uuid NOT NULL REFERENCES island_grammar_focus(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('warmup', 'target')),
  hanzi text NOT NULL,
  pinyin text NOT NULL,
  english text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grammar_focus_id, tier)
);

-- Enable RLS
ALTER TABLE public.island_grammar_focus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.island_grammar_examples ENABLE ROW LEVEL SECURITY;

-- RLS Policies for island_grammar_focus
DROP POLICY IF EXISTS "Users can view their own grammar focus" ON public.island_grammar_focus;
CREATE POLICY "Users can view their own grammar focus"
  ON public.island_grammar_focus
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own grammar focus" ON public.island_grammar_focus;
CREATE POLICY "Users can insert their own grammar focus"
  ON public.island_grammar_focus
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own grammar focus" ON public.island_grammar_focus;
CREATE POLICY "Users can delete their own grammar focus"
  ON public.island_grammar_focus
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for island_grammar_examples
DROP POLICY IF EXISTS "Users can view their own grammar examples" ON public.island_grammar_examples;
CREATE POLICY "Users can view their own grammar examples"
  ON public.island_grammar_examples
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM island_grammar_focus
      WHERE island_grammar_focus.id = island_grammar_examples.grammar_focus_id
      AND island_grammar_focus.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own grammar examples" ON public.island_grammar_examples;
CREATE POLICY "Users can insert their own grammar examples"
  ON public.island_grammar_examples
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM island_grammar_focus
      WHERE island_grammar_focus.id = island_grammar_examples.grammar_focus_id
      AND island_grammar_focus.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own grammar examples" ON public.island_grammar_examples;
CREATE POLICY "Users can delete their own grammar examples"
  ON public.island_grammar_examples
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM island_grammar_focus
      WHERE island_grammar_focus.id = island_grammar_examples.grammar_focus_id
      AND island_grammar_focus.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS island_grammar_focus_island_id_position_idx
  ON public.island_grammar_focus(island_id, position);

CREATE INDEX IF NOT EXISTS island_grammar_examples_grammar_focus_id_tier_idx
  ON public.island_grammar_examples(grammar_focus_id, tier);

COMMENT ON TABLE island_grammar_focus IS 'Stores grammar focus points for topic islands with structured data';
COMMENT ON TABLE island_grammar_examples IS 'Stores warmup and target-level examples for each grammar point';
