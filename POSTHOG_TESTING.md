# PostHog Testing & Verification

## ✅ PostHog Installation Status

**Status**: Successfully installed and running!

Your app is now tracking:
- ✅ Page views (automatically)
- ✅ User navigation
- ✅ Click events (auto-captured)
- ✅ Custom events (ready to add)

## 🧪 Testing the Installation

### 1. Visual Test (What You Just Did)

You navigated from the home page to the login page. PostHog captured:
- Initial page load (`/`)
- Navigation to `/login`
- Click event on "Sign in" button

### 2. View Events in PostHog Dashboard

1. Open https://us.i.posthog.com
2. Log in to your PostHog account
3. Navigate to **Activity** or **Events** tab
4. You should see:
   - `$pageview` events with URLs like `http://localhost:3002/` and `http://localhost:3002/login`
   - `$autocapture` events for clicks
   - Any custom events from the AccountModal

### 3. Test Custom Event Tracking

To test custom events, you can:

**Option A: Use Browser Console**
1. Open your browser DevTools (press F12 or Cmd+Option+J)
2. Paste this code:
```javascript
posthog.capture('test_custom_event', {
  test_property: 'hello from console',
  timestamp: new Date().toISOString()
})
```
3. Check PostHog dashboard for the `test_custom_event`

**Option B: Add Test Button to Any Page**
Create a test component:

```tsx
'use client'
import { useAnalytics } from '@/lib/posthog/client'

export default function TestPostHog() {
  const { captureEvent } = useAnalytics()

  return (
    <button
      onClick={() => {
        captureEvent('test_button_clicked', {
          location: 'test_page',
          timestamp: new Date().toISOString()
        })
        alert('Event sent! Check PostHog dashboard.')
      }}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      Test PostHog Event
    </button>
  )
}
```

### 4. Test Events Already Tracking

Navigate to your app and try these actions to generate events:

**Account Modal Events**:
1. Log in to your app
2. Open Account Modal (click your profile/account)
3. Try clicking "Upgrade to Pro" → captures `checkout_started`
4. Click "Manage Billing" → captures `billing_portal_opened`
5. Sign out → captures `user_logged_out`

**Page Navigation Events**:
1. Click around different pages
2. Each page view is automatically captured as `$pageview`

## 📊 Events Currently Being Tracked

### Automatic Events (No code needed)
- `$pageview` - Every page navigation
- `$pageleave` - When user leaves a page
- `$autocapture` - Clicks, form submissions, etc.

### Custom Events (Already implemented)
- `checkout_started` - User clicks upgrade button
- `checkout_failed` - Checkout fails
- `checkout_error` - Checkout error occurs
- `billing_portal_opened` - User opens billing portal
- `cancellation_feedback_submitted` - User submits cancellation feedback
- `user_logged_out` - User signs out

### User Identification
- When AccountModal opens, user is identified with `user.id`, `email`, and `name`

## 🔍 Debugging PostHog

### Check Browser Console

PostHog logs events in development mode. Look for:
```
[PostHog] initialized successfully
[PostHog] Tracking event: $pageview
[PostHog] Tracking event: custom_event_name
```

### Enable PostHog Debug Mode

Add this to browser console for more detailed logging:
```javascript
posthog.debug()
```

### Check Network Tab

1. Open DevTools → Network tab
2. Filter by "posthog" or "us.i.posthog.com"
3. You should see POST requests to:
   - `https://us.i.posthog.com/e/` (events)
   - `https://us.i.posthog.com/decide/` (feature flags, config)

## 📈 Expected Behavior

### On Page Load
1. PostHog initializes with your API key
2. Page view event is captured
3. Session recording starts (if enabled in PostHog)

### On Navigation
1. Previous page `$pageleave` event captured
2. New page `$pageview` event captured
3. URL is updated in event properties

### On Custom Event
1. Event name and properties sent to PostHog
2. Associated with current user (if identified)
3. Appears in dashboard within seconds

## ⚠️ Known Issues & Solutions

### "PostHog already initialized" Warning
- **What**: Hot reload in dev mode causes re-initialization
- **Impact**: No impact, just a warning
- **Solution**: Ignore it, or add check to prevent re-init

### Events Not Appearing in Dashboard
- **Check**: Are you in the correct PostHog project?
- **Check**: Is `NEXT_PUBLIC_POSTHOG_KEY` correct?
- **Check**: Browser console for errors
- **Wait**: Events can take 5-10 seconds to appear

### PostHog Not Loading
- **Check**: Environment variables are set
- **Check**: Dev server restarted after adding env vars
- **Check**: Browser console for initialization errors

## 🎯 Next Steps

1. ✅ **Installation Complete** - PostHog is running!
2. ✅ **Basic Events Tracked** - Page views and AccountModal events
3. 🔄 **Add More Events** - See `POSTHOG_EXAMPLES.md` for ideas
4. 📊 **Create Dashboards** - Set up insights in PostHog
5. 🎨 **Add Feature Flags** - Use PostHog for A/B testing
6. 🔔 **Set Up Alerts** - Get notified of important events

## 📚 Resources

- **Your Documentation**: 
  - `POSTHOG_SETUP.md` - Setup guide
  - `POSTHOG_EXAMPLES.md` - Code examples
  - `POSTHOG_CHECKLIST.md` - Verification checklist

- **PostHog Resources**:
  - Dashboard: https://us.i.posthog.com
  - Docs: https://posthog.com/docs
  - Next.js Guide: https://posthog.com/docs/libraries/next-js

## 🧪 Quick Test Commands

**Test in Browser Console**:
```javascript
// Check if PostHog is loaded
console.log(posthog)

// Capture test event
posthog.capture('test_event', { test: true })

// Check current user
console.log(posthog.get_distinct_id())

// Enable debug mode
posthog.debug()
```

---

**Status**: ✅ PostHog is successfully installed and tracking events!

**Your app**: http://localhost:3002  
**PostHog dashboard**: https://us.i.posthog.com

Try navigating around your app and check the PostHog dashboard to see events appear in real-time!
