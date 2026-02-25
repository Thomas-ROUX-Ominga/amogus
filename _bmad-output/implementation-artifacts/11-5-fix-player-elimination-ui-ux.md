# Story 11.5: Fix Player Elimination UI/UX

Status: done

## Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] Fix polling bug in Ghost Mode (polling was stopping for Crewmates)
- [x] [AI-Review][HIGH] Add prominent elimination overlay to GameHome
- [x] [AI-Review][MEDIUM] Update EliminatedScreen for role-specific messaging (Crewmate vs Impostor)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to clearly see when I am eliminated and have the elimination state visually prominent,
so that there is no confusion about my game status.

## Acceptance Criteria

1. The player elimination screen is redesigned to be opaque, prominent, and clearly indicates the "Dead" or "Eliminated" state without visual bugs or transparency issues.
2. The Admin Dashboard includes a feature allowing the Admin to manually eliminate any player from the game remotely.
3. An Admin-triggered elimination immediately updates the targeted player's screen to the Eliminated state via real-time sync.
4. An eliminated Crewmate enters "Ghost Mode" and can still scan QR codes and complete their remaining assigned quests, though their status remains eliminated.

## Tasks / Subtasks

- [x] Task 1: Fix Eliminated UI (AC: 1)
  - [x] Subtask 1.1: Update `components/game/eliminated-screen.tsx` to fix transparency and z-index issues
  - [x] Subtask 1.2: Ensure the visually prominent "Ghost Mode" state is obvious
- [x] Task 2: Allow Admin Remote Elimination (AC: 2, 3)
  - [x] Subtask 2.1: Add "Eliminate" button next to each player on the Admin Dashboard
  - [x] Subtask 2.2: Create server action to update player status to `ELIMINATED` in Redis
  - [x] Subtask 2.3: Ensure SWR automatically picks up the state change on the player's device
- [x] Task 3: Implement Ghost Mode Quests (AC: 4)
  - [x] Subtask 3.1: Remove the blocking "ACCESS DENIED - SYSTEM OFFLINE" message for eliminated Crewmates
  - [x] Subtask 3.2: Allow the `completedQuest` logic to process quests for players whose state is `ELIMINATED`

## Dev Notes

### Architecture Intelligence

**Elimination Logic:**

- The current elimination flow simply sets the player status to `ELIMINATED` and blocks all actions. We need to selectively allow actions if the player is a Crewmate.
- Read `lib/redis/actions.ts` or game server files handling `PlayerState`.

### Project Structure Notes

**File Locations:**

- UI components: `components/game/eliminated-screen.tsx`, `app/game/[id]/page.tsx`
- Admin Dashboard UI: `components/admin/admin-dashboard.tsx`
- Actions: `lib/redis/actions.ts`

### References

- [Source: epics.md#Story-11.5:-Fix-Player-Elimination-UI/UX]

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha)

### Debug Log References

No major debugging issues encountered during implementation.

### Completion Notes List

- **Task 1 - Eliminated UI Enhancement**: Successfully redesigned the eliminated screen with opaque background (`bg-black` instead of `bg-black/90`), prominent "ELIMINATED" header, and clear Ghost Mode messaging. Updated styling to use red accents for elimination state and blue accents for Ghost Mode capabilities.

- **Task 2 - Admin Remote Elimination**: Implemented admin elimination functionality with proper authorization checks. Added skull icon buttons to LiveDashboard for each alive player, created `eliminatePlayer` server action with admin validation, and ensured real-time updates via SWR revalidation.

- **Task 3 - Ghost Mode Implementation**: Successfully differentiated behavior between eliminated Crewmates and Impostors. Eliminated Crewmates can now scan QR codes and complete quests in Ghost Mode, while eliminated Impostors remain blocked. Updated camera scanner logic to show appropriate overlays based on player role.

### File List

- `components/game/eliminated-screen.tsx` - Updated UI for better visibility and Ghost Mode messaging
- `components/admin/LiveDashboard.tsx` - Added eliminate buttons with loading states
- `app/admin/dashboard/actions.ts` - Added admin elimination action with authorization
- `components/game/camera-scanner.tsx` - Updated to support Ghost Mode for eliminated Crewmates
- `components/game/game-home.tsx` - Pass playerRole to CameraScanner
- `lib/redis/actions.ts` - Modified completeQuest to allow eliminated Crewmates
- `tests/unit/components/eliminated-screen.test.tsx` - New test suite for eliminated screen
- `tests/unit/admin/elimination-action.test.ts` - New test suite for admin elimination
- `tests/unit/components/camera-scanner.test.tsx` - Updated tests for Ghost Mode behavior
