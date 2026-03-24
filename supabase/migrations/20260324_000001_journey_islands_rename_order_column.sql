-- PostgREST reserves the query parameter "order" for sorting. Filtering with .eq('order', n)
-- from supabase-js does not match the column; use step_order instead.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'journey_islands'
      and column_name = 'order'
  ) then
    alter table public.journey_islands rename column "order" to step_order;
  end if;
end $$;
