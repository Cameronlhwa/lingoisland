# PostHog Tracking Examples

Quick reference for adding analytics to your components.

## 1. Track Button Clicks

```tsx
'use client'
import { useAnalytics } from '@/lib/posthog/client'

export default function UpgradeButton() {
  const { captureEvent } = useAnalytics()

  return (
    <button 
      onClick={() => {
        captureEvent('upgrade_button_clicked', {
          location: 'dashboard',
          plan: 'pro'
        })
      }}
    >
      Upgrade to Pro
    </button>
  )
}
```

## 2. Track Page/Component Views

```tsx
'use client'
import { useAnalytics } from '@/lib/posthog/client'
import { useEffect } from 'react'

export default function IslandPage({ islandId }: { islandId: string }) {
  const { captureEvent } = useAnalytics()

  useEffect(() => {
    captureEvent('island_viewed', {
      island_id: islandId
    })
  }, [islandId, captureEvent])

  return <div>Island content...</div>
}
```

## 3. Track Form Submissions

```tsx
'use client'
import { useAnalytics } from '@/lib/posthog/client'

export default function QuizForm() {
  const { captureEvent } = useAnalytics()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    const score = calculateScore()
    
    captureEvent('quiz_completed', {
      score,
      total_questions: 10,
      percentage: (score / 10) * 100
    })
    
    // Submit form...
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

## 4. Identify Users on Login

```tsx
'use client'
import { useAnalytics } from '@/lib/posthog/client'
import { useEffect } from 'react'

export default function UserProvider({ 
  children, 
  user 
}: { 
  children: React.ReactNode
  user: User | null 
}) {
  const { identify, captureEvent } = useAnalytics()

  useEffect(() => {
    if (user) {
      // Identify user
      identify(user.id, {
        email: user.email,
        name: user.name,
        subscription_tier: user.subscription_tier,
        signup_date: user.created_at
      })

      // Track login
      captureEvent('user_logged_in')
    }
  }, [user, identify, captureEvent])

  return <>{children}</>
}
```

## 5. Track API Routes (Server-Side)

```tsx
// app/api/islands/[id]/complete/route.ts
import { captureServerEvent } from '@/lib/posthog/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = await request.json()

  // Mark island as complete in database...

  // Track event
  await captureServerEvent({
    distinctId: userId,
    event: 'island_completed',
    properties: {
      island_id: params.id,
      completion_time: Date.now()
    }
  })

  return Response.json({ success: true })
}
```

## 6. Track Server Actions

```tsx
'use server'
import { captureServerEvent } from '@/lib/posthog/server'

export async function saveFlashcard(userId: string, wordId: string) {
  // Save to database...

  await captureServerEvent({
    distinctId: userId,
    event: 'flashcard_saved',
    properties: {
      word_id: wordId
    }
  })

  return { success: true }
}
```

## 7. Track Errors

```tsx
'use client'
import { useAnalytics } from '@/lib/posthog/client'

export default function MyComponent() {
  const { captureEvent } = useAnalytics()

  async function handleAction() {
    try {
      await riskyOperation()
    } catch (error) {
      captureEvent('error_occurred', {
        error_message: error.message,
        error_type: error.name,
        component: 'MyComponent',
        action: 'handleAction'
      })
      throw error
    }
  }

  return <button onClick={handleAction}>Do Something</button>
}
```

## 8. Track User Properties (A/B Testing, Cohorts)

```tsx
'use client'
import { useAnalytics } from '@/lib/posthog/client'

export default function ProfileSettings() {
  const { identify } = useAnalytics()

  function updateLanguageLevel(level: string) {
    // Update in database...
    
    // Update in PostHog for cohort analysis
    identify(userId, {
      language_level: level,
      last_level_update: new Date().toISOString()
    })
  }

  return <div>Settings...</div>
}
```

## 9. Track Feature Flags (If Using PostHog Feature Flags)

```tsx
'use client'
import { usePostHog } from 'posthog-js/react'

export default function NewFeature() {
  const posthog = usePostHog()
  const showNewFeature = posthog?.isFeatureEnabled('new-story-reader')

  if (!showNewFeature) {
    return <OldStoryReader />
  }

  return <NewStoryReader />
}
```

## 10. Track Session Duration

```tsx
'use client'
import { useAnalytics } from '@/lib/posthog/client'
import { useEffect, useRef } from 'react'

export default function StudySession() {
  const { captureEvent } = useAnalytics()
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    return () => {
      // On unmount, track session duration
      const duration = Date.now() - startTimeRef.current
      captureEvent('study_session_ended', {
        duration_ms: duration,
        duration_minutes: Math.round(duration / 60000)
      })
    }
  }, [captureEvent])

  return <div>Study session...</div>
}
```

## Event Naming Best Practices

### ✅ Good Event Names
- `button_clicked`
- `quiz_completed`
- `island_started`
- `subscription_created`
- `story_read`

### ❌ Avoid
- `click` (too vague)
- `buttonClick` (use snake_case)
- `Button Clicked` (use lowercase)
- `quiz_completed_successfully_with_high_score` (too long/specific - use properties instead)

## Property Best Practices

### ✅ Good Properties
```js
captureEvent('quiz_completed', {
  score: 8,
  total_questions: 10,
  quiz_type: 'vocabulary',
  difficulty: 'intermediate'
})
```

### ❌ Avoid
```js
captureEvent('quiz_completed', {
  result: 'User scored 8 out of 10 on vocabulary quiz' // Use structured data
})
```

## Testing Your Events

1. Open browser DevTools Console
2. Look for PostHog logs: `[PostHog] Tracking event: event_name`
3. Check PostHog dashboard: https://us.i.posthog.com
4. Use PostHog browser extension for real-time event viewing
