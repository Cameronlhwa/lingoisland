-- Backfill pinyin for reverse cards by matching swapped front/back pairs
update public.cards as reverse_card
set pinyin = forward_card.pinyin
from public.cards as forward_card
where reverse_card.user_id = forward_card.user_id
  and reverse_card.pinyin is null
  and forward_card.pinyin is not null
  and reverse_card.back = forward_card.front
  and reverse_card.front = forward_card.back;

