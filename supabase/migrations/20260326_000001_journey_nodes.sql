alter table public.journey_islands
  add column if not exists node_type text not null default 'island' check (node_type in ('island', 'story')),
  add column if not exists position integer,
  add column if not exists story_id uuid references public.stories(id) on delete set null,
  add column if not exists word_count integer default 10,
  add column if not exists hint text;

update public.journey_islands
set position = step_order
where position is null;

update public.journey_islands
set word_count = case
  when step_order = 1 then 5
  else coalesce(word_count, 10)
end
where node_type = 'island';

create index if not exists journey_islands_journey_position_idx
  on public.journey_islands (journey_id, position);
