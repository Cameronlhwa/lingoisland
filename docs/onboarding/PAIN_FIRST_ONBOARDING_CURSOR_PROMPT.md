# Cursor prompt: pain-first onboarding

You are working on the personalized onboarding flow at `/onboarding/journey` (branch `onboarding-no-phone`). Read this whole document before touching code.

Work in **phases**. At the end of every phase, STOP and post a check-in: what you changed (file + summary), test results, and any open questions. Do not start the next phase until I reply "go". Where a phase says **ASK FIRST**, report what you found and propose an approach, then wait. Prefer small, line-level edits over rewrites. Do not delete the phone/texting steps or their code.

---

## Why we're doing this

LingoIsland's primary customer: busy adults with a real-life reason to learn Mandarin (mainly work: clients, colleagues, meetings), studying 5–15 minutes, 3–5 days a week. Beginner to intermediate. Success = using Mandarin in a real situation. Positioning: a serious, efficient tool, not a game. Core promise: "Learn the Mandarin you actually need, in only 10 minutes a day."

Today the flow only asks about goal, topics, level and time. It never asks what *hurts*. We're restructuring it around a sales process: **Connect → Diagnose → Prescribe → Commit**. We find the learner's pain, show them people who felt the same, reflect the pain back, and present the plan as the relief. LingoIsland must read as a painkiller, not a vitamin.

---

## Target flow

Learner path (has studied before):

```
goal → interests → level → experience → using_pain → learning_pain → reviews
→ calibration → pronunciation → availability → building → reflect → plan → commitment → paywall
```

Beginner path (level = "I am completely new", OR experience = "I haven't really started"):

```
goal → interests → level → [experience skipped if level is "new"] → using_pain → learning_pain (hesitation variant)
→ reviews → [calibration skipped ONLY if level is "new"] → pronunciation ("say your first word") → availability
→ building → reflect → plan → commitment → paywall
```

Rules:
- `experience` is skipped when `level.selfReport === "new"`.
- `calibration` is skipped only when `level.selfReport === "new"`. Someone who says "I know a few words" but "haven't really started" still takes the quiz (it's pitched easy).
- The "beginner" variant of `learning_pain` and `pronunciation` applies when `selfReport === "new"` OR `experience === "not_started"`. Put this in one pure helper: `isBeginnerPath(answers)`.
- The reviews screen moves OUT of `CalibrationStep` and becomes its own `reviews` step, after the pain questions.
- Pronunciation stays for everyone (it's the moment users experience the product).

---

## Key files (already explored)

- `lib/onboarding/personalized/flow.ts`: `STEP_ORDER`, `OnboardingAnswers`, `emptyAnswers`, `stepsFor`, `isStepComplete`, `previousStep`/`nextStep`/`progressFor`, `updateAnswers` (the `affectsPlan` list), `planFor`, `parseAnswers` (untrusted input validation), `progressColumns`, `answersForServer`
- `lib/onboarding/personalized/goals.ts`: `GOALS`, `INTERESTS_BY_GOAL`, `normalizeCustomText`
- `lib/onboarding/personalized/socialProof.ts`: `matchReviews`, `socialProofTitle`
- `lib/landing-content.ts`: `LEARNER_TESTIMONIALS` (4 real reviews with `match` tags)
- `lib/onboarding/personalized/plan.ts`: `buildPlan`, `firstJourneys`, `goalBenefit`, `milestone.range`
- `lib/onboarding/personalized/building.ts`: `BUILD_STAGES`
- `lib/onboarding/personalized/pronunciation.ts` + `app/api/onboarding/pronunciation/route.ts`
- `lib/onboarding/personalized/analytics.ts`: `ONBOARDING_EVENTS`, `ALLOWED_KEYS`, `sanitizeOnboardingProps`
- `components/Onboarding/personalized/`: `PersonalizedOnboardingFlow.tsx`, `ProfileSteps.tsx`, `CalibrationStep.tsx`, `SocialProofIntro.tsx`, `PronunciationStep.tsx`, `PlanSteps.tsx`, `PaywallStep.tsx`, `ui.tsx`, `stepTypes.ts`
- `app/onboarding/upgrade/OnboardingUpgradeClient.tsx`: the shared paywall (mobile + desktop layouts)
- `app/api/onboarding/activate/route.ts`, `app/api/onboarding/save-email/route.ts`
- Tests: `tests/onboarding/*.test.ts` (`npm run test:onboarding`), `tests/e2e/personalized-onboarding.spec.ts`, `tests/e2e/onboarding-checkout.spec.ts`

---

## Phase 0: Read and confirm (no edits)

Read every file above. Then report:
1. Anything in this document that conflicts with the code (wrong names, assumptions that don't hold).
2. Whether `onboarding_progress.answers` (jsonb) stores the full answers snapshot, so new answer fields need NO migration. Confirm by reading `supabase/migrations/20261107_000001_personalized_onboarding.sql` and the save RPC.
3. What anything downstream does with `calibration.placement` being null (activation, plan, progressColumns), because beginners will now skip calibration.
4. What `app/api/onboarding/save-email/route.ts` currently does.
5. What fields the pronunciation route's normalized SpeechSuper result exposes (overall, tone, per-syllable?).

STOP and check in.

---

## Phase 1: Data model and flow logic (no UI yet)

### 1a. New content file: `lib/onboarding/personalized/painPoints.ts`

Pure data + helpers, no React. Keys are stored and sent to analytics; labels are display-only.

**Experience** (`ExperienceKey`):
| key | label |
|---|---|
| `not_started` | I haven't really started |
| `under_6_months` | Less than 6 months |
| `6_to_24_months` | 6 months to 2 years |
| `over_2_years` | More than 2 years |
| `on_and_off` | On and off for years |
| `as_a_kid` | I learned some as a kid |

**Using pain**: options depend on `goal.primary`. Multi-select, max 2. Some keys are shared across goals with different labels.

work:
| key | label |
|---|---|
| `stay_quiet` | I stay quiet when colleagues speak Mandarin |
| `rely_on_translator` | Someone has to translate for me |
| `cant_keep_going` | I can say hello, but can't keep the conversation going |
| `missing_opportunities` | I'm missing chances with clients, roles or deals |
| `want_to_improve` | It's fine, I just want to get better |

school:
| key | label |
|---|---|
| `lost_in_class` | I get lost in class or lectures |
| `hard_to_connect` | It's hard to connect with Chinese classmates |
| `exam_pressure` | I have an exam or requirement coming up |
| `cant_keep_going` | I can say hello, but can't keep the conversation going |
| `want_to_improve` | It's fine, I just want to get better |

heritage:
| key | label |
|---|---|
| `understand_cant_reply` | I understand some, but I can't reply |
| `family_switches` | My family switches to English for me |
| `limited_with_elders` | I can't really talk with grandparents or older relatives |
| `feel_disconnected` | I feel disconnected from my roots |
| `want_to_improve` | It's fine, I just want to get better |

travel:
| key | label |
|---|---|
| `point_and_gesture` | I end up pointing and using English |
| `cant_talk_locals` | I can't really talk with locals |
| `worried_get_around` | I worry about getting around on my own |
| `want_to_improve` | It's fine, I just want to get better |

everyday / other:
| key | label |
|---|---|
| `stay_quiet` | I stay quiet when friends speak Mandarin |
| `cant_keep_going` | I can say hello, but can't keep the conversation going |
| `cant_follow_shows` | I can't follow shows or videos without subtitles |
| `want_to_improve` | It's fine, I just want to get better |

`want_to_improve` is exclusive: selecting it clears the others, and selecting another clears it.

**Timing** (same screen as using pain, single-select, required):
| key | label |
|---|---|
| `this_week` | This week |
| `this_month` | Within a month |
| `upcoming_event` | A trip or event coming up |
| `ongoing` | It happens every week |
| `no_date` | No specific time |

Plus optional free text "What's coming up?" (placeholder per goal, e.g. work: "For example, a client dinner in Shanghai"). Normalize with `normalizeCustomText` (max 40). Show it when timing is `this_week`, `this_month` or `upcoming_event`.

**Learning pain** (learner path, multi-select, max 2):
| key | label |
|---|---|
| `forget_words` | I forget words quickly |
| `not_relevant` | Lessons weren't about things I actually need |
| `freeze_speaking` | I recognize words but freeze when speaking |
| `plateau` | I've stopped improving |
| `inconsistent` | It's hard to stay consistent with my schedule |
| `no_practice` | I have no one to practise with |
| `tones` | Tones and pronunciation |

**Hesitation** (beginner path, multi-select, max 2):
| key | label |
|---|---|
| `no_time` | I don't have much time |
| `seems_too_hard` | It seems too hard (tones, characters) |
| `dont_know_where_start` | I didn't know where to start |
| `apps_felt_like_games` | Apps felt like games, not real Mandarin |
| `worried_quit` | I'm worried I'll quit |

Export: option arrays, `usingPainOptionsFor(goal)`, `is*Key` guards, and label lookups for a key in a goal context.

### 1b. `flow.ts` changes

- Add to `OnboardingAnswers` and `emptyAnswers()`:
  ```ts
  experience: { key: ExperienceKey | null };
  usingPain: { keys: UsingPainKey[]; timing: TimingKey | null; upcomingText: string | null };
  learningPain: { keys: LearningPainKey[]; hesitations: HesitationKey[] };
  ```
- `STEP_ORDER`: insert `experience`, `using_pain`, `learning_pain`, `reviews` after `level`. Insert `reflect` after `building`, before `plan`. Keep the messaging steps where they are.
- Add `isBeginnerPath(answers)` per the rules above.
- `stepsFor(answers)`: still filter out `MESSAGING_STEPS`. Also drop `experience` and `calibration` when `level.selfReport === "new"`.
- `isStepComplete`:
  - `experience`: `key !== null`
  - `using_pain`: `keys.length > 0 && timing !== null`
  - `learning_pain`: beginner path → `hesitations.length > 0`, otherwise `keys.length > 0`
  - `reviews` and `reflect`: fall through to the `events[step]?.completed_at` default
- `updateAnswers`: add `experience`, `usingPain`, `learningPain` to `affectsPlan`. When `level` changes, also clear `experience` if the new self-report is `new`.
- `progressFor`: still fold `building` into the previous visible step and exclude `paywall`. The total will now change after the level step. That's acceptable, but make sure the bar never moves backwards on the same step.
- `parseAnswers`: validate the new fields strictly using the guards. Drop unknown keys, cap arrays at 2, enforce `want_to_improve` exclusivity, normalize `upcomingText`. Old saved states without these fields must parse to empty values (returning users resume at `experience`/`using_pain`).
- `previousStep` must respect the dynamic step list (going back from `using_pain` for a "new" learner goes to `level`).
- Do NOT bump `FLOW_VERSION` unless Phase 0 shows it's required. If you think it is, ASK FIRST.

### 1c. Analytics (`analytics.ts`)

New events: `experienceSelected: "onboarding_experience_selected"`, `usingPainSelected: "onboarding_using_pain_selected"`, `learningPainSelected: "onboarding_learning_pain_selected"`, `reviewsViewed: "onboarding_reviews_viewed"`, `reflectionConfirmed: "onboarding_reflection_confirmed"`, `reflectionEdited: "onboarding_reflection_edited"`.

New `ALLOWED_KEYS`: `experience`, `pains`, `timing`, `learning_pains`, `hesitations`, `path` (`"learner" | "beginner"`), `has_upcoming_text`. Only send keys, never labels or `upcomingText`.

### 1d. Tests (`tests/onboarding/`)

Add unit tests for: `stepsFor` on both paths; `isBeginnerPath` (all combinations); `parseAnswers` rejecting bad keys, over-long arrays and markup in `upcomingText`; `want_to_improve` exclusivity; `resumeStep` for an old saved state that has no new fields; and `sanitizeOnboardingProps` dropping `upcomingText` if passed.

STOP and check in.

---

## Phase 2: New screens and reordering

All new screens use the existing primitives in `ui.tsx` (`StepFrame`, `OptionCard`, `ChipButton`, `PrimaryButton`, `SectionLabel`, `FieldError`) and match `ProfileSteps.tsx` patterns (`track` on submit, `next(patch)`, back button, `data-testid`s). Put them in a new file, `components/Onboarding/personalized/PainSteps.tsx`.

1. **`ExperienceStep`**
   - Title: "How long have you been learning Mandarin?"
   - Subtitle: "Your best guess is fine."
   - Six `OptionCard`s, single-select.
   - Tracks `experienceSelected { experience }`.

2. **`UsingPainStep`**
   - Title by goal: work "When Mandarin comes up at work, what usually happens?", school "…at school…", heritage "…with family…", travel "When you travel, what usually happens with Mandarin?", everyday/other "When Mandarin comes up, what usually happens?"
   - Subtitle: "Pick up to two."
   - Pain `OptionCard`s (multi-select, max 2; a third tap shows a gentle `FieldError`: "Pick your top two").
   - Then a `SectionLabel`: "When's the next time you'll need it?" with timing options, and the conditional "What's coming up? (optional)" text input.
   - Tracks `usingPainSelected { pains, timing, has_upcoming_text }`.

3. **`LearningPainStep`** (one component, two variants via `isBeginnerPath`)
   - Learner: title "What's been hardest about learning so far?", subtitle "Pick up to two."
   - Beginner: title "What's held you back from starting?", subtitle "Pick up to two. Lots of people feel this way."
   - Tracks `learningPainSelected { learning_pains | hesitations, path }`.

4. **`ReviewsStep`**: move `SocialProofIntro` out of `CalibrationStep`.
   - Remove the `showReviews` state and branch from `CalibrationStep` so it starts at its intro (writing system + Start).
   - Render `SocialProofIntro` as the `reviews` step in `PersonalizedOnboardingFlow.tsx`.
   - Continue calls `next()`. Track `reviewsViewed` once.

5. **Interests step copy only**: change the `InterestsStep` title to "Which situations do you want to handle first?". Keep the chips and keys exactly as they are (`JOURNEYS` in `plan.ts` depends on them).

6. Wire everything in `PersonalizedOnboardingFlow.tsx`, including the `wide` layout if the reviews step needs it (it did inside calibration via `onWideChange`).

Update `tests/e2e/personalized-onboarding.spec.ts` for both paths: a "few words" work learner, and a "completely new" learner who must never see the quiz.

STOP and check in.

---

## Phase 3: Reviews matched to pain

Hard rule: **never write, edit or paraphrase testimonial quotes.** They're real reviews. Only add matching tags.

1. Extend the `LearnerTestimonial.match` type in `lib/landing-content.ts` with optional `pains?: string[]` (using-pain keys) and `learningPains?: string[]` (learning-pain and hesitation keys).
2. Tag the existing four:
   - Business and heritage learner: `pains: ["cant_keep_going", "understand_cant_reply"]`, `learningPains: ["not_relevant"]`
   - Finance professional: `pains: ["cant_keep_going", "missing_opportunities"]`, `learningPains: ["inconsistent", "no_time"]`
   - Medical professional: `pains: ["missing_opportunities"]`, `learningPains: ["not_relevant", "apps_felt_like_games"]`
   - Traveler: `pains: ["point_and_gesture", "cant_talk_locals", "worried_get_around"]`
3. `matchReviews` scoring. Add these on top of the existing points, ranked highest first: learning pain or hesitation match **+6**, using pain match **+5**, then goal +4, interests +2 each, level +1.
4. Reason label, using the first match in that order:
   - "Also felt stuck" (`plateau`)
   - "Also short on time" (`inconsistent`, `no_time`)
   - "Also wanted relevant lessons" (`not_relevant`, `apps_felt_like_games`)
   - "Also struggled with clients" (`cant_keep_going`, `missing_opportunities`)
   - "Also grew up hearing Mandarin" (`understand_cant_reply`)
   - otherwise the existing goal and interest reasons
5. `socialProofTitle(answers)` (change the signature to take answers):
   - Beginner path: "Others who started from zero"
   - Any learning pain is `plateau`: "People who felt stuck too"
   - Otherwise keep the existing goal-based titles.
6. Unit tests for the new ranking and reasons.

Note for my check-in: list which pains/hesitations have NO matching review (expected: `freeze_speaking`, `plateau`, `tones`, `seems_too_hard`, `worried_quit`, `stay_quiet`, …). I'll collect real reviews for them. Don't invent any.

STOP and check in.

---

## Phase 4: Pronunciation as the "aha" moment

1. **Beginner framing** (`isBeginnerPath`):
   - Offer title: "Say your first word in Mandarin"
   - Subtitle: "It takes about 20 seconds. You can skip it."
   - Use `LEVEL_WORDS[0]` (你好) as the first word, then the interest-family word.
2. **Learner framing**:
   - Title: "Check your tones in 20 seconds"
   - Subtitle: "Say two words from your plan, or skip for now."
3. **Visible feedback.** ASK FIRST: tell me what the normalized SpeechSuper result contains (from Phase 0). We still never show or store a numeric score. Proposed contract: the route returns `{ status: "ok", needsToneSupport, feedback: "great" | "close" | "retry", weakSyllable?: string }`, derived server-side from the existing thresholds. After each word, show one line:
   - great: "Your tones were spot on."
   - close: "Close. Your tone on {syllable} needs a little work. Your plan adds extra tone practice."
   - retry: "Tones take practice. Your plan starts you with extra help."

   Keep the copy encouraging. Never say "wrong" or "bad".
4. Update `tests/pronunciation/` for the new response shape.

STOP and check in.

---

## Phase 5: Prescribe (building, reflection, plan)

1. **Building stages** (`building.ts` / `BuildingStep`): make the stage labels dynamic from the plan, keeping the timing unchanged:
   - "Focusing on {interestPhrase}"
   - "Matching your starting point"
   - "Fitting it into {minutes} minutes, {days}"

   Fall back to the current labels if data is missing.

2. **New `reflect` step: "Did we get this right?"** Build the copy in a new pure module, `lib/onboarding/personalized/reflection.ts`, with unit tests. Use first-person-to-you phrasing built from labels, never raw keys. Example output:
   - Learner:
     - **Right now:** "You stay quiet when colleagues speak Mandarin."
     - **What's been hard:** "Lessons weren't about things you actually need."
     - **Your goal:** "Handle basic client and professional situations in about {milestone.range}" (or "…before {upcomingText}" when present).
   - Beginner:
     - **Right now:** same as above.
     - **What's held you back:** "You weren't sure you'd have time."
     - **Your goal:** same as above.

   For `want_to_improve`, use: "Mandarin isn't holding you back, but you want it to be stronger."

   Buttons: primary "That's me" (`next()`, track `reflectionConfirmed`), secondary "Change something" (jump to `using_pain`, track `reflectionEdited`). Add a `jumpTo(step)` prop to `StepProps` for this.

3. **Plan step** (`PlanStep`):
   - Show the milestone with its time range under the summary: "First milestone: {milestone.text}, in about {milestone.range}."
   - Add a short "Built around what you told us" list: up to 3 lines, mapping each selected learning pain or hesitation to how the plan answers it. Put the mapping in `reflection.ts`:
     - `not_relevant` / `apps_felt_like_games` → "Every lesson uses your situations, not textbook scenarios"
     - `forget_words` → "Quick reviews bring words back before you forget them"
     - `freeze_speaking` / `no_practice` → "Practice conversations before the real one"
     - `inconsistent` / `no_time` → "{minutes}-minute lessons that fit your week"
     - `plateau` → "Starts above what you already know"
     - `tones` / `seems_too_hard` → "Pinyin on everything and extra tone help"
     - `dont_know_where_start` → "A clear first step, every day"
     - `worried_quit` → "Small daily goals so you keep going"
   - Remove internal jargon from this screen: no "Huahua", no "Journeys". Rename "Your first Journeys" to "Your first lessons", and the footer to "Lessons keep adjusting as you learn."

4. **Lesson generation input.** ASK FIRST. Do not change `app/api/onboarding/activate/route.ts` or any generation prompt yet. Propose how the using-pain, timing and upcoming-event context should reach the first generated lesson (e.g. appended to `learningGoal`, or a new field). Note: free text going into prompts needs sanitizing. Wait for approval.

STOP and check in.

---

## Phase 6: Commit and paywall

1. **Commitment step:** change the CTA to "I'm ready, start my plan" (it currently says "show me my plan", but the next screen is the paywall). Replace the "Add Huahua anytime" chip with "Practice conversations included". Leave the name field as is.
2. **Paywall copy** (`activationCopy` in `PaywallStep.tsx` → `OnboardingUpgradeClient`):
   - Headline by top using pain, with fallback by path:
     - work `stay_quiet` / `rely_on_translator`: "Stop sitting out of Mandarin conversations at work"
     - `cant_keep_going`: "Go past hello in your next Mandarin conversation"
     - `missing_opportunities`: "Stop missing chances because of Mandarin"
     - heritage `family_switches` / `understand_cant_reply` / `limited_with_elders`: "Finally reply to your family in Mandarin"
     - fallback, learner path: "Finally use the Mandarin you've studied"
     - fallback, beginner path: "Your first real Mandarin conversation, in {minutes} minutes a day"
   - Subline: "{minutes} minutes a day, {days}. Built around {interestPhrase}."
   - Make the desktop and mobile headline, subline and CTA identical. CTA on both: "Start my plan".
   - Benefits: exactly 3 on BOTH layouts. Use the same pain → benefit mapping as the plan step, filling to 3 from defaults ("Lessons built around your situations", "Practice conversations before the real one", "Quick reviews that fit your day"). Remove the 6-item mobile list and all jargon ("Journeys", "Huahua", "Proactive messages", "Monthly texting allowance").
   - Mobile shows "Your first 2 lessons" and a "Speaking practice" row. Keep the lessons; remove the speaking row unless pronunciation was completed.
   - Desktop: add the first two lesson titles. Desktop currently doesn't show them.
   - Social proof: show the top `matchReviews` result (quote + role) under the price on both layouts, replacing the founder quote. Keep the CTCSOL credibility line.
   - Refund line next to the price: ASK FIRST. Ask me for the exact refund policy wording before adding it. Do not invent terms.
3. **"Not now"** must stop dumping people on the homepage. ASK FIRST, using what you learned about `save-email` in Phase 0. Proposed behaviour: "Not now" opens an inline panel ("Want us to hold your plan? We'll email it to you, plus a reminder."), with an email field that calls save-email, and a "No thanks" link that keeps the current routing. If timing is `this_week`/`this_month`/`upcoming_event`, word it as "a reminder before {upcomingText or 'then'}".
4. Update `tests/e2e/onboarding-checkout.spec.ts` for the new CTA text.

STOP and check in.

---

## Phase 7: Final QA

- `npm run test:onboarding`, `npm run test:pronunciation`, `npm run lint`, `npx tsc --noEmit`, `npm run test:e2e`.
- Manually run both paths at 375px wide and on desktop, and confirm:
  - the progress bar never goes backwards
  - Back works from every new step
  - refresh mid-flow resumes correctly
  - `?restart=1` clears the new fields
  - a saved state from before this change resumes at the first new step
- Grep the onboarding and paywall UI for "Huahua", "Journey" and "Island" in user-facing strings and list any left.
- Report the final step count for each path.

## Out of scope

Pricing changes, Stripe, the phone/texting steps, the quiz question bank, and anything outside onboarding and the paywall.
