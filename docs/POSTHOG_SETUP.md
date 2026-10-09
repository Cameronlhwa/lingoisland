# PostHog Analytics Setup

PostHog is integrated for product analytics and event tracking.

## Environment Variables

Add to your `.env.local`:

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_EDYjm2dLTsIQ0vX000vp07tVQKcIGYi6mbTypqgbaR5
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Client-Side Usage

### Using the custom hook (recommended)

```tsx
'use client'

import { useAnalytics } from '@/lib/posthog/client'

export default function MyComponent() {
  const { captureEvent, identify } = useAnalytics()

  function handleClick() {
    captureEvent('button_clicked', {
      button_name: 'upgrade',
      location: 'dashboard',
    })
  }

  // Identify user when they log in
  useEffect(() => {
    if (user) {
      identify(user.id, {
        email: user.email,
        plan: user.subscription_tier,
      })
    }
  }, [user, identify])

  return <button onClick={handleClick}>Upgrade</button>
}
```

### Using PostHog directly

```tsx
'use client'

import { usePostHog } from 'posthog-js/react'

export default function MyComponent() {
  const posthog = usePostHog()

  function handlePurchase() {
    posthog.capture('purchase_completed', {
      amount: 99,
      currency: 'USD',
    })
  }

  return <button onClick={handlePurchase}>Complete Purchase</button>
}
```

## Server-Side Usage

### In API Routes

```tsx
import { captureServerEvent } from '@/lib/posthog/server'

export async function POST(request: Request) {
  const { userId } = await request.json()

  // Capture server-side event
  await captureServerEvent({
    distinctId: userId,
    event: 'api_subscription_created',
    properties: {
      plan: 'pro',
      amount: 10,
    },
  })

  return Response.json({ success: true })
}
```

### In Server Actions

```tsx
'use server'

import { captureServerEvent } from '@/lib/posthog/server'

export async function upgradeSubscription(userId: string) {
  // Your subscription logic...

  await captureServerEvent({
    distinctId: userId,
    event: 'subscription_upgraded',
    properties: {
      from_plan: 'free',
      to_plan: 'pro',
    },
  })

  return { success: true }
}
```

## Event Naming Conventions

Use descriptive, snake_case event names:

- `button_clicked`
- `subscription_created`
- `island_completed`
- `quiz_submitted`
- `story_read`

## Key Events to Track

### User Authentication
- `user_signed_up`
- `user_logged_in`
- `user_logged_out`

### Subscription Events
- `subscription_created`
- `subscription_upgraded`
- `subscription_cancelled`
- `payment_succeeded`
- `payment_failed`

### Learning Events
- `island_started`
- `island_completed`
- `quiz_started`
- `quiz_completed`
- `story_read`
- `flashcard_reviewed`

### Engagement Events
- `chat_message_sent`
- `word_saved`
- `audio_played`

## User Properties

Set user properties on identify:

```tsx
identify(user.id, {
  email: user.email,
  subscription_tier: 'pro',
  signup_date: user.created_at,
  language_learning: 'mandarin',
})
```

## Testing

PostHog events are automatically disabled in development by default. To test:

1. Check the PostHog dashboard at https://us.i.posthog.com
2. Use the PostHog browser extension to see events in real-time
3. Check the browser console for PostHog debug logs

## Resources

- [PostHog Docs](https://posthog.com/docs)
- [Next.js Integration](https://posthog.com/docs/libraries/next-js)
- [Event Tracking Best Practices](https://posthog.com/docs/product-analytics/event-tracking)
