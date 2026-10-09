# Review Vocabulary Feature - Topic Islands

## Overview

When creating a new Topic Island, users can now choose to include review vocabulary from their existing islands in the example sentences. This helps reinforce previously learned words while introducing new vocabulary.

---

## ✅ Feature Implementation

### 1. UI Components (Create Island Modal)

**Location:** `app/app/topic-islands/page.tsx`

**New Form State:**
```typescript
{
  includeReviewVocab: false,           // Toggle to enable review vocab
  reviewVocabMode: "random" | "select", // How to select islands
  selectedReviewIslands: string[],      // Selected island IDs (for "select" mode)
}
```

**UI Elements:**
1. **Toggle Switch**: "Include review vocabulary?"
   - Description: "Example sentences will use words from your other islands for reinforcement."
   - Only visible if user has existing islands
   
2. **Mode Selection** (when enabled):
   - **Random**: Randomly select words from all other islands
   - **Select Islands**: Choose specific islands to pull vocabulary from

3. **Island Selector** (when "Select Islands" is chosen):
   - Scrollable list (max-height: 160px)
   - Checkboxes for each existing island
   - Shows island topic and level
   - Multi-select enabled

### 2. API Integration

**Endpoint:** `POST /api/topic-islands/[id]/generate-batch`

**New Request Body Parameter:**
```typescript
{
  batchSize: number,
  reviewVocab?: {
    mode: "random" | "select",
    islandIds?: string[]  // Only required when mode is "select"
  }
}
```

**Backend Logic:**

#### Random Mode:
```typescript
// Fetch up to 50 words from all other islands
// Randomly shuffle and select 8 words max
const { data: knownWordsData } = await supabase
  .from('island_words')
  .select('hanzi')
  .eq('user_id', user.id)
  .neq('island_id', islandId)  // Exclude current island
  .order('created_at', { ascending: false })
  .limit(50)

knownWords = shuffle(knownWordsData).slice(0, 8)
```

#### Select Mode:
```typescript
// Fetch up to 50 words from selected islands only
// Randomly shuffle and select 8 words max
const { data: knownWordsData } = await supabase
  .from('island_words')
  .select('hanzi')
  .eq('user_id', user.id)
  .in('island_id', reviewVocabConfig.islandIds)  // Only selected islands
  .order('created_at', { ascending: false })
  .limit(50)

knownWords = shuffle(knownWordsData).slice(0, 8)
```

#### No Review Vocab:
```typescript
// knownWords remains empty array
// Sentences won't include any review vocabulary
knownWords = []
```

### 3. Sentence Generation Integration

**Location:** `lib/deepseek/generate-word-sentences.ts`

The `knownWords` array (if not empty) is passed to the DeepSeek prompt:

```
KNOWN WORDS for context (use naturally, about 2 times each across all sentences):
你好, 吃, 喝, 学习, 工作, 朋友, 家, 时间
- Only include these words where they fit naturally.
- Do NOT force them or re-explain them; treat as familiar vocabulary.
```

This ensures:
- Review words are integrated naturally into example sentences
- Learners reinforce previously learned vocabulary
- Context feels more realistic (using familiar words in new sentences)

---

## 🎯 Use Cases

### Use Case 1: Random Review (Quick Setup)
**Scenario:** User wants general vocabulary reinforcement without thinking about which islands.

**Steps:**
1. Create new island
2. Enable "Include review vocabulary?"
3. Select "Random"
4. Create

**Result:** Example sentences will randomly use words from all existing islands.

### Use Case 2: Themed Review
**Scenario:** User is learning "Restaurant" vocabulary and wants to reinforce "Food" and "Cooking" islands.

**Steps:**
1. Create new island: "Restaurant"
2. Enable "Include review vocabulary?"
3. Select "Select Islands"
4. Check: "Food" and "Cooking"
5. Create

**Result:** Example sentences will use words specifically from Food and Cooking islands.

### Use Case 3: No Review (Default)
**Scenario:** User wants to focus only on new vocabulary without mixing in old words.

**Steps:**
1. Create new island
2. Leave "Include review vocabulary?" disabled
3. Create

**Result:** Example sentences will only use new words from this island.

---

## 📊 Technical Details

### Word Selection Algorithm

1. **Fetch candidates** (up to 50 words):
   - Random mode: All islands except current
   - Select mode: Only specified islands
   - Ordered by created_at (most recent first)

2. **Shuffle** using Fisher-Yates algorithm:
   ```typescript
   .sort(() => 0.5 - Math.random())
   ```

3. **Select subset** (max 8 words):
   ```typescript
   .slice(0, Math.min(8, candidateKnownWords.length))
   ```

### Why 8 Words?

- Enough for variety across 10-20 new words
- Not overwhelming (each review word appears ~2 times across all sentences)
- Maintains focus on new vocabulary
- Works well with the "about 2 times each" guidance in the prompt

### Conditional Passing

Review words are only passed to sentence generation if they exist:
```typescript
knownWords: knownWords.length > 0 ? knownWords : undefined
```

This prevents empty arrays from affecting the prompt.

---

## 🎨 UI/UX Considerations

### Visual Hierarchy

1. **Primary controls** (Topic, Level, Word Count): Always visible
2. **Grammar focus**: Collapsible section
3. **Review vocabulary**: Conditional section (only if islands exist)
   - Styled with light gray background to distinguish as optional
   - Clear toggle for enable/disable

### Responsive Design

- **Island selector**: 
  - Fixed max-height with scroll
  - Prevents modal from growing too large with many islands
  - Touch-friendly checkbox targets (mobile)

### User Feedback

- Selected islands show checked state
- Island count visible in UI
- Mode selection uses button group pattern
- Helper text explains what each mode does

---

## 🧪 Testing Scenarios

### Test 1: No Existing Islands
- **Expected**: Review vocab section not shown
- **Verify**: Modal renders without review vocab option

### Test 2: Random Mode
- **Setup**: Create 3 islands with 10 words each
- **Action**: Create 4th island with random review vocab
- **Expected**: Sentences include words from islands 1-3
- **Verify**: Check generated sentences for familiar words

### Test 3: Select Mode - Single Island
- **Setup**: Create 2 islands (A and B)
- **Action**: Create 3rd island, select only island A
- **Expected**: Sentences only use words from island A
- **Verify**: Check generated sentences for island A words

### Test 4: Select Mode - Multiple Islands
- **Setup**: Create 3 islands (Food, Travel, Shopping)
- **Action**: Create 4th island, select Food + Travel
- **Expected**: Sentences use words from Food and Travel only
- **Verify**: Shopping words should NOT appear

### Test 5: Toggle Off
- **Action**: Enable review vocab, then disable before creating
- **Expected**: Island created without review vocabulary
- **Verify**: Sentences only use new words

### Test 6: Select Mode - No Islands Selected
- **Action**: Choose "Select Islands" but don't check any
- **Expected**: No review words passed (knownWords = [])
- **Verify**: Sentences only use new words

---

## 📈 Future Enhancements

### Potential Improvements

1. **Smart Selection Algorithm**:
   - Weight by SRS intervals (focus on words due for review)
   - Consider word difficulty relative to new island level
   - Prefer words user has seen fewer times

2. **Visual Preview**:
   - Show how many words will be pulled from each selected island
   - Preview a few example review words before creating

3. **Filtering Options**:
   - Filter islands by level
   - Filter islands by recency
   - "Similar topics only" toggle

4. **User Preferences**:
   - Remember last used mode (random vs select)
   - Remember last selected islands
   - Default enable/disable setting in profile

5. **Analytics**:
   - Track which islands are most commonly used for review
   - Show success rate for mixed vs pure vocabulary islands
   - Suggest optimal review combinations

---

## 🐛 Edge Cases Handled

1. **Empty island list**: Review vocab section hidden
2. **Select mode + no selections**: Treated as disabled (no review words)
3. **Selected island deleted**: API filters out non-existent IDs
4. **Island with no words**: Skipped in word fetching
5. **Less than 8 available words**: Uses all available words
6. **No words available**: knownWords = [], sentences generate normally

---

## 🔄 Data Flow

```
User Action: Enable review vocab + Select islands
           ↓
UI State: formData.selectedReviewIslands = [id1, id2, ...]
           ↓
API Call: POST /api/topic-islands/{id}/generate-batch
           ↓
Backend: Fetch words from selected islands
           ↓
Backend: Shuffle and select up to 8 words
           ↓
Backend: Pass to generateWordSentences(knownWords)
           ↓
DeepSeek: Generate sentences with review vocab integrated
           ↓
Database: Store sentences with natural review word usage
           ↓
User: Sees sentences that reinforce old + introduce new vocabulary
```

---

## ✨ Summary

This feature provides flexible vocabulary reinforcement during island creation:
- **Random mode** for quick, general review
- **Select mode** for targeted, thematic review  
- **Optional** (defaults to off, no review words)
- **Smart integration** (words used naturally, not forced)
- **Scalable** (handles 0 to 100+ islands gracefully)

The implementation maintains focus on new vocabulary while strategically reinforcing previously learned words for better retention! 🎓
