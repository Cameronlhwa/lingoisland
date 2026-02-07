-- Add words_marked_known tracking to usage_monthly table
ALTER TABLE usage_monthly ADD COLUMN IF NOT EXISTS words_marked_known INTEGER NOT NULL DEFAULT 0;

-- Backfill existing rows that might have NULL
UPDATE usage_monthly SET words_marked_known = 0 WHERE words_marked_known IS NULL;

-- Add comment
COMMENT ON COLUMN usage_monthly.words_marked_known IS 'Number of times user used "Already know" button (Free: 1/month, Pro: unlimited)';
