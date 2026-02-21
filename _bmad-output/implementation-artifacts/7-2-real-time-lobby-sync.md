# Story 7.2: Real-time Lobby Sync

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to see the crew list grow as people join and see when the game starts without refreshing,
so that the onboarding feels responsive.

## Acceptance Criteria

1. **Real-time Player List**: Lobby page updates automatically when a new player joins (using SWR polling or SSE).
2. **Instant Game Start Redirect**: When Admin clicks "Start Game", all joined players are instantly redirected to their Role Selection or Dashboard.

## Tasks / Subtasks

- [x] Real-time Lobby Updates (AC: 1)
  - [x] Implement SWR hook for lobby state polling (2s interval)
  - [x] Update player list UI to show real-time joins with animations
  - [x] Add visual feedback for new player arrivals
- [x] Game Start Detection (AC: 2)
  - [x] Implement real-time game status monitoring
  - [x] Add automatic redirect logic when game status changes to IN_PROGRESS
  - [x] Ensure smooth transition to role selection or game home
- [x] Performance & UX Optimization
  - [x] Add connection status indicators (online/offline)
  - [x] Implement proper cleanup of polling intervals
  - [x] Add haptic feedback for game start detection
- [x] Testing & Validation
  - [x] Unit Test: SWR hook behavior and cleanup
  - [x] Integration Test: Multi-player lobby sync simulation

## Dev Notes

### Architecture Compliance

- **Real-time Pattern**: Use SWR with 2-second polling interval as specified in Phase 2 architecture
- **State Management**: Leverage existing `refreshGameData` in game store for real-time updates
- **Key Pattern**: Continue using `game:{shortCode}:state` Redis pattern from story 7.1

### Technical Requirements

- **SWR Configuration**: 2-second refresh interval, focus tracking, revalidate on focus
- **Animation**: Smooth fade-in for new players, pulse effect for game start
- **Cleanup**: Proper useEffect cleanup to prevent memory leaks
- **Fallback**: Show connection status if polling fails

### File Structure Requirements

- **Modified Lobby**: `app/game/[id]/page.tsx` (add SWR integration)
- **Enhanced Store**: `lib/store/game-store.ts` (add real-time polling hook)
- **New Hook**: `hooks/use-real-time-lobby.ts` (SWR wrapper for lobby updates)
- **Updated Components**: Enhanced player list with animations in lobby

### Previous Story Intelligence

From story 7-1 "Setup from Batch (Short-Codes)":
- **Short Code Pattern**: Games use 6-character codes stored as `game:{shortCode}:state`
- **Game Store**: Existing `refreshGameData` function can be leveraged for polling
- **Player Management**: Join flow already handles player addition to Redis state
- **UI Patterns**: Existing player list rendering can be enhanced with animations

### Implementation Strategy

1. **Phase 1 - Real-time Polling**: Create SWR hook that polls game state every 2 seconds
2. **Phase 2 - UI Enhancements**: Add animations and visual feedback for state changes
3. **Phase 3 - Game Start Detection**: Monitor status changes and trigger redirects
4. **Phase 4 - Polish**: Add connection status, haptics, and error handling

### Critical Integration Points

- **Redis Key Pattern**: `game:{shortCode}:state` (from story 7.1)
- **Game Store**: Use existing `refreshGameData` as SWR fetcher
- **Lobby Component**: Enhance existing player list in `app/game/[id]/page.tsx`
- **Role Selection**: Leverage existing redirect logic for IN_PROGRESS state

### Testing Requirements

- **Unit Tests**: SWR hook behavior, cleanup logic, state change detection
- **Integration Tests**: Multi-client lobby simulation, game start propagation

### References

- [Epics: Story 7.2 Requirements](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L74)
- [Architecture: Real-time Communication](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L54)
- [Previous Story: 7.1 Implementation](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/7-1-setup-from-batch-short-codes.md)
- [Source: lib/store/game-store.ts](file:///home/omi/projects/amogus/lib/store/game-store.ts)
- [Source: app/game/[id]/page.tsx](file:///home/omi/projects/amogus/app/game/[id]/page.tsx)

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha)

### Debug Log References

- Story creation workflow executed for 7-2
- Analyzed sprint-status.yaml, epics.md, architecture.md, game-store.ts, and lobby page
- Reviewed previous story 7-1 for context and patterns

### Completion Notes List

- ✅ Extracted AC from epics.md for real-time lobby sync
- ✅ Analyzed existing lobby structure in app/game/[id]/page.tsx
- ✅ Identified SWR integration points in game store
- ✅ Defined technical strategy using existing refreshGameData function
- ✅ Mapped implementation phases for systematic development
- ✅ Specified testing strategy for unit and integration tests
- ✅ Ensured compatibility with short-code pattern from story 7.1
- ✅ Implemented SWR hook with 2-second polling interval
- ✅ Added real-time player list updates with animations
- ✅ Implemented game start detection and automatic redirects
- ✅ Added connection status indicators (online/offline)
- ✅ Implemented haptic feedback for game start detection
- ✅ Created comprehensive unit tests for SWR hook
- ✅ Created integration tests for real-time functionality
- ✅ Enhanced lobby UI with connection status and animations
- ✅ Proper cleanup of polling intervals to prevent memory leaks
- ✅ Fixed all linting issues and ensured code quality
- ✅ Validated all tests pass successfully

### Implementation Summary

**Story 7.2: Real-time Lobby Sync** has been successfully completed with all acceptance criteria met:

1. **Real-time Player List**: Lobby page updates automatically when new players join using SWR polling with 2-second intervals
2. **Instant Game Start Redirect**: When Admin clicks "Start Game", all joined players are instantly redirected to their Role Selection or Game Home

**Key Features Implemented:**
- Enhanced `useRealTimeGamePolling` hook with new player detection logic
- Connection status indicators (SYNC/OFFLINE) 
- Animated player list updates with NEW player highlighting
- Game start detection with automatic redirects (race condition fixed)
- Haptic feedback for game start events
- Proper cleanup to prevent memory leaks
- Comprehensive test coverage (unit, integration)

**Technical Achievements:**
- Leveraged existing `refreshGameData` function for consistency
- Maintained Redis key pattern `game:{shortCode}:state` from story 7.1
- Added SWR dependency for efficient real-time updates
- Enhanced UI with connection status and visual feedback
- All tests passing with 100% success rate
- Zero linting errors

### File List

- _bmad-output/implementation-artifacts/7-2-real-time-lobby-sync.md
- app/game/[id]/page.tsx (MODIFIED - SWR integration + new player animations)
- lib/store/game-store.ts (MODIFIED - enhanced useRealTimeGamePolling hook)
- tests/unit/use-real-time-lobby.test.ts (MODIFIED - tests for actual implementation)
- tests/integration/real-time-lobby.test.ts (MODIFIED - real integration tests)
- package.json (MODIFIED - added swr dependency)
