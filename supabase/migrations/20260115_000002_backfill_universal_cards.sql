-- Backfill script: Migrate quiz_cards and flashcards to universal cards system
-- RUN THIS ONCE AFTER THE MAIN MIGRATION

-- Step 1: Migrate quiz_cards to cards + card_collections
do $$
declare
  v_card_mapping jsonb := '{}';
  v_quiz_card record;
  v_new_card_id uuid;
  v_count int := 0;
begin
  -- Only run if quiz_cards table exists
  if exists (select from information_schema.tables where table_name = 'quiz_cards') then
    
    for v_quiz_card in 
      select * from quiz_cards order by created_at
    loop
      -- Insert into cards
      insert into cards (
        user_id, front, back, front_lang, back_lang, pinyin, 
        source_type, source_ref_id, created_at
      ) values (
        v_quiz_card.user_id,
        v_quiz_card.front,
        v_quiz_card.back,
        case when v_quiz_card.direction = 'ZH_EN' then 'zh' else 'en' end,
        case when v_quiz_card.direction = 'ZH_EN' then 'en' else 'zh' end,
        v_quiz_card.pinyin,
        'quiz_island',
        v_quiz_card.quiz_island_id,
        v_quiz_card.created_at
      )
      returning id into v_new_card_id;

      -- Store mapping for later review state migration
      v_card_mapping := v_card_mapping || jsonb_build_object(v_quiz_card.id::text, v_new_card_id::text);
      v_count := v_count + 1;

      -- Insert into card_collections
      insert into card_collections (
        user_id, collection_type, collection_id, card_id, created_at
      ) values (
        v_quiz_card.user_id,
        'quiz_island',
        v_quiz_card.quiz_island_id,
        v_new_card_id,
        v_quiz_card.created_at
      )
      on conflict (user_id, collection_type, collection_id, card_id) do nothing;
    end loop;

    raise notice 'Migrated % quiz_cards to cards', v_count;
  end if;
end $$;

-- Step 2: Migrate flashcards to cards + card_collections
do $$
declare
  v_card_mapping jsonb := '{}';
  v_flashcard record;
  v_new_card_id uuid;
  v_count int := 0;
begin
  -- Only run if flashcards table exists
  if exists (select from information_schema.tables where table_name = 'flashcards') then
    
    for v_flashcard in 
      select * from flashcards order by created_at
    loop
      -- Insert into cards
      insert into cards (
        user_id, front, back, front_lang, back_lang, pinyin,
        source_type, source_ref_id, created_at
      ) values (
        v_flashcard.user_id,
        v_flashcard.front,
        v_flashcard.back,
        v_flashcard.front_lang,
        v_flashcard.back_lang,
        v_flashcard.pinyin,
        v_flashcard.source,
        v_flashcard.source_ref_id,
        v_flashcard.created_at
      )
      returning id into v_new_card_id;

      -- Store mapping for later review state migration
      v_card_mapping := v_card_mapping || jsonb_build_object(v_flashcard.id::text, v_new_card_id::text);
      v_count := v_count + 1;

      -- Insert into card_collections
      insert into card_collections (
        user_id, collection_type, collection_id, card_id, created_at
      ) values (
        v_flashcard.user_id,
        'deck',
        v_flashcard.deck_id,
        v_new_card_id,
        v_flashcard.created_at
      )
      on conflict (user_id, collection_type, collection_id, card_id) do nothing;
    end loop;

    raise notice 'Migrated % flashcards to cards', v_count;
  end if;
end $$;

-- Step 3: Update card_review_state to point to new card IDs
-- This is tricky because we need to match old flashcard IDs to new card IDs
-- We'll use a deterministic approach: match by user_id + front + back

do $$
declare
  v_review_state record;
  v_old_card record;
  v_new_card_id uuid;
begin
  for v_review_state in 
    select crs.*, 
           f.user_id as card_user_id, 
           f.front, 
           f.back,
           f.deck_id
    from card_review_state crs
    left join flashcards f on f.id = crs.card_id
    where f.id is not null
  loop
    -- Find matching card in new cards table
    select id into v_new_card_id
    from cards
    where user_id = v_review_state.card_user_id
      and front = v_review_state.front
      and back = v_review_state.back
    limit 1;

    if v_new_card_id is not null then
      -- Update the review state to point to new card
      update card_review_state
      set card_id = v_new_card_id
      where id = v_review_state.id;
    else
      -- Card not found, delete orphaned review state
      delete from card_review_state where id = v_review_state.id;
    end if;
  end loop;

  raise notice 'Updated card_review_state references';
end $$;

-- Step 4: Clean up orphaned review states (optional)
do $$
begin
  delete from card_review_state
  where card_id not in (select id from cards);
  
  raise notice 'Backfill complete!';
end $$;

