# Story 11.2: General Application Flow Fixes

Status: done

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

- [x] Task 1: Refactor Home Page UI (AC: 1)
  - [x] Subtask 1.1: Remove the "Scan" button from `app/page.tsx`
  - [x] Subtask 1.2: Ensure the only primary actions are "Join a game" and "Login"
- [x] Task 2: Fix Admin Role Assignment on Game Launch (AC: 2)
  - [x] Subtask 2.1: Update the game creation logic so the creator doesn't get prompted for pseudo/role
  - [x] Subtask 2.2: Ensure the creator gets written to the Redis game state as the Admin
  - [x] Subtask 2.3: Automatically redirect the Admin to the Admin Dashboard upon game creation
- [x] Task 3: Restrict Game Launch to Admin (AC: 3)
  - [x] Subtask 3.1: Hide the "Launch Game" button in the Lobby for non-admin players
  - [x] Subtask 3.2: Add server-side validation to ensure only the Admin can trigger the start game action

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

✅ **Task 1 Complete**: Removed Scan button from home page, simplified UI to only show "Join a game" and "Login" options. Improved user experience by eliminating confusing scan functionality.

✅ **Task 2 Complete**: Implemented automatic admin role assignment. Admin users creating games are automatically added as ADMIN players and redirected to the specific game admin dashboard. No more pseudo/role selection for game creators.

✅ **Task 3 Complete**: Added both UI and server-side restrictions for game launch. Only the game creator (admin) can launch games, with disabled buttons for regular players and server validation to prevent unauthorized launches.

### File List

- `app/page.tsx` - Removed Scan button and simplified home page UI
- `types/game.ts` - Added ADMIN role to PlayerRole type
- `lib/redis/actions.ts` - Updated joinGame, createGame, and startGame functions for admin role management
- `app/admin/games/create/page.tsx` - Updated to redirect to specific game admin dashboard
- `app/game/[id]/page.tsx` - Modified launch button logic to only allow admin to launch games
- `tests/integration/game-creation.test.ts` - Updated integration tests
- `tests/unit/game-actions.test.ts` - Updated unit tests
- `tests/unit/start-game.test.ts` - Updated unit tests
- `tests/unit/story-11-2-admin-role.test.ts` - Added admin role requirement tests
- `tests/unit/story-11-2-game-launch.test.ts` - Added game launch permission tests
- `tests/unit/story-11-2-home-page.test.tsx` - Added home page UI tests
- `tests/unit/story-11-2-launch-ui.test.tsx` - Added launch button UI tests

### Change Log

- Apply code review fixes: update documentation and remove redundant logic in `lib/redis/actions.ts`.
