# Story 10.2: Self-Elimination Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to signal that I have been "killed" or eliminated,
so that I stop receiving game updates.

## Acceptance Criteria

1. "SIGNAL ELIMINATION" button in the dashboard footer.
2. Once activated, player status in Redis becomes `ELIMINATED`.
3. Any further scan attempts return an "ACCESS DENIED - SYSTEM OFFLINE" message.

## Tasks / Subtasks

- [x] Task 1: Add elimination button to game dashboard (AC: 1)
  - [x] Subtask 1.1: Design footer elimination button component
  - [x] Subtask 1.2: Add button to game dashboard layout
  - [x] Subtask 1.3: Implement confirmation dialog for elimination
- [x] Task 2: Implement elimination state management (AC: 2)
  - [x] Subtask 2.1: Add eliminatePlayer action to Redis actions
  - [x] Subtask 2.2: Update player state structure to support elimination
  - [x] Subtask 2.3: Add elimination handling to game store
- [x] Task 3: Block eliminated players from quest interactions (AC: 3)
  - [x] Subtask 3.1: Add elimination check to quest scanning flow
  - [x] Subtask 3.2: Create eliminated player error screen component
  - [x] Subtask 3.3: Update camera scanner to respect elimination status
- [x] Task 4: Update real-time polling for eliminated players (AC: implicit)
  - [x] Subtask 4.1: Modify polling to stop for eliminated players
  - [x] Subtask 4.2: Update admin dashboard to show eliminated status
  - [x] Subtask 4.3: Add elimination status to game state tracking

## Dev Notes

### Architecture Intelligence

**Current Player State Structure:**

From `lib/redis/actions.ts` analysis, players currently have:

```typescript
{
  id: string;
  name: string;
  isAlive: boolean;  // This field already exists!
  role?: PlayerRole;
  completedQuests?: string[];
  lastQuestCompleted?: number;
}
```

**Critical Redis Data Patterns:**

- Game state key: `game:{shortCode}:state` (already established)
- Use existing `lib/redis/actions.ts` patterns for new elimination action
- Follow atomic update patterns for state changes
- Maintain consistency with existing error handling (`ActionResponse<T>`)

**Real-time Communication Integration:**

- Use existing SWR polling from Story 7.2 and 10.1
- Eliminated players should stop polling to reduce server load
- Admin dashboard (Story 10.1) should show eliminated status

### Project Structure Notes

**File Locations:**

- Elimination button component: `components/game/elimination-button.tsx` (new)
- Eliminated screen component: `components/game/eliminated-screen.tsx` (new)
- Redis action: `lib/redis/actions.ts` (extend existing)
- Game store updates: `lib/store/game-store.ts` (extend existing)
- Game dashboard modifications: `components/game/game-home.tsx` (update existing)

**Consistency with Existing Patterns:**

- Follow authentication patterns from Story 6.1 (Admin Authentication)
- Use same error handling patterns as other game actions
- Maintain consistent styling with existing game components
- Use established `ActionResponse<T>` pattern for server actions

### Technical Requirements

**Elimination State Management:**

```typescript
// New action to add to lib/redis/actions.ts
export async function eliminatePlayer(
  gameId: string,
  userId: string,
): Promise<ActionResponse<{ isAlive: boolean }>>;

// Game store state additions
isEliminating: boolean;
eliminationError: string | null;
eliminationErrorCode: string | null;
```

**UI/UX Requirements:**

- Footer button should be visually distinct but not intrusive
- Confirmation dialog prevents accidental elimination
- Eliminated screen should be clear about permanent state
- Maintain dark theme consistency from UX specification

**State Flow:**

1. Player clicks "SIGNAL ELIMINATION" button
2. Confirmation dialog appears ("Are you sure you want to signal elimination?")
3. Upon confirmation:
   - Call `eliminatePlayer(gameId, userId)` action
   - Update local state to `isAlive: false`
   - Stop real-time polling
   - Show eliminated screen
4. Any subsequent quest attempts show "ACCESS DENIED - SYSTEM OFFLINE"

**Security & Validation:**

- Only the player themselves can eliminate their own character
- Validate gameId and userId parameters to prevent Redis injection
- Ensure elimination is idempotent (multiple calls safe)
- Maintain game integrity - eliminated players stay in game state for admin visibility

### Testing Requirements

**Unit Tests (Vitest):**

- Test `eliminatePlayer` Redis action
- Test game store elimination state management
- Test elimination button component rendering and interaction
- Test eliminated screen component

**Integration Tests:**

- Test complete elimination flow from button click to state update
- Test that eliminated players cannot complete quests
- Test real-time polling stops after elimination
- Test admin dashboard shows eliminated status

**E2E Tests (Playwright):**

- Test full elimination journey
- Test quest scanning after elimination returns access denied
- Test admin dashboard reflects elimination in real-time
- Test elimination confirmation dialog behavior

### Previous Story Intelligence

**From Story 10.1 (Interactive Admin Dashboard):**

- Live dashboard already shows player progress and status
- Real-time SWR polling established with 2-second intervals
- Admin authentication patterns already implemented
- Component structure in `components/admin/` is established

**Key Learnings:**

- Use SWR for efficient real-time updates
- Implement proper error boundaries for async operations
- Follow established Redis atomic update patterns
- Maintain consistent loading states and error handling

### Git Intelligence

**Recent Implementation Patterns:**

From recent commits analyzing Story 10.1 implementation:

- Components follow PascalCase naming convention
- Server actions use `ActionResponse<T>` pattern consistently
- Error codes defined in `lib/constants/error-codes.ts`
- Unit tests colocated with components in `tests/unit/`

**Code Patterns to Follow:**

- Use `React.memo` for performance optimization
- Implement proper TypeScript interfaces for all props
- Use established CSS class naming from existing components
- Follow async/await patterns for server actions

### Latest Technical Information

**Redis State Management:**

- Current Redis client supports atomic updates (used in `completeQuest`, `selectRole`)
- TTL management already established (`GAME_TTL_SECONDS`)
- Error handling patterns consistent across all actions

**Real-time Updates:**

- SWR polling proven effective in Stories 7.2 and 10.1
- Consider stopping polling for eliminated players to reduce server load
- Admin dashboard will need to filter eliminated players appropriately

**Component Architecture:**

- Shadcn UI components already integrated and styled
- Dark theme "Tactical Station" established in UX specification
- Mobile-first responsive design patterns established

### References

- [Source: epics.md#Epic-10-Live-Ops-Player-State]
- [Source: architecture.md#Data-Modeling-Persistence]
- [Source: architecture.md#Real-time-Communication]
- [Source: architecture.md#Project-Directory-Structure]
- [Source: prd.md#Updated-Success-Criteria-v2.0]
- [Source: ux-design-specification.md#Design-System-Foundation]
- [Source: 10-1-interactive-admin-dashboard.md] (Previous story patterns)

## Dev Agent Record

### Agent Model Used

Penguin Alpha (Cascade v1.0)

### Debug Log References

### Completion Notes List

- ✅ **Elimination Button Component**: Created `components/game/elimination-button.tsx` with confirmation dialog and haptic feedback
- ✅ **Redis Action**: Implemented `eliminatePlayer` action in `lib/redis/actions.ts` with proper validation and atomic updates
- ✅ **Game Store Integration**: Added elimination state management to `lib/store/game-store.ts` with `eliminatePlayerAction` method
- ✅ **Camera Scanner Updates**: Modified `components/game/camera-scanner.tsx` to show "ACCESS DENIED" for eliminated players
- ✅ **Real-time Polling**: Updated `useRealTimeGamePolling` hook to stop polling for eliminated players
- ✅ **Game Dashboard Integration**: Added elimination button to footer with proper status display
- ✅ **Eliminated Screen**: Created `components/game/eliminated-screen.tsx` for access denied scenarios
- ✅ **Tests**: Added comprehensive unit tests for elimination action and button component
- ✅ **AI Code Review Fixes**:
  - Unused `EliminatedScreen` now properly shown via `camera-scanner.tsx` overlay.
  - SWR Polling now properly aborted for eliminated players in `game-store.ts`.
  - Added player `isAlive` checks to `completeQuest` to satisfy AC 3 completely.
  - Implemented completely new `createPlayerSession` & `verifyPlayerSession` in `auth-utils.ts` and tied them to `joinGame`, `selectRole`, `completeQuest`, and `eliminatePlayer` to secure game actions against ID spoofing.

### File List

- `components/game/elimination-button.tsx` (new)
- `components/game/eliminated-screen.tsx` (new)
- `components/game/game-home.tsx` (modified)
- `components/game/camera-scanner.tsx` (modified)
- `lib/redis/actions.ts` (modified)
- `lib/redis/auth-utils.ts` (modified)
- `lib/store/game-store.ts` (modified)
- `tests/unit/elimination-action.test.ts` (new)
- `tests/unit/elimination-button.test.tsx` (new)
- `tests/unit/game-actions.test.ts` (modified)
