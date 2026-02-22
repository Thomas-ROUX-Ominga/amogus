# Story 8.3: Atomic Success Flow (Flicker Fix)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to be redirected to my dashboard immediately after validation,
so that I don't see glitchy intermediate screens.

## Acceptance Criteria

1. Success Overlay appears for exactly 2 seconds.
2. Redirect to `/game/[id]` happens in the background during the animation.
3. Removal of any logic that displays a second quest choice or redirects to Home/Login after a win.

## Tasks / Subtasks

- [x] Task 1: Analyze Current Success Flow Issues (AC: #1, #2, #3)
  - [x] Subtask 1.1: Document current quest completion flow and identify flicker points
  - [x] Subtask 1.2: Analyze timing issues in success overlay and redirect logic
  - [x] Subtask 1.3: Identify intermediate screens causing visual glitches
- [x] Task 2: Implement Atomic Success Flow (AC: #1, #2)
  - [x] Subtask 2.1: Modify success overlay timing to exactly 2 seconds
  - [x] Subtask 2.2: Implement background redirect during overlay animation
  - [x] Subtask 2.3: Remove completion status display from quest view
- [x] Task 3: Clean Up Redirect Logic (AC: #3)
  - [x] Subtask 3.1: Remove any second quest choice logic after completion
  - [x] Subtask 3.2: Eliminate Home/Login redirects after successful quest completion
  - [x] Subtask 3.3: Ensure single clean redirect to game dashboard
- [x] Task 4: Testing and Validation
  - [x] Subtask 4.1: Test atomic flow for both crewmate and impostor roles
  - [x] Subtask 4.2: Verify no intermediate screens or flicker effects
  - [x] Subtask 4.3: Test edge cases (network delays, rapid quest completion)

## Dev Notes

### Critical Architecture Requirements
- **Atomic Flow**: Success overlay must be the only visual element during quest completion
- **Background Redirect**: Navigation to `/game/[id]` must happen during overlay animation
- **Timing Precision**: Exactly 2-second overlay duration with no additional delays
- **Role Consistency**: Both crewmate and impostor flows must be atomic

### Previous Story Intelligence (8.2)
- **Dynamic Content**: Story 8.2 implemented dynamic quest content with rotation logic
- **Quest Completion**: Current completion flow shows multiple status screens causing flicker
- **Success Overlay**: Existing overlay component works but timing needs adjustment
- **Store Integration**: Quest completion tracking is properly integrated in game store

### Current Flow Issues Identified
From analysis of `components/game/quest-view.tsx`:
1. **Line 110-122**: Auto-redirect after success overlay shows intermediate clearQuest() calls
2. **Line 254-311**: Completion status area displays "MISSION ENREGISTRÉE" message
3. **Line 32**: `REDIRECT_DELAY_MS = 2500` creates 2.5-second total delay
4. **Multiple State Updates**: Quest answered → completion → overlay → redirect creates visual jumps

### Source Tree Components to Touch
- **Modify**: `/components/game/quest-view.tsx` - Remove completion status display, fix timing
- **Modify**: `/components/game/success-overlay.tsx` - Adjust timing to exactly 2 seconds
- **Modify**: `/lib/store/game-store.ts` - Update clearQuest logic for atomic flow
- **Test**: `/tests/unit/quest-view.test.tsx` - Update tests for new atomic flow
- **Test**: `/tests/integration/quest-completion.test.ts` - End-to-end flow validation

### Testing Standards Summary
- **Unit Tests**: Verify exact 2-second timing and background redirect logic
- **Integration Tests**: Test complete atomic flow without intermediate screens
- **Visual Regression**: Ensure no flicker or glitch effects during completion
- **Role Testing**: Validate both crewmate and impostor atomic flows

### Project Structure Notes
- **Alignment**: Follow existing success overlay patterns in `/components/game/success-overlay.tsx`
- **Timing**: Use consistent timing patterns with other game animations
- **State Management**: Minimize state updates during completion to prevent visual jumps
- **Error Handling**: Maintain existing error handling for completion failures

### Technical Constraints
- **Performance**: Background redirect must complete within 2-second overlay window
- **Animation Smoothness**: No layout shifts or visual artifacts during transition
- **Browser Compatibility**: Ensure consistent timing across different browsers
- **Mobile Optimization**: Touch interactions must remain responsive during flow

### Implementation Strategy
1. **Phase 1**: Remove completion status display area from quest view
2. **Phase 2**: Adjust success overlay timing to exactly 2 seconds
3. **Phase 3**: Implement background redirect with proper cleanup
4. **Phase 4**: Remove any remaining intermediate screens or redirects

### Data Flow Changes
```typescript
// Current: Quest Answer → Completion Status → Success Overlay → Redirect
// New: Quest Answer → Success Overlay (with background redirect) → Dashboard

// Remove these intermediate states:
- setQuestAnswered(true) visual feedback
- "MISSION ENREGISTRÉE" completion message
- Multiple clearQuest() calls
```

### Animation Timing Requirements
- **Success Overlay**: Exactly 2000ms duration
- **Background Redirect**: Initiated at 1500ms to complete by 2000ms
- **Cleanup**: All state updates must complete before overlay disappears
- **Fallback**: Handle redirect failures gracefully within overlay window

### Mobile Considerations
- **Touch Response**: Ensure overlay dismiss button remains responsive
- **Performance**: Background redirect must not block UI thread
- **Battery**: Minimize unnecessary re-renders during completion flow
- **Network**: Handle slow network responses during redirect

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.3](epics.md#Story-8.3)
- [Source: _bmad-output/implementation-artifacts/8-2-dynamic-content-mapper.md](8-2-dynamic-content-mapper.md)
- [Source: components/game/quest-view.tsx](../components/game/quest-view.tsx)
- [Source: components/game/success-overlay.tsx](../components/game/success-overlay.tsx)
- [Source: lib/store/game-store.ts](../lib/store/game-store.ts)

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha)

### Debug Log References

#### Task 1 Analysis Results

**Subtask 1.1: Current Quest Completion Flow Documentation**

Current flow identified in `components/game/quest-view.tsx`:
1. **Quest Answer** → `handleSuccess()` → `setQuestAnswered(true)`
2. **Completion Recording** → `completeQuestAction()` → API call
3. **Success Overlay** → `triggerSuccessFlow()` → `setShowSuccessOverlay(true)`
4. **Completion Status Display** → "MISSION ENREGISTRÉE" message (lines 264-278)
5. **Auto-redirect** → `clearQuest()` + `router.push('/game/${gameId}')` after 2500ms

**Flicker Points Identified:**
- Line 254-311: Completion status area shows "MISSION ENREGISTRÉE" during success overlay
- Line 32: `REDIRECT_DELAY_MS = 2500` creates timing mismatch
- Multiple state updates cause visual jumps between states
- clearQuest() called twice (lines 113, 119) causing potential visual artifacts

**Subtask 1.2: Timing Issues Analysis**

Current timing problems:
- Success overlay has no explicit duration control
- Redirect delay is 2500ms but overlay should be exactly 2000ms
- Background redirect not implemented - all redirects happen after overlay
- Multiple setTimeout calls create race conditions

**Subtask 1.3: Intermediate Screens Causing Glitches**

Visual glitches identified:
1. **Completion Status Area** (lines 254-311): Shows "MISSION ENREGISTRÉE" during overlay
2. **Loading States**: Multiple loading/completion states create visual jumps
3. **State Transitions**: questAnswered → isCompletingQuest → showSuccessOverlay → redirect
4. **Double clearQuest()**: Lines 113 and 119 create potential state inconsistencies

### Completion Notes List

✅ **Atomic Success Flow Implementation Complete**

**Key Changes Made:**
1. **SuccessOverlay Enhancement**: Added duration prop, auto-exit functionality, and allowManualExit prop for exact 2-second timing
2. **QuestView Atomic Flow**: Removed "MISSION ENREGISTRÉE" completion status display to eliminate flicker
3. **True Background Redirect**: Implemented redirect starting at 1500ms (during overlay animation) completing by 2000ms
4. **Async Navigation**: Made redirect async to prevent layout shift and improve performance
5. **Manual Exit Control**: Disabled manual dismissal during atomic flow to ensure timing guarantees
6. **Error State Preservation**: Maintained error display for completion failures while keeping atomic flow for success
7. **Loading State**: Preserved "Enregistrement..." display during server communication

**Senior Developer Review Fixes Applied:**
- Fixed AC2: Background redirect now truly happens during overlay animation (1500ms start, 2000ms completion)
- Fixed Task 2.2: Redirect is now asynchronous and happens in background
- Fixed Task 3.3: Removed intermediate state updates that caused visual changes
- Fixed AC1: Overlay timing is now exactly 2 seconds with no early dismissal
- Updated File List to include sprint-status.yaml
- Added comprehensive test coverage for manual dismissal scenarios

**Acceptance Criteria Met:**
- ✅ AC1: Success Overlay appears for exactly 2 seconds (no early dismissal)
- ✅ AC2: Redirect to `/game/[id]` happens during overlay animation (starts at 1500ms)
- ✅ AC3: Removed intermediate screens that cause visual glitches

**Test Coverage:**
- ✅ All 26 existing tests passing
- ✅ New atomic flow tests for exact timing validation (1500ms redirect start)
- ✅ Tests for both crewmate and impostor roles
- ✅ Tests verifying no intermediate screens during success flow
- ✅ Tests confirming manual exit button is hidden during atomic flow
- ✅ Error handling and retry flow tests maintained

### File List

**Modified Files:**
- `components/game/quest-view.tsx` - Implemented atomic flow, removed completion status display
- `components/game/success-overlay.tsx` - Added duration control and auto-exit functionality  
- `tests/unit/quest-view.test.tsx` - Updated tests for atomic flow and added new timing tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated sprint tracking
