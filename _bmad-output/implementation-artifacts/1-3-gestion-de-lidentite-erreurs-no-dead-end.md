# Story 1.3: Gestion de l'Identité & Erreurs (No Dead End)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an utilisateur,
I want être informé si une partie est invalide et pouvoir revenir à l'accueil,
so that je ne reste pas bloqué sur un écran vide ou dans un état instable.

## Acceptance Criteria

1. [x] **Error Clarity**: Accessing a non-existent game ID displays a specific "GAME_NOT_FOUND" visual state. [Source: prd.md#L265]
2. [x] **No Dead End**: All error screens MUST provide a prominent "Back to Terminal Home" action targeting `/`. [Source: architecture.md#L144, ux-design-specification.md#L266]
3. [x] **Tactical UI**: Error screens must follow the "Tactical Terminal" aesthetic using `Orbitron` for headers and `destructive` (Red) accents for alerts. [Source: ux-design-specification.md#L204]
4. [x] **Haptic Alert**: Critical failures (e.g., game not found) trigger a long continuous vibration on mobile devices. [Source: ux-design-specification.md#L358]
5. [x] **Consistency**: The `useLocalUser` hook must handle storage failures without preventing the display of the error screen. [Source: code-review find 6]

## Tasks / Subtasks

- [x] **Data Layer Refinement** (AC: 1, 4)
  - [x] Enhance `getGame` in `lib/kv/actions.ts` to return specific error codes (e.g., `ERR_CODE: GAME_DECOMMISSIONED`).
  - [x] Ensure the server action response structure is strictly followed.
- [x] **Component Implementation** (AC: 2, 3)
  - [x] Create `components/game/error-view.tsx` using `Orbitron` fonts and `Framer Motion` for a "Signal Lost" glitch effect.
  - [x] Ensure the "Back to Home" button has a minimum 44x44px touch target.
- [x] **Page Integration** (AC: 1, 2, 5)
  - [x] Update `app/game/[id]/page.tsx` to utilize the new `ErrorView` component.
  - [x] Integrate `useHaptic` (or native navigator.vibrate) to trigger on error mount.
- [x] **Testing**
  - [x] Add a unit test in `tests/unit/error-logic.test.ts` for error code mapping.
  - [x] Add an E2E test in `tests/e2e/invalid-game.spec.ts` verifying the "No Dead End" return path.

## Dev Notes

- **Aesthetic**: Use `text-destructive` and `border-destructive/20` for errors. Apply `font-orbitron` to the "SIGNAL LOST" header.
- **Source tree**: Modify `app/game/[id]/page.tsx`, `lib/kv/actions.ts`. Create `components/game/error-view.tsx`.
- **Testing**: Ensure "No Dead End" is tested by simulating a 404/Null state from the KV mock.

### Project Structure Notes

- Follow the directory structure established in Story 1.2.
- Components go in `components/game/`.
- Logic in `lib/kv/actions.ts`.

### References

- [Architecture: Error Handling](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L144)
- [UX Design: Error Recovery](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L128)
- [PRD: Functional Requirement 23](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L266)

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.0 Pro)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created for Story 1.3.
- Integrated learnings from Story 1.2 code review (Haptic, Hydration, Orbitron).

### File List

- [components/game/error-view.tsx](file:///home/omi/projects/amogus/components/game/error-view.tsx)
- [app/game/[id]/page.tsx](file:///home/omi/projects/amogus/app/game/[id]/page.tsx)
- [lib/kv/actions.ts](file:///home/omi/projects/amogus/lib/kv/actions.ts)
- [lib/store/game-store.ts](file:///home/omi/projects/amogus/lib/store/game-store.ts)
- [types/game.ts](file:///home/omi/projects/amogus/types/game.ts)
- [tests/unit/error-logic.test.ts](file:///home/omi/projects/amogus/tests/unit/error-logic.test.ts)
- [tests/unit/use-local-user.test.ts](file:///home/omi/projects/amogus/tests/unit/use-local-user.test.ts)
- [lib/constants/error-codes.ts](file:///home/omi/projects/amogus/lib/constants/error-codes.ts)
- [tests/e2e/invalid-game.spec.ts](file:///home/omi/projects/amogus/tests/e2e/invalid-game.spec.ts)

## Senior Developer Review (AI)

**Date:** 2026-02-07
**Reviewer:** Antigravity

### Findings
- **Fixed**: Standardized error codes (GAME_NOT_FOUND, ERR_SIGNAL_LOST) usage across `actions.ts`, `page.tsx`, and `error-view.tsx` using new `lib/constants/error-codes.ts`.
- **Fixed**: Relaxed fragile UUID regex validation in `joinGame` to support future ID changes.
- **Fixed**: Updated unit tests to use constants and verified compatibility.
- **Note**: `lib/kv/client.ts` has uncommitted changes (Redis migration), but functionality is verified via E2E tests.

**Status:** Approved
