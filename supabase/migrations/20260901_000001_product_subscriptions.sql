-- Independent billing state for Islands and HSK Prep. profiles.plan remains a
-- temporary compatibility cache for older application code.
create table if not exists public.product_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('core', 'hsk')),
  stripe_subscription_id text unique,
  status text not null default 'active' check (status in ('active', 'trialing', 'canceled', 'unpaid')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product)
);

alter table public.product_subscriptions enable row level security;

drop policy if exists "Users can view their own product subscriptions" on public.product_subscriptions;
create policy "Users can view their own product subscriptions"
  on public.product_subscriptions for select
  using (auth.uid() = user_id);

-- Backfill legacy billing plans. A null end represents an intentional lifetime
-- grant, so it remains an active product entitlement.
insert into public.product_subscriptions (user_id, product, status, current_period_end, cancel_at_period_end, stripe_subscription_id)
select id, 'core', 'active', current_period_end, coalesce(cancel_at_period_end, false), stripe_subscription_id
from public.profiles
where plan in ('pro', 'both')
on conflict (user_id, product) do nothing;

insert into public.product_subscriptions (user_id, product, status, current_period_end, cancel_at_period_end)
select id, 'hsk', 'active', current_period_end, coalesce(cancel_at_period_end, false)
from public.profiles
where plan in ('hsk', 'both')
on conflict (user_id, product) do nothing;
