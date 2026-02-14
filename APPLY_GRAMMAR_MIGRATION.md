# Applying Grammar Focus Migration

## Option 1: Supabase Dashboard (Recommended)

1. Go to https://jixkvixlrjdgsvobwjbj.supabase.co
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the contents of `supabase/migrations/20260213_000002_grammar_focus_tables.sql`
5. Run the query
6. Verify tables were created under **Database** > **Tables**

## Option 2: Supabase CLI

If you have project linked:
```bash
supabase link --project-ref jixkvixlrjdgsvobwjbj
supabase db push
```

## What the Migration Creates

- **Table**: `island_grammar_focus` - Stores grammar points per island
- **Table**: `island_grammar_examples` - Stores warmup + target examples  
- **Indexes**: For fast queries
- **RLS Policies**: Security rules for user access

## After Migration

You can immediately:
1. Create new islands with grammar enabled (0/1/2/3 patterns)
2. See varied, topic-aware grammar points
3. View sleek UI with pinyin chips and 2 examples per point

Existing islands without grammar focus will simply not show the section (graceful).
