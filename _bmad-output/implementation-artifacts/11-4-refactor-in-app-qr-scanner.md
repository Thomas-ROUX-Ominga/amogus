# Story 11.4: Refactor In-App QR Scanner

Status: ready-for-dev

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

- [ ] Task 1: Replace Scanner library (AC: 1)
  - [ ] Subtask 1.1: Install `html5-qrcode` dependency
  - [ ] Subtask 1.2: Swap out the existing `react-qr-reader` or native MediaDevices implementation with `html5-qrcode` in the scanner component
- [ ] Task 2: Robust Camera handling (AC: 2)
  - [ ] Subtask 2.1: Handle camera permissions gracefully
  - [ ] Subtask 2.2: Configure scanner to prefer rear-facing cameras on mobile devices
- [ ] Task 3: Seamless Redirection (AC: 3)
  - [ ] Subtask 3.1: Fix the callback logic to ensure that a successful scan (`/quest/XYZ`) instantly triggers the navigation router without flickering

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

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
