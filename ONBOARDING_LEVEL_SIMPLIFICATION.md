# Onboarding Level Selection Simplification

## Changes Made

### 1. Topic Island Onboarding (`/app/onboarding/topic-island/page.tsx`)

**Before:**
- Showed 5 level groups with 3 buttons each (A1-, A1, A1+)
- Users had to understand +/- notation
- Total of 15 buttons to choose from

**After:**
- Shows 5 simple level cards (A1, A2, B1, B2, C1)
- Click entire card to select level
- Much cleaner, easier for non-CEFR users
- Mapping: Beginner → A1, Upper beginner → A2, Intermediate → B1, etc.

### 2. Story Onboarding (`/app/onboarding/story/page.tsx`)

**Before:**
- Same complex 15-button layout

**After:**
- Same simplified 5-card layout
- Consistent with topic island onboarding

### 3. Backward Compatibility

**Extended levels still work for existing users:**
- Database: `cefr_level` is a text field with no constraints ✅
- API validation: Uses `.startsWith()` matching (both "B1" and "B1-" pass) ✅
- Story generation: Has level normalization logic ✅
- Word generation: Handles both base and extended levels ✅
- Custom story API: Updated to accept both formats ✅

## Technical Details

### Type System

```typescript
// For new users (onboarding)
type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1";

// Still valid for existing users
type ExtendedCEFRLevel =
  | "A1-" | "A1" | "A1+"
  | "A2-" | "A2" | "A2+"
  | "B1-" | "B1" | "B1+"
  | "B2-" | "B2" | "B2+"
  | "C1-" | "C1" | "C1+";
```

### API Validation

**Topic Islands** (`/api/topic-islands/route.ts`):
```typescript
const baseLevel =
  level.startsWith('A1') ? 'A1' :
  level.startsWith('A2') ? 'A2' : 
  level.startsWith('B1') ? 'B1' : 
  level.startsWith('B2') ? 'B2' :
  level.startsWith('C1') ? 'C1' : null
```
✅ Both "B1" and "B1-" pass validation

**Custom Stories** (`/api/story/custom/route.ts`):
```typescript
const EXTENDED_LEVELS = [
  "A1-", "A1", "A1+",
  "A2-", "A2", "A2+",
  "B1-", "B1", "B1+",
  "B2-", "B2", "B2+",
  "C1-", "C1", "C1+"
];

function isValidLevel(level: string): boolean {
  return EXTENDED_LEVELS.includes(level);
}
```
✅ Explicitly accepts both formats

### Story Generation

**Level Normalization** (`lib/stories/getOrCreateDailyStory.ts`):
```typescript
// Normalize level (handle variations like A2-, A2, A2+)
let baseLevel = level;
if (level.match(/^(A1|A2|B1|B2|C1)[+-]?$/)) {
  baseLevel = level.replace(/[+-]/g, '');
}
const styleGuide = levelGuidance[baseLevel] || levelGuidance['B1'];
```
✅ Strips +/- for style lookup, works with base levels directly

### Word/Sentence Generation

**Tier Mapping** (`lib/deepseek/generate-word-sentences.ts`):
```typescript
const easyTierMap: Record<string, string> = {
  'A1-': 'absolute beginner',
  'A1': 'weak A1',  // Base level has entry ✅
  'A1+': 'solid A1',
  // ... etc
}

const actualDetailedLevel = detailedLevel || level
const easyDescription = easyTierMap[actualDetailedLevel] || 
  `one full level easier than ${level}`  // Fallback ✅
```
✅ Has entries for base levels, plus fallback for safety

## Database Schema

```sql
-- user_profiles table
create table user_profiles (
  user_id uuid primary key,
  cefr_level text not null default 'B1',  -- No constraints ✅
  -- ... other fields
);

-- topic_islands table
create table topic_islands (
  id uuid primary key,
  level text not null default 'B1',  -- No constraints ✅
  -- ... other fields
);
```

**No enum constraints or check constraints** → Any string value accepted

## Testing Checklist

### New Users (Base Levels)

- [ ] Create account via topic island onboarding
- [ ] Select "Beginner (A1)" → stores "A1" in database
- [ ] Generate topic island → words generate successfully
- [ ] Create account via story onboarding
- [ ] Select "Intermediate (B1)" → stores "B1" in database
- [ ] Generate custom story → story generates successfully

### Existing Users (Extended Levels)

- [ ] User with `cefr_level='B1-'` in database
- [ ] Can create new topic islands
- [ ] Can generate new words
- [ ] Can create custom stories
- [ ] Daily story generation works
- [ ] User with `cefr_level='A2+'` in database
- [ ] All features work normally

### Edge Cases

- [ ] User profile updated from "B1" to "B1-" manually in database → app still works
- [ ] Topic island created with level "A1" → sentence generation works
- [ ] Topic island created with level "A1+" → sentence generation works
- [ ] Story generation with mixed levels (islands have "B1" and "B1-")

## Migration Path

**No migration required!** The changes are:
1. ✅ UI simplification only (onboarding pages)
2. ✅ Extended validation in custom story API
3. ✅ All existing data remains valid
4. ✅ All existing functionality preserved

**New users** get simplified onboarding with base levels.
**Existing users** with extended levels continue working normally.

## UI Changes

### Before (Complex)
```
┌─────────────────────────────────────────────────┐
│ Beginner (A1)                                   │
│ Just starting out...                            │
│                                [A1-][A1][A1+]   │
└─────────────────────────────────────────────────┘
```

### After (Simple)
```
┌─────────────────────────────────────────────────┐
│ Beginner (A1)                                   │
│ Just starting out with basic phrases and        │
│ survival vocabulary (equivalent to HSK 1-2).    │
│                                                  │
│ (Click entire card to select)                   │
└─────────────────────────────────────────────────┘
```

## Benefits

1. **Simpler for beginners** - No need to understand +/- notation
2. **Cleaner UI** - One click instead of choosing between 3 options
3. **Faster onboarding** - Less decision fatigue
4. **Still accurate** - Base level is good enough for content generation
5. **Backward compatible** - Existing users unaffected
6. **No data migration** - Just UI changes

## Rationale

The +/- sub-levels were:
- ❌ Confusing for users unfamiliar with CEFR
- ❌ Caused analysis paralysis (which between A1-, A1, A1+?)
- ❌ Not critical for content generation (base level is sufficient)
- ❌ Made UI cluttered on mobile

The base levels are:
- ✅ Sufficient for AI-generated content tuning
- ✅ Maps clearly to familiar terms (Beginner, Intermediate, etc.)
- ✅ Easier for users to self-assess
- ✅ Cleaner, more professional UI
