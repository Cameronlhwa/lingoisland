# Feature Flags Quick Start

## 5-Minute Setup Guide

### Step 1: Create Your First Feature Flag (2 min)

1. Go to https://us.i.posthog.com/feature_flags
2. Click **"New feature flag"**
3. Fill in:
   - **Key**: `new-dashboard` (use lowercase with dashes)
   - **Description**: "New dashboard redesign"
   - **Rollout percentage**: Start with 10%
4. Click **"Save"**

### Step 2: Use in Your Code (1 min)

```tsx
'use client'
import { useFeatureFlagEnabled } from 'posthog-js/react'

export default function Dashboard() {
  const showNewDashboard = useFeatureFlagEnabled('new-dashboard')
  
  return showNewDashboard ? <NewDashboard /> : <OldDashboard />
}
```

### Step 3: Test It (2 min)

1. Reload your page multiple times
2. ~10% of the time you'll see the new version
3. Go back to PostHog and change to 100%
4. Reload page - now everyone sees new version!

## Common Patterns

### 1. Pro-Only Feature

**In PostHog Dashboard:**
- Create flag: `pro-advanced-analytics`
- Set targeting: "subscription_tier = 'pro'"

**In Code:**
```tsx
const canAccessAdvanced = useFeatureFlagEnabled('pro-advanced-analytics')

if (!canAccessAdvanced) {
  return <UpgradePrompt />
}

return <AdvancedAnalytics />
```

### 2. A/B Test Button Color

**In PostHog Dashboard:**
- Create flag: `button-color-test`
- Add variants: `control`, `green`, `purple`
- Set to 33% each

**In Code:**
```tsx
const variant = useFeatureFlagVariantKey('button-color-test')

const buttonColors = {
  control: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
}

<button className={buttonColors[variant] || buttonColors.control}>
  Upgrade to Pro
</button>
```

### 3. Kill Switch

**In PostHog Dashboard:**
- Create flag: `enable-new-feature`
- Set to 100%

**In Code:**
```tsx
const featureEnabled = useFeatureFlagEnabled('enable-new-feature')

if (!featureEnabled) {
  return <OldFeature />
}

return <NewFeature />
```

If there's a problem, set flag to 0% in PostHog - instantly disabled!

## Test Example Component

I created a working example at:
```
components/examples/FeatureFlagExample.tsx
```

Add it to any page to see feature flags in action:

```tsx
import FeatureFlagExample from '@/components/examples/FeatureFlagExample'

export default function TestPage() {
  return (
    <div>
      <h1>Feature Flag Test</h1>
      <FeatureFlagExample />
    </div>
  )
}
```

## Pricing Reminder

✅ **FREE for 1M requests/month**
- Most apps use < 100k requests/month
- You're covered!

## Next Steps

1. ✅ Create your first flag (use guide above)
2. ✅ Test with example component
3. 📚 Read full guide: `POSTHOG_FEATURE_FLAGS.md`
4. 🧪 Try an A/B test

## Resources

- **Create Flag**: https://us.i.posthog.com/feature_flags
- **Full Guide**: See `POSTHOG_FEATURE_FLAGS.md`
- **PostHog Docs**: https://posthog.com/docs/feature-flags
