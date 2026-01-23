-- Backfill pinyin for reverse cards (EN->ZH) using matching forward cards
update public.cards as reverse_card
set pinyin = forward_card.pinyin
from public.cards as forward_card
where reverse_card.user_id = forward_card.user_id
  and reverse_card.pinyin is null
  and reverse_card.back_lang = 'zh'
  and forward_card.front_lang = 'zh'
  and forward_card.pinyin is not null
  and reverse_card.back = forward_card.front
  and reverse_card.front = forward_card.back
  and reverse_card.source_type = forward_card.source_type
  and reverse_card.source_ref_id = forward_card.source_ref_id;

