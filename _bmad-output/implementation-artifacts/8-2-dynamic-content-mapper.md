# Story 8.2: Dynamic Content Mapper

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a crewmate,
I want to see a fresh question or mini-game every time I scan a QR code,
so that the game remains unpredictable.

## Acceptance Criteria

1. Upon scanning `questId`, the system fetches Quest Meta (Format/Type) from Redis.
2. It then selects a random entry from `quests-content.json` matching that (Format, Type).
3. **Idempotency/Rotation**: If a player re-scans a quest they _previously failed_, a _different_ content entry from the same (Format, Type) pool is selected.

## Tasks / Subtasks

- [x] Task 1: Quest Metadata Retrieval (AC: #1)
  - [x] Subtask 1.1: Create Redis action to fetch quest metadata by questId
  - [x] Subtask 1.2: Handle batch-based quest metadata vs default pool metadata
  - [x] Subtask 1.3: Add error handling for missing quest metadata
- [x] Task 2: Dynamic Content Selection (AC: #2)
  - [x] Subtask 2.1: Extend quest-pool.ts with dynamic selection logic
  - [x] Subtask 2.2: Create content mapper service with format/type filtering
  - [x] Subtask 2.3: Add random selection algorithm with proper seeding
- [x] Task 3: Failed Quest Tracking (AC: #3)
  - [x] Subtask 3.1: Extend player state to track failed quests by content ID
  - [x] Subtask 3.2: Implement rotation logic to exclude previously failed content
  - [x] Subtask 3.3: Add Redis actions for failed quest tracking
- [x] Task 4: Integration with Quest Flow
  - [x] Subtask 4.1: Update quest route to use dynamic content mapper
  - [x] Subtask 4.2: Update quest completion tracking with content IDs
  - [x] Subtask 4.3: Add comprehensive error handling and fallbacks

## Dev Notes

### Critical Architecture Requirements
- **Redis Integration**: Use existing Redis patterns from `/lib/redis/actions.ts` for quest metadata and player state
- **Content Pools**: Leverage existing quest pools in `/lib/constants/` (short.json, medium.json, long.json)
- **Idempotency**: Ensure same questId can yield different content for players who failed previously
- **Performance**: Content selection must be sub-100ms to maintain game flow

### Previous Story Intelligence (8.1)
- **Camera Scanner**: Story 8.1 implemented QR scanning with automatic navigation to `/game/[id]/quest`
- **Navigation Pattern**: Quest route receives `questId` parameter from QR scan
- **Error Handling**: Follow camera scanner patterns for graceful error states
- **Dependencies**: Camera scanner already provides questId extraction and navigation

### Source Tree Components to Touch
- **Modify**: `/lib/redis/actions.ts` - Add quest metadata and failed quest tracking actions
- **Extend**: `/lib/constants/quest-pool.ts` - Add dynamic content selection with rotation logic
- **Create**: `/lib/quests/dynamic-content-mapper.ts` - New service for content mapping and rotation
- **Modify**: `/types/quest.ts` - Extend interfaces for content tracking and failed quest state
- **Modify**: `/app/game/[id]/quest/page.tsx` - Integrate dynamic content mapper
- **Extend**: `/lib/store/game-store.ts` - Add failed quest tracking to game state

### Testing Standards Summary
- **Unit Tests**: Vitest for dynamic content mapper logic and rotation algorithms
- **Integration Tests**: Test quest metadata retrieval and content selection end-to-end
- **Mock Strategy**: Mock Redis for quest metadata and player state testing
- **Edge Cases**: Test empty pools, exhausted content, and malformed quest IDs

### Project Structure Notes
- **Alignment**: Follow existing Redis action patterns in `/lib/redis/actions.ts`
- **Naming**: Use descriptive function names following existing patterns (e.g., `getQuestContent`, `trackFailedQuest`)
- **State Management**: Extend existing Zustand store patterns for failed quest tracking
- **Error Handling**: Use existing error code patterns from `/lib/constants/error-codes.ts`

### Technical Constraints
- **Redis Performance**: All operations must complete within 100ms to maintain game flow
- **Content Exhaustion**: Handle edge case where all content in pool has been attempted
- **Backward Compatibility**: Ensure existing quest completion logic continues to work
- **Memory Efficiency**: Track only essential failed quest data (questId + contentId)

### Integration Points
- **Batch System**: Support both batch-based quests and default pool quests
- **Camera Scanner**: Integrate with existing quest route from story 8.1
- **Quest Completion**: Extend existing completion tracking to include content IDs
- **Player State**: Add failed quest tracking to existing player state structure

### Data Model Extensions
```typescript
// Extend player state for failed quest tracking
interface PlayerState {
  // ... existing fields
  failedQuests?: {
    [questId: string]: string[] // Array of content IDs that were failed
  }
}

// New content mapper result
interface QuestContentResult {
  content: QuestGame
  contentId: string
  isRotation: boolean // true if this is a rotation due to previous failure
}
```

### Algorithm Requirements
- **Random Selection**: Use cryptographically secure random for content selection
- **Rotation Logic**: When player fails quest, exclude that contentId from future selections
- **Fallback Strategy**: If all content exhausted, reset rotation and allow any content
- **Deterministic**: Same questId + player + failure history should yield same content until completion

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8](epics.md#Epic-8)
- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Modeling](architecture.md#Data-Modeling)
- [Source: _bmad-output/implementation-artifacts/8-1-in-app-camera-scanner.md](8-1-in-app-camera-scanner.md)
- [Source: lib/redis/actions.ts](../lib/redis/actions.ts)
- [Source: lib/constants/quest-pool.ts](../lib/constants/quest-pool.ts)
- [Source: types/quest.ts](../types/quest.ts)

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha)

### Debug Log References

### Completion Notes List

- **Task 1 - Quest Metadata Retrieval**: Successfully implemented Redis actions for fetching quest metadata with support for both batch-specific and default pool metadata. Added comprehensive error handling for missing metadata.

- **Task 2 - Dynamic Content Selection**: Created DynamicContentMapper service with cryptographically secure random selection and rotation logic. Extended quest-pool.ts with exclusion-based selection functions.

- **Task 3 - Failed Quest Tracking**: Implemented Redis-based failed quest tracking per player with content ID granularity. Added rotation logic to exclude previously failed content while providing fallback when all content is exhausted.

- **Task 4 - Integration**: Successfully integrated dynamic content mapper into quest flow. Updated QuestView component to use dynamic content and record failed quests. Updated game store with new state management for failed quest tracking.

### File List

- **Modified**: `/lib/redis/actions.ts` - Added quest metadata and failed quest tracking actions
- **Extended**: `/lib/constants/quest-pool.ts` - Added dynamic content selection with rotation logic
- **Created**: `/lib/quests/dynamic-content-mapper.ts` - New service for content mapping and rotation
- **Modified**: `/types/quest.ts` - Extended interfaces for content tracking and failed quest state
- **Modified**: `/app/game/[id]/quest/page.tsx` - Integrated dynamic content mapper
- **Extended**: `/lib/store/game-store.ts` - Added failed quest tracking to game state
- **Modified**: `/components/game/quest-view.tsx` - Updated to use dynamic content and record failures
- **Created**: `/tests/unit/dynamic-content-mapper.test.ts` - Comprehensive tests for content mapper
- **Created**: `/tests/unit/quest-pool-dynamic.test.ts` - Tests for new quest pool functions
- **Modified**: `/tests/unit/quest-page.test.tsx` - Updated mocks for new store functions
- **Modified**: `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated sprint tracking
