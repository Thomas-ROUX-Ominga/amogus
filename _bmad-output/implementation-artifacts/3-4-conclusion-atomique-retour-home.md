# Story 3.4: Conclusion Atomique & Retour Home

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a crewmate,
I want être redirigé automatiquement vers mon cockpit après un succès,
so that libérer mes mains et pouvoir scanner le prochain QR immédiatement.

## Acceptance Criteria

1.  **Celebration Overlay**: Upon successful quest completion (server confirmed), a full-screen "MISSION ACCOMPLIE" overlay appears with a "glitch" or cyber-tech animation effect (Framer Motion). [Source: epics.md#L267, architecture.md#L73]
2.  **Auto-Redirect**: After a short delay (e.g., 2000-3000ms) allowing the user to see the celebration, the system automatically redirects the user back to the Game Home (`/game/[id]`). [Source: epics.md#L268, ux-design-specification.md#L360]
3.  **Manual Exit Option**: The overlay includes a manual "Retour au Cockpit" button that allows the user to skip the animation/delay and return immediately (No Dead End). [Source: architecture.md#L144, epics.md#L41]
4.  **Haptic & Visual Feedback**: The celebration triggers a distinct success haptic pattern (e.g., `[50, 50, 50, 50, 200]`) and visual flash. [Source: epics.md#L256, ux-design-specification.md#L357]
5.  **State Cleanup**: Upon redirection (or unmount), the local quest state (answered, completed) is reset so the next quest starts fresh. [Source: story 3.1 Dev Notes - clearQuest]
6.  **Progress Update**: When returning to Home, the quest progress bar reflects the newly completed quest (handled by logic added in Story 3.3, verified here). [Source: story 3.3 AC#5]

## Tasks / Subtasks

- [x] **Task 1: Create SuccessOverlay Component** (AC: 1, 3, 4)
    - [x] Create `components/game/success-overlay.tsx`
    - [x] Implement Framer Motion animation (opacity, scale, glitch effect)
    - [x] Add "MISSION ACCOMPLIE" text (Orbitron font)
    - [x] Add manual "Retour au Cockpit" button (secondary variant)
    - [x] Trigger haptic feedback on mount

- [x] **Task 2: Integrate Overlay into QuestView** (AC: 1, 2, 5)
    - [x] Modify `components/game/quest-view.tsx`
    - [x] Render `SuccessOverlay` when `isQuestCompleted` (from store/local state) is true
    - [x] Implement `useEffect` for auto-redirect timer (3000ms)
    - [x] Use `router.push('/game/[id]')` for redirection

- [x] **Task 3: State Management & Cleanup** (AC: 5)
    - [x] Ensure `clearQuest()` is called on unmount or before redirect
    - [x] Verify `questAnswered` and `completionSuccess` are reset

- [x] **Task 4: Testing** (AC: 1-6)
    - [x] Unit Test: `SuccessOverlay` renders correctly
    - [x] Unit Test: `QuestView` shows overlay on success
    - [x] Unit Test: Auto-redirect timer triggers router push
    - [x] E2E Test: Full flow (Answer -> Success -> Overlay -> Auto-redirect -> Home)

## Dev Notes

- **Architecture Patterns**:
    - Use `framer-motion` for the overlay transitions.
    - Use `useRouter` from `next/navigation` for redirection.
    - **Crucial**: Ensure the redirect happens ONLY after the server has confirmed the completion (which was implemented in Story 3.3). Do not redirect on local success alone.

- **UX Timing**:
    - The delay should be long enough to feel rewarding but short enough to keep the flow "Tactical". ~2.5s is a good starting point.

- **Project Structure**:
    - `components/game/success-overlay.tsx` (New Component)
    - `components/game/quest-view.tsx` (Modify)

### References

- [Epic 3 Story 3.4](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L258-L270)
- [Architecture: UI/UX](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L106)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
