# Story 3.2: Conteneur de Quête (Quest Sandbox)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a crewmate,
I want voir une interface de quête optimisée (tiers inférieur pour le pouce),
so that résoudre ma mission tout en gardant un œil sur mon environnement réel.

## Acceptance Criteria

1. **Quest Sandbox Layout**: The `QuestView` component (`components/game/quest-view.tsx`) is refactored into a proper "Quest Sandbox" container with a clear separation: instructions/context at top, interactive quest content in the middle, and action buttons (submit + flee) in the bottom thumb zone. [Source: epics.md#L232-L244, ux-design-specification.md#L320-L323]
2. **Interactive Quest Content Area**: Replace the current placeholder ("Zone d'interaction — Prochaine mise à jour") with a dynamic quest renderer that dispatches to the correct quest type component based on `quest.type`. For this story, support `true-false` and `qcm` types. [Source: epics.md#L232-L244, epic-2-retro Prep Task #4]
3. **True/False Quest Component**: A `QuestTrueFalse` component renders two large buttons ("VRAI" / "FAUX") in the thumb zone. Tapping the correct answer triggers success. Tapping the wrong answer shows inline error feedback. [Source: quests.json true-false type, ux-design-specification.md#L364]
4. **QCM Quest Component**: A `QuestQCM` component renders multiple-choice options as large tappable cards. The quest JSON `instruction` field contains the question text; a new `options` field (array of `{label: string, value: string}`) provides the choices; a new `answer` field identifies the correct option. Tapping the correct option triggers success. [Source: quests.json qcm type, ux-design-specification.md#L364]
5. **Quest Data Model Extension**: Extend the `Quest` type in `types/quest.ts` to include optional fields: `options?: QuestOption[]` and `answer?: string`. Update `quests.json` to include `options` and `answer` for all quests. [Source: types/quest.ts, epic-2-retro Prep Task #2]
6. **Immediate Validation (No Confirm Step)**: Quest answers are validated immediately on tap — no "Submit" button needed. Correct answer → success state. Wrong answer → inline error with option to retry. [Source: ux-design-specification.md#L364 "Validation Live"]
7. **Success State**: On correct answer: (a) haptic feedback (double vibration `[50, 50, 50]`), (b) visual success flash (green border pulse), (c) quest marked as answered in local state. The success overlay/redirect is NOT in scope (Story 3.4). [Source: ux-design-specification.md#L357, epics.md#L256]
8. **Failure State**: On wrong answer: (a) haptic feedback (long vibration `[200]`), (b) visual error flash (red border pulse), (c) option to retry (same quest, reset selection). [Source: ux-design-specification.md#L358]
9. **Flee Button Preserved**: The "Abandonner / Fuir" button remains always visible at the bottom of the quest sandbox, below the quest interaction area. Behavior unchanged from Story 3.1. [Source: epics.md#L243, ux-design-specification.md#L353]
10. **Thumb-Driven Design**: All interactive elements (answer buttons, flee button) are in the lower 2/3 of the screen. Minimum 44x44px touch targets. `touch-manipulation` CSS on all buttons. [Source: ux-design-specification.md#L216, L375, L390, NFR-A1]
11. **Tactical Terminal Aesthetic**: Quest interaction components follow the established Tactical Terminal design: Orbitron headers, Rajdhani body/buttons, glassmorphic cards, dark background, primary accent colors. [Source: story 3.1 Dev Notes, ux-design-specification.md#L200-L211]
12. **Accessibility**: `prefers-reduced-motion` disables success/error animations. ARIA labels on all answer buttons. Keyboard navigation support (Tab + Enter). High contrast (4.5:1 minimum). [Source: ux-design-specification.md#L388-L391, epic-2-retro Action Item #1]
13. **No Dead End**: Every error state provides a clear recovery path. If quest data is malformed (missing options/answer), show error with "Return to Game Home" link. [Source: architecture.md#L144]

## Tasks / Subtasks

- [x] **Task 1: Extend Quest Data Model** (AC: 5)
  - [x] Add `QuestOption` interface to `types/quest.ts`: `{ label: string, value: string }`
  - [x] Add optional `options?: QuestOption[]` and `answer?: string` fields to `Quest` interface
  - [x] Update `lib/constants/quests.json` — add `options` array and `answer` field to all 9 quests
  - [x] For `true-false` quests: `options: [{label: "VRAI", value: "true"}, {label: "FAUX", value: "false"}]`, `answer: "true"` or `"false"`
  - [x] For `qcm` quests: extract options from instruction text into structured `options` array, set `answer` to correct value

- [x] **Task 2: Quest Renderer Dispatcher** (AC: 2)
  - [x] Create `components/game/quest-renderer.tsx` — receives `Quest` + callbacks, dispatches to type-specific component
  - [x] Switch on `quest.type`: `"true-false"` → `<QuestTrueFalse />`, `"qcm"` → `<QuestQCM />`
  - [x] Fallback for unsupported types: show error with "Return to Game Home" link
  - [x] Validate quest has required fields (`options`, `answer`) before rendering — show error if malformed

- [x] **Task 3: QuestTrueFalse Component** (AC: 3, 6, 7, 8, 10, 11, 12)
  - [x] Create `components/game/quest-true-false.tsx`
  - [x] Render two large buttons: "VRAI" (green accent) and "FAUX" (red accent) in thumb zone
  - [x] On tap: compare selected value to `quest.answer`
  - [x] Correct → call `onSuccess()` callback, trigger haptic `[50, 50, 50]`, green border pulse animation
  - [x] Wrong → call `onError()` callback, trigger haptic `[200]`, red border pulse animation, allow retry
  - [x] Buttons: min-h-[56px], touch-manipulation, ARIA labels, keyboard accessible
  - [x] `prefers-reduced-motion`: skip pulse animations

- [x] **Task 4: QuestQCM Component** (AC: 4, 6, 7, 8, 10, 11, 12)
  - [x] Create `components/game/quest-qcm.tsx`
  - [x] Render options as large tappable cards (glassmorphic style, full-width)
  - [x] On tap: compare selected value to `quest.answer`
  - [x] Correct → call `onSuccess()` callback, trigger haptic `[50, 50, 50]`, highlight correct option green
  - [x] Wrong → call `onError()` callback, trigger haptic `[200]`, highlight wrong option red, allow retry
  - [x] Cards: min-h-[48px], touch-manipulation, ARIA labels, keyboard accessible
  - [x] `prefers-reduced-motion`: skip highlight animations

- [x] **Task 5: Refactor QuestView into Quest Sandbox** (AC: 1, 9, 10, 11)
  - [x] Refactor `components/game/quest-view.tsx` to integrate `QuestRenderer`
  - [x] Layout: quest header (title + duration badge) → instruction text → `<QuestRenderer />` → flee button
  - [x] Remove placeholder div ("Zone d'interaction — Prochaine mise à jour")
  - [x] Pass `onSuccess` and `onError` callbacks from QuestView to QuestRenderer
  - [x] `onSuccess`: update Zustand store `questAnswered: true` (new field), trigger success haptic
  - [x] `onError`: no store update, just visual feedback
  - [x] Flee button remains at bottom, unchanged behavior

- [x] **Task 6: Zustand Store — Quest Answer State** (AC: 7)
  - [x] Add `questAnswered: boolean` to GameStore (default `false`)
  - [x] Add `setQuestAnswered(answered: boolean)` action
  - [x] Reset `questAnswered` in `clearQuest()` and `reset()`
  - [x] Note: quest completion recording in Redis is Story 3.3 scope, NOT this story

- [x] **Task 7: Testing** (AC: 1-13)
  - [x] Unit test: `quest-renderer.test.tsx` — dispatches to correct component, handles unsupported types, validates quest data
  - [x] Unit test: `quest-true-false.test.tsx` — renders buttons, correct/wrong answer handling, haptic calls, accessibility
  - [x] Unit test: `quest-qcm.test.tsx` — renders options, correct/wrong answer handling, haptic calls, accessibility
  - [x] Unit test: `quest-view.test.tsx` — update existing tests for new layout with QuestRenderer integration
  - [x] Unit test: `game-store.test.ts` — test new `questAnswered` field and `setQuestAnswered` action

## Dev Notes

### Architecture Compliance

**State Management Pattern:**
- Zustand store (`lib/store/game-store.ts`) for client-side quest answer state
- New field `questAnswered: boolean` tracks if current quest has been answered correctly
- Quest completion recording in Redis is Story 3.3 — NOT this story
- Response wrapper: `{ success: boolean, data?: T, error?: string }` — follow existing pattern
- No new server actions needed — all quest interaction is client-side only

**Redis Key Pattern:**
- Game state: `game:{gameId}:state` (existing, read-only for this story)
- Quest completion data will be added in Story 3.3 (NOT this story)

**Error Handling:**
- All error states must provide clear messaging and recovery path
- Use standardized error codes from `lib/constants/error-codes.ts`
- Follow "No Dead End" principle: always provide a way back to `/game/[id]`
- New error scenario: malformed quest data (missing options/answer) → show ErrorView

**Data Flow:**
```
Quest Page loads quest → QuestView renders sandbox layout
  → QuestRenderer dispatches to QuestTrueFalse or QuestQCM
  → User taps answer → immediate validation (client-side)
  → Correct: haptic + green flash + questAnswered=true
  → Wrong: haptic + red flash + retry allowed
  → Flee: clearQuest() + router.push(/game/[id])
```

### Technical Requirements

**Dependencies (all already installed — NO new dependencies):**
- `next` 16.1.6 — App Router, routing
- `framer-motion` v12.33.0 — success/error pulse animations
- `zustand` v5.0.11 — quest answer state
- `lucide-react` v0.563.0 — icons (Check, X, AlertTriangle)
- `react` 19.2.3 — hooks

**No new dependencies required.**

**Component Architecture:**
```
app/game/[id]/quest/page.tsx              (NO CHANGE - already loads quest + renders QuestView)
  └── <QuestView>                          (MODIFY - components/game/quest-view.tsx)
        ├── Quest header (title + duration badge)   — NO CHANGE
        ├── Quest instruction                       — NO CHANGE
        ├── <QuestRenderer>                         — NEW (components/game/quest-renderer.tsx)
        │     ├── <QuestTrueFalse />                — NEW (components/game/quest-true-false.tsx)
        │     └── <QuestQCM />                      — NEW (components/game/quest-qcm.tsx)
        └── "Abandonner" flee button                — NO CHANGE (stays at bottom)
```

### UI/UX Requirements

**Quest Sandbox Layout (Mobile-First, Thumb-Driven):**
```
┌─────────────────────────┐
│ QUEST ACTIVE    ● SHORT │  ← Header (Orbitron) + Duration badge — UNCHANGED
├─────────────────────────┤
│                         │
│  Quest Title            │  ← Orbitron, large — UNCHANGED
│  ─────────────────────  │
│  Instruction text here  │  ← Rajdhani, readable — UNCHANGED
│                         │
├─────────────────────────┤  ← NEW: Interactive Quest Area
│                         │
│  ┌───────────────────┐  │  ← True/False: Two large buttons
│  │     ✓  VRAI       │  │     OR
│  └───────────────────┘  │  ← QCM: Multiple choice cards
│  ┌───────────────────┐  │
│  │     ✕  FAUX       │  │
│  └───────────────────┘  │
│                         │
├─────────────────────────┤
│  ╔═══════════════════╗  │
│  ║  ✕ ABANDONNER     ║  │  ← Flee button — UNCHANGED
│  ╚═══════════════════╝  │
└─────────────────────────┘
```

**True/False Button Styling:**
- "VRAI" button: `border-[#2DA44E] text-[#2DA44E]` (green accent)
- "FAUX" button: `border-[#DA3633] text-[#DA3633]` (red accent)
- Both: glassmorphic card style, min-h-[56px], full-width, font-rajdhani font-bold uppercase

**QCM Option Card Styling:**
- Default: `border-primary/20 bg-black/50 backdrop-blur-sm` (glassmorphic)
- Selected correct: `border-[#2DA44E] bg-[#2DA44E]/10` (green highlight)
- Selected wrong: `border-[#DA3633] bg-[#DA3633]/10` (red highlight)
- Each card: min-h-[48px], full-width, font-rajdhani, touch-manipulation

**Success/Error Feedback Animations (Framer Motion):**
- Success: green border pulse (scale 1→1.02→1, border color flash), duration 300ms
- Error: red border pulse (shake -2px→2px→0), duration 300ms
- Both: `prefers-reduced-motion` → skip animation, just show color change

**Accessibility:**
- High contrast ratio (4.5:1 minimum)
- Touch targets: 44x44px minimum (buttons are 56px+ height)
- `prefers-reduced-motion`: disable pulse/shake animations
- ARIA labels: `aria-label="Répondre Vrai"`, `aria-label="Répondre Faux"`, `aria-label="Option A: [text]"`
- Keyboard: Tab to navigate options, Enter to select
- Role: `role="radiogroup"` for QCM options, `role="group"` for True/False

### File Structure Requirements

```
types/
  └── quest.ts                    # MODIFY - Add QuestOption interface, options/answer fields

lib/constants/
  └── quests.json                 # MODIFY - Add options[] and answer to all 9 quests

components/game/
  ├── quest-view.tsx              # MODIFY - Integrate QuestRenderer, remove placeholder
  ├── quest-renderer.tsx          # NEW - Quest type dispatcher
  ├── quest-true-false.tsx        # NEW - True/False quest component
  └── quest-qcm.tsx              # NEW - QCM quest component

lib/store/
  └── game-store.ts               # MODIFY - Add questAnswered, setQuestAnswered

tests/unit/
  ├── quest-renderer.test.tsx     # NEW - Quest renderer dispatcher tests
  ├── quest-true-false.test.tsx   # NEW - True/False component tests
  ├── quest-qcm.test.tsx         # NEW - QCM component tests
  ├── quest-view.test.tsx         # MODIFY - Update for new layout
  └── game-store.test.ts         # MODIFY - Test questAnswered field

```

### Previous Story Intelligence

**From Story 3.1 (Routage Dynamique & Scan QR) — DONE:**
- `QuestView` component exists at `components/game/quest-view.tsx` with placeholder content area
- Placeholder div: `"Zone d'interaction — Prochaine mise à jour"` — this is what we replace
- `QuestView` receives `quest: Quest` and `gameId: string` props
- `handleFlee` function: clears quest from store + navigates to `/game/[id]` — keep unchanged
- Duration badge colors and labels already defined as `Record<QuestDuration, string>`
- Quest page (`app/game/[id]/quest/page.tsx`) handles all validation — NO changes needed there
- Haptic pattern: `navigator.vibrate([duration])` with try/catch for safety
- `clearQuest()` already exists in Zustand store

**Code Review Fixes from Story 3.1 (MUST NOT regress):**
- H1: `clearQuest()` called in flee handler — KEEP this
- H2: `useSearchParams()` wrapped in `<Suspense>` — DO NOT touch quest page.tsx
- M1: `router.push()` for SPA navigation — DO NOT use `window.location.href`
- M4: Duration colors typed as `Record<QuestDuration, string>` — follow same pattern
- L1: Use `bg-background` Tailwind variable, not hardcoded `bg-[#0D1117]`
- L2: `aria-hidden` on visible span when sr-only duplicate exists

**Key Code Review Patterns to Follow (from Epic 2 retro):**
- **(a) State sync**: Always update Zustand store after state changes
- **(b) Accessibility**: `prefers-reduced-motion`, keyboard navigation, ARIA labels, touch targets (44px min)
- **(c) Error recovery**: Inline error display, functional retry, "No Dead End" principle
- **(d) No `setState` during render** — use `useEffect` for derived state
- **(e) `'use client'` directive** for all Framer Motion and hook-using components
- **(f) Hydration-safe**: no `localStorage` during SSR

**Patterns established in Epic 2 + Story 3.1:**
1. Server Actions in `lib/redis/actions.ts` for all Redis mutations
2. Error codes from `lib/constants/error-codes.ts`
3. Orbitron for headers, Rajdhani for body, JetBrains Mono for technical data
4. Haptic: `navigator.vibrate([duration])` with try/catch
5. Hydration-safe: no localStorage during SSR
6. Atomic Redis updates via `atomicUpdate` (WATCH/MULTI/EXEC)
7. `'use client'` directive for all Framer Motion components
8. `useReducedMotion()` hook for accessibility
9. `willChange: transform` for GPU acceleration on animations
10. Tailwind primary color variables instead of hardcoded hex

### Epic 3 Context

**This Story's Role in Epic 3:**
- Story 3.1: Quest routing & scan — DONE ✅
- **Story 3.2: Quest sandbox container (THIS STORY)** — interactive quest UI with answer validation
- Story 3.3: Mini-games MVP (QCM, Vrai/Faux) — quest completion recording in Redis + progress update
- Story 3.4: Auto-redirect home after success — celebration overlay + auto-redirect loop

**What this story enables:**
- Transforms the quest page from display-only to interactive
- Creates the quest renderer pattern for dispatching to type-specific components
- Establishes answer validation flow (client-side) used by Story 3.3
- Provides the `questAnswered` state that Story 3.3 will use to trigger Redis recording
- Creates reusable quest type components extensible for future types

**What this story does NOT do (scope boundaries):**
- Does NOT record quest completion in Redis (Story 3.3)
- Does NOT update `questsCompleted` / `questsTotal` counters (Story 3.3)
- Does NOT implement success overlay or auto-redirect (Story 3.4)
- Does NOT handle Impostor-specific view (Epic 4)
- Does NOT implement `form` or `single-input` quest types (future)
- After correct answer, quest shows success state but user must manually flee or wait for Story 3.4

### Epic 2 Retrospective Action Items (MUST follow)

**Dev Checklist (from retro Action Item #1):**
- [x] State sync: Zustand store updated after every state change (questAnswered)
- [x] Accessibility: prefers-reduced-motion, keyboard navigation, ARIA labels, touch targets
- [x] Error recovery: inline error display, functional retry, "No Dead End" principle

**Mandatory Test Gate (from retro Action Item #2):**
After implementation AND after code review, run:
```bash
pnpm lint
pnpm test
```

### Latest Technical Information

**Next.js 16.1.6:**
- Quest page already uses `'use client'` + `useSearchParams()` in Suspense — NO changes needed
- New components are all client components (Framer Motion + hooks)

**Framer Motion v12.33.0:**
- Use `motion` components with `'use client'` directive
- `useReducedMotion()` hook for accessibility
- For success/error pulse: `animate={{ scale: [1, 1.02, 1] }}` or `animate={{ x: [-2, 2, 0] }}`
- `transition={{ duration: 0.3 }}` for quick feedback
- GPU-accelerated: prefer `transform` and `opacity` properties

**Zustand v5.0.11:**
- Shallow equality for selectors
- Extend existing store — do NOT create a separate quest store
- Add `questAnswered` alongside existing `currentQuest`

**Tailwind CSS v4:**
- Custom font classes: `font-orbitron`, `font-rajdhani`
- JetBrains Mono via `font-[family-name:var(--font-jetbrains-mono)]`
- Dark theme variables already configured
- Use `touch-manipulation` for mobile button optimization
- Use `bg-background` not hardcoded `bg-[#0D1117]`

### Testing Requirements

**Unit Tests (Vitest):**
- `quest-renderer.test.tsx`: Dispatches to correct component by type, handles unsupported types, validates quest data (missing options/answer)
- `quest-true-false.test.tsx`: Renders VRAI/FAUX buttons, correct answer triggers onSuccess, wrong answer triggers onError, haptic calls, ARIA labels, keyboard navigation
- `quest-qcm.test.tsx`: Renders all options, correct answer triggers onSuccess, wrong answer triggers onError, haptic calls, ARIA labels, keyboard navigation
- `quest-view.test.tsx`: Update existing — verify QuestRenderer is rendered instead of placeholder, flee button still works
- `game-store.test.ts`: Test `questAnswered` field, `setQuestAnswered` action, reset clears questAnswered

- Full flow: SCAN → quest page → answer correctly → success state visible
- Wrong answer → error feedback → retry → correct answer
- True/False quest interaction (both correct and wrong)
- QCM quest interaction (both correct and wrong)
- Flee button works during/after quest interaction

**Test Gate Command Sequence:**
```bash
pnpm lint
pnpm test
```

### Implementation Strategy

**Phase 1: Data Model Extension**
1. Extend `types/quest.ts` with `QuestOption`, `options`, `answer` fields
2. Update `lib/constants/quests.json` with structured options and answers

**Phase 2: Quest Type Components**
1. Create `components/game/quest-true-false.tsx`
2. Create `components/game/quest-qcm.tsx`
3. Create `components/game/quest-renderer.tsx` (dispatcher)

**Phase 3: Integration**
1. Refactor `components/game/quest-view.tsx` to use QuestRenderer
2. Update `lib/store/game-store.ts` with `questAnswered` state

**Phase 4: Testing**
1. Unit tests for all new components + updated components
2. Update existing quest-view tests

### Known Considerations

**Quest JSON — Structured Options:**
- Current quests.json has options embedded in `instruction` text (e.g., "A) 4815 B) 1623...")
- This story extracts options into a structured `options` array for programmatic rendering
- The `instruction` field is simplified to contain only the question text
- `answer` field contains the `value` of the correct option

**Answer Validation — Client-Side Only:**
- All answer validation happens client-side (compare selected value to `quest.answer`)
- No server action needed — quest data is from static JSON
- This is acceptable for MVP — server-side validation not needed for party game

**Success State — No Redirect Yet:**
- After correct answer, the quest shows a success state (green highlight)
- User must manually tap "Abandonner" to return home, OR wait for Story 3.4 auto-redirect
- Story 3.4 will add the celebration overlay + auto-redirect after 2 seconds

**Impostor Handling — NOT in scope:**
- Epic 4 handles Impostor-specific quest view
- For now, if an Impostor accesses the quest page, they see the same interactive content
- This is acceptable for MVP — Impostor camouflage comes later

### Project Structure Notes

- Follows hybrid organization from architecture.md
- New quest type components in `components/game/` (alongside existing game components)
- Quest renderer dispatcher in `components/game/` (composition pattern)
- Store extension in `lib/store/game-store.ts` (single store pattern)
- Quest data model extension in `types/quest.ts` (alongside existing types)

### References

- [Epic 3 Story 3.2](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L232-L244)
- [Architecture: Project Structure](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L177-L211)
- [Architecture: Error Handling](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L144)
- [Architecture: Frontend Architecture](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L104-L107)
- [UX Design: Quest Sandbox](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L320-L323)
- [UX Design: Button Hierarchy](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L349-L353)
- [UX Design: Feedback Patterns](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L355-L359)
- [UX Design: Form & Interaction](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L361-L365)
- [UX Design: Thumb Zone](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L216)
- [UX Design: Haptic Feedback](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L357)
- [Story 3.1 - Routage Dynamique](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/3-1-routage-dynamique-scan-qr.md)
- [Epic 2 Retrospective](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/epic-2-retro-2026-02-08.md)
- [Framer Motion v12 Docs](https://motion.dev/docs)

## Senior Developer Review (AI)

**Reviewer:** Omi (via Cascade) on 2026-02-08
**Outcome:** Changes Requested → Fixed

### Findings (8 total: 3 HIGH, 3 MEDIUM, 2 LOW)

**🔴 HIGH — Fixed:**
- **H1**: Buttons not disabled after wrong answer → double-tap could fire `onError` multiple times without retry. Fixed by adding guard in `useQuestAnswer` hook + `disabled={answered || failed}`.
- **H2**: `handleAnswer` callable after success via keyboard despite `disabled` on Framer Motion button. Fixed by `if (isCorrect !== null) return;` guard in hook.

**🟡 MEDIUM — Fixed:**
- **M1**: `sprint-status.yaml` modified in git but missing from story File List. Fixed in File List below.
- **M2**: ~30 lines of duplicated `handleAnswer`/`handleRetry` logic between `QuestTrueFalse` and `QuestQCM`. Fixed by extracting `hooks/use-quest-answer.ts` shared hook.
- **M3**: `willChange: "transform"` permanently applied to all buttons (GPU memory waste on mobile). Fixed to apply only on the selected/animating button.

**🟢 LOW — Noted (not fixed):**
- **L1**: Hardcoded hex colors (`#2DA44E`, `#DA3633`) instead of Tailwind CSS variables. Deferred — would require design system variable setup.
- **L2**: No regression test for double-call prevention. Fixed as part of H1/H2 (6 new tests added).

### Test Gate After Review Fixes
- Lint: ✅
- Unit tests: 194 passed (6 new regression tests)

## Change Log


## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (Cascade)

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- **Task 1**: Extended `Quest` type with `QuestOption` interface, `options?: QuestOption[]` and `answer?: string` fields. Updated all 9 quests in `quests.json` with structured options arrays and answer fields. QCM instruction text simplified to question-only (options extracted to structured array).
- **Task 2**: Created `QuestRenderer` dispatcher component. Validates quest data (options/answer present), dispatches to `QuestTrueFalse` or `QuestQCM` by type, shows error with "Retour au Game Home" link for unsupported types or malformed data.
- **Task 3**: Created `QuestTrueFalse` component with VRAI/FAUX buttons, green/red accent colors, haptic feedback ([50,50,50] success, [200] error), Framer Motion pulse/shake animations, `prefers-reduced-motion` support, retry on wrong answer, ARIA labels, `role="group"`, min-h-[56px] touch targets.
- **Task 4**: Created `QuestQCM` component with glassmorphic option cards, letter-prefixed labels (A/B/C/D), `role="radiogroup"` + `role="radio"`, same haptic/animation/accessibility patterns as TrueFalse, min-h-[48px] touch targets.
- **Task 5**: Refactored `QuestView` to integrate `QuestRenderer` replacing the placeholder div. Added `handleSuccess` (sets `questAnswered: true`) and `handleError` (no-op, visual only) callbacks. Fixed `bg-[#0D1117]` → `bg-background` per Story 3.1 code review L1.
- **Task 6**: Added `questAnswered: boolean` (default false) and `setQuestAnswered()` action to GameStore. Reset in both `clearQuest()` and `reset()`.

### File List

**New files:**
- `components/game/quest-renderer.tsx` — Quest type dispatcher component
- `components/game/quest-true-false.tsx` — True/False quest interaction component
- `components/game/quest-qcm.tsx` — QCM quest interaction component
- `hooks/use-quest-answer.ts` — Shared quest answer logic hook (review fix M2)
- `tests/unit/quest-renderer.test.tsx` — 8 tests for quest renderer
- `tests/unit/quest-true-false.test.tsx` — 15 tests for true/false component (incl. 3 review regression tests)
- `tests/unit/quest-qcm.test.tsx` — 16 tests for QCM component (incl. 3 review regression tests)

**Modified files:**
- `types/quest.ts` — Added QuestOption interface, options/answer fields to Quest
- `lib/constants/quests.json` — Added structured options and answer to all 9 quests
- `components/game/quest-view.tsx` — Integrated QuestRenderer, removed placeholder, added callbacks, fixed bg-background
- `lib/store/game-store.ts` — Added questAnswered field, setQuestAnswered action, reset in clearQuest/reset
- `tests/unit/quest-pool.test.ts` — Added 6 tests for quest data model (options/answer validation)
- `tests/unit/quest-view.test.tsx` — Updated mock, added 2 tests for QuestRenderer integration
- `tests/unit/game-store.test.ts` — Added 5 tests for questAnswered state
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story 3-2 status updated
