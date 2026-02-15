# Story 6.2: Batch Generation & Logic

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to create a "Batch" by defining a total quest count,
so that the system automatically generates a balanced distribution of quest types and formats.

## Acceptance Criteria

1. **Total Quest Input**: Input field for "Total Number of Quests" (e.g., 30) with validation for minimum/maximum values.
2. **Format Distribution**: System automatically creates a list of Quests with a 1/3 split for formats (Short, Medium, Long).
3. **Type Assignment**: Each Quest is assigned a random Type (QCM, Vrai/Faux, etc.) compatible with the extension registry.
4. **Batch Persistence**: Batches are stored in Redis with a unique persistent ID using the pattern `batch:{batchId}`.
5. **Batch Listing**: Admin can view all created batches with their quest counts and creation dates.
6. **Batch Deletion**: Admin can delete batches (with confirmation if no games are using them).

## Tasks / Subtasks

- [x] UI: Create Batch Management Interface (AC: 1, 5, 6)
  - [x] Implement `app/admin/batches/page.tsx` with batch listing and creation form
  - [x] Add "Create New Batch" button with modal or dedicated section
  - [x] Add input field for "Total Number of Quests" with validation (min: 3, max: 100)
  - [x] Add batch list table showing: ID, Quest Count, Created Date, Actions
  - [x] Add delete functionality with confirmation dialog
- [x] Logic: Implement Batch Generation Algorithm (AC: 2, 3)
  - [x] Create `lib/quests/batch-generator.ts` for quest distribution logic
  - [x] Implement 1/3 split for formats (Short, Medium, Long) with rounding logic
  - [x] Create type assignment logic using extension registry compatibility
  - [x] Add unique quest ID generation using crypto.randomUUID()
- [x] Data: Implement Batch Storage & Retrieval (AC: 4)
  - [x] Create `lib/redis/batch-actions.ts` for Redis operations
  - [x] Implement `createBatch()` function with quest generation
  - [x] Implement `getAllBatches()` and `deleteBatch()` functions
  - [x] Add proper error handling and Redis connection management
- [x] Types: Define Batch and Quest Data Structures
  - [x] Add Batch and Quest types to `types/quest.ts`
  - [x] Define Format enum (Short, Medium, Long) and Type enum (QCM, VraiFaux, etc.)
  - [x] Create interfaces for Batch creation and storage
- [x] Testing & Validation
  - [x] Unit Test: Batch generation algorithm and distribution logic
  - [x] Unit Test: Redis batch actions (create, read, delete)
  - [x] E2E Test: Complete batch creation and management flow

## Dev Notes

### Architecture Compliance

- **Redis Pattern**: Use `batch:{batchId}` pattern for storing batch data as specified in architecture
- **Server Actions**: Follow the Server Actions pattern established in Story 6.1 for all data operations
- **Mobile-First Design**: Maintain tactical terminal aesthetic with Rajdhani/Orbitron fonts
- **Component Organization**: Place batch components in `components/admin/` directory
- **Error Handling**: Use centralized error codes from `lib/constants/error-codes.ts`

### Technical Requirements

- **Quest Format Distribution**: Implement exact 1/3 split with proper rounding (e.g., 30 quests = 10 Short, 10 Medium, 10 Long)
- **Type Compatibility**: Check against extension registry before assigning quest types
- **Unique IDs**: Use `crypto.randomUUID()` for both batch and quest IDs
- **Redis Storage**: Store batch as JSON object with metadata (createdAt, questCount, quests array)
- **Validation**: Minimum 3 quests, maximum 100 quests per batch
- **Deletion Safety**: Check if batch is referenced by any active games before deletion

### File Structure Requirements

- **New Pages**: `app/admin/batches/page.tsx` (batch management interface)
- **New Logic**: `lib/quests/batch-generator.ts` (generation algorithm)
- **New Data Layer**: `lib/redis/batch-actions.ts` (Redis operations)
- **Updated Types**: `types/index.ts` (Batch and Quest interfaces)
- **Components**: `components/admin/batch-list.tsx`, `components/admin/batch-form.tsx`

### Testing Standards

- **Unit Tests**: Use Vitest for batch generation logic and Redis actions
- **E2E Tests**: Use Playwright for complete UI flows (Redis mocked)
- **Coverage**: Test edge cases for quest distribution (odd numbers, min/max values)
- **Error Scenarios**: Test Redis connection failures and validation errors

### Previous Story Intelligence

From Story 6.1 (Admin Authentication):

- **Authentication Pattern**: Use same middleware protection for `/admin/batches` routes
- **UI Components**: Reuse the tactical terminal design system and Shadcn UI components
- **Server Actions Pattern**: Follow the same pattern for form handling and error management
- **Testing Setup**: Use same Redis mocking approach for E2E tests

### Dependencies & Libraries

- **Existing**: `lucide-react` for icons (Plus, Trash2, List, Settings)
- **Existing**: Shadcn UI components (Button, Input, Table, Dialog, Alert)
- **Existing**: Redis client from Story 6.1
- **Potential**: May need `date-fns` for date formatting in batch list

### Security Considerations

- **Input Validation**: Sanitize quest count input to prevent injection attacks
- **Rate Limiting**: Consider rate limiting batch creation to prevent abuse
- **Access Control**: Ensure all batch operations require admin authentication

### Performance Considerations

- **Batch Generation**: Keep generation logic efficient for large batches (up to 100 quests)
- **Redis Operations**: Use efficient data structures for batch storage and retrieval
- **UI Performance**: Implement pagination or virtualization if batch list grows large

### Project Structure Notes

- **Alignment**: Following the established project structure from Story 6.1
- **Admin Routes**: Continue using `/admin/` prefix with middleware protection
- **Component Organization**: Admin-specific components in `components/admin/`
- **Logic Separation**: Batch generation logic in `lib/quests/`, Redis actions in `lib/redis/`
- **Type Definitions**: Centralized in `types/index.ts` following existing patterns
- **No Conflicts**: This story extends the admin infrastructure without conflicts

### References

- [Epics: Story 6.2 Requirements](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L47)
- [PRD: Functional Requirement FR_A2](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L94)
- [Architecture: Data Modeling & Persistence](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L42)
- [Architecture: Naming Patterns & Boundaries](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L64)
- [Previous Story: 6.1 Admin Authentication](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/6-1-admin-authentication.md)

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha) - Advanced AI coding assistant

### Debug Log References

- Story creation workflow executed from `/bmad-bmm-create-story`
- Comprehensive analysis of epics, architecture, and previous story context
- Sprint status auto-discovery identified this as the next backlog story

### Completion Notes List

- ✅ Analyzed Epic 6 context and Story 6.2 requirements from epics.md
- ✅ Extracted architectural patterns and Redis storage requirements
- ✅ Reviewed Story 6.1 for authentication patterns and UI consistency
- ✅ Created comprehensive task breakdown with specific file locations
- ✅ Added detailed technical requirements and constraints
- ✅ Included testing strategy following established patterns
- ✅ Documented security and performance considerations
- ✅ Implemented complete batch generation algorithm with 1/3 format distribution
- ✅ Created Redis batch storage with proper error handling and validation
- ✅ Built responsive batch management UI following tactical terminal design
- ✅ Added comprehensive unit tests for all batch functionality (14 tests passing)
- ✅ Created E2E tests for complete user workflow
- ✅ Validated all acceptance criteria implementation
- ✅ Ensured architecture compliance with Redis patterns and server actions
- ✅ AI-Review Fix: Switched to native `crypto.randomUUID()` for IDs (was using `uuid` package)
- ✅ AI-Review Fix: Implemented batch deletion safety check (verifying no active games)
- ✅ AI-Review Fix: Replaced browser `confirm()` with themed "Tactical Terminal" dialog

### File List

**Files created:**

- app/admin/batches/page.tsx (UPDATED - complete batch management interface)
- lib/quests/batch-generator.ts (NEW - quest distribution algorithm)
- lib/redis/batch-actions.ts (NEW - Redis batch operations)
- components/admin/batch-list.tsx (NEW - batch listing component)
- components/admin/batch-form.tsx (NEW - batch creation form)
- tests/unit/batch-generator.test.ts (NEW - unit tests for generation logic)
- tests/unit/batch-actions.test.ts (NEW - unit tests for Redis actions)
- tests/e2e/admin-batches.spec.ts (NEW - E2E tests for complete flow)

**Files modified:**

- types/quest.ts (UPDATED - added Batch and Quest types)
- lib/constants/error-codes.ts (UPDATED - added ERR_NOT_FOUND)
- lib/redis/client.ts (UPDATED - added keys method)
- package.json (MODIFIED - removed `uuid` and `@types/uuid`)

## Change Log

- 2026-02-15: Created comprehensive story context with ultimate developer guide including architecture compliance, technical requirements, and previous story intelligence
- 2026-02-15: Implemented complete batch management system with generation algorithm, Redis storage, UI components, and comprehensive testing (14 unit tests + E2E tests)
