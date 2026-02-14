# Grammar Focus Redesign - Complete Implementation

## Overview

The Grammar Focus feature has been completely redesigned with:
- ✅ **Dynamic AI-selected patterns** (topic + level aware, variety guaranteed)
- ✅ **Sleek minimal UI** with pinyin chips
- ✅ **Two examples per point** (warmup + target level)
- ✅ **Variety mechanism** using hints
- ✅ **Graceful fallbacks** if API fails

---

## 1. Database Schema

### New Tables

**`island_grammar_focus`** - Stores grammar points
```sql
- id (uuid)
- island_id (ref topic_islands)
- user_id (ref auth.users)
- hanzi (text) - Grammar pattern in Chinese
- pinyin (text) - Romanization
- english (text) - English explanation
- pattern (text) - Very short pattern description (8-10 chars)
- when_to_use (text, optional) - 1-line usage hint
- position (int) - Order (1, 2, 3)
```

**`island_grammar_examples`** - Stores examples
```sql
- id (uuid)
- grammar_focus_id (ref island_grammar_focus)
- tier ('warmup' | 'target') - Exactly 2 per grammar point
- hanzi, pinyin, english (text)
```

**Migration**: `supabase/migrations/20260213_000002_grammar_focus_tables.sql`

---

## 2. Backend: Grammar Generation

### File: `lib/deepseek/generate-grammar-focus.ts`

**Purpose**: Generate grammar points with AI-driven variety

**Function**: `generateGrammarFocus()`

**Inputs**:
- `topic` - User's island topic
- `level` - A1/A2/B1/B2/C1
- `detailedLevel` - Optional refined level (e.g., B1+)
- `grammarCount` - 0/1/2/3 (if 0, returns empty)
- `varietyHint` - String/number for variety (e.g., timestamp + userId)

**Output**:
```typescript
{
  points: [
    {
      hanzi: "虽然…但是…",
      pinyin: "suīrán... dànshì...",
      english: "although... but...",
      pattern: "虽然 [X] 但是 [Y]",
      whenToUse: "Show contrast between expectation and reality",
      examples: [
        { tier: "warmup", hanzi: "...", pinyin: "...", english: "..." },
        { tier: "target", hanzi: "...", pinyin: "...", english: "..." }
      ]
    }
  ]
}
```

### Key Features

1. **Level Seeds** (SUGGESTIONS ONLY):
   - A1: 是…的, 有/没有, 在 + location, 想要, 这个/那个, 多少
   - A2: 了, 正在, 先…再…, 因为…所以…, 可以/应该, 比较, 会…了
   - B1: 虽然…但是…, 如果…就…, 既然…就…, 才 vs 就, 越…越…, 连…都…, 对…来说, 把 + result
   - B2: 不仅…而且…, 不是…而是…, 即使…也…, 以便…, 反而, 结果/导致, 据说/看来, 早知道…就…
   - C1: 与其…不如…, 一方面…另一方面…, 值得 + V, 宁可…也不…, 无论…都…, 归根到底, 从某种程度上说

2. **Prompt Instructions**:
   - Seeds are **suggestions only** - AI can choose others
   - Must be **topic-relevant**
   - **Vary selections** across runs (don't always pick the same)
   - Return **fewer** if can't find topic-relevant patterns
   - At least one pattern should match target level

3. **Variety Mechanism**:
   - `varietyHint` passed to prompt (e.g., `"1707850123-abc123de"`)
   - Instructs AI to use hint for diversification
   - Temperature: 0.85 (higher for variety)

4. **Validation**:
   - Checks structure, field presence, example count
   - Graceful fallback on error (returns empty array)

---

## 3. Backend Integration

### File: `app/api/topic-islands/[id]/generate-batch/route.ts`

**Changes**:
1. Import `generateGrammarFocus` instead of `pickGrammarPatterns`
2. Before word generation, if `grammarTarget > 0`:
   - Create variety hint: `${Date.now()}-${userId.slice(0, 8)}`
   - Call `generateGrammarFocus()`
   - Insert into `island_grammar_focus` table
   - Insert examples into `island_grammar_examples` table
3. Remove `grammarTags` from `generateWordSentences` calls
4. Remove `grammar_tag` from sentence inserts

**Why**: Grammar is now stored separately, not tied to word sentences

### File: `app/api/topic-islands/[id]/route.ts` (GET)

**Changes**:
1. Fetch `island_grammar_focus` + `island_grammar_examples`
2. Join examples to focus points
3. Return `grammarFocus` array in response

---

## 4. Frontend: Sleek UI

### File: `app/app/topic-islands/[id]/page.tsx`

**New Types**:
```typescript
interface GrammarExample {
  id: string;
  tier: "warmup" | "target";
  hanzi: string;
  pinyin: string;
  english: string;
}

interface GrammarFocus {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  pattern: string;
  when_to_use?: string | null;
  position: number;
  examples: GrammarExample[];
}
```

**State**: `const [grammarFocus, setGrammarFocus] = useState<GrammarFocus[]>([])`

**UI Design** (Sleek & Minimal):

Each grammar point card:
```
┌─────────────────────────────────────────┐
│ 虽然…但是… [suīrán... dànshì...] although...│
│ Pattern: 虽然 [X] 但是 [Y]              │
│ Show contrast between expectation...   │
│                                         │
│ ┌─ WARMUP ─────────────────────┐      │
│ │ 虽然下雨了，但是我还是去了。  │ 🔊   │
│ │ Suīrán xià yǔ le...           │      │
│ │ Although it rained...          │      │
│ └───────────────────────────────┘      │
│                                         │
│ ┌─ YOUR LEVEL ─────────────────┐      │
│ │ 虽然他抱怨挺多的，但说实话...  │ 🔊   │
│ │ Suīrán tā bàoyuàn tǐng duō de...│     │
│ │ Although he complains a lot...  │     │
│ └───────────────────────────────┘      │
└─────────────────────────────────────────┘
```

**Features**:
- Pinyin as small **chip/pill** next to hanzi
- Compact pattern line
- Optional 1-line "when to use"
- Two bordered example boxes (warmup + target)
- Speaker button for TTS
- Tight spacing, scannable
- No repetitive labels or walls of text

---

## 5. How It Works End-to-End

### Creation Flow

1. User creates island:
   - Topic: "Complaining"
   - Level: B1
   - Grammar count: 2

2. Backend (`generate-batch`):
   - Generates variety hint: `"1707850123-abc123de"`
   - Calls `generateGrammarFocus({topic: "Complaining", level: "B1", grammarCount: 2, varietyHint})`
   - DeepSeek returns:
     ```json
     {
       "points": [
         { "hanzi": "连…都…", ... 2 examples },
         { "hanzi": "本来…结果…", ... 2 examples }
       ]
     }
     ```
   - Stores in `island_grammar_focus` + `island_grammar_examples`
   - Continues with word/sentence generation (grammar separate)

3. Frontend (island detail page):
   - Fetches island + words + **grammarFocus**
   - Renders sleek Grammar Focus section if `grammarFocus.length > 0`
   - Shows pinyin chip, pattern, 2 examples per point

### Variety Guarantee

- Different `varietyHint` on each run
- Prompt explicitly says: "Vary selections, don't always pick the same"
- Temperature 0.85
- Result: B1 "Complaining" might get different patterns than B1 "Restaurants"

### Fallback

If `generateGrammarFocus()` fails:
- Returns empty array
- UI gracefully hides Grammar Focus section
- Rest of island generation proceeds

---

## 6. Benefits

### Before
- Always 比 and 把 for B1 + 2 grammar
- Not topic-aware
- Three examples (easy/same/hard) - cluttered
- Grammar tag tied to sentences

### After
- Dynamic patterns based on topic
- Variety across runs
- Two examples (warmup + target) - cleaner
- Grammar stored separately
- Sleek UI with pinyin chips
- Topic-relevant selections

---

## 7. Testing

To test:
1. Run migration: `supabase db push` or apply `20260213_000002_grammar_focus_tables.sql`
2. Create a new island with grammar enabled (count: 1, 2, or 3)
3. Check console logs for selected patterns
4. View island detail page for sleek Grammar Focus section

Expected:
- Different patterns for different topics
- Warmup examples are short and simple
- Target examples match the selected level
- Pinyin appears as chips next to grammar titles

---

## 8. Files Changed

1. **New**: `lib/deepseek/generate-grammar-focus.ts` - AI grammar generation
2. **New**: `supabase/migrations/20260213_000002_grammar_focus_tables.sql` - Database schema
3. **Updated**: `app/api/topic-islands/[id]/generate-batch/route.ts` - Use new grammar generation
4. **Updated**: `app/api/topic-islands/[id]/route.ts` - Fetch grammar focus data
5. **Updated**: `app/app/topic-islands/[id]/page.tsx` - Sleek UI rendering
6. **Unchanged**: `app/api/islands/[id]/add-words/route.ts` - Will update next if needed
7. **New**: `GRAMMAR_PATTERN_SELECTION.md` - Documentation
8. **New**: `GRAMMAR_FOCUS_REDESIGN.md` - This file

---

## 9. Next Steps (Optional Enhancements)

1. **Add variety hint to add-words** - Currently only generate-batch uses it
2. **Store grammar_target in island** - Already exists, good for display
3. **User feedback** - "Was this grammar helpful?" rating
4. **Grammar progress tracking** - Mark patterns as "learned"
5. **More level seeds** - Expand the suggestion lists with community input
