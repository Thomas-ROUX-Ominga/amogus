# Story 11.2: General Application Flow Fixes

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to experience a logical starting flow and clearly separated roles,
so that the game is intuitive from the moment I open it.

## Acceptance Criteria

1. The Home page displays only two options: "Join a game with code" and "Login" (which also offers registration). The useless "Scan" option is removed from the Home page.
2. An authenticated User (Admin) creating and launching a game cannot choose a player pseudo or role. They are automatically assigned the "Admin" role for that game and redirected to the Admin Dashboard.
3. Non-admin players who join the lobby cannot launch the game. Only the Admin can start the game for everyone.

## Tasks / Subtasks

- [ ] Task 1: Refactor Home Page UI (AC: 1)
  - [ ] Subtask 1.1: Remove the "Scan" button from `app/page.tsx`
  - [ ] Subtask 1.2: Ensure the only primary actions are "Join a game" and "Login"
- [ ] Task 2: Fix Admin Role Assignment on Game Launch (AC: 2)
  - [ ] Subtask 2.1: Update the game creation logic so the creator doesn't get prompted for pseudo/role
  - [ ] Subtask 2.2: Ensure the creator gets written to the Redis game state as the Admin
  - [ ] Subtask 2.3: Automatically redirect the Admin to the Admin Dashboard upon game creation
- [ ] Task 3: Restrict Game Launch to Admin (AC: 3)
  - [ ] Subtask 3.1: Hide the "Launch Game" button in the Lobby for non-admin players
  - [ ] Subtask 3.2: Add server-side validation to ensure only the Admin can trigger the start game action

## Dev Notes

### Architecture Intelligence

**Critical Flow Constraints:**

- The authentication logic should correctly identify if the current session is an admin or a regular player. Use the existing session management methods to retrieve the user's role and ID.
- Game state in Redis must correctly reflect who the admin is for a given game ID to enforce AC 3.

### Project Structure Notes

**File Locations:**

- Home Page: `app/page.tsx`
- Lobby/Game Join Components: `components/game/lobby.tsx`, `app/game/[id]/page.tsx`
- Actions for starting game: `lib/redis/actions.ts` or similar server actions related to game state.

### References

- [Source: epics.md#Story-11.2:-General-Application-Flow-Fixes]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
