# Story 8.1: In-App Camera Scanner

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to trigger my camera directly from the game dashboard,
so that I can scan QR codes without leaving the web app.

## Acceptance Criteria

1. Persistent "SCAN" button on the Game Dashboard.
2. Clicking it opens a camera overlay using `MediaDevices API`.
3. Successful QR detection automatically triggers navigation to the quest route.

## Tasks / Subtasks

- [x] Task 1: Camera Scanner Component (AC: #2)
  - [x] Subtask 1.1: Create camera overlay component with MediaDevices API
  - [x] Subtask 1.2: Implement QR code detection using qr-scanner or similar library
  - [x] Subtask 1.3: Add camera permission handling and error states
- [x] Task 2: Integration with Game Dashboard (AC: #1)
  - [x] Subtask 2.1: Update scan-button.tsx to trigger camera overlay instead of being disabled
  - [x] Subtask 2.2: Add proper state management for scanner visibility
- [x] Task 3: Navigation Integration (AC: #3)
  - [x] Subtask 3.1: Implement automatic navigation to /game/[id]/quest on QR detection
  - [x] Subtask 3.2: Pass detected questId to quest route
  - [x] Subtask 3.3: Add loading states during navigation

## Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Fixed camera permission logic to handle 'prompt' state in camera-scanner.tsx:38
- [x] [AI-Review][HIGH] Fixed memory leak risk by improving cleanup function in camera-scanner.tsx:80-91
- [x] [AI-Review][HIGH] Added missing accessibility attributes to video element in camera-scanner.tsx:213-214
- [x] [AI-Review][MEDIUM] Updated File List to include missing test file documentation
- [x] [AI-Review][LOW] Exported UseCameraScannerOptions and UseCameraScannerReturn interfaces in use-camera-scanner.ts:6-16

## Dev Notes

### Critical Architecture Requirements
- **MediaDevices API**: Use HTML5 MediaDevices API for camera access (Architecture.md line 60)
- **Performance**: Sub-300ms transition from scan to quest (UX Design line 177)
- **Mobile-First**: Touch-optimized interactions with haptic feedback
- **Error Handling**: Graceful fallbacks for camera denial or unsupported browsers

### Source Tree Components to Touch
- **Modify**: `/components/game/scan-button.tsx` - Enable camera functionality
- **Create**: `/components/game/camera-scanner.tsx` - New camera overlay component
- **Modify**: `/components/game/game-home.tsx` - Integrate scanner state
- **Create**: `/hooks/use-camera-scanner.ts` - Custom hook for camera logic
- **Extend**: `/types/game.ts` - Add scanner-related types if needed

### Testing Standards Summary
- **Unit Tests**: Vitest for camera hook logic and QR detection
- **Integration Tests**: Test camera overlay integration with game dashboard
- **Mock Strategy**: Mock MediaDevices API for CI/CD testing
- **Manual Testing**: Test on real devices for camera permissions and QR scanning

### Project Structure Notes
- **Alignment**: Follow existing component patterns in `/components/game/`
- **Naming**: Use kebab-case for components, PascalCase for React components
- **Imports**: Maintain existing import structure (Framer Motion, Lucide icons, etc.)
- **State Management**: Use existing Zustand store patterns from `/lib/store/`

### Technical Constraints
- **Browser Support**: MediaDevices API requires HTTPS and modern browsers
- **Permissions**: Must handle camera permission gracefully
- **Performance**: QR scanning should not block UI thread
- **Memory**: Clean up camera streams properly to avoid memory leaks

### UX Requirements
- **Haptic Feedback**: Use existing vibration patterns from scan-button.tsx
- **Visual Feedback**: Loading states during camera initialization
- **Error States**: Clear messaging for camera access denied
- **Accessibility**: Proper ARIA labels and keyboard navigation

### Integration Points
- **Redis**: No direct Redis interaction needed for this story
- **Navigation**: Use Next.js router for quest navigation
- **State**: Integrate with existing game state via Zustand store

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-8](epics.md#Epic-8)
- [Source: _bmad-output/planning-artifacts/architecture.md#Device-Integration](architecture.md#Device-Integration)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Experience-Mechanics](ux-design-specification.md#Experience-Mechanics)
- [Source: components/game/scan-button.tsx](../components/game/scan-button.tsx)
- [Source: types/game.ts](../types/game.ts)

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha)

### Debug Log References

### Completion Notes List

- **Camera Scanner Component**: Created `/components/game/camera-scanner.tsx` with MediaDevices API integration, QR code detection using qr-scanner library, comprehensive error handling for camera permissions, and haptic feedback on successful scans.
- **Custom Hook**: Implemented `/hooks/use-camera-scanner.ts` for state management and navigation logic with automatic quest ID extraction from QR codes.
- **Game Dashboard Integration**: Updated `/components/game/game-home.tsx` to integrate camera scanner with proper state management and `/components/game/scan-button.tsx` to support camera scanner trigger.
- **Testing**: Created comprehensive unit tests for the camera scanner hook covering all scenarios including navigation, error handling, and haptic feedback.
- **Dependencies**: Added `qr-scanner` library for QR code detection functionality.
- **Performance**: Optimized for sub-300ms transition from scan to quest with loading states and proper cleanup of camera resources.

### File List

- `/components/game/camera-scanner.tsx` (NEW) - Camera overlay component with QR scanning
- `/hooks/use-camera-scanner.ts` (NEW) - Custom hook for camera scanner state management
- `/components/game/game-home.tsx` (MODIFIED) - Integrated camera scanner
- `/components/game/scan-button.tsx` (MODIFIED) - Added gameId prop support
- `/tests/unit/hooks/use-camera-scanner.test.ts` (NEW) - Unit tests for camera scanner hook
- `/tests/unit/game-home.test.tsx` (MODIFIED) - Updated tests for camera integration
- `/tests/setup.ts` (NEW) - Test setup for jest-dom matchers
- `/vitest.config.ts` (MODIFIED) - Added test setup configuration
- `/package.json` (MODIFIED) - Added qr-scanner dependency
