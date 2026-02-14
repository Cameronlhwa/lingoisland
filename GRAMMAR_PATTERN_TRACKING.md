# Grammar Pattern Tracking System

## Overview
Implemented a system to track recently learned grammar patterns per user and avoid repetition across topic islands.

## How It Works

### 1. Database Storage
Grammar patterns are already stored in `island_grammar_focus` table with:
- `user_id` - who learned it
- `hanzi` - the grammar pattern (e.g., "既然…就…")
- `created_at` - when it was learned

### 2. Recent Pattern Retrieval
**File**: `/lib/grammar/recent-patterns.ts`

Helper function to get the last N grammar patterns a user has learned:
```typescript
export async function getRecentGrammarPatterns(
  userId: string,
  limit: number = 10
): Promise<string[]>
```

Returns unique pattern names ordered by most recent first.

### 3. Grammar Generation with Avoidance
**File**: `/lib/deepseek/generate-grammar-focus.ts`

Updated function signature to accept recent patterns:
```typescript
export async function generateGrammarFocus({
  topic,
  level,
  detailedLevel,
  grammarCount,
  varietyHint,
  recentPatterns = [], // NEW
})
```

When recent patterns are provided, they're added to the prompt:
```
RECENTLY LEARNED (try to avoid these if possible):
- 既然…就…
- 虽然…但是…
- 如果…就…

The user has recently learned these patterns. While you can use them 
if they're truly the best fit for "topic", prefer selecting different 
patterns to provide fresh learning experiences.
```

### 4. API Integration
**File**: `/app/api/topic-islands/[id]/generate-batch/route.ts`

Before generating grammar:
1. Fetch last 10 grammar patterns for the user
2. Pass them to `generateGrammarFocus()`
3. Log them for debugging

```typescript
// Get recently learned grammar patterns
const { data: recentGrammar } = await supabase
  .from('island_grammar_focus')
  .select('hanzi')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(10)

const recentPatterns = Array.from(new Set(recentGrammar?.map(g => g.hanzi) || []))

// Pass to generation
const grammarFocusResult = await generateGrammarFocus({
  topic: island.topic,
  level: baseLevel,
  detailedLevel,
  grammarCount: grammarTarget,
  varietyHint,
  recentPatterns, // Avoids these
})
```

## Behavior

### Soft Avoidance (Not Hard Block)
The system uses **soft avoidance** - the AI will:
- ✅ **Prefer** different patterns when possible
- ✅ **Still use** recent patterns if they're the best fit for the topic
- ✅ **Balance** variety with topic relevance

Example:
- User creates "Politics" island → gets "既然…就…"
- User creates "Government" island → will likely get different patterns
- User creates "Making Decisions" island → might still get "既然…就…" if it's clearly the best fit

### Tracking Window
- Tracks last **10** grammar patterns per user
- Oldest patterns naturally fall off the list
- Patterns can repeat after ~10 new islands

### Why 10?
- Balance between variety and not being too restrictive
- Users typically create 3-5 islands before returning
- Allows patterns to "cycle back" naturally

## Adjustable Parameters

### Change tracking window
In the API route, adjust the limit:
```typescript
.limit(10)  // Track last 10 patterns
.limit(15)  // Track last 15 patterns (more variety)
.limit(5)   // Track last 5 patterns (less restrictive)
```

### Change avoidance strength
In the prompt (generate-grammar-focus.ts):
```typescript
// Current (soft):
"try to avoid these if possible"
"prefer selecting different patterns"

// Stronger (medium):
"strongly prefer different patterns"
"only use these if absolutely necessary"

// Strictest (hard):
"do NOT use these patterns"
"these are forbidden"
```

## Benefits

1. **Natural Variety**: Users see different grammar across islands
2. **Topic-First**: Topic relevance still takes priority
3. **Spaced Repetition**: Old patterns can return after being "forgotten"
4. **No Manual Work**: Automatic tracking per user
5. **Debugging**: Console logs show what's being avoided

## Future Enhancements (Optional)

### 1. Adjust by Level
Track patterns per level:
```typescript
// Only avoid B1 patterns when creating B1 islands
const recentB1Patterns = recentGrammar.filter(g => g.level === 'B1')
```

### 2. Time-Based Decay
Weight recent patterns more heavily:
```typescript
// Avoid patterns from last 7 days strongly
// Avoid patterns from last 30 days weakly
```

### 3. User Preference
Let users opt out:
```typescript
// Settings: "Prefer variety" vs "Prefer repetition for practice"
```

### 4. Analytics
Track which patterns users see most:
```typescript
// Show user: "You've learned 虽然…但是… 3 times"
```

## Example Flow

**User Journey**:
1. Creates "Politics" island → Gets: 既然…就…, 不仅…而且…
2. Creates "Restaurants" island → Gets: 虽然…但是…, 如果…就… (avoids the 2 from Politics)
3. Creates "Complaining" island → Gets: 连…都…, 本来…结果… (avoids all 4 previous)
4. Creates 8 more islands...
5. Creates "Government" island → Can get 既然…就… again (fell off the 10-pattern window)

## Testing

To test the system:
1. Create 2-3 islands quickly with same level
2. Check console logs for "Avoiding recently learned patterns"
3. Verify different grammar patterns appear
4. After 10+ islands, verify patterns can repeat naturally
