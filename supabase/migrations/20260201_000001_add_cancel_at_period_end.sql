-- Add cancel_at_period_end to profiles table to track subscription cancellation status
-- This avoids having to query Stripe API every time we need to check cancellation status

alter table public.profiles 
add column if not exists cancel_at_period_end boolean not null default false;

comment on column public.profiles.cancel_at_period_end is 'True if user has canceled their subscription but still has access until current_period_end. Synced from Stripe via webhook.';
