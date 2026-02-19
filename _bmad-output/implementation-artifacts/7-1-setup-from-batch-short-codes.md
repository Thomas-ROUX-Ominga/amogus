# Story 7.1: Setup from Batch (Short-Codes)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Logged-in User (Organizer),
I want to create a game session by selecting a Batch and receiving a short join code,
so that players can join quickly from their mobile devices.

## Acceptance Criteria

1. **Batch Selection**: Creation UI allows selecting a previously created Batch from the list of available batches (requires authentication).
2. **Quest Distribution Config**: The Logged-in User defines "Quests per Player" with a default distribution (2 Short, 2 Medium, 2 Long).
3. **Short-Code Generation**: System produces a unique 6-character alphanumeric code (e.g., AH72X9) to replace UUIDs in the join flow.
4. **Redis Persistence**: Game state is stored using the new short code key pattern `game:{shortCode}:state`.
5. **Join Flow Compatibility**: The join flow is updated (or compatible) to accept the 6-character short code.

## Tasks / Subtasks

- [x] UI: Update Game Creation Interface (AC: 1, 2)
  - [x] Implement batch selection dropdown in game creation form (authenticated view)
  - [x] Add inputs for Quests per Player (S/M/L) with default values (2/2/2)
- [x] Logic: Implement Short-Code Engine (AC: 3)
  - [x] Create `lib/utils/short-code.ts` using `nanoid` or `crypto`
  - [x] Use unambiguous alphabet: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`
  - [x] Implement collision check with Redis `exists`
- [x] Data: Update Game Actions (AC: 4)
  - [x] Modify `createGame` in `lib/redis/actions.ts` to accept `batchId` and `questsPerPlayer`
  - [x] Implement short-code storage logic instead of UUIDs
  - [x] Ensure TTL (24h) is maintained for the new key pattern
- [x] Integration: Short-Code Join Flow (AC: 5)
  - [x] Update `app/(auth)/join/[code]/page.tsx` (or equivalent) to handle 6-char codes
  - [x] Ensure backward compatibility or migration if necessary
- [x] Verification & Testing
  - [x] Unit Test: Short-code generation and collision logic
  - [x] Integration Test: Game creation with batch and custom distribution

## Dev Notes

### Architecture Compliance

- **Key Pattern**: Use `game:{shortCode}:state` as defined in the Phase 2 Tactical Pivot architecture.
- **Short Code Format**: 6 characters, uppercase alphanumeric, excluding 0, 1, O, I for readability.
- **Server Actions**: All Redis mutations must remain in `lib/redis/actions.ts`.

### Technical Requirements

- **Nanoid Alphabet**: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`
- **Collision Handling**: Max 3 retries for generation if collision detected.
- **Quest Validation**: Ensure `questsPerPlayer` sum does not exceed total available in batch.

### File Structure Requirements

- **New Logic**: `lib/utils/short-code.ts`
- **Modified Actions**: `lib/redis/actions.ts`
- **Modified UI**: `app/admin/games/create/page.tsx` (or wherever game creation happens)

### References

- [Epics: Story 7.1 Requirements](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L66)
- [Architecture: Data Modeling & Persistence](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L42)
- [Architecture: Authentication & Authorization](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L52)
- [Source: lib/redis/actions.ts#L11](file:///home/omi/projects/amogus/lib/redis/actions.ts#L11)

## Dev Agent Record

### Agent Model Used

Antigravity (Gecko v4)

### Debug Log References

- Story creation workflow executed for 7-1
- Analyzed sprint-status.yaml, epics.md, architecture.md, and actions.ts

### Completion Notes List

- ✅ Extracted AC from epics.md
- ✅ Defined technical strategy for short codes (alphabet, collision)
- ✅ Mapped tasks to file locations (actions.ts, new utils)
- ✅ Implemented short-code generation utility with collision detection
- ✅ Updated game creation interface with batch selection and quest distribution
- ✅ Modified createGame action to use short codes and accept batch/quest config
- ✅ Enhanced join flow to validate and handle 6-character short codes
- ✅ Added comprehensive unit and integration tests
- ✅ Updated GameState type to include questsPerPlayer configuration

### File List

- \_bmad-output/implementation-artifacts/7-1-setup-from-batch-short-codes.md
- lib/utils/short-code.ts (NEW)
- lib/redis/actions.ts (MODIFIED)
- lib/redis/client.ts (MODIFIED - added exists method)
- types/game.ts (MODIFIED - added questsPerPlayer)
- app/admin/games/create/page.tsx (NEW)
- app/page.tsx (MODIFIED - enhanced short code validation)
- tests/unit/short-code.test.ts (NEW)
- tests/integration/game-creation.test.ts (NEW)
