# Story 3.1: Routage Dynamique & Scan QR

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a crewmate,
I want scanner un QR code (URL avec paramètre `duration`),
so that être projeté immédiatement dans une quête aléatoire de la durée correspondante.

## Acceptance Criteria

1. **Quest Route Exists**: The route `/game/[id]/quest` exists as a new page under `app/game/[id]/quest/page.tsx`. It reads the `duration` query parameter from the URL. [Source: epics.md#L219-L231, architecture.md#L23, L129]
2. **Duration Validation**: The `duration` query param must be one of `short`, `medium`, `long`. Any other value (missing, empty, invalid) displays a clear error with a "Return to Game Home" link. [Source: epics.md#L228-L230, architecture.md#L144]
3. **Quest Data Source**: Quest content is loaded from a static JSON file (`lib/constants/quests.json` or similar). The JSON contains quest pools organized by duration (`short`, `medium`, `long`), each with 2-3 example quests minimum. [Source: epic-2-retro Prep Task #1, #2]
4. **Random Quest Selection**: When a Crewmate accesses `/game/[id]/quest?duration=short`, the system randomly selects one quest from the `short` pool and displays it. Selection is client-side (no server action needed for random draw). [Source: epics.md#L229]
5. **Quest Display**: The selected quest is displayed with its title, instructions, and type indicator. The quest page uses the Tactical Terminal aesthetic. Content is visible only to Crewmates (Impostor handling is Epic 4). [Source: epics.md#L230-L231, ux-design-specification.md#L320-L323]
6. **Player & Game Validation**: The quest page validates that: (a) the game exists and is `IN_PROGRESS`, (b) the current user is a player in the game, (c) the player has a role assigned. Invalid states show error with recovery path. [Source: architecture.md#L144, error-codes.ts]
7. **SCAN Button Activation**: The SCAN button on Game Home (`components/game/scan-button.tsx`) is activated (no longer disabled). It links to `/game/[id]/quest?duration=short` as a default (QR codes will provide the actual duration). [Source: scan-button.tsx comment "Future: add href prop for Epic 3", story 2.3 AC#3]
8. **Instant Load (<300ms)**: The quest page loads instantly from the SCAN button or direct URL access. No perceptible delay between navigation and quest display. [Source: ux-design-specification.md#L177, NFR-P2]
9. **Quest TypeScript Types**: New types are created: `Quest`, `QuestType`, `QuestDuration`, `QuestPool`. Types support extensible quest types (`true-false`, `qcm`, `form`, `single-input`). [Source: epic-2-retro Prep Task #2]
10. **No Dead End**: Every error state on the quest page provides a clear "Return to Game Home" action. The abandon/flee button is always present. [Source: architecture.md#L144, ux-design-specification.md#L353, epics.md#L243]
11. **Mobile-First / Thumb-Driven**: Quest page follows thumb-driven design — instructions at top, action buttons in lower third. Minimum 44x44px touch targets. [Source: ux-design-specification.md#L216, L375, L390]
12. **Haptic Feedback**: Trigger vibration on quest load (short pulse confirming successful scan transition). [Source: ux-design-specification.md#L357]

## Tasks / Subtasks

- [x] **Task 1: Quest Data Model & Types** (AC: 3, 9)
  - [x] Create `types/quest.ts` with `Quest`, `QuestType`, `QuestDuration`, `QuestPool` types
  - [x] `QuestType`: `'true-false' | 'qcm' | 'form' | 'single-input'`
  - [x] `QuestDuration`: `'short' | 'medium' | 'long'`
  - [x] `Quest`: `{ id: string, type: QuestType, duration: QuestDuration, title: string, instruction: string, ... }`
  - [x] Ensure types are extensible for future quest types (mini-game, etc.)

- [x] **Task 2: Quest JSON Data File** (AC: 3)
  - [x] Create `lib/constants/quests.json` with quest pools by duration
  - [x] Include 2-3 example quests per duration (short, medium, long)
  - [x] Quest types: at least `true-false` and `qcm` represented
  - [x] Content in French (game language)
  - [x] Create `lib/constants/quest-pool.ts` helper to load and type the JSON

- [x] **Task 3: Quest Route Page** (AC: 1, 2, 5, 6, 8, 10, 11)
  - [x] Create `app/game/[id]/quest/page.tsx` as a `'use client'` component
  - [x] Read `duration` from `useSearchParams()` and `id` from `useParams()`
  - [x] Validate `duration` is one of `short | medium | long`
  - [x] Fetch game state via `fetchGame` and validate game/player/role
  - [x] Select random quest from the matching duration pool
  - [x] Display quest with Tactical Terminal aesthetic
  - [x] Show "Abandonner" (flee) button always visible at bottom
  - [x] Show error view with recovery for all invalid states
  - [x] Trigger haptic feedback on successful quest load

- [x] **Task 4: Activate SCAN Button** (AC: 7)
  - [x] Update `ScanButton` component to accept `href` prop (string)
  - [x] When `href` is provided and not disabled, render as `next/link` wrapping or use `router.push`
  - [x] Update `GameHome` to pass `href={/game/${gameState.id}/quest?duration=short}` and `disabled={false}`
  - [x] Remove "Bientôt disponible" subtitle when enabled
  - [x] Keep haptic feedback on press

- [x] **Task 5: Quest Display Component** (AC: 5, 11)
  - [x] Create `components/game/quest-view.tsx` — displays a single quest
  - [x] Layout: instruction at top, quest content in middle, action buttons at bottom (thumb zone)
  - [x] Tactical Terminal aesthetic: Orbitron headers, Rajdhani body, dark bg, glassmorphic card
  - [x] Show quest title, instruction text, duration badge
  - [x] Include "Abandonner / Fuir" ghost button (red border) at bottom — navigates back to `/game/[id]`
  - [x] Quest interaction UI is placeholder for Story 3.2/3.3 (display only for now)

- [x] **Task 6: Error Handling for Quest Page** (AC: 2, 6, 10)
  - [x] Add new error codes: `ERR_INVALID_DURATION`, `ERR_NO_QUESTS`, `ERR_QUEST_LOAD_FAILED`
  - [x] Reuse `ErrorView` component for all error states
  - [x] Invalid duration → error with "Return to Game Home" link
  - [x] Game not found / not in progress → error with recovery
  - [x] Player not in game / no role → error with recovery
  - [x] No quests available for duration → error with recovery

- [x] **Task 7: Zustand Store — Quest State** (AC: 5)
  - [x] Add `currentQuest: Quest | null` to GameStore
  - [x] Add `questError: string | null` for quest-specific errors
  - [x] Add `setCurrentQuest(quest: Quest)` and `clearQuest()` actions
  - [x] Keep existing `questsCompleted` / `questsTotal` fields (populated in Story 3.3)

- [x] **Task 8: Testing** (AC: 1-12)
  - [x] Unit test: `quest-pool.ts` — returns typed quests, filters by duration, handles empty pools
  - [x] Unit test: `quest-view.tsx` — renders quest title, instruction, flee button, correct layout
  - [x] Unit test: Quest page — validates duration param, handles invalid values
  - [x] Unit test: Updated `scan-button.tsx` — renders with href, navigates when enabled
  - [x] Unit test: New quest types validate correctly
  - [x] E2E test: Full flow — create game → join → launch → select role → Game Home → click SCAN → quest page loads with quest content
  - [x] E2E test: Invalid duration param → error page with recovery link
  - [x] E2E test: Direct URL access to quest page → validates game/player state
  - [x] E2E test: Flee/abandon button → returns to Game Home
  - [x] E2E test: SCAN button is now enabled on Game Home (no longer shows "Bientôt disponible")

## Dev Notes

### Architecture Compliance

**State Management Pattern:**
- Zustand store (`lib/store/game-store.ts`) for client-side quest state
- Server Actions in `lib/redis/actions.ts` for game state validation (reuse existing `getGame`)
- Response wrapper: `{ success: boolean, data?: T, error?: string }` — follow existing pattern
- Quest selection is CLIENT-SIDE only (random draw from JSON pool) — no new server action needed for quest draw
- Quest completion recording will come in Story 3.3

**Redis Key Pattern:**
- Game state: `game:{gameId}:state` (existing, read-only for this story)
- Quest completion data will be added in Story 3.3 (NOT this story)

**Error Handling:**
- All error states must provide clear messaging and recovery path
- Use standardized error codes from `lib/constants/error-codes.ts`
- Follow "No Dead End" principle: always provide a way back to `/game/[id]`
- New error codes needed: `ERR_INVALID_DURATION`, `ERR_NO_QUESTS`, `ERR_QUEST_LOAD_FAILED`

**Data Flow:**
```
SCAN Button (Game Home) → Link to /game/[id]/quest?duration=X
  → Quest Page reads duration from useSearchParams()
  → Validates game state via fetchGame (existing server action)
  → Selects random quest from JSON pool (client-side)
  → Displays quest via QuestView component
```

### Technical Requirements

**Dependencies (all already installed — NO new dependencies):**
- `next` 16.1.6 — App Router, `useSearchParams`, `useParams`, `Link`
- `framer-motion` v12.33.0 — quest page transitions (optional entrance animation)
- `zustand` v5.0.11 — quest state management
- `lucide-react` v0.563.0 — icons (ArrowLeft, AlertTriangle, Scan, Clock, X)
- `react` 19.2.3 — hooks

**No new dependencies required.**

**Critical: useSearchParams() Usage:**
- `useSearchParams()` is a Client Component hook — page MUST have `'use client'` directive
- Returns `ReadonlyURLSearchParams` — use `.get('duration')` to read the param
- Wrap in `Suspense` boundary if needed for static rendering (Next.js requirement)
- Alternative: use `searchParams` prop on the page component (Server Component approach) — but since we need client interactivity, use the hook

**Component Architecture:**
```
app/game/[id]/quest/page.tsx          (NEW - Quest route page)
  ├── Validates game state + duration
  ├── Selects random quest from pool
  └── <QuestView>                     (NEW - components/game/quest-view.tsx)
        ├── Quest header (title + duration badge)
        ├── Quest instruction
        ├── Quest content placeholder (for Story 3.2/3.3)
        └── "Abandonner" flee button (bottom, thumb zone)

components/game/scan-button.tsx       (MODIFY - add href prop, enable state)
components/game/game-home.tsx          (MODIFY - pass href + disabled=false to ScanButton)
```

### UI/UX Requirements

**Tactical Terminal Aesthetic (consistent with Game Home):**
- Font: `Orbitron` for quest title and page header
- Font: `Rajdhani` for instruction text, labels, buttons
- Font: `JetBrains Mono` for technical data (duration, quest ID)
- Background: Dark `#0D1117`
- Primary accent: `#58A6FF` (Tactical Blue)
- Glassmorphic cards: `bg-black/50 backdrop-blur-sm border border-primary/20`

**Quest Page Layout (Mobile-First, Thumb-Driven):**
```
┌─────────────────────────┐
│ QUEST ACTIVE    ● SHORT │  ← Header (Orbitron) + Duration badge
├─────────────────────────┤
│                         │
│  Quest Title            │  ← Orbitron, large
│  ─────────────────────  │
│  Instruction text here  │  ← Rajdhani, readable
│  explaining what to do  │
│                         │
│  [Quest Content Area]   │  ← Placeholder for Story 3.2/3.3
│  (Coming in next story) │
│                         │
├─────────────────────────┤
│                         │
│  ╔═══════════════════╗  │
│  ║  ✕ ABANDONNER     ║  │  ← Flee button (ghost, red border, thumb zone)
│  ╚═══════════════════╝  │
│                         │
└─────────────────────────┘
```

**Duration Badge Colors:**
- `short`: Green accent (`#2DA44E`)
- `medium`: Yellow/amber accent (`#D29922`)
- `long`: Red accent (`#DA3633`)

**Accessibility:**
- High contrast ratio (4.5:1 minimum)
- Touch targets: 44x44px minimum
- `prefers-reduced-motion`: disable entrance animations
- ARIA labels on interactive elements
- Duration announced via sr-only text

### File Structure Requirements

```
types/
  └── quest.ts                    # NEW - Quest, QuestType, QuestDuration, QuestPool types

lib/constants/
  ├── quests.json                 # NEW - Quest data pools (short/medium/long)
  ├── quest-pool.ts               # NEW - Typed quest pool loader/helper
  └── error-codes.ts              # MODIFY - Add ERR_INVALID_DURATION, ERR_NO_QUESTS, ERR_QUEST_LOAD_FAILED

app/game/[id]/quest/
  └── page.tsx                    # NEW - Quest route page

components/game/
  ├── quest-view.tsx              # NEW - Quest display component
  ├── scan-button.tsx             # MODIFY - Add href prop, enable state
  └── game-home.tsx               # MODIFY - Pass href + disabled=false to ScanButton

lib/store/
  └── game-store.ts               # MODIFY - Add currentQuest, questError, setCurrentQuest, clearQuest

tests/unit/
  ├── quest-pool.test.ts          # NEW - Quest pool helper tests
  ├── quest-view.test.tsx         # NEW - Quest view component tests
  └── quest-page.test.tsx         # NEW - Quest page validation tests

tests/e2e/
  └── quest-routing.spec.ts       # NEW - E2E tests for quest routing flow
```

### Previous Story Intelligence

**From Story 2.3 (Home Cocktail — Game Home) — DONE:**
- `ScanButton` component already has comment: `// Future: add href prop for Epic 3 quest routing`
- `ScanButton` accepts `disabled` and `onClick` props — add `href` prop
- `GameHome` currently passes `disabled={true}` to ScanButton — change to `disabled={false}` with `href`
- `questsCompleted` and `questsTotal` already in Zustand store (default 0)
- Framer Motion v12 patterns established (pulse animation, `useReducedMotion`)
- All fonts loaded: Orbitron, Rajdhani, JetBrains Mono with `display:swap`

**Key Code Review Patterns to Follow (from Epic 2 retro):**
- **(a) State sync**: Always update Zustand store with server response after every mutation
- **(b) Accessibility**: `prefers-reduced-motion`, keyboard navigation, ARIA labels, touch targets (44px min)
- **(c) Error recovery**: Inline error display, functional retry, "No Dead End" principle
- **(d) No `setState` during render** — use `useEffect` for derived state
- **(e) `'use client'` directive** for all Framer Motion and hook-using components
- **(f) Hydration-safe**: no `localStorage` during SSR

**Patterns established in Epic 2:**
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
Story 3.1 is the FIRST story in Epic 3 (Le Cycle "Strike-Quest"):
- **Story 3.1: Quest routing & scan (THIS STORY)** — route, data model, random selection, SCAN activation
- Story 3.2: Quest sandbox container — optimized quest UI with thumb-driven layout
- Story 3.3: Mini-games MVP (QCM, Vrai/Faux) — interactive quest types with completion
- Story 3.4: Auto-redirect home after success — celebration + redirect loop

**What this story enables:**
- Creates the quest route infrastructure for all subsequent stories
- Defines the quest data model used by Stories 3.2, 3.3, 3.4
- Activates the SCAN button (the central UX element)
- Establishes the quest JSON file as the content source (decoupled from code)

**What this story does NOT do (scope boundaries):**
- Does NOT implement quest interaction/completion (Story 3.3)
- Does NOT implement the quest sandbox optimized layout (Story 3.2)
- Does NOT implement auto-redirect after success (Story 3.4)
- Does NOT handle Impostor-specific view (Epic 4)
- Does NOT record quest completion in Redis (Story 3.3)
- Quest content area is a PLACEHOLDER — display only, no interactivity yet

### Epic 2 Retrospective Action Items (MUST follow)

**Dev Checklist (from retro Action Item #1):**
- [ ] State sync: Zustand store updated with server response after every fetch
- [ ] Accessibility: prefers-reduced-motion, keyboard navigation, ARIA labels, touch targets
- [ ] Error recovery: inline error display, functional retry, "No Dead End" principle

**Mandatory Test Gate (from retro Action Item #2):**
After implementation AND after code review, run:
```bash
pnpm lint
pnpm test
pnpm exec playwright test --reporter=line
```

### Latest Technical Information

**Next.js 16.1.6 — useSearchParams:**
- `useSearchParams()` from `next/navigation` — Client Component hook
- Returns `ReadonlyURLSearchParams` — use `.get('duration')` to read query param
- Must be in a `'use client'` component
- For Server Components, use `searchParams` prop on page instead
- Wrap in `<Suspense>` if needed for static rendering optimization

**Framer Motion v12.33.0:**
- Use `motion` components with `'use client'` directive
- `useReducedMotion()` hook for accessibility
- GPU-accelerated: prefer `transform` and `opacity` properties
- Optional entrance animation for quest page: `initial={{ opacity: 0 }} animate={{ opacity: 1 }}`

**Zustand v5.0.11:**
- Shallow equality for selectors
- Extend existing store — do NOT create a separate quest store

**Tailwind CSS v4:**
- Custom font classes: `font-orbitron`, `font-rajdhani`
- JetBrains Mono via `font-[family-name:var(--font-jetbrains-mono)]`
- Dark theme variables already configured
- Use `touch-manipulation` for mobile button optimization

### Testing Requirements

**Unit Tests (Vitest):**
- `quest-pool.test.ts`: Quest pool loads correctly, filters by duration, handles empty pools, returns typed quests
- `quest-view.test.tsx`: Renders quest title, instruction, duration badge, flee button; correct layout structure
- `quest-page.test.tsx`: Validates duration param (valid/invalid/missing), handles game state errors
- `scan-button.test.tsx` (update existing): Renders with href, navigates when enabled, still works when disabled

**E2E Tests (Playwright):**
- Full flow: create → join → launch → role → Game Home → SCAN → quest page with content
- Invalid duration → error with recovery link
- Direct URL access → validates game/player state
- Flee button → returns to Game Home
- SCAN button enabled on Game Home

**Test Gate Command Sequence:**
```bash
pnpm lint
pnpm test
pnpm exec playwright test --reporter=line
```

### Implementation Strategy

**Phase 1: Data Foundation**
1. Create `types/quest.ts` (Quest types)
2. Create `lib/constants/quests.json` (quest data)
3. Create `lib/constants/quest-pool.ts` (typed loader)
4. Add error codes to `error-codes.ts`

**Phase 2: Quest Route**
1. Create `app/game/[id]/quest/page.tsx` (quest route)
2. Create `components/game/quest-view.tsx` (quest display)
3. Update `lib/store/game-store.ts` (quest state)

**Phase 3: SCAN Activation**
1. Update `components/game/scan-button.tsx` (add href prop)
2. Update `components/game/game-home.tsx` (enable SCAN with href)

**Phase 4: Testing**
1. Unit tests for quest pool, quest view, quest page
2. Update existing scan-button tests
3. E2E tests for full quest routing flow
4. Run full test gate: lint + unit + E2E

### Known Considerations

**Quest Content — JSON File Approach:**
- Quest content is decoupled from code (JSON file)
- Easy to add/modify quests without code changes
- JSON file is the single source of truth for quest content
- Content in French for the IRL party context

**SCAN Button — Now Enabled:**
- The SCAN button transitions from disabled (Story 2.3) to enabled (this story)
- Default links to `?duration=short` — in real usage, QR codes will encode the duration
- The `href` prop makes ScanButton a navigation element (Link-based)

**Quest Page — Display Only:**
- This story creates the quest DISPLAY infrastructure
- Quest interaction (answering, completing) comes in Story 3.2/3.3
- The quest content area shows the question/instruction but is NOT interactive yet
- A clear visual indicator should show this is a "view" state

**Impostor Handling — NOT in scope:**
- Epic 4 handles Impostor-specific quest view
- For now, if an Impostor accesses the quest page, they see the same content as Crewmate
- This is acceptable for MVP — Impostor camouflage comes later

### Project Structure Notes

- Follows hybrid organization from architecture.md
- New quest route under `app/game/[id]/quest/` (nested under game dynamic route)
- Quest types in `types/quest.ts` (alongside `types/game.ts`)
- Quest data in `lib/constants/` (alongside `error-codes.ts`)
- Quest components in `components/game/` (alongside existing game components)
- Store extension in `lib/store/game-store.ts` (single store pattern)

### References

- [Epic 3 Story 3.1](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L219-L231)
- [Architecture: Dynamic Routing](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L23)
- [Architecture: Project Structure](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L177-L211)
- [Architecture: Error Handling](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L144)
- [Architecture: Data Flow](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L224-L226)
- [UX Design: Strike-Quest Cycle](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L251-L264)
- [UX Design: Scanner Button](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L315-L318)
- [UX Design: Quest Sandbox](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L320-L323)
- [UX Design: Button Hierarchy](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L349-L353)
- [UX Design: Haptic Feedback](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L357)
- [UX Design: Thumb Zone](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L216)
- [Story 2.3 - Game Home](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/2-3-home-cocktail-game-home.md)
- [Epic 2 Retrospective](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/epic-2-retro-2026-02-08.md)
- [Next.js useSearchParams](https://nextjs.org/docs/app/api-reference/functions/use-search-params)

## Change Log

- 2026-02-08: Story 3.1 implemented — Quest routing infrastructure, data model, SCAN button activation, quest display component, error handling, Zustand quest state, full test coverage (140 unit, 26 E2E)
- 2026-02-08: **Code Review (AI)** — 9 issues found (3H/4M/2L), all fixed automatically:
  - H1: Added `clearQuest()` call in flee handler to prevent stale quest state on re-SCAN
  - H2: Wrapped `useSearchParams()` in `<Suspense>` boundary (Next.js 16 requirement)
  - H3: Replaced non-deterministic `getRandomQuest()` pool-empty check with `getQuestsByDuration().length === 0`
  - M1: Replaced 5x `window.location.href` with `router.push()` for SPA navigation (preserves state, <300ms)
  - M2: Removed dead `questError` field from Zustand store (never written/read)
  - M3: Added unit tests for empty quest pool edge case
  - M4: Typed `DURATION_COLORS`/`DURATION_LABELS` as `Record<QuestDuration, string>` for type-safety
  - L1: Replaced hardcoded `bg-[#0D1117]` with `bg-background` Tailwind variable
  - L2: Fixed screen reader duplication in duration badge (added `aria-hidden` to visible span)
  - Test gate: 142 unit + 26 E2E pass, lint clean

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (Cascade)

### Debug Log References

- Fixed E2E test stability: Removed Framer Motion scale pulse animation from Link variant of ScanButton — continuous scale transform caused Playwright "element not stable" failures
- Fixed E2E strict mode violations: Used `{ exact: true }` and `getByRole('heading')` to disambiguate elements with duplicate text (sr-only spans, error title vs message)

### Completion Notes List

- **Task 1**: Created `types/quest.ts` with `Quest`, `QuestType`, `QuestDuration`, `QuestPool` types. Types are extensible via union types.
- **Task 2**: Created `lib/constants/quests.json` with 3 quests per duration (9 total), covering `true-false` and `qcm` types. French content. Created `quest-pool.ts` helper with `getQuestsByDuration`, `getRandomQuest`, `isValidDuration`.
- **Task 3**: Created `app/game/[id]/quest/page.tsx` — client component using `useSearchParams`, validates duration/game/player/role, selects random quest, displays via QuestView, haptic on load.
- **Task 4**: Updated `ScanButton` with `href` prop — renders as `next/link` when enabled. Updated `GameHome` to pass `href` and `disabled={false}`. Removed "Bientôt disponible" subtitle.
- **Task 5**: Created `components/game/quest-view.tsx` — Tactical Terminal aesthetic, duration badge with color coding, flee button in thumb zone, quest content placeholder for Story 3.2/3.3.
- **Task 6**: Added `ERR_INVALID_DURATION`, `ERR_NO_QUESTS`, `ERR_QUEST_LOAD_FAILED` to error-codes.ts. All error states use `ErrorView` with recovery paths.
- **Task 7**: Extended Zustand store with `currentQuest`, `questError`, `setCurrentQuest()`, `clearQuest()`. Reset clears quest state.
- **Task 8**: 36 new unit tests (quest-pool, quest-view, quest-page, scan-button href, game-home updated). 5 new E2E tests (full flow, SCAN enabled, flee, invalid duration, direct URL). Updated existing E2E tests for enabled SCAN button. All 140 unit + 26 E2E pass.

### File List

**New files:**
- types/quest.ts
- lib/constants/quests.json
- lib/constants/quest-pool.ts
- app/game/[id]/quest/page.tsx
- components/game/quest-view.tsx
- tests/unit/quest-pool.test.ts
- tests/unit/quest-view.test.tsx
- tests/unit/quest-page.test.tsx
- tests/e2e/quest-routing.spec.ts

**Modified files:**
- lib/constants/error-codes.ts
- lib/store/game-store.ts
- components/game/scan-button.tsx
- components/game/game-home.tsx
- tests/unit/scan-button.test.tsx
- tests/unit/game-home.test.tsx
- tests/e2e/game-home.spec.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
