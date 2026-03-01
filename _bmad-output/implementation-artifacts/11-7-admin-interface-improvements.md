# Story 11.7: Admin Interface Improvements

Status: backlog

## Story

As an admin,
I want a clearer overview of the game's global progress and player statuses,
so that I can manage the game more effectively and players can easily identify the host.

## Acceptance Criteria

1. **AC1**: The "Quest Progress" area in the Admin Dashboard displays a global progress bar representing the total completed quests out of the total assigned quests for all players.
2. **AC2**: A "Host" badge is displayed next to the admin's name in the player list for all participants (lobby and during the game).
3. **AC3**: The "SCAN" and "SIGNAL ELIMINATION" actions are hidden for users with the Admin role.
4. **AC4**: In the Admin Dashboard, players who are eliminated are visually highlighted (e.g., red background/tile) with an elimination icon.

## Tasks / Subtasks

- [x] Task 1: Global Progress Bar & Live Elimination (AC: 1, 4)
  - [x] Update `LiveDashboard.tsx` to ensure `overallProgress` is correctly calculated across all players.
  - [x] Enhance player tiles in the individual progress list with "Eliminated" visual styles.
- [x] Task 2: Host Identification & Badge (AC: 2)
  - [x] Update `useAuth` or similar hook to expose `isHost` logic (comparing `userId` with `gameState.creatorId`).
  - [x] Update player list components to render the "Host" badge.
- [x] Task 3: UX Cleanup for Admin (AC: 3)
  - [x] Conditional rendering for "SCAN" and "SIGNAL ELIMINATION" buttons based on user role.

## Dev Notes

### Architecture Intelligence

- Use existing `gameState.players` and `gameState.creatorId` for logic.
- Real-time updates are already handled via SWR in `LiveDashboard.tsx`.

### References

- [Source: components/admin/LiveDashboard.tsx]
- [Source: hooks/use-auth.tsx]
