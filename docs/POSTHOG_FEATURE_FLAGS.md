# PostHog Feature Flags & Experiments Guide

## 🎯 Free Plan Includes Feature Flags!

**YES** - Feature flags are included in PostHog's free plan! ✅

### Free Plan Limits
- ✅ **1 million feature flag requests/month** (free)
- ✅ **Unlimited feature flags**
- ✅ **A/B testing & experiments**
- ✅ **Multivariate testing**
- ✅ **Unlimited team members**

For most apps, 1 million requests/month is plenty. If you exceed it, additional requests are billed at low cost.

## 🚀 What Are Feature Flags?

Feature flags let you:
- **Toggle features on/off** without deploying code
- **Run A/B tests** to compare different versions
- **Gradual rollouts** (e.g., 10% of users see new feature)
- **Target specific users** (e.g., only pro users, only in US)
- **Kill switch** to instantly disable problematic features

## 📝 How to Set Up Feature Flags

### Step 1: Create a Feature Flag in PostHog

1. Go to https://us.i.posthog.com
2. Click **"Feature Flags"** in the left sidebar
3. Click **"New feature flag"**
4. Configure:
   - **Key**: `new-story-reader` (lowercase, dashes)
   - **Name**: "New Story Reader"
   - **Description**: "Test new story reader UI"
   - **Roll out to**: Choose percentage or specific users

### Step 2: Use in Your Code

PostHog is already set up in your app! Just use the hooks.

## 💻 Using Feature Flags in Code

### Client-Side (React Components)

```tsx
'use client'
import { useFeatureFlagEnabled } from 'posthog-js/react'

export default function StoryReader() {
  const showNewReader = useFeatureFlagEnabled('new-story-reader')
  
  if (showNewReader) {
    return <NewStoryReader />
  }
  
  return <OldStoryReader />
}
```

### With Payload (Complex Flags)

```tsx
'use client'
import { useFeatureFlagVariantKey, useFeatureFlagPayload } from 'posthog-js/react'

export default function PricingPage() {
  // Get which variant user sees
  const variant = useFeatureFlagVariantKey('pricing-test')
  
  // Get custom data
  const payload = useFeatureFlagPayload('pricing-test')
  
  switch (variant) {
    case 'control':
      return <PricingControl />
    case 'variant-a':
      return <PricingVariantA price={payload?.price} />
    case 'variant-b':
      return <PricingVariantB />
    default:
      return <PricingControl />
  }
}
```

### Check All Flags

```tsx
'use client'
import { usePostHog } from 'posthog-js/react'

export default function FeatureGate() {
  const posthog = usePostHog()
  
  const flags = {
    newUI: posthog?.isFeatureEnabled('new-ui'),
    betaFeatures: posthog?.isFeatureEnabled('beta-features'),
    proOnly: posthog?.isFeatureEnabled('pro-only-feature'),
  }
  
  return (
    <div>
      {flags.newUI && <NewUIComponent />}
      {flags.betaFeatures && <BetaFeaturesList />}
    </div>
  )
}
```

### Server-Side (API Routes & Server Actions)

For server-side feature flags, you need to check flags manually:

```tsx
// app/api/my-route/route.ts
import { PostHog } from 'posthog-node'

export async function GET(request: Request) {
  const posthog = new PostHog(
    process.env.NEXT_PUBLIC_POSTHOG_KEY!,
    { host: process.env.NEXT_PUBLIC_POSTHOG_HOST }
  )
  
  const userId = 'user-id' // Get from session/auth
  
  // Check if feature is enabled for this user
  const isEnabled = await posthog.isFeatureEnabled(
    'new-api-endpoint',
    userId
  )
  
  if (isEnabled) {
    // New logic
  } else {
    // Old logic
  }
  
  await posthog.shutdown()
  
  return Response.json({ success: true })
}
```

## 🧪 Running A/B Tests (Experiments)

### Step 1: Create Experiment in PostHog

1. Go to **Experiments** in PostHog
2. Click **"New experiment"**
3. Configure:
   - **Feature flag key**: `checkout-button-test`
   - **Variants**: Control, Test A, Test B
   - **Goal metric**: Choose what you're measuring (e.g., `checkout_completed`)

### Step 2: Implement in Code

```tsx
'use client'
import { useFeatureFlagVariantKey } from 'posthog-js/react'
import { useAnalytics } from '@/lib/posthog/client'

export default function CheckoutButton() {
  const variant = useFeatureFlagVariantKey('checkout-button-test')
  const { captureEvent } = useAnalytics()
  
  const handleClick = () => {
    captureEvent('checkout_button_clicked', {
      variant, // Track which variant they saw
    })
    // ... checkout logic
  }
  
  // Render different variants
  switch (variant) {
    case 'control':
      return (
        <button onClick={handleClick} className="bg-blue-500">
          Checkout
        </button>
      )
    case 'test-a':
      return (
        <button onClick={handleClick} className="bg-green-500 text-xl">
          🚀 Complete Purchase
        </button>
      )
    case 'test-b':
      return (
        <button onClick={handleClick} className="bg-purple-500">
          Buy Now - Save 10%
        </button>
      )
    default:
      return <button onClick={handleClick}>Checkout</button>
  }
}
```

### Step 3: Track Goal Event

Make sure you're tracking the goal event:

```tsx
const handleCheckoutComplete = () => {
  captureEvent('checkout_completed', {
    amount: total,
    variant: posthog.getFeatureFlag('checkout-button-test'),
  })
}
```

PostHog will automatically analyze which variant performs best!

## 🎯 Common Use Cases

### 1. Gradual Rollout

Roll out new feature to 10% → 25% → 50% → 100%

```tsx
// PostHog dashboard: Set "new-dashboard" to 10%
// No code changes needed - just adjust percentage in PostHog
const showNewDashboard = useFeatureFlagEnabled('new-dashboard')
```

### 2. Pro-Only Features

```tsx
'use client'
import { useFeatureFlagEnabled } from 'posthog-js/react'

export default function ProFeature() {
  const canAccessProFeatures = useFeatureFlagEnabled('pro-features')
  
  if (!canAccessProFeatures) {
    return <UpgradePrompt />
  }
  
  return <ProFeatureComponent />
}
```

In PostHog, set targeting:
- Roll out to users where `subscription_tier = 'pro'`

### 3. Beta Testing

```tsx
const isBetaTester = useFeatureFlagEnabled('beta-program')

if (isBetaTester) {
  return <BetaFeatures />
}
```

In PostHog, target specific emails or user IDs.

### 4. A/B Test Pricing

```tsx
const pricingVariant = useFeatureFlagVariantKey('pricing-experiment')

const prices = {
  'control': { monthly: 9.99, yearly: 99 },
  'variant-a': { monthly: 14.99, yearly: 149 },
  'variant-b': { monthly: 7.99, yearly: 79 },
}

const price = prices[pricingVariant] || prices.control
```

### 5. Kill Switch

Create flag `enable-new-feature` and set to 100%. If there's a problem:
1. Go to PostHog
2. Set to 0%
3. Feature instantly disabled for all users (no deploy!)

## 📊 Targeting Options

In PostHog dashboard, you can target flags by:

### User Properties
- Email
- User ID
- Subscription tier
- Country
- Device type
- Any custom property you've set

### Percentage Rollout
- 0% = Off for everyone
- 50% = Random 50% of users
- 100% = On for everyone

### Custom Conditions
- Users in specific cohorts
- Users who performed certain events
- Combine multiple conditions with AND/OR

## 🔧 Advanced Feature Flag Patterns

### Loading States

```tsx
'use client'
import { useFeatureFlagEnabled } from 'posthog-js/react'
import { useEffect, useState } from 'react'

export default function FeatureComponent() {
  const [isLoading, setIsLoading] = useState(true)
  const showNewFeature = useFeatureFlagEnabled('new-feature')
  
  useEffect(() => {
    setIsLoading(false)
  }, [showNewFeature])
  
  if (isLoading) {
    return <Spinner />
  }
  
  return showNewFeature ? <NewFeature /> : <OldFeature />
}
```

### Override for Testing

```tsx
'use client'
import { usePostHog } from 'posthog-js/react'
import { useEffect } from 'react'

export default function DevTools() {
  const posthog = usePostHog()
  
  // Override flag for testing (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Force enable a flag
      posthog?.featureFlags.override({
        'new-feature': true,
        'beta-test': 'variant-a',
      })
    }
  }, [posthog])
  
  return null
}
```

### Bootstrap Flags (SSR)

To avoid flickering, bootstrap flags from server:

```tsx
// Server Component
import { PostHog } from 'posthog-node'

export default async function Page() {
  const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!)
  const userId = await getUserId()
  
  const flags = await posthog.getAllFlags(userId)
  await posthog.shutdown()
  
  return <ClientComponent initialFlags={flags} />
}
```

## 💰 Pricing & Limits

### Free Plan (What You Have)
- ✅ 1,000,000 feature flag requests/month
- ✅ Unlimited flags
- ✅ A/B testing & experiments
- ✅ All targeting options
- ✅ 1 project
- ✅ Unlimited team members

### If You Exceed Free Tier
- First 1M requests: **Free**
- Next requests: **$0.0001 per request** (very cheap)
- Example: 2M requests = $0 + (1M × $0.0001) = $100/month

### What Counts as a Request?
Each time you check a flag = 1 request:
```tsx
useFeatureFlagEnabled('my-flag') // 1 request per page load
```

**Tip**: Flags are cached, so checking the same flag multiple times in the same session only counts as 1 request!

## 🎓 Best Practices

### 1. Use Descriptive Names
```tsx
// ✅ Good
'new-checkout-flow'
'pricing-experiment-q1-2026'
'beta-story-wizard'

// ❌ Bad
'flag1'
'test'
'new-thing'
```

### 2. Clean Up Old Flags
Delete flags after experiments complete to keep dashboard clean.

### 3. Default to Safe Behavior
```tsx
// Always provide fallback
const showNew = useFeatureFlagEnabled('new-feature') ?? false
```

### 4. Track Feature Usage
```tsx
const showFeature = useFeatureFlagEnabled('my-feature')

useEffect(() => {
  if (showFeature) {
    captureEvent('feature_exposed', { feature: 'my-feature' })
  }
}, [showFeature, captureEvent])
```

### 5. Use Payload for Configuration
Instead of multiple flags, use one flag with payload:

```tsx
const config = useFeatureFlagPayload('ui-config')

<Button color={config?.buttonColor || 'blue'}>
  {config?.buttonText || 'Click me'}
</Button>
```

## 🔗 Resources

- **PostHog Dashboard**: https://us.i.posthog.com/feature_flags
- **Create Experiment**: https://us.i.posthog.com/experiments
- **Docs**: https://posthog.com/docs/feature-flags
- **Experiments Docs**: https://posthog.com/docs/experiments

## 📋 Quick Reference

```tsx
// Check if enabled
const isEnabled = useFeatureFlagEnabled('flag-key')

// Get variant
const variant = useFeatureFlagVariantKey('flag-key')

// Get payload
const payload = useFeatureFlagPayload('flag-key')

// Get all flags
const posthog = usePostHog()
const allFlags = posthog?.getFeatureFlags()

// Override for testing
posthog?.featureFlags.override({ 'flag-key': true })

// Reload flags
posthog?.reloadFeatureFlags()
```

---

## ✅ Summary

**Yes, feature flags are FREE!** You get:
- 1M requests/month (free)
- Unlimited flags
- A/B testing
- All targeting options

**To start using**:
1. Create flag in PostHog dashboard
2. Use `useFeatureFlagEnabled('flag-key')` in your code
3. That's it!

No additional setup needed - PostHog is already configured in your app! 🎉
