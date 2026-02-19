# Story 6.3: QR & Localization

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to name the physical location of each quest and download a PDF for printing,
so that I can setup the game area IRL.

## Acceptance Criteria

- **AC 1**: Interface to list all quests in a Batch with an editable "Location" text field (e.g., "Machine à café").
- **AC 2**: "Generate PDF" button produces a document where each page contains: 1 QR Code pointing to `/quest/{questId}`, the Location label, and the Quest Format (S/M/L).
- **AC 3**: QR Codes carry the persistent Quest ID from the Batch, independent of any specific Game session.

## Tasks / Subtasks

- [x] Core: Update types and dependencies (AC: 1, 2)
  - [x] Add `location` string to `Quest` interface in `types/quest.ts`
  - [x] Install `jspdf` and `qrcode` dependencies
- [x] Data: Implement location persistence (AC: 1)
  - [x] Create `updateQuestsLocations` action in `lib/redis/batch-actions.ts`
  - [x] Add unit tests for location updates in `tests/unit/batch-actions.test.ts`
- [x] Logic: Create PDF generation utility (AC: 2, 3)
  - [x] Implement `lib/utils/pdf-utils.ts` using `jspdf` and `qrcode`
  - [x] Ensure QR codes point to `/quest/{questId}`
  - [x] Add labels for Location and Format (S/M/L) to each page
- [x] UI: Build batch detail and management interface (AC: 1, 2)
  - [x] Create `app/admin/batches/[id]/page.tsx` for batch details
  - [x] Create `components/admin/batch-detail.tsx` with editable location fields
  - [x] Integrate "Generate PDF" button with `pdf-utils`
  - [x] Add "Manage" button to `components/admin/batch-list.tsx`
- [x] Verification: End-to-end testing
  - [x] Verify PDF generation button existence and location saving

## Dev Notes

### Architecture Compliance

- **Redis Actions**: Use Server Actions for all Redis mutations following the established pattern.
- **Client-Side Generation**: Perform PDF/QR generation on the client to reduce server load and leverage browser APIs.
- **Tactical Aesthetic**: Match the existing terminal theme for the batch detail UI.

### Technical Requirements

- **PDF Layout**: One quest per page, high-contrast QR code for reliable scanning.
- **URL Schema**: QR codes MUST link to `/quest/[questId]` as per AC 2.
- **Persistence**: Location updates must be atomic to prevent batch corruption.

### File Structure Requirements

- **Dynamic Route**: `app/admin/batches/[id]/page.tsx`
- **Utility**: `lib/utils/pdf-utils.ts`
- **Component**: `components/admin/batch-detail.tsx`

### Project Structure Notes

- Alignment with `app/admin/` structure and `components/admin/` organization.
- New dependencies `jspdf` and `qrcode` added for specialized output.

### References

- [Epics: Story 6.3 Requirements](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L56)
- [Architecture: Data Modeling](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L42)
- [Previous Story: 6.2 Batch Generation](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/6-2-batch-generation-and-logic.md)

## Dev Agent Record

### Agent Model Used

Antigravity (Advanced Agentic Assistant)

### Debug Log References

- Story creation workflow executed following `create-story` instructions.
- Plan approved by user on 2026-02-15.

### Completion Notes List

- [x] Generated story document with full context and task breakdown.
- [x] Implemented physical location persistence for quests.
- [x] Created PDF generation utility with embedded QR codes.
- [x] Built admin batch management interface with inline editing.
- [x] Fixed project-wide lint and TypeScript errors in test suite.
- [x] Addressed code review findings: Added security checks to batch actions and updated documentation.

### File List

- `types/quest.ts` (MODIFIED)
- `lib/redis/batch-actions.ts` (MODIFIED)
- `lib/utils/pdf-utils.ts` (NEW)
- `app/admin/batches/[id]/page.tsx` (NEW)
- `components/admin/batch-detail.tsx` (NEW)
- `components/admin/batch-list.tsx` (MODIFIED)
- `tests/unit/batch-actions.test.ts` (MODIFIED)
- `tests/unit/components/admin/refresh-button.test.tsx` (MODIFIED - TS fix)
- `tests/unit/components/admin/refresh-button.test.tsx` (MODIFIED)
- `lib/constants/error-codes.ts` (MODIFIED)
- `package.json` (MODIFIED)
- `package-lock.json` (MODIFIED)
