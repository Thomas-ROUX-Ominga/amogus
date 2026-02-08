# Story 2.1: Lancement de la Partie (Start Game)

Status: ready-for-dev

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

- [ ] **Server Action Implementation** (AC: 1, 6)
  - [ ] Create `startGame` server action in `lib/kv/actions.ts`
  - [ ] Implement state transition logic: `WAITING` → `IN_PROGRESS`
  - [ ] Add validation to ensure game exists and is in `WAITING` state
  - [ ] Return structured response: `{ success: boolean, data?: Game, error?: string }`
  - [ ] Handle error cases (game not found, invalid state, Redis errors)

- [ ] **Game State Type Updates** (AC: 1)
  - [ ] Update `types/game.ts` to include `IN_PROGRESS` in `GameStatus` enum
  - [ ] Ensure type consistency across codebase

- [ ] **UI Component - Launch Button** (AC: 2, 4, 5, 7, 8)
  - [ ] Create or update lobby component in `app/game/[id]/page.tsx`
  - [ ] Add "Lancer la partie" button with Tactical Terminal styling
  - [ ] Implement button disabled state when player count < 1
  - [ ] Add loading state during server action execution
  - [ ] Integrate haptic feedback on successful launch
  - [ ] Ensure 44x44px minimum touch target

- [ ] **Client-Side State Management** (AC: 3)
  - [ ] Update `lib/store/game-store.ts` to handle `IN_PROGRESS` state
  - [ ] Implement state synchronization after successful launch
  - [ ] Add logic to trigger role selection screen for all players

- [ ] **Role Selection Screen Preparation** (AC: 3)
  - [ ] Create placeholder role selection component (to be fully implemented in Story 2.2)
  - [ ] Add conditional rendering: show lobby when `WAITING`, show role selection when `IN_PROGRESS`

- [ ] **Testing** (AC: 1, 2, 6)
  - [ ] Unit test: `startGame` action with valid game ID
  - [ ] Unit test: `startGame` action with invalid game ID (error handling)
  - [ ] Unit test: `startGame` action with game already in progress (idempotency)
  - [ ] E2E test: Organizer launches game and players see role selection screen
  - [ ] E2E test: Launch button disabled when no players joined

## Dev Notes

### Architecture Compliance

**State Management Pattern:**

- Use Zustand store (`lib/store/game-store.ts`) for client-side game state
- Server Actions in `lib/kv/actions.ts` for all Redis mutations
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

lib/kv/
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

1. **Server Actions**: All Redis mutations go through `lib/kv/actions.ts`
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

### Project Structure Notes

- Follows hybrid organization from architecture.md
- Feature-specific logic in `app/game/[id]/`
- Shared components in `components/game/`
- Server actions in `lib/kv/actions.ts`
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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created
- Integrated learnings from Epic 1: Redis client usage, Tactical Terminal UI, error handling patterns
- Prepared foundation for Epic 2 state machine and role selection flow

### File List
