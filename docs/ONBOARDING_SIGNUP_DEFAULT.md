# Onboarding Default to Sign Up

## Change Made

**File**: `app/onboarding/topic-island/page.tsx`

Changed the default authentication mode from "sign in" to "sign up" (create account).

## Code Change

```typescript
// Before
const [isSignUp, setIsSignUp] = useState(false);

// After  
const [isSignUp, setIsSignUp] = useState(true);
```

## User Experience

### Before:
- Primary button: "SIGN IN WITH EMAIL"
- Toggle text: "New here? Create an account"
- User had to click toggle to create account

### After:
- Primary button: "CREATE ACCOUNT"
- Toggle text: "Already have an account? Sign in"
- New users can immediately create account (default)
- Existing users can click toggle to sign in

### Unchanged:
- ✅ "Continue with Google" button still present
- ✅ Email and password fields
- ✅ All functionality works the same
- ✅ Toggle between modes still works

## Rationale

Most visitors to `/onboarding/topic-island` are new users who need to create an account. Defaulting to sign-up mode reduces friction for the primary use case.

Existing users can still easily access sign-in by clicking the toggle button.

## Testing

- [ ] Visit `/onboarding/topic-island`
- [ ] Verify "CREATE ACCOUNT" button shows by default
- [ ] Verify toggle text says "Already have an account? Sign in"
- [ ] Click toggle and verify it switches to "SIGN IN WITH EMAIL"
- [ ] Test creating new account works
- [ ] Test toggling to sign in and signing in works
