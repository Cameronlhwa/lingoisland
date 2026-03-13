# Temporary storage without account (anonymous users)

Onboarding lets users create a topic island **without** signing up. Their data is stored in Supabase under an **anonymous user**. It becomes permanent only if they later sign in with Google (same user, data preserved). If they leave without signing up, the data stays in the DB until you clean it up.

## Supabase setup (required)

1. **Enable Anonymous sign-in**  
   Dashboard → **Authentication** → **Providers** → turn on **Anonymous**.  
   Without this, `signInAnonymously()` returns 422 and onboarding shows "Try without account isn't available".

2. **Enable Manual linking** (for "Save with Google")  
   Dashboard → **Authentication** → **Providers** → enable **Manual linking**.  
   This allows linking a Google identity to the current anonymous user via `linkIdentity({ provider: 'google' })` so the same `user_id` keeps all their islands.

## Flow

- **Start**: User picks topic + level → `signInAnonymously()` → redirect to `/app/topic-islands` → island created under that anonymous user.
- **Save permanently**: On the island page, anonymous users see "Sign up for free". Clicking it runs `linkIdentity({ provider: 'google' })`; after Google OAuth, the **same** user gets a Google identity and is no longer anonymous. All data (islands, words) stays attached to that `user_id`.
- **Leave without signing up**: Anonymous user and their rows stay in the DB. They cannot log back in (no email/password), so that data is effectively orphaned until cleanup.

## Cleanup (optional)

To delete anonymous users and their data after some time (e.g. 30 days), run in SQL or a cron job:

```sql
-- Deletes anonymous users created more than 30 days ago.
-- CASCADE on your tables (e.g. topic_islands, user_profiles) will remove their data.
DELETE FROM auth.users
WHERE is_anonymous IS TRUE
  AND created_at < NOW() - INTERVAL '30 days';
```

Run this periodically (e.g. weekly) or via a Supabase Edge Function / external cron.
