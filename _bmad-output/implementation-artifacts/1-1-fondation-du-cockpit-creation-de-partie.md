# Story 1.1: Fondation du Cockpit & Création de Partie

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an organisateur,
I want initialiser la plateforme et créer ma première partie,
so that je puisse commencer à configurer ma soirée Among Us IRL.

## Acceptance Criteria

1. **Next.js 16 + Tailwind 4 Setup**: Project is initialized with the latest versions and configured correctly. [Source: epics.md#L57, architecture.md#L55]
2. **Project Structure Initialization**: Folders `app/`, `components/`, `lib/`, `types/`, `hooks/`, `tests/` are created according to the architecture. [Source: architecture.md#L179]
3. **Vercel KV Configuration**: Connection to Vercel KV is established and tested. [Source: architecture.md#L91]
4. **Game Creation**: Clicking "Créer une partie" on the home page creates a unique game entry in Vercel KV with a non-guessable UUID. [Source: epics.md#L130, architecture.md#L98]
5. **Initial State**: The game state is initialized in Redis using the key `game:{gameId}:state`. [Source: architecture.md#L125]
6. **Lobby Redirection**: After creation, the user is redirected to `/game/[id]`. [Source: epics.md#L131, architecture.md#L23]

## Tasks / Subtasks

- [ ] **Infrastructure Setup** (AC: 1, 2)
  - [ ] Initialize Next.js project structure if not already fully present.
  - [ ] Configure `tailwind.config.js` for v4.
  - [ ] Install and configure `@serwist/next` for PWA.
  - [ ] Install `zustand`, `framer-motion`, and `@vercel/kv`.
- [ ] **Data Layer** (AC: 3, 5)
  - [ ] Create `lib/kv/client.ts` for Vercel KV initialization.
  - [ ] Create `lib/kv/actions.ts` with `createGame` Server Action.
  - [ ] Define `GameState` types in `types/game.ts`.
- [ ] **Frontend Implementation** (AC: 4, 6)
  - [ ] Implement `app/page.tsx` with a "Créer une partie" button.
  - [ ] Integrate the `createGame` action with a loading state (pulse effect).
  - [ ] Implement the `app/game/[id]/page.tsx` (Lobby shell).
- [ ] **Testing**
  - [ ] Add unit test for `createGame` logic (mocking KV).
  - [ ] Add basic E2E test for the creation flow.

## Dev Notes

### Architecture Patterns & Constraints
- **State Management**: Use Zustand v5 for coordinating UI state with server actions. [Source: architecture.md#L105]
- **Naming Conventions**: Use `kebab-case` for files and `PascalCase` for React components. [Source: architecture.md#L121]
- **API Response Wrapper**: Use `{ success: boolean, data?: T, error?: string }` for Server Actions. [Source: architecture.md#L136]
- **Tactical UI**: Use high-contrast "Terminal" theme. Background: `#0D1117`, Accents: `#58A6FF`. [Source: ux-design-specification.md#L200]

### Project Structure Notes
- `app/game/[id]/` for lobby/home.
- `lib/kv/` for Redis interaction.
- `components/effects/` for the "pulse" transition when creating a game.

### References
- [PRD: Product Scope](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L53)
- [Architecture: Implementation Patterns](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L119)
- [UX Design: Visual Design Foundation](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L194)

## Dev Agent Record

### Agent Model Used

Antigravity (Claude 3.5 Sonnet / Gemini 2.0 Pro)

### Debug Log References

### Completion Notes List

### File List
