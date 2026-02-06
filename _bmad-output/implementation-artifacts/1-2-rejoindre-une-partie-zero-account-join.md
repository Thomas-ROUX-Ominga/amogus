# Story 1.2: Rejoindre une Partie (Zero-Account Join)

Status: done

## Story

As a joueur,
I want accéder à une partie via un lien direct et saisir mon pseudo,
so that je puisse rejoindre le lobby sans créer de compte.

## Acceptance Criteria

1. [x] **Direct Access**: Accessing `/game/[id]` loads the game session correctly.
2. [x] **Pseudo Validation**: A player must enter a pseudo before joining. (Server-side & Client-side validation active)
3. [x] **Local Identity**: A unique `userId` is generated client-side and stored in `localStorage` for persistence. (Hydration & Error safe)
4. [x] **KV Integration**: The player is added to the `players` list in Vercel KV state. (Race-condition mitigated)
5. [x] **No-Account Friction**: No signup/login flow is required.

## Tasks / Subtasks

- [x] **Identity Management** (AC: 3)
  - [x] Implement `hooks/use-local-user.ts` (Storage error & hydration safe).
  - [x] Ensure `userId` is persistent across page refreshes.
- [x] **Data Layer Extension** (AC: 4)
  - [x] Implement `joinGame` with server-side validation & concurrency checks.
  - [x] Ensure `joinGame` prevents duplicate joins.
  - [x] Update `useGameStore` to include a `join` action.
- [x] **Frontend Implementation** (AC: 1, 2, 5)
  - [x] Create `components/game/join-form.tsx` (Tactical Orbitron design).
  - [x] Update `app/game/[id]/page.tsx` with conditional join/lobby flow.
- [x] **Testing**
  - [x] Create `tests/unit/join-game.test.ts`.
  - [x] Add E2E tests in `tests/e2e/join-game.spec.ts`.
  - [x] Add Store tests in `tests/unit/game-store.test.ts`.
  - [x] Add Component tests in `tests/unit/components.test.tsx`.

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 2.0 Pro)

### Completion Notes
- Fixed Orbitron font requirement across all headers.
- Implemented strict server-side validation for pseudos and UUIDs.
- Reduced hydration flicker and added localStorage fail-safes.
- Updated all E2E tests to match new UI labels and flows.

### File List
- [hooks/use-local-user.ts](file:///home/omi/projects/amogus/hooks/use-local-user.ts)
- [lib/kv/actions.ts](file:///home/omi/projects/amogus/lib/kv/actions.ts)
- [lib/store/game-store.ts](file:///home/omi/projects/amogus/lib/store/game-store.ts)
- [components/game/join-form.tsx](file:///home/omi/projects/amogus/components/game/join-form.tsx)
- [app/game/[id]/page.tsx](file:///home/omi/projects/amogus/app/game/[id]/page.tsx)
- [tests/unit/join-game.test.ts](file:///home/omi/projects/amogus/tests/unit/join-game.test.ts)
- [tests/unit/game-store.test.ts](file:///home/omi/projects/amogus/tests/unit/game-store.test.ts)
- [tests/unit/components.test.tsx](file:///home/omi/projects/amogus/tests/unit/components.test.tsx)
- [tests/unit/use-local-user.test.ts](file:///home/omi/projects/amogus/tests/unit/use-local-user.test.ts)
- [tests/e2e/join-game.spec.ts](file:///home/omi/projects/amogus/tests/e2e/join-game.spec.ts)
- [tests/e2e/create-game.spec.ts](file:///home/omi/projects/amogus/tests/e2e/create-game.spec.ts)
