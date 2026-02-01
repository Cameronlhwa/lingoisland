# PostHog Session Replay Guide

## ✅ Session Replay is NOW Enabled for Production

Session replay has been configured and will automatically work in production when users visit your site.

## 🎥 What is Session Replay?

Session replay records user sessions (mouse movements, clicks, scrolls, page views) so you can watch exactly how users interact with your app. It's like having a video recording of their session.

## 🔧 Current Configuration

Your app now has session replay enabled with these settings:

```typescript
session_recording: {
  recordCrossOriginIframes: false,  // Don't record external iframes
  maskAllInputs: true,              // Mask all input fields (privacy)
  maskTextSelector: '.sensitive',   // Mask elements with 'sensitive' class
  recordCanvas: false,              // Don't record canvas (better performance)
}

// Disabled in development, enabled in production
disable_session_recording: process.env.NODE_ENV === 'development'
```

## 🔒 Privacy & Security

### What's Automatically Masked

1. **All Input Fields**: Passwords, emails, text inputs are masked as `***`
2. **Sensitive Elements**: Any element with class `sensitive` is hidden
3. **Credit Card Info**: Automatically detected and masked
4. **Personal Data**: You can add custom masking

### How to Mask Sensitive Data

**Option 1: Add `sensitive` class**
```tsx
<div className="sensitive">
  User's private information
</div>
```

**Option 2: Use PostHog data attributes**
```tsx
<div data-ph-capture-attribute-user-email="[email]">
  User email: user@example.com
</div>
```

**Option 3: Disable recording for specific elements**
```tsx
<div data-ph-no-capture>
  This won't be recorded at all
</div>
```

## 📊 Where to View Session Replays

1. Go to https://us.i.posthog.com
2. Click **"Session Replay"** in the left sidebar
3. You'll see a list of recorded sessions
4. Click any session to watch it

### What You Can See
- ✅ Mouse movements and clicks
- ✅ Page navigation
- ✅ Scrolling behavior
- ✅ Form interactions (masked)
- ✅ Console logs and errors
- ✅ Network requests
- ❌ Actual input values (masked for privacy)

## 🎯 Session Replay Features

### 1. Linked to Events
Every session is linked to the events that happened during it. You can:
- Click on an event in the "Activity" tab
- Click "View Recording" to see what the user was doing

### 2. Filtered Recordings
Find specific sessions by:
- User ID
- Page visited
- Event triggered
- Session duration
- Error occurred

### 3. Console Logs
See browser console logs during the session:
- Errors
- Warnings
- Custom logs

### 4. Network Activity
See all network requests made during the session

## 🚀 Production Setup

### What Happens in Production

When you deploy to production:

1. **Automatic Recording Starts**
   - All user sessions are recorded (with privacy settings)
   - No additional setup needed

2. **No Performance Impact**
   - Session replay is optimized for minimal performance impact
   - Compressed and sent in batches

3. **Storage**
   - Recordings are stored for 30 days (default)
   - Configure longer retention in PostHog settings

### Environment Variables

Make sure these are set in your production environment:

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_EDYjm2dLTsIQ0vX000vp07tVQKcIGYi6mbTypqgbaR5
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## ⚙️ Configuration Options

### Enable Recording in Development (Optional)

If you want to test session replay locally:

```typescript
// In PostHogProvider.tsx
disable_session_recording: false, // Enable in dev
```

### Sampling (Reduce Storage Costs)

To record only a percentage of sessions:

```typescript
session_recording: {
  sessionSampleRate: 0.5, // Record 50% of sessions
  minimumDuration: 5000,  // Only record sessions longer than 5 seconds
}
```

### Advanced Masking

```typescript
session_recording: {
  maskAllInputs: true,
  maskInputOptions: {
    password: true,  // Always mask passwords
    email: true,     // Mask emails
    tel: false,      // Don't mask phone numbers
  },
  maskTextSelector: '.sensitive, .private, [data-private]',
}
```

## 🔍 Debugging Session Replay

### Check if Recording is Active

In browser console:
```javascript
// Check if session replay is enabled
posthog.sessionRecording?.status

// Should return 'active' in production
```

### View Recording Status

```javascript
// Get current session recording status
posthog.get_session_replay_url()

// Returns URL to current session recording
```

## 📈 Best Practices

### 1. Review Privacy Settings
- ✅ Mask all sensitive inputs
- ✅ Review what's being recorded
- ✅ Add `data-ph-no-capture` to sensitive areas

### 2. Monitor Storage Usage
- Check PostHog billing for recording storage
- Consider sampling if you have high traffic

### 3. Use Recordings to Debug Issues
- When users report bugs, find their session
- Watch exactly what they did
- See console errors in real-time

### 4. Link with Events
- Capture custom events at key moments
- Use session replay to see context around events

## 🎬 Common Use Cases

### 1. Debug User Issues
```
User reports: "Checkout isn't working"
→ Find their session in PostHog
→ Watch their session replay
→ See exact error that occurred
```

### 2. Understand User Behavior
```
Why do users abandon on this page?
→ Watch session replays of users who left
→ See where they got confused
→ Identify UX improvements
```

### 3. Track Feature Usage
```
How do users interact with new feature?
→ Filter recordings by feature page
→ Watch usage patterns
→ Identify common issues
```

## ⚠️ Important Notes

### What Gets Recorded
- ✅ DOM mutations (element changes)
- ✅ Mouse movements and clicks
- ✅ Scroll events
- ✅ Page navigation
- ✅ Console logs
- ✅ Network requests (metadata only)

### What Doesn't Get Recorded
- ❌ Input values (masked)
- ❌ Passwords
- ❌ Credit card numbers
- ❌ Elements with `data-ph-no-capture`
- ❌ Cross-origin iframe content

### GDPR & Privacy Compliance

Session replay respects:
- User consent (if you have a consent banner)
- Do Not Track settings
- Privacy regulations

To fully comply with GDPR:
```typescript
// Only start recording after user consent
if (userHasGivenConsent) {
  posthog.opt_in_capturing()
  posthog.startSessionRecording()
} else {
  posthog.opt_out_capturing()
}
```

## 🔗 Resources

- **PostHog Dashboard**: https://us.i.posthog.com/recordings
- **Session Replay Docs**: https://posthog.com/docs/session-replay
- **Privacy Controls**: https://posthog.com/docs/session-replay/privacy

---

## ✅ Summary

**Status**: Session replay is ENABLED for production ✅

**What happens now**:
1. Deploy your app to production
2. Session recordings start automatically
3. View recordings at https://us.i.posthog.com/recordings
4. All sensitive data is masked by default

**No additional setup needed!** Session replay will work automatically when users visit your production site.
