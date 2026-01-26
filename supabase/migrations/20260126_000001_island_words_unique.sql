do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'island_words_island_id_hanzi_key'
  ) then
    alter table public.island_words
      add constraint island_words_island_id_hanzi_key unique (island_id, hanzi);
  end if;
end $$;

