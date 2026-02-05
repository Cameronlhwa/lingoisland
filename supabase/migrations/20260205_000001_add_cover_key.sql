-- Add cover_key column to topic_islands
-- This stores the filename of the pre-generated island image from public/island-library/

alter table public.topic_islands 
add column if not exists cover_key text;

-- Create index for performance (optional but recommended)
create index if not exists topic_islands_cover_key_idx 
  on public.topic_islands(cover_key);
