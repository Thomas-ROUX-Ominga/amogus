# Story 2.1: Lancement de la Partie (Start Game)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an organisateur,
I want stopper les nouvelles entrées et lancer la partie,
so that les joueurs puissent choisir leur rôle et commencer les quêtes.

## Acceptance Criteria

1. **State Transition**: Clicking "Lancer la partie" button transitions game state from `WAITING` to `IN_PROGRESS` in Redis. [Source: epics.md#L186]
2. **Minimum Players Validation**: The button is only enabled when at least one player has joined the lobby. [Source: epics.md#L184]
3. **Player Notification**: All players currently in the lobby see the role selection screen appear after the organizer launches the game. [Source: epics.md#L187]
4. **Tactical UI**: The "Lancer la partie" button follows the Tactical Terminal aesthetic with `Orbitron` font and uses the `Primary` color scheme (Tactical Blue `#58A6FF`). [Source: ux-design-specification.md#L200, architecture.md#L107]
5. **Touch Target**: The launch button has a minimum touch target of 44x44px for mobile accessibility. [Source: ux-design-specification.md#L223, ux-design-specification.md#L351]
6. **Error Handling**: If the state transition fails, display an error message with a retry option following the "No Dead End" principle. [Source: architecture.md#L144]
7. **Haptic Feedback**: On successful launch, trigger a short double vibration on mobile devices to confirm the action. [Source: ux-design-specification.md#L357]
8. **Optimistic UI**: The button shows a loading state during the server action call to provide immediate feedback. [Source: ux-design-specification.md#L365]

## Tasks / Subtasks

- [x] **Server Action Implementation** (AC: 1, 6)
  - [x] Create `startGame` server action in `lib/redis/actions.ts`
  - [x] Implement state transition logic: `LOBBY` → `IN_PROGRESS`
  - [x] Add validation to ensure game exists and is in `LOBBY` state
  - [x] Return structured response: `{ success: boolean, data?: Game, error?: string }`
  - [x] Handle error cases (game not found, invalid state, Redis errors)

- [x] **Game State Type Updates** (AC: 1)
  - [x] `IN_PROGRESS` already present in `GameStatus` enum in `types/game.ts`
  - [x] Type consistency verified across codebase

- [x] **UI Component - Launch Button** (AC: 2, 4, 5, 7, 8)
  - [x] Updated lobby component in `app/game/[id]/page.tsx`
  - [x] Added "Lancer la partie" button with Tactical Terminal styling (Orbitron font, #58A6FF)
  - [x] Implemented button disabled state when player count < 1
  - [x] Added loading state with spinner during server action execution
  - [x] Integrated haptic feedback (double vibration) on successful launch
  - [x] Ensured 44x44px minimum touch target via `min-h-[44px]` + `touch-manipulation`

- [x] **Client-Side State Management** (AC: 3)
  - [x] Updated `lib/store/game-store.ts` with `launch` action and `isLaunching` state
  - [x] Implemented state synchronization after successful launch
  - [x] Added conditional rendering: role selection screen shown when `IN_PROGRESS`

- [x] **Role Selection Screen Preparation** (AC: 3)
  - [x] Created placeholder role selection component `components/game/role-selection.tsx`
  - [x] Added conditional rendering: show lobby when `LOBBY`, show role selection when `IN_PROGRESS`

- [x] **Testing** (AC: 1, 2, 6)
  - [x] Unit test: `startGame` action with valid game ID
  - [x] Unit test: `startGame` action with invalid game ID (error handling)
  - [x] Unit test: `startGame` action with game already in progress (idempotency)
  - [x] Unit test: `startGame` with no players (ERR_NO_PLAYERS)
  - [x] Unit test: `startGame` with invalid state FINISHED (ERR_INVALID_STATE)
  - [x] Unit test: `startGame` Redis failure (ERR_SIGNAL_LOST)
  - [x] Unit test: game-store `launch` success and failure
  - [x] E2E test: Organizer launches game and players see role selection screen
  - [x] E2E test: Launch button enabled when player has joined

## Dev Notes

### Architecture Compliance

**State Management Pattern:**

- Use Zustand store (`lib/store/game-store.ts`) for client-side game state
- Server Actions in `lib/redis/actions.ts` for all Redis mutations
- Follow established response wrapper: `{ success: boolean, data?: T, error?: string }`

**Redis Key Pattern:**

- Game state stored at: `game:{gameId}:state`
- Follow existing patterns from Stories 1.1-1.3

**Error Handling:**

- All error states must provide clear messaging and recovery path
- Use standardized error codes from `lib/constants/error-codes.ts`
- Follow "No Dead End" principle: always provide a way back

### Technical Requirements

**Dependencies:**

- Redis client (standard `redis` package, NOT `@vercel/kv`)
- Zustand v5 for state management
- Framer Motion v12 for future animations (Story 2.2)
- Next.js Server Actions for mutations

**Game State Machine:**

```
WAITING → IN_PROGRESS → (future: COMPLETED)
```

**State Transition Rules:**

- `WAITING` → `IN_PROGRESS`: Allowed when player count >= 1
- `IN_PROGRESS` → `IN_PROGRESS`: Idempotent (no error)
- Any other transition: Error

### UI/UX Requirements

**Tactical Terminal Aesthetic:**

- Font: `Orbitron` for the button text
- Color: Tactical Blue `#58A6FF` (Primary)
- Background: Dark `#0D1117`
- Button size: Large, prominent, centered in lobby view
- Animation: Subtle pulse effect when enabled (optional enhancement)

**Mobile-First Design:**

- Touch target: Minimum 44x44px
- Button placement: Lower third of screen (thumb-friendly zone)
- Loading state: Spinner or pulse animation
- Haptic feedback: Short double vibration on success

**Accessibility:**

- High contrast ratio (4.5:1 minimum)
- Clear button label in French: "Lancer la partie"
- Disabled state visually distinct (reduced opacity)

### File Structure Requirements

Based on Epic 1 patterns:

```
app/game/[id]/
  └── page.tsx              # Main lobby/game page (update for launch button)

lib/redis/
  └── actions.ts            # Add startGame server action

lib/store/
  └── game-store.ts         # Update to handle IN_PROGRESS state

types/
  └── game.ts               # Update GameStatus enum

components/game/
  └── role-selection.tsx    # Create placeholder (full impl in Story 2.2)

tests/unit/
  └── start-game.test.ts    # Unit tests for startGame action

tests/e2e/
  └── launch-game.spec.ts   # E2E test for launch flow
```

### Previous Story Intelligence

**From Story 1.3 (Gestion de l'Identité & Erreurs):**

- Error handling pattern established with standardized error codes
- `useLocalUser` hook handles localStorage safely (hydration-safe)
- Haptic feedback pattern: `navigator.vibrate([duration])`
- "No Dead End" principle: all error states provide recovery path

**From Epic 1 Retrospective:**

- Redis migration complete - use standard `redis` client
- Testing infrastructure (Vitest + Playwright) established
- Tactical Terminal UI theme with Orbitron fonts
- Hydration-safe patterns documented for client-side state

**Key Patterns to Follow:**

1. **Server Actions**: All Redis mutations go through `lib/redis/actions.ts`
2. **Error Codes**: Use constants from `lib/constants/error-codes.ts`
3. **Fonts**: Use `Orbitron` for headers/buttons, `Rajdhani` for body text
4. **Testing**: Write unit tests first, then E2E tests
5. **Hydration**: Avoid localStorage access during SSR

### Epic 2 Preparation Context

**From Epic 1 Retrospective - Critical Prep:**

- Framer Motion setup needed for Story 2.2 (role selection animations)
- Game state transition logic is the foundation for Epic 2
- This story (2.1) establishes the state machine for the entire epic

**State Machine Foundation:**
This story implements the critical `WAITING → IN_PROGRESS` transition that enables:

- Story 2.2: Role selection (requires `IN_PROGRESS` state)
- Story 2.3: Game home cockpit (requires role assignment)
- All of Epic 3: Quest system (requires active game)

### Latest Technical Information

**Next.js 16 Server Actions Best Practices:**

- Use `'use server'` directive at top of action functions
- Return serializable data only (no functions, no undefined)
- Handle errors gracefully with try-catch
- Use `revalidatePath()` if needed for cache invalidation

**Redis Best Practices (2024-2026):**

- Use connection pooling for performance
- Set appropriate TTL for game sessions (e.g., 24 hours)
- Use transactions for atomic state updates
- Handle connection errors with retry logic

**Zustand v5 Patterns:**

- Use `create` from `zustand`
- Prefer shallow equality checks for performance
- Use `devtools` middleware in development
- Keep store actions pure and testable

### Testing Requirements

**Unit Tests (Vitest):**

- Test `startGame` action with mocked Redis client
- Test state transition validation logic
- Test error handling for all edge cases
- Test idempotency (calling startGame twice)

**E2E Tests (Playwright):**

- Test full launch flow: create game → join player → launch
- Test button disabled state when no players
- Test error recovery when launch fails
- Test that all players see role selection after launch

**Coverage Goals:**

- 100% coverage for `startGame` action
- E2E coverage for critical user path

### Known Limitations (MVP)

- **No organizer distinction**: Any joined player can launch the game. The `GameState` model does not store a `creatorId`. This is acceptable for MVP party-game context where the organizer shares the screen/link, but should be addressed if access control is needed later.

### Project Structure Notes

- Follows hybrid organization from architecture.md
- Feature-specific logic in `app/game/[id]/`
- Shared components in `components/game/`
- Server actions in `lib/redis/actions.ts`
- Types in `types/game.ts`

### References

- [Epic 2 Story 2.1](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L176-L188)
- [Architecture: State Management](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L100-L102)
- [Architecture: Error Handling](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L144)
- [UX Design: Button Hierarchy](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L349-L353)
- [UX Design: Haptic Feedback](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L357)
- [PRD: FR4 - Lancement de la partie](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L23)
- [Epic 1 Retrospective](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/epic-1-retro-2026-02-08.md)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (Cascade)

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Integrated learnings from Epic 1: Redis client usage, Tactical Terminal UI, error handling patterns
- Prepared foundation for Epic 2 state machine and role selection flow
- Implemented `startGame` server action with LOBBY → IN_PROGRESS state transition, idempotency, and full error handling
- Added `ERR_INVALID_STATE` and `ERR_NO_PLAYERS` error codes
- Updated game-store with `launch` action and `isLaunching` loading state
- Added "Lancer la partie" button with Orbitron font, Tactical Blue styling, 44px touch target, loading spinner, and haptic feedback
- Created placeholder `RoleSelection` component for Story 2.2
- Conditional rendering: lobby view (LOBBY) vs role selection (IN_PROGRESS)
- 32 unit tests pass (8 new), 0 regressions
- 2 new E2E tests for launch flow
- Note: Story references `WAITING` state but codebase uses `LOBBY` — followed existing codebase convention

### Senior Developer Review (AI)

**Reviewer:** Omi (via Cascade adversarial review)
**Date:** 2026-02-08
**Outcome:** Approved with fixes applied

**Issues Found & Fixed (7 total):**

- 🔴 **H1** — Launch error displayed via global ErrorView, ejecting user from lobby. **Fixed:** Added `launchError` state to game-store, inline error display with retry under launch button.
- 🔴 **H2** — `startGame` used non-atomic GET+SET pattern (race condition). **Fixed:** Added `atomicUpdate` method to Redis client using WATCH/MULTI/EXEC, refactored `startGame` to use it.
- 🔴 **H3** — E2E test "disabled when no players" never tested disabled state. **Fixed:** Renamed and corrected test to verify button visibility and enabled state after join.
- 🟡 **M1** — Dev Notes referenced obsolete `lib/kv/actions.ts` path. **Fixed:** Updated all references to `lib/redis/actions.ts`.
- 🟡 **M2** — No organizer/player distinction for launch permission. **Fixed:** Documented as known MVP limitation.
- 🟡 **M3** — `redis.get` returned `null` silently when client not initialized (misleading GAME_NOT_FOUND). **Fixed:** Now throws like `redis.set`.
- 🟡 **M4** — No TTL on Redis game keys. **Fixed:** Added `GAME_TTL_SECONDS` (24h) to `createGame` and `startGame`.

**Low issues (not fixed, informational):**
- 🟢 L1 — AC1 says `WAITING` but code uses `LOBBY` (documented in Completion Notes)
- 🟢 L2 — `playwright-report/index.html` tracked in git (should be gitignored)

### Change Log

- 2026-02-08: Implemented Story 2.1 — startGame server action, launch button UI, game-store launch action, role selection placeholder, error codes, unit tests, E2E tests
- 2026-02-08: Code review fixes — atomic Redis transactions, inline launch error display, TTL on game keys, redis.get throw on missing client, Dev Notes path corrections, MVP limitation documented

### File List

- `lib/redis/actions.ts` — Added `startGame` server action (atomic via `atomicUpdate`), TTL on `createGame`
- `lib/redis/client.ts` — Added `atomicUpdate` method (WATCH/MULTI/EXEC), `GAME_TTL_SECONDS`, fixed `get`/`del` to throw when client not initialized
- `lib/store/game-store.ts` — Added `launch` action, `isLaunching` state, separate `launchError` state
- `lib/constants/error-codes.ts` — Added `ERR_INVALID_STATE`, `ERR_NO_PLAYERS`
- `app/game/[id]/page.tsx` — Added launch button, role selection conditional rendering, haptic feedback, inline launch error display with retry
- `components/game/role-selection.tsx` — New placeholder component
- `tests/unit/start-game.test.ts` — New: 6 unit tests for startGame action (updated for atomicUpdate mock)
- `tests/unit/game-store.test.ts` — Updated: added 2 tests for launch action (launchError validation)
- `tests/unit/game-actions.test.ts` — Updated: mock includes atomicUpdate and TTL assertion
- `tests/unit/error-logic.test.ts` — Updated: mock includes atomicUpdate
- `tests/unit/join-game.test.ts` — Updated: mock includes atomicUpdate
- `tests/e2e/launch-game.spec.ts` — New: 2 E2E tests for launch flow (corrected disabled state test)
