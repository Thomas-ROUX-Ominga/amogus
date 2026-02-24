# Story 11.3: Game Settings from Batch

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to set the default number of Short/Medium/Long quests per player when launching a game from a Batch,
so that the game automatically assigns the correct quests to joiners.

## Acceptance Criteria

1. The Batch launch page includes input fields to explicitly set the default number of Short, Medium, and Long quests per user (e.g., 4 Short, 2 Medium, 1 Long).
2. The game creation logic saves these settings to the game state.
3. New players joining the game are automatically assigned quests matching this exact distribution from the selected Batch.

## Tasks / Subtasks

- [ ] Task 1: UI for Quest Distribution Settings (AC: 1)
  - [ ] Subtask 1.1: Add input fields for Short, Medium, and Long counts on `app/admin/batches/[id]/page.tsx`
  - [ ] Subtask 1.2: Validate input to ensure at least 1 quest total is selected
- [ ] Task 2: Save Settings to Game State (AC: 2)
  - [ ] Subtask 2.1: Update `createGame` server action to accept distribution settings
  - [ ] Subtask 2.2: Store `questConfig: {S, M, L}` in the active game hash in Redis
- [ ] Task 3: Automatic Assignment on Join (AC: 3)
  - [ ] Subtask 3.1: Update `joinGame` logic to read `questConfig` instead of hardcoding distribution
  - [ ] Subtask 3.2: Assign quests from the batch matching the new required distribution per player

## Dev Notes

### Architecture Intelligence

**Critical Game Creation Logic:**

- Look at `lib/redis/actions.ts` for how games are currently created from a batch.
- When saving to Redis, update the type definition for Game to include the custom quest configuration.
- The `joinGame` or `assignQuests` logic must be updated to use the game's configuration instead of defaults.

### Project Structure Notes

**File Locations:**

- UI: `app/admin/batches/[id]/page.tsx` or wherever the "Launch Game" button lives.
- Core logic: `lib/redis/actions.ts`, `lib/services/game-service.ts`

### References

- [Source: epics.md#Story-11.3:-Game-Settings-from-Batch]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
