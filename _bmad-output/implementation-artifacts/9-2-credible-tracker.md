# Story 9.2: Credible Tracker

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an impostor,
I want to see a list of location labels and a progress bar,
so that my screen looks exactly like a Crewmate's if someone glances at it.

## Acceptance Criteria

1. Impostor Dashboard shows the same list of assigned quest locations as a Crewmate.
2. Progress bar updates as the Impostor "completes" scans.

## Tasks / Subtasks

- [x] Task 1: Analyze Current Quest Assignment System (AC: #1)
  - [x] Subtask 1.1: Document how quests are currently assigned and tracked for crewmates
  - [x] Subtask 1.2: Identify where quest location data is stored and retrieved
  - [x] Subtask 1.3: Analyze current QuestProgress component limitations for impostors
- [x] Task 2: Design Fake Quest Assignment System for Impostors (AC: #1)
  - [x] Subtask 2.1: Create fake quest assignment logic that mirrors crewmate assignments
  - [x] Subtask 2.2: Generate location labels for impostor quest list from batch data
  - [x] Subtask 2.3: Ensure fake assignments match crewmate quest count and distribution
- [x] Task 3: Implement Credible Quest List Display (AC: #1)
  - [x] Subtask 3.1: Modify QuestProgress component to show quest list for impostors
  - [x] Subtask 3.2: Create QuestList component showing location labels with completion status
  - [x] Subtask 3.3: Style impostor quest list identically to crewmate display
- [x] Task 4: Implement Progress Tracking for Impostors (AC: #2)
  - [x] Subtask 4.1: Track impostor "completed" quests in local state or Redis
  - [x] Subtask 4.2: Update progress bar as impostor scans QR codes
  - [x] Subtask 4.3: Ensure progress timing matches crewmate completion patterns
- [x] Task 5: Integration and Testing
  - [x] Subtask 5.1: Test impostor dashboard shows credible quest list
  - [x] Subtask 5.2: Verify progress bar updates correctly on impostor scans
  - [x] Subtask 5.3: Ensure visual consistency between crewmate and impostor displays

## Dev Notes

### Critical Architecture Requirements
- **Visual Parity**: Impostor quest display must be indistinguishable from crewmate view
- **Fake Assignment System**: Generate plausible quest assignments based on batch data
- **Progress Synchronization**: Progress tracking must mirror crewmate completion patterns
- **Location Labels**: Use actual batch location data for credibility
- **Performance**: Minimal overhead for impostor fake assignment generation

### Previous Story Intelligence (9.1)
- **Silent Success Implementation**: Story 9.1 eliminated quest content loading for impostors
- **Role Detection Pattern**: Early role checks prevent content operations (`currentPlayer?.role === "IMPOSTOR"`)
- **Success Overlay Timing**: 2000ms duration preserved with impostor styling
- **Store Integration**: Game store includes role checks for content loading prevention
- **Files Modified**: `quest-view.tsx`, `game-store.ts`, `dynamic-content-mapper.ts`

### Current System Analysis
From code analysis of current implementation:
1. **QuestProgress Component** (line 13-15): Returns `null` for impostors - needs modification
2. **No Quest List Display**: Currently only shows progress bar, no individual quest items
3. **Quest Assignment**: Happens via QR scanning, not pre-assigned lists in dashboard
4. **Location Data**: Available in batch quests but not displayed in dashboard
5. **Progress Tracking**: Uses `completedQuests` array in player object

### Source Tree Components to Touch
- **Modify**: `/components/game/quest-progress.tsx` - Remove null return for impostors, add quest list
- **Create**: `/components/game/quest-list.tsx` - New component for displaying quest items with locations
- **Modify**: `/lib/store/game-store.ts` - Add impostor quest assignment and tracking logic
- **Modify**: `/lib/redis/actions.ts` - Add fake quest assignment generation for impostors
- **Modify**: `/components/game/game-home.tsx` - Update to pass quest data to QuestProgress
- **Test**: `/tests/unit/quest-progress.test.tsx` - Update tests for impostor quest list display
- **Test**: `/tests/integration/impostor-credible-tracker.test.ts` - End-to-end impostor credibility test

### Testing Standards Summary
- **Unit Tests**: Verify fake quest assignment generation and display logic
- **Integration Tests**: Test complete impostor dashboard with quest list and progress
- **Visual Regression**: Ensure impostor and crewmate displays are visually identical
- **Performance Tests**: Verify minimal overhead for fake assignment system

### Project Structure Notes
- **Alignment**: Follow existing role detection patterns from Story 9.1
- **Component Structure**: Create reusable QuestList component for both roles
- **Store Integration**: Extend existing game store patterns with impostor-specific state
- **Styling Consistency**: Use existing design system and component patterns
- **Error Handling**: Preserve existing error handling while adding impostor features

### Technical Constraints
- **Data Source**: Must use actual batch quest data for location labels
- **Visual Parity**: No visual differences between impostor and crewmate quest displays
- **Performance**: Fake assignments should be generated efficiently
- **Memory**: Minimal additional state storage for impostor tracking
- **Mobile Optimization**: Touch interactions and responsive design preserved

### Implementation Strategy
1. **Phase 1**: Analyze batch quest data structure and assignment patterns
2. **Phase 2**: Create fake quest assignment system for impostors
3. **Phase 3**: Implement QuestList component with location display
4. **Phase 4**: Modify QuestProgress to show quest list for impostors
5. **Phase 5**: Add progress tracking and synchronization

### Fake Assignment Algorithm
```typescript
// For impostors: Generate fake assignments based on batch data
const generateImpostorQuestAssignments = (batchId: string, questsPerPlayer: QuestDistribution) => {
  // Get actual quest metadata from batch
  // Select random quests matching distribution (short/medium/long)
  // Return list with location labels for display
  // Store in impostor-specific state for tracking
}
```

### Quest List Display Requirements
- **Location Labels**: Show actual quest locations from batch data
- **Completion Status**: Checkmarks or visual indicators for "completed" quests
- **Progress Integration**: Sync with overall progress bar
- **Visual Consistency**: Same styling, fonts, colors as crewmate view
- **Responsive Design**: Mobile-optimized layout matching current design

### Progress Tracking Strategy
- **Local State**: Track impostor "completed" quests in component state
- **Redis Option**: Optional server-side tracking for persistence
- **Scan Detection**: Increment progress on each impostor QR scan
- **Timing Simulation**: Match crewmate completion timing patterns
- **Reset Handling**: Clear fake progress on game reset

### Data Flow Changes
```typescript
// Current: Impostor → No Quest List → No Progress Display
// New: Impostor → Fake Quest List → Progress Bar Updates

// New components needed:
- QuestList: Displays quest items with locations and completion status
- FakeAssignmentGenerator: Creates plausible impostor quest assignments
- ImpostorProgressTracker: Manages fake completion state

// Modified components:
- QuestProgress: Shows quest list for impostors instead of null
- GameHome: Passes quest assignment data to QuestProgress
- GameStore: Includes impostor-specific quest tracking
```

### Role Detection Requirements
- **Early Detection**: Use existing `currentPlayer?.role === "IMPOSTOR"` pattern
- **Consistent Checks**: Apply role detection in QuestProgress and GameHome
- **Fallback Safety**: Default to crewmate behavior if role is undefined
- **Performance**: Role checks should be early and efficient

### Visual Parity Requirements
- **Identical Styling**: Same fonts, colors, spacing, borders as crewmate view
- **Same Layout**: Quest list positioning and progress bar placement
- **Responsive Behavior**: Mobile layout identical between roles
- **Animation Consistency**: Same transitions and hover states
- **Accessibility**: Same ARIA labels and screen reader support

### Batch Data Integration
- **Location Labels**: Extract from batch quest metadata
- **Quest Distribution**: Match actual crewmate assignment patterns
- **Format Types**: Use real quest types for credibility
- **Count Matching**: Same number of quests as crewmates receive
- **Randomization**: Plausible but deterministic assignment patterns

### Mobile Considerations
- **Touch Targets**: Quest list items must be touch-friendly (44px minimum)
- **Scroll Performance**: Smooth scrolling for longer quest lists
- **Visual Clarity**: Clear completion indicators on small screens
- **Battery Efficiency**: Minimal re-renders for progress updates
- **Network Handling**: Graceful degradation if batch data unavailable

### Security Considerations
- **No Real Data**: Fake assignments must not expose actual quest answers
- **Isolation**: Impostor state completely separate from crewmate game logic
- **Data Validation**: Validate batch quest data before using for assignments
- **State Sanitization**: Clean impostor state on role changes or game reset

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story-9.2](epics.md#Story-9.2)
- [Source: _bmad-output/implementation-artifacts/9-1-seamless-impostor-scan.md](9-1-seamless-impostor-scan.md)
- [Source: components/game/quest-progress.tsx](../components/game/quest-progress.tsx)
- [Source: components/game/game-home.tsx](../components/game/game-home.tsx)
- [Source: lib/store/game-store.ts](../lib/store/game-store.ts)
- [Source: lib/redis/actions.ts](../lib/redis/actions.ts)
- [Source: types/game.ts](../types/game.ts)
- [Source: types/quest.ts](../types/quest.ts)

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha)

### Debug Log References

### Completion Notes List

- **Story 9.2 Implementation Complete**: Successfully implemented credible tracker for impostors
- **Visual Parity Achieved**: Impostors now see quest list with locations and progress bar identical to crewmates
- **Fake Assignment System**: Created system to generate plausible quest assignments from batch data
- **Progress Tracking**: Implemented local state tracking for impostor quest completion
- **Components Created**: QuestList component for displaying quest items with locations and completion status
- **Store Integration**: Extended game store with impostor-specific state and actions
- **Integration Points**: Modified GameHome to initialize impostor quests and handle scan completion
- **Tests Passing**: Core functionality tests pass, integration tests verify end-to-end behavior

### File List

- `/components/game/quest-progress.tsx` - Modified to show quest list for impostors instead of null, added quest list for crewmates
- `/components/game/quest-list.tsx` - New component for displaying quest items with locations and completion status
- `/components/game/game-home.tsx` - Modified to initialize impostor quests and handle scan completion with location setting
- `/lib/store/game-store.ts` - Extended with impostor quest tracking state, actions, and location setting capability
- `/tests/unit/impostor-quest-tracker.test.ts` - New unit tests for impostor quest tracking functionality using real store methods
- `/tests/integration/impostor-credible-tracker.test.ts` - Integration tests for complete impostor credible tracker workflow
- `/tests/unit/game-home.test.tsx` - Modified test file for game-home component changes
- `/tests/unit/quest-progress.test.tsx` - Modified test file for quest-progress component changes
