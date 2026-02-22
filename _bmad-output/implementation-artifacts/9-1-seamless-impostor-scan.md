# Story 9.1: Seamless Impostor Scan

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an impostor,
I want to experience a "silent" success screen when I scan a QR,
so that I can pretend to work without being spotted.

## Acceptance Criteria

1. Scan results immediately show the Success screen (matching Crewmate timing).
2. Content of the quest (Question/Minigame) is NEVER loaded or visible for the Impostor role.

## Tasks / Subtasks

- [x] Task 1: Analyze Current Impostor Scan Flow (AC: #1, #2)
  - [x] Subtask 1.1: Document current impostor quest loading and display behavior
  - [x] Subtask 1.2: Identify where quest content is being loaded for impostors
  - [x] Subtask 1.3: Analyze timing differences between impostor and crewmate success flows
- [x] Task 2: Implement Silent Success for Impostors (AC: #1)
  - [x] Subtask 2.1: Remove quest content loading for impostor role completely
  - [x] Subtask 2.2: Ensure immediate success screen trigger matches crewmate timing
  - [x] Subtask 2.3: Verify no quest content elements are rendered for impostors
- [x] Task 3: Prevent Content Loading (AC: #2)
  - [x] Subtask 3.1: Skip dynamic content mapper calls for impostor role
  - [x] Subtask 3.2: Remove simulated quest game creation for impostors
  - [x] Subtask 3.3: Ensure no quest data is fetched or displayed for impostors
- [x] Task 4: Testing and Validation
  - [x] Subtask 4.1: Test impostor scan flow shows immediate success screen
  - [x] Subtask 4.2: Verify no quest content is loaded or visible for impostors
  - [x] Subtask 4.3: Test timing consistency between impostor and crewmate success flows

## Dev Notes

### Critical Architecture Requirements
- **Silent Success**: Impostors must see immediate success screen without any quest content
- **No Content Loading**: Quest content must never be loaded or rendered for impostor role
- **Timing Consistency**: Success screen timing must match crewmate experience exactly
- **Role Detection**: Proper impostor role detection before any quest content operations

### Previous Story Intelligence (8.3)
- **Atomic Success Flow**: Story 8.3 implemented exactly 2-second success overlay with background redirect
- **Success Overlay**: Current overlay component supports impostor mode with different styling
- **Quest Loading**: Dynamic content mapper loads quest content for crewmates
- **Role Detection**: Current role detection works but still loads some content for impostors

### Current Impostor Implementation Issues
From analysis of `components/game/quest-view.tsx`:
1. **Line 51-66**: Creates fake "impostor-sim" quest game with content display
2. **Line 161-167**: Triggers immediate success but still loads quest content first
3. **Line 203-251**: Renders quest content area even for impostors (though conditionally hidden)
4. **Line 67**: Dynamic content mapper still called for impostors when currentQuestContent matches

### Source Tree Components to Touch
- **Modify**: `/components/game/quest-view.tsx` - Remove all quest content loading for impostors
- **Modify**: `/lib/store/game-store.ts` - Skip content loading for impostor role
- **Modify**: `/lib/quests/dynamic-content-mapper.ts` - Add role check to prevent loading
- **Test**: `/tests/unit/quest-view.test.tsx` - Update tests for impostor silent success
- **Test**: `/tests/integration/impostor-scan.test.ts` - End-to-end impostor flow validation

### Testing Standards Summary
- **Unit Tests**: Verify no quest content loading for impostor role
- **Integration Tests**: Test complete impostor scan flow with immediate success
- **Visual Regression**: Ensure no quest content flashes or appears for impostors
- **Timing Tests**: Verify success screen timing matches crewmate experience

### Project Structure Notes
- **Alignment**: Follow existing role detection patterns in quest-view.tsx
- **Success Overlay**: Use existing impostor styling and timing from success-overlay.tsx
- **Store Integration**: Maintain existing game store patterns but add role checks
- **Error Handling**: Preserve existing error handling while preventing content loading

### Technical Constraints
- **Performance**: Eliminate unnecessary network calls for impostor quest content
- **Security**: Ensure no quest data is exposed to impostor role
- **User Experience**: Immediate success screen must feel natural, not broken
- **Mobile Optimization**: Touch interactions must remain responsive for impostors

### Implementation Strategy
1. **Phase 1**: Add early role check to prevent any quest content loading
2. **Phase 2**: Remove impostor-sim quest game creation completely
3. **Phase 3**: Ensure success overlay timing matches crewmate experience
4. **Phase 4**: Clean up any remaining impostor content references

### Data Flow Changes
```typescript
// Current: QR Scan → Role Check → Load Content → Success (Impostor)
// New: QR Scan → Role Check → Immediate Success (Impostor)

// Remove for impostors:
- loadDynamicQuestContent() calls
- QuestGame creation (including impostor-sim)
- Quest content rendering
- Dynamic content mapper calls
```

### Role Detection Requirements
- **Early Detection**: Role must be checked before any quest operations
- **Definitive Check**: Use currentPlayer?.role === "IMPOSTOR" consistently
- **Fallback Safety**: Default to crewmate behavior if role is undefined
- **Performance**: Role check should be cheap and early in component lifecycle

### Success Overlay Timing
- **Duration**: Exactly 2000ms (matching crewmate from Story 8.3)
- **Background Redirect**: Start at 1500ms, complete by 2000ms
- **Manual Exit**: Disabled during atomic flow (consistent with Story 8.3)
- **Styling**: Use existing impostor red theme and glitch effects

### Mobile Considerations
- **Touch Response**: Success screen must remain responsive on mobile
- **Performance**: Eliminate unnecessary content loading improves mobile performance
- **Battery**: Reduced network calls improve battery life for impostors
- **Network**: Handle offline scenarios gracefully for impostor scans

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-9.1](epics.md#Story-9.1)
- [Source: _bmad-output/implementation-artifacts/8-3-atomic-success-flow-flicker-fix.md](8-3-atomic-success-flow-flicker-fix.md)
- [Source: components/game/quest-view.tsx](../components/game/quest-view.tsx)
- [Source: components/game/success-overlay.tsx](../components/game/success-overlay.tsx)
- [Source: lib/store/game-store.ts](../lib/store/game-store.ts)
- [Source: lib/quests/dynamic-content-mapper.ts](../lib/quests/dynamic-content-mapper.ts)

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha)

### Debug Log References

### Completion Notes List

- **Story 9.1 Implementation Complete**: Successfully implemented seamless impostor scan flow with silent success
- **Key Changes Made**:
  - Modified `quest-view.tsx` to skip all quest content loading for impostors
  - Updated `game-store.ts` to prevent dynamic content mapper calls for impostor role
  - Enhanced `dynamic-content-mapper.ts` with early role check to prevent content loading
  - Removed fake "impostor-sim" quest game creation completely
- **Timing Preserved**: Success overlay maintains exactly 2000ms duration matching crewmate experience
- **Security Enhanced**: No quest data is ever fetched or exposed to impostor role
- **Performance Improved**: Eliminated unnecessary network calls for impostor scans

### File List

- **Modified**: `/components/game/quest-view.tsx` - Added early role check and skipped content loading for impostors, removed impostor-sim fallback completely
- **Modified**: `/lib/store/game-store.ts` - Added role check to prevent dynamic content loading for impostors  
- **Modified**: `/lib/quests/dynamic-content-mapper.ts` - Added early role check before any content operations, removed debug logging
- **Modified**: `/tests/unit/dynamic-content-mapper.test.ts` - Added test for impostor role check preventing content loading
- **Test**: `/tests/unit/quest-view-impostor.test.tsx` - Unit tests for impostor silent success behavior
- **Test**: `/tests/integration/impostor-scan.test.ts` - Integration tests for complete impostor scan flow
