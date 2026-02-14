# Dynamic Grammar Pattern Selection

## Overview

Grammar patterns are now selected dynamically using AI based on the topic and level, rather than always using the first N patterns from a hardcoded list.

## How It Works

### 1. Pattern Selection (`lib/deepseek/pick-grammar-patterns.ts`)

When a user enables grammar focus:

1. **AI Selection**: Claude (Anthropic API) chooses the most relevant grammar patterns based on:
   - **Topic**: What the user wants to learn about (e.g., "Complaining", "Politics", "Restaurants")
   - **Level**: A2, B1, B2, C1, etc.
   - **Count**: How many patterns (1-3) the user requested

2. **Suggestions Only**: The hardcoded pattern lists are passed as **suggestions only** - the AI can:
   - Choose from the suggested patterns
   - Suggest other level-appropriate patterns
   - Vary choices based on topic (not always the same patterns)

3. **Temperature**: Uses 0.8 temperature for variety across different islands

### 2. Integration Points

The dynamic selection is used in two places:

- **`app/api/topic-islands/[id]/generate-batch/route.ts`**: When generating a new island
- **`app/api/islands/[id]/add-words/route.ts`**: When adding more words to an existing island

Both routes now:
1. Call `pickGrammarPatterns()` with topic, level, and count
2. Log the selected patterns
3. Pass them to sentence generation
4. Fall back to hardcoded first-N if AI selection fails

### 3. Example Sentences

Example sentences are already topic-aware and level-tuned:

- **Topic**: Sentences use vocabulary and situations from the island's topic
- **Level**: Sentence complexity matches the user's level (easy/same/hard tiers)
- **Grammar**: The selected patterns are naturally demonstrated in context

## Benefits

### Before
- B1 + 2 patterns → **always** 比 and 把
- Same patterns for every topic at that level
- Not topic-aware

### After
- B1 + 2 patterns → **different patterns** based on topic
- "Complaining" might get different patterns than "Politics"
- Variety across islands even at the same level
- Grammar fits the topic context

## Fallback

If the AI selection fails (API error, parsing error, etc.):
- Falls back to the first N patterns from the suggestion list
- Logs the error for monitoring
- Continues generation without blocking the user

## Suggested Pattern Lists

The suggestion lists remain in the code as:
- Reference for the AI
- Fallback in case of errors
- Documentation of level-appropriate patterns

They are **not** a fixed selection anymore - just inspiration for the AI to choose from (or deviate from).
