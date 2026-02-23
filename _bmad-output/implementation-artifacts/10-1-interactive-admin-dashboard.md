# Story 10.1: Interactive Admin Dashboard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to see live global stats of the game,
so that I can narrate the progress to the crew.

## Acceptance Criteria

1. Live view shows: Total Quests Completed / Total Quests Assigned.
2. Progress breakdown by Format (Short/Med/Long).
3. List of active players with their individual progress (e.g., "Omi: 4/6").

## Tasks / Subtasks

- [x] Task 1: Create live stats dashboard component (AC: 1, 2, 3)
  - [x] Subtask 1.1: Design responsive dashboard layout
  - [x] Subtask 1.2: Implement real-time data fetching from Redis
  - [x] Subtask 1.3: Add progress visualization components
- [x] Task 2: Implement real-time updates (AC: 1, 2, 3)
  - [x] Subtask 2.1: Set up SWR polling or SSE for live updates
  - [x] Subtask 2.2: Optimize Redis queries for performance
  - [x] Subtask 2.3: Add error handling and loading states
- [x] Task 3: Add admin authentication protection (AC: implicit)
  - [x] Subtask 3.1: Ensure middleware protects dashboard routes
  - [x] Subtask 3.2: Add session validation

## Dev Notes

### Architecture Intelligence

**Critical Redis Data Structure:**

- `game:{shortCode}:state` contains current game status, players, and assignments
- Use existing `lib/redis/actions.ts` for all Redis operations
- Follow established naming patterns: `batch:{batchId}`, `game:{shortCode}:state`

**Real-time Communication Requirements:**

- Use SWR with 2s interval (consistent with lobby sync in epic 7)
- Alternative: Server-Sent Events (SSE) for more responsive updates
- Follow existing patterns from Story 7.2 (Real-time Lobby Sync)

**Component Structure:**

- Place in `components/admin/` directory (following established structure)
- Use existing UI components from `components/ui/`
- Follow naming conventions: PascalCase for components

### Project Structure Notes

**File Locations:**

- Dashboard component: `components/admin/LiveDashboard.tsx`
- API actions: `lib/redis/actions.ts` (extend existing)
- Types: `types/admin.ts` (create if needed)
- Admin routes: `app/admin/dashboard/page.tsx`

**Consistency with Existing Patterns:**

- Follow authentication patterns from Story 6.1 (Admin Authentication)
- Use same middleware protection as other admin routes
- Maintain consistent styling with existing admin components

### Technical Requirements

**Data Processing:**

- Calculate total quests: sum of all players' assigned quests
- Calculate completed quests: sum of all players' completed quests
- Format breakdown: aggregate by quest format (S/M/L) across all players
- Player progress: individual completed/assigned ratios

**Performance Considerations:**

- Minimize Redis queries - batch operations where possible
- Implement efficient data aggregation on server-side
- Use React.memo for dashboard components to prevent unnecessary re-renders
- Consider debouncing rapid updates

**Security & Validation:**

- All admin routes must be protected by authentication middleware
- Validate shortCode parameter to prevent Redis injection
- Sanitize all displayed data to prevent XSS

### Testing Requirements

**Unit Tests (Vitest):**

- Test data aggregation logic
- Test Redis query functions
- Test component rendering with mock data

**Integration Tests:**

- Test real-time updates
- Test authentication protection
- Test error handling scenarios

**E2E Tests (Playwright):**

- Test complete dashboard flow
- Test live updates during active game
- Test unauthorized access attempts

### References

- [Source: epics.md#Epic-10-Live-Ops-Player-State]
- [Source: architecture.md#Data-Modeling-Persistence]
- [Source: architecture.md#Real-time-Communication]
- [Source: architecture.md#Project-Directory-Structure]
- [Source: prd.md#Updated-Success-Criteria-v2.0]

## Dev Agent Record

### Agent Model Used

Penguin Alpha (Cascade v1.0)

### Debug Log References

### Completion Notes List

✅ **Task 1 Complete**: Created responsive dashboard layout with game selection interface and comprehensive stats display
✅ **Task 2 Complete**: Implemented real-time updates using SWR with 2-second polling intervals
✅ **Task 3 Complete**: Added admin authentication protection with both middleware and client-side validation

**Key Implementation Details:**

- LiveDashboard component with real-time data fetching and progress visualization
- SimpleProgressBar component for consistent progress indicators
- Dashboard page with game selection and authentication checks
- Comprehensive unit tests covering all states (loading, error, success)
- SWR integration for efficient real-time updates
- Admin authentication protection at multiple layers

### File List

- app/admin/dashboard/page.tsx (new)
- components/admin/LiveDashboard.tsx (new)
- components/admin/simple-progress-bar.tsx (new)
- tests/unit/admin/LiveDashboard.test.tsx (new)
- eslint.config.mjs (modified)
- app/admin/dashboard/actions.ts (new)
