# Quiz Variety Fix

## Problem
The quiz function was showing the same words repeatedly because:
1. All words were always selected by default
2. The quiz randomly picked 10 words from the selected pool every time
3. There was no memory of which words were recently quizzed
4. Pure randomization meant users could see the same subset multiple times in a row

## Solution
Implemented a **Smart Quiz System** that tracks recently quizzed words and prioritizes variety:

### 1. Recently Quizzed Tracking
- Added `recentlyQuizzedIds` state to track the last 20 words that have been quizzed
- Automatically limits the set size to prevent infinite growth

### 2. Smart Word Selection Algorithm
When starting a quiz, the system now:

1. **Prioritizes fresh words**: If there are 10+ words that haven't been quizzed recently, uses only those
2. **Mixes fresh + recent**: If fewer than 10 fresh words, combines fresh words (priority) with some recent ones
3. **Resets automatically**: If all words have been quizzed, automatically clears the history and starts fresh

### 3. User-Friendly Features
- **Smart Quiz indicator**: Shows a blue banner when the smart quiz is active, displaying how many fresh words are available
- **Manual reset option**: Users can click "Reset history" to manually clear the recently-quizzed tracking
- **Automatic tracking**: Each quiz session adds its words to the recently-quizzed set

## Code Changes

### `/app/app/topic-islands/[id]/page.tsx`

#### Added State
```typescript
const [recentlyQuizzedIds, setRecentlyQuizzedIds] = useState<Set<string>>(new Set());
```

#### Updated `handleStartQuiz` Function
- Filters words into "fresh" (not recently quizzed) and "recently quizzed" groups
- Implements smart selection logic:
  - 10+ fresh words → use only fresh
  - Some fresh words → mix 7 fresh + 3 recent
  - All quizzed → reset history and use all
- Tracks the 10 selected words in `recentlyQuizzedIds`
- Maintains a maximum of 20 IDs in the tracking set

#### Added UI Banner
Shows when `recentlyQuizzedIds.size > 0`:
- Displays how many fresh words are available
- Provides a "Reset history" button for manual clearing
- Uses blue accent color for clear visibility

## User Experience

### Before
- Quizzes felt repetitive
- Same words appeared frequently
- No sense of progress through the word list

### After
- Each quiz focuses on words you haven't practiced recently
- Automatically provides variety across quiz sessions
- Clear feedback about quiz variety status
- Manual control via reset button when desired
- Automatic reset when all words have been covered

## Technical Details

### Memory Management
- Limits `recentlyQuizzedIds` to 20 most recent words
- Prevents memory bloat in long sessions
- Clears old entries automatically using array slicing

### Edge Cases Handled
1. **Fewer than 10 total words**: Works with smaller word sets
2. **All words quizzed**: Automatically resets and starts fresh
3. **Partial fresh words**: Intelligently mixes fresh and recent
4. **Manual reset**: User can override the automatic tracking

### Performance
- O(n) complexity for word filtering
- Minimal memory footprint (max 20 IDs tracked)
- No database queries needed (client-side only)

## Future Enhancements (Optional)
- Persist `recentlyQuizzedIds` to localStorage for cross-session tracking
- Track word performance (correct/incorrect) for spaced repetition
- Add difficulty-based prioritization
- Show visual indicators for which words haven't been quizzed yet
