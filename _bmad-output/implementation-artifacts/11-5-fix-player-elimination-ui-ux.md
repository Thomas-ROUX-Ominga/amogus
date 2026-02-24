# Story 11.5: Fix Player Elimination UI/UX

Status: ready-for-dev

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

- [ ] Task 1: Fix Eliminated UI (AC: 1)
  - [ ] Subtask 1.1: Update `components/game/eliminated-screen.tsx` to fix transparency and z-index issues
  - [ ] Subtask 1.2: Ensure the visually prominent "Ghost Mode" state is obvious
- [ ] Task 2: Allow Admin Remote Elimination (AC: 2, 3)
  - [ ] Subtask 2.1: Add "Eliminate" button next to each player on the Admin Dashboard
  - [ ] Subtask 2.2: Create server action to update player status to `ELIMINATED` in Redis
  - [ ] Subtask 2.3: Ensure SWR automatically picks up the state change on the player's device
- [ ] Task 3: Implement Ghost Mode Quests (AC: 4)
  - [ ] Subtask 3.1: Remove the blocking "ACCESS DENIED - SYSTEM OFFLINE" message for eliminated Crewmates
  - [ ] Subtask 3.2: Allow the `completedQuest` logic to process quests for players whose state is `ELIMINATED`

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
