-- Paywall system migration
-- Adds usage tracking and word positioning for Free tier limits

-- 1. Create usage_monthly table to track monthly island creation limits
create table if not exists public.usage_monthly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key text not null, -- Format: "YYYY-MM"
  topic_islands_created int not null default 0,
  stories_created int not null default 0, -- For future use
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_key)
);

-- Enable RLS on usage_monthly
alter table public.usage_monthly enable row level security;

-- RLS Policies for usage_monthly
drop policy if exists "Users can view their own usage" on public.usage_monthly;
create policy "Users can view their own usage"
  on public.usage_monthly
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own usage" on public.usage_monthly;
create policy "Users can insert their own usage"
  on public.usage_monthly
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own usage" on public.usage_monthly;
create policy "Users can update their own usage"
  on public.usage_monthly
  for update
  using (auth.uid() = user_id);

-- Index for performance
create index if not exists usage_monthly_user_id_month_key_idx 
  on public.usage_monthly(user_id, month_key);

-- 2. Add position field to island_words for stable word ordering
alter table public.island_words
  add column if not exists position int;

-- Create index for position sorting
create index if not exists island_words_island_id_position_idx
  on public.island_words(island_id, position);

-- 3. Backfill position for existing island_words (ordered by created_at)
-- This ensures existing data has stable positions
do $$
declare
  island_record record;
  word_record record;
  word_position int;
begin
  -- For each island
  for island_record in 
    select distinct island_id from public.island_words where position is null
  loop
    word_position := 1;
    -- For each word in this island (ordered by created_at)
    for word_record in
      select id from public.island_words 
      where island_id = island_record.island_id and position is null
      order by created_at
    loop
      update public.island_words 
      set position = word_position 
      where id = word_record.id;
      word_position := word_position + 1;
    end loop;
  end loop;
end $$;

-- 4. Add profiles.plan column if it doesn't exist (for billing)
-- This may already exist from previous migrations, so use 'if not exists'
alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  add column if not exists current_period_end timestamptz;

-- Update RLS policies for profiles if needed (assuming they exist)
-- No changes needed to existing policies

-- 5. Create helper function to check if word is locked for free user
create or replace function public.is_word_locked(
  p_word_position int,
  p_user_id uuid
) returns boolean as $$
declare
  user_plan text;
  user_period_end timestamptz;
  is_pro_active boolean;
begin
  -- Get user plan
  select plan, current_period_end into user_plan, user_period_end
  from public.profiles
  where id = p_user_id;

  -- If no profile found, default to free
  if user_plan is null then
    user_plan := 'free';
  end if;

  -- Check if pro is active (plan is pro and period hasn't ended)
  is_pro_active := user_plan = 'pro' and (
    user_period_end is null or user_period_end > now()
  );

  -- Free users: words with position > 10 are locked
  -- Pro users: no words are locked
  if is_pro_active then
    return false;
  else
    return p_word_position > 10;
  end if;
end;
$$ language plpgsql security definer;
