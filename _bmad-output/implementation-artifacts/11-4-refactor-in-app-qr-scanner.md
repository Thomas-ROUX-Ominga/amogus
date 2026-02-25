# Story 11.4: Refactor In-App QR Scanner

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to reliably scan QR codes using my device's camera,
so that I can complete quests efficiently.

## Acceptance Criteria

1. The current camera scanner implementation is replaced or heavily refactored using a robust library like `html5-qrcode`.
2. The scanner works reliably on both Desktop browsers (with webcams) and Mobile devices (with rear cameras).
3. The scanning experience remains fast and seamlessly redirects upon successful QR detection.

## Tasks / Subtasks

- [x] Task 1: Replace Scanner library (AC: 1)
  - [x] Subtask 1.1: Install `html5-qrcode` dependency
  - [x] Subtask 1.2: Swap out the existing `react-qr-reader` or native MediaDevices implementation with `html5-qrcode` in the scanner component
- [x] Task 2: Robust Camera handling (AC: 2)
  - [x] Subtask 2.1: Handle camera permissions gracefully
  - [x] Subtask 2.2: Configure scanner to prefer rear-facing cameras on mobile devices
- [x] Task 3: Seamless Redirection (AC: 3)
  - [x] Subtask 3.1: Fix the callback logic to ensure that a successful scan (`/quest/XYZ`) instantly triggers the navigation router without flickering

## Dev Notes

### Architecture Intelligence

**QR Library Switch:**

- The current implementation was buggy and didn't trigger correctly. We are switching to `html5-qrcode` because it supports better targeting of environment cameras and handles varied lighting conditions much better.
- Remove the old library from `package.json` to keep things clean.

### Project Structure Notes

**File Locations:**

- Scanner component: `components/game/camera-scanner.tsx` or similar scanner component.
- Package file: `package.json`

### References

- [Source: epics.md#Story-11.4:-Refactor-In-App-QR-Scanner]

## Dev Agent Record

### Agent Model Used

Penguin Alpha via Cascade

### Debug Log References

- Replaced qr-scanner library with html5-qrcode for better reliability
- Updated component to use Html5QrcodeScanner instead of native MediaDevices
- Configured scanner to prefer rear-facing cameras on mobile devices
- Added comprehensive error handling for camera permissions
- Implemented seamless redirection by pausing scanner on successful scan
- Enhanced error messages with specific troubleshooting steps
- Created comprehensive unit tests for all functionality

### Completion Notes List

- Task 1 completed: Successfully replaced qr-scanner with html5-qrcode library
- Task 2 completed: Enhanced camera permission handling and mobile camera preference
- Task 3 completed: Implemented seamless redirection without flickering
- Component now uses more robust scanning technology with better mobile support
- Camera handling improved with environment camera preference and better error messages
- Tests created to verify functionality, error handling, and seamless redirection
- All acceptance criteria satisfied

### File List

- components/game/camera-scanner.tsx (refactored to use low-level html5-qrcode API with environment camera auto-start)
- tests/unit/components/camera-scanner.test.tsx (updated to verify alphanumeric extraction and auto-start)
- components/admin/batch-detail.tsx (updated in context of Story 11.3 fixes)
- lib/quests/quest-assignment.ts (new quest assignment logic)
- lib/redis/actions.ts (updated joinGame and completeQuest)
- package.json (updated dependencies)

### Change Log

- Replaced qr-scanner dependency with html5-qrcode for improved reliability
- Enhanced camera permission handling with fallback for unsupported browsers
- Added seamless redirection logic to prevent UI flickering
- Improved error messages with specific troubleshooting guidance
- Added comprehensive test coverage for all new functionality
