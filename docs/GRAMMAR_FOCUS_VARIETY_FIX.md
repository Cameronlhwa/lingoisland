# Grammar Focus Repetition Fix

## Problem
The grammar focus generation was repeatedly returning "既然。。。就" (since...then) for B1, B2, and C1 levels across multiple requests, showing no variety.

## Root Cause
1. **Insufficient randomness**: Temperature was 0.85, which wasn't high enough for true variety
2. **Weak variety instructions**: The prompt only mentioned avoiding repetition but didn't give concrete mechanisms
3. **Limited seed pool**: Each level had only 6-8 grammar patterns, making it easy for the model to default to the same ones
4. **No rotation strategy**: The model wasn't given explicit instructions on HOW to vary selections

## Solution Implemented

### 1. Enhanced Variety Mechanism
**File**: `/lib/deepseek/generate-grammar-focus.ts`

Added a random seed component to the variety hint:
```typescript
const randomSeed = Math.floor(Math.random() * 10000)
```

This creates a unique randomization factor for each request that:
- Changes independently of timestamp
- Provides a seed for the model to use in selection logic
- Helps avoid temporal clustering of similar requests

### 2. Explicit Rotation Instructions
Updated the prompt to include:
- **Explicit exclusion**: "DO NOT default to '既然…就…' repeatedly"
- **Mental rotation concept**: "think of yourself as maintaining a mental rotation of options"
- **Index-based selection**: "prefer starting from index ${randomSeed % seeds.length} in this list"
- **Hint tracking**: Each request gets a unique hint ID that the model should use to avoid repetition

New prompt section:
```
VARIETY REQUIREMENT (CRITICAL):
Hint ID: ${variety}-${randomSeed}
This is request #${randomSeed} - you MUST pick DIFFERENT grammar patterns than typical defaults.
DO NOT default to "既然…就…" repeatedly. 
Actively avoid: 既然…就… if you've seen this hint range before.
Rotate through different patterns - think of yourself as maintaining a mental rotation of options.
```

### 3. Increased Temperature
Changed temperature from **0.85** to **1.2** for maximum variety:
```typescript
temperature: 1.2, // Higher for maximum variety
```

Higher temperature means:
- More randomness in token selection
- Less deterministic outputs
- Greater variety across similar prompts

### 4. Expanded Seed Lists
Doubled or tripled the number of grammar patterns in each level's seed list:

**Before**:
- A1: 6 patterns
- A2: 7 patterns
- B1: 8 patterns
- B2: 8 patterns
- C1: 8 patterns

**After**:
- A1: 10 patterns
- A2: 12 patterns
- B1: 14 patterns
- B2: 14 patterns
- C1: 12 patterns

Example additions for B1:
- Added: `除了…以外` (except), `本来…结果…` (originally), `一边…一边…` (while), `不但…而且…` (not only), `只要…就…` (as long as)

### 5. Enhanced System Message
Updated the system message to reinforce variety:
```typescript
'You MUST vary your selections across different requests - never repeat the same grammar patterns.'
```

## Technical Details

### Variety Hint Construction
```typescript
const varietyHint = `${Date.now()}-${userId?.slice(0, 8)}`  // From API call
const randomSeed = Math.floor(Math.random() * 10000)        // In generation function
const finalHint = `${variety}-${randomSeed}`                // Combined
```

### Rotation Logic
The model is instructed to:
1. View grammar patterns as a shuffled deck
2. Use `randomSeed % seeds.length` to determine starting position
3. Pick from that position onwards in the rotation
4. Track hint IDs mentally to avoid repeating for similar hints

### Temperature Impact
- **0.85**: Somewhat varied but still deterministic
- **1.2**: Maximum variety while maintaining coherence
- Above 1.2 would risk nonsensical outputs

## Expected Behavior After Fix

### Before:
- Request 1 (B1): "既然…就…"
- Request 2 (B2): "既然…就…"
- Request 3 (C1): "既然…就…"

### After:
- Request 1 (B1): "虽然…但是…" (although)
- Request 2 (B1): "才 vs 就" (timing)
- Request 3 (B1): "连…都…" (even)
- Request 4 (B1): "除了…以外" (except)
- etc.

Each request should now return different grammar patterns, with proper variety across:
- Same level, different topics
- Different levels, same topic
- Sequential requests with any combination

## Testing Recommendations

1. **Test same level, same topic**: Create 3+ islands with identical settings
2. **Test level progression**: Create islands at B1, B2, C1 with same topic
3. **Test rapid succession**: Create multiple islands quickly to ensure timestamp isn't causing clustering
4. **Verify topic relevance**: Ensure patterns are still appropriate for the topic

## Additional Notes

- The fix maintains topic relevance and level appropriateness
- Grammar patterns are still selected from appropriate difficulty pools
- Examples are still generated to match the topic
- The "warmup + target" example structure remains unchanged
- Fallback behavior (empty array) remains for error cases
