# Story 2.3: Home Cocktail (Game Home)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a joueur,
I want accéder à un écran central (Mon "Cockpit"),
so that voir mon état actuel, le nombre de quêtes restantes et le bouton de scan.

## Acceptance Criteria

1. **Game Home Display**: After role selection and transition animation, the player lands on the Game Home screen showing their pseudo, role badge, and a massive central SCAN button. [Source: epics.md#L202-L214, ux-design-specification.md#L188-L192]
2. **Role Badge**: The player's role is displayed with color-coded badge — Crewmate in green (`#2DA44E`), Impostor in red (`#DA3633`) — using Orbitron font. [Source: ux-design-specification.md#L200-L204, architecture.md#L107]
3. **Massive SCAN Button**: A central, pulsing SCAN button (minimum 120px touch target) placed in the thumb-zone (lower third of screen) with Framer Motion pulse animation. The button links to `/game/[id]/quest?duration=...` but is non-functional until Epic 3. For now, it displays a "Coming Soon" toast or disabled state. [Source: ux-design-specification.md#L315-L318, L351]
4. **Quest Progress Bar (Crewmate only)**: Crewmates see a progress bar showing completed quests vs total. For MVP (pre-Epic 3), display "0/X quêtes" placeholder. Impostors do NOT see this bar. [Source: epics.md#L213]
5. **Tactical Terminal Aesthetic**: Dark background (`#0D1117`), Orbitron for titles, Rajdhani for body, high contrast, glassmorphic card borders, neon accents. [Source: ux-design-specification.md#L200-L211]
6. **Player List**: Show connected players with their names. Current player highlighted with "YOU" badge. [Source: existing pattern from Story 2.2]
7. **Mobile-First / Thumb-Driven**: All interactive elements in the lower half of the screen. Minimum 44x44px touch targets. [Source: ux-design-specification.md#L216, L375, L390]
8. **Haptic Feedback**: Trigger short vibration on SCAN button press. [Source: ux-design-specification.md#L357]
9. **No Dead End**: A way to return to the home page (`/`) is always available. Error states provide clear recovery paths. [Source: architecture.md#L144]
10. **Idempotency / Reload**: If a player reloads the page and already has a role, they should land directly on Game Home (skip role selection). Already implemented in Story 2.2 — verify it still works. [Source: Story 2.2 AC#10]
11. **Game Status Indicator**: Show a live status indicator (green dot + "ACTIVE" label) confirming the game is in progress. [Source: existing pattern from Story 2.2]

## Tasks / Subtasks

- [x] **Task 1: Extract Game Home into dedicated component** (AC: 1, 5, 7, 11)
  - [x] Create `components/game/game-home.tsx` — extract the inline Game Home JSX from `app/game/[id]/page.tsx` (lines 96-172)
  - [x] Accept props: `gameState`, `currentPlayer`, `userId`
  - [x] Apply Tactical Terminal aesthetic with proper font classes
  - [x] Add game status indicator (green dot + ACTIVE)
  - [x] Ensure mobile-first layout with vertical stacking

- [x] **Task 2: Role Badge Component** (AC: 2, 5)
  - [x] Create `components/game/role-badge.tsx` — reusable role display
  - [x] Color-coded: Crewmate green (`#2DA44E`) with Users icon, Impostor red (`#DA3633`) with Shield icon
  - [x] Orbitron font for role name, Rajdhani for label
  - [x] Compact variant (for header) and full variant (for home display)

- [x] **Task 3: Massive SCAN Button** (AC: 3, 7, 8)
  - [x] Create `components/game/scan-button.tsx` — the central action button
  - [x] Minimum 120px height, full-width, placed in thumb zone
  - [x] Framer Motion pulse animation (reuse `PulseButton` pattern from `components/effects/pulse-button.tsx`)
  - [x] Haptic feedback on press (`navigator.vibrate([50])`)
  - [x] For now: disabled state with "SCAN — Bientôt disponible" label (Epic 3 enables it)
  - [x] Future-ready: accept `href` or `onClick` prop for quest routing

- [x] **Task 4: Quest Progress Indicator (Crewmate only)** (AC: 4, 5)
  - [x] Create `components/game/quest-progress.tsx`
  - [x] Show progress bar with "X/Y quêtes accomplies" text
  - [x] Use Shadcn Progress component or custom bar with Tactical Terminal styling
  - [x] Only render for Crewmate role (hide for Impostor)
  - [x] For MVP: hardcode total=0, completed=0 (data comes from Epic 3)

- [x] **Task 5: Game Home Layout Assembly** (AC: 1, 3, 4, 6, 7, 9)
  - [x] Compose `game-home.tsx` with: Header (status + role badge) → Quest Progress → Player List → SCAN Button (bottom)
  - [x] Ensure SCAN button is in the lower third (thumb zone)
  - [x] Add "Retour à l'accueil" link/button for No Dead End principle
  - [x] Responsive: centered container on tablet/desktop

- [x] **Task 6: Update page.tsx Integration** (AC: 1, 10)
  - [x] Replace inline Game Home JSX in `app/game/[id]/page.tsx` with `<GameHome />` component
  - [x] Verify idempotent reload behavior (role already selected → show Game Home directly)
  - [x] Ensure transition flow still works: role selection → transition → game home

- [x] **Task 7: Zustand Store — Quest State Preparation** (AC: 4)
  - [x] Add `questsCompleted` and `questsTotal` fields to `GameStore` (default 0)
  - [x] These will be populated by Epic 3 server actions
  - [x] Expose via store for `quest-progress.tsx` consumption

- [x] **Task 8: Testing** (AC: 1-11)
  - [x] Unit test: `game-home.tsx` renders with correct role badge, player list, scan button
  - [x] Unit test: `quest-progress.tsx` renders for Crewmate, hidden for Impostor
  - [x] Unit test: `scan-button.tsx` renders disabled state, triggers haptic on click
  - [x] Unit test: `role-badge.tsx` renders correct colors for each role

## Dev Notes

### Architecture Compliance

**State Management Pattern:**
- Zustand store (`lib/store/game-store.ts`) for client-side state
- Server Actions in `lib/redis/actions.ts` for all Redis mutations
- Response wrapper: `{ success: boolean, data?: T, error?: string }`
- No new server actions needed for this story — Game Home is purely presentational over existing state

**Redis Key Pattern:**
- Game state: `game:{gameId}:state` (already exists)
- Player data including role already stored (from Story 2.2)
- Quest completion data will be added in Epic 3

**Error Handling:**
- All error states must provide clear messaging and recovery path
- Use standardized error codes from `lib/constants/error-codes.ts`
- Follow "No Dead End" principle: always provide a way back to `/`
- Game Home itself should handle edge cases: game ended, player removed, etc.

### Technical Requirements

**Dependencies (all already installed):**
- `framer-motion` v12.33.0 — for SCAN button pulse animation
- `zustand` v5.0.11 — state management
- `lucide-react` v0.563.0 — icons (Users, Shield, Scan, ArrowLeft)
- `next` 16.1.6 — App Router
- `redis` v5.10.0 — standard Redis client (NOT @vercel/kv)

**No new dependencies required.**

**Component Architecture:**
```
app/game/[id]/page.tsx
  └── <GameHome>                    (NEW - components/game/game-home.tsx)
        ├── Header: status + role badge
        ├── <RoleBadge>             (NEW - components/game/role-badge.tsx)
        ├── <QuestProgress>         (NEW - components/game/quest-progress.tsx)
        ├── Player List (inline)
        ├── <ScanButton>            (NEW - components/game/scan-button.tsx)
        └── "Retour" link
```

### UI/UX Requirements

**Tactical Terminal Aesthetic:**
- Font: `Orbitron` for title "Game Cockpit" and role name
- Font: `Rajdhani` for labels, descriptions, player names
- Font: `JetBrains Mono` for technical data (game ID, status codes)
- Background: Dark `#0D1117`
- Crewmate accent: `#2DA44E`
- Impostor accent: `#DA3633`
- Primary accent: `#58A6FF` (Tactical Blue)
- Glassmorphic cards: `bg-black/50 backdrop-blur-sm border border-primary/20`

**SCAN Button Specifications:**
- Minimum height: 120px
- Full width within container
- Background: `#58A6FF` (Tactical Blue) with pulse animation
- Icon: Scan icon from Lucide (or custom crosshair)
- Text: "SCANNER" in Orbitron, uppercase, tracking-wider
- Pulse: Framer Motion `scale` animation (1.0 → 1.02 → 1.0) on loop
- Position: Bottom of the screen content (thumb zone)
- Disabled state for MVP: reduced opacity, "Bientôt disponible" subtitle

**Layout (Mobile-First):**
```
┌─────────────────────────┐
│ GAME COCKPIT    ● ACTIVE│  ← Header (Orbitron)
├─────────────────────────┤
│  [Icon] CREWMATE        │  ← Role Badge (color-coded)
│  Pseudo: "PlayerName"   │
├─────────────────────────┤
│  ████████░░ 3/5 quêtes  │  ← Quest Progress (Crewmate only)
├─────────────────────────┤
│  Joueurs connectés (4)  │
│  ┌─────┐ ┌─────┐       │  ← Player List
│  │ Ali │ │ Bob │        │
│  └─────┘ └─────┘       │
├─────────────────────────┤
│                         │
│  ╔═══════════════════╗  │
│  ║   ◎ SCANNER       ║  │  ← SCAN Button (thumb zone)
│  ║  Bientôt dispo.   ║  │
│  ╚═══════════════════╝  │
│                         │
│  ← Retour à l'accueil  │  ← No Dead End link
└─────────────────────────┘
```

**Accessibility:**
- High contrast ratio (4.5:1 minimum)
- Touch targets: 44x44px minimum, 120px for SCAN button
- `prefers-reduced-motion`: disable pulse animation
- ARIA labels on interactive elements
- Role announced via sr-only text

### File Structure Requirements

```
components/game/
  ├── game-home.tsx          # NEW - Main Game Home component
  ├── role-badge.tsx         # NEW - Reusable role badge
  ├── scan-button.tsx        # NEW - Massive SCAN button
  └── quest-progress.tsx     # NEW - Quest progress bar

app/game/[id]/
  └── page.tsx               # MODIFY - Replace inline Game Home with <GameHome>

lib/store/
  └── game-store.ts          # MODIFY - Add quest state fields

tests/unit/
  ├── game-home.test.tsx     # NEW - Game Home component tests
  ├── scan-button.test.tsx   # NEW - Scan button tests
  └── quest-progress.test.tsx # NEW - Quest progress tests

```

### Previous Story Intelligence

**From Story 2.2 (Sélection de Rôle & Immersion Visuelle) — DONE:**
- Role selection flow fully implemented and reviewed
- Framer Motion v12 installed and working
- `RoleTransition` component in `components/effects/role-transition.tsx`
- `chooseRole` action in Zustand store with `selectedRole`, `isSelectingRole`, `roleError` states
- `selectRole` server action in `lib/redis/actions.ts` with atomic updates
- Inline Game Home placeholder exists in `page.tsx` lines 96-172 — **this is what we're replacing**
- Idempotent role handling: players with roles skip selection screen
- 32 unit tests passing after code review fixes

**Key Code Review Fixes from 2.2 to carry forward:**
- [H1] No `setState` during render — use `useEffect` for derived state
- [H2] Always sync Zustand store with server response (update `gameState.players` locally)
- [M1] Always check `prefers-reduced-motion` for animations
- [M4] Don't import unused modules (e.g., `useRouter` if not needed)

**Patterns established:**
1. Server Actions in `lib/redis/actions.ts` for all Redis mutations
2. Error codes from `lib/constants/error-codes.ts`
3. Orbitron for headers, Rajdhani for body
4. Haptic: `navigator.vibrate([duration])` with try/catch
5. Hydration-safe: no localStorage during SSR
6. Atomic Redis updates via `atomicUpdate`
7. `'use client'` directive for all Framer Motion components

### Epic 2 Context

**This Story's Role in Epic 2:**
Story 2.3 is the FINAL story in Epic 2 (Déploiement des Rôles & Cockpit de Jeu):
- Story 2.1: Game launch (DONE) — enables role selection
- Story 2.2: Role selection (DONE) — assigns player roles, creates transition
- **Story 2.3: Game Home cockpit (THIS STORY)** — the player's central hub

**What comes next (Epic 3):**
- Story 3.1: QR scan routing → activates the SCAN button
- Story 3.2: Quest sandbox container
- Story 3.3: Mini-games (QCM, Vrai/Faux)
- Story 3.4: Auto-redirect home after quest success

**CRITICAL**: The SCAN button must be future-ready for Epic 3 integration. Design it to accept an `href` or `onClick` prop so Story 3.1 can simply enable it.

### Latest Technical Information

**Framer Motion v12 (already installed v12.33.0):**
- Use `motion` components with `'use client'` directive
- Pulse animation: `animate={{ scale: [1, 1.02, 1] }}` with `transition={{ repeat: Infinity, duration: 2 }}`
- Check `prefers-reduced-motion` via `useReducedMotion()` hook from framer-motion
- GPU-accelerated: prefer `transform` and `opacity` properties

**Next.js 16.1.6:**
- App Router with `'use client'` for interactive components
- Server Actions for mutations (no new ones needed here)
- Link component for navigation (`next/link`)

**Zustand v5.0.11:**
- Shallow equality for selectors
- Keep quest state fields ready for Epic 3

**Tailwind CSS v4:**
- Custom font classes: `font-orbitron`, `font-rajdhani`, `font-mono`
- Dark theme variables already configured
- Use `touch-manipulation` for mobile button optimization

### Testing Requirements

**Unit Tests (Vitest):**
- `game-home.test.tsx`: Renders all sections (header, role badge, player list, scan button)
- `role-badge.test.tsx`: Correct colors/icons for CREWMATE vs IMPOSTOR
- `scan-button.test.tsx`: Renders disabled state, pulse animation present, haptic triggers
- `quest-progress.test.tsx`: Renders for Crewmate, hidden for Impostor, correct counts

- Full flow: create → join → launch → select role → transition → Game Home visible
- Verify SCAN button visible on Game Home
- Verify role badge shows correct role
- Verify player list shows joined players
- Page reload: player with role → lands on Game Home directly
- Quest progress visible for Crewmate, hidden for Impostor

### Implementation Strategy

**Phase 1: Component Extraction**
1. Create `role-badge.tsx` (simple, reusable)
2. Create `scan-button.tsx` (with Framer Motion pulse)
3. Create `quest-progress.tsx` (Crewmate-only)

**Phase 2: Game Home Assembly**
1. Create `game-home.tsx` composing all sub-components
2. Apply Tactical Terminal layout with thumb-zone placement

**Phase 3: Integration**
1. Update `page.tsx` to use `<GameHome>` component
2. Update Zustand store with quest state fields
3. Verify transition flow and idempotent reload

**Phase 4: Testing**
1. Unit tests for all new components
3. Manual mobile testing for thumb-zone placement

### Known Considerations

**SCAN Button — Disabled for MVP:**
- Epic 3 will enable the SCAN button with QR routing
- For now, show it as disabled but visually prominent (pulse animation still active but dimmed)
- This maintains the UX promise of the "Cockpit" while being honest about functionality

**Quest Progress — Placeholder Data:**
- No quest data exists until Epic 3
- Show "0 quêtes" or "En attente de missions..." placeholder
- Store fields (`questsCompleted`, `questsTotal`) ready for Epic 3 to populate

**Impostor vs Crewmate Home:**
- Both see the same Game Home layout
- Crewmate sees quest progress bar; Impostor does not
- SCAN button behavior will differ in Epic 3/4 (Crewmate gets real quest, Impostor gets fake success)
- For now, both see the same disabled SCAN button

**Performance:**
- Game Home is lightweight — no heavy data fetching
- Framer Motion pulse animation uses GPU-accelerated transforms
- Player list is small (max 10 players)

### Project Structure Notes

- Follows hybrid organization from architecture.md
- Feature components in `components/game/`
- Effects/animations in `components/effects/` (existing pattern)
- Server actions in `lib/redis/actions.ts` (no changes needed)
- Types in `types/game.ts` (no changes needed)
- Store in `lib/store/game-store.ts` (minor addition for quest fields)

### References

- [Epic 2 Story 2.3](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L202-L214)
- [Architecture: Frontend Architecture](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L104-L107)
- [Architecture: Project Structure](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L177-L211)
- [Architecture: Error Handling](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L144)
- [UX Design: SCAN Button](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L315-L318)
- [UX Design: Button Hierarchy](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L349-L353)
- [UX Design: Color System](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L196-L206)
- [UX Design: Typography](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L207-L211)
- [UX Design: Haptic Feedback](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L357)
- [UX Design: Thumb Zone](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L216)
- [UX Design: Game Home Flow](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L188-L192)
- [Story 2.2 - Sélection de Rôle](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/2-2-selection-de-role-immersion-visuelle.md)
- [Story 2.1 - Lancement de la Partie](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/2-1-lancement-de-la-partie-start-game.md)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (Cascade)

### Debug Log References

- Fixed role-badge unit tests: jsdom returns `rgb()` not hex for `style.color`
- Fixed lint warnings: removed unused `href` param in scan-button.tsx, unused `container` in tests

### Completion Notes List

- Extracted inline Game Home JSX (~80 lines) from `page.tsx` into composable `<GameHome>` component
- Created 4 new components: `game-home.tsx`, `role-badge.tsx`, `scan-button.tsx`, `quest-progress.tsx`
- RoleBadge supports compact/full variants with color-coded Crewmate (#2DA44E) / Impostor (#DA3633) display
- ScanButton uses Framer Motion pulse animation with `useReducedMotion()` accessibility check, haptic feedback, disabled MVP state
- QuestProgress conditionally renders for Crewmate only, with ARIA progressbar attributes
- Added Rajdhani and JetBrains Mono font imports to layout.tsx with display:swap for performance
- Added `questsCompleted` and `questsTotal` to Zustand store (default 0, ready for Epic 3)
- Replaced inline Game Home in page.tsx with single `<GameHome>` component call
- Removed unused `Shield`/`Users` imports from page.tsx (moved to role-badge.tsx)
- Updated existing role-selection.test.tsx mocks with new store fields
- 99 unit tests passing (14 test files), 0 lint errors

**Code Review Fixes Applied (2026-02-08):**
- [H2] Added keyboard navigation (Enter/Space) to SCAN button for accessibility
- [H3] Fixed race condition in chooseRole by fetching fresh game state after role selection
- [H4] Added defensive validation for missing role with error recovery UI
- [H6] Added display:swap to Orbitron and Rajdhani fonts for FOUT prevention
- [H7] Added runtime validation filtering invalid players from list
- [H8] Imported JetBrains Mono font and applied to technical data in footer
- [M1] Added GPU acceleration hint (willChange: transform) to SCAN button animation
- [M2] Replaced hardcoded #58A6FF colors with Tailwind primary color variables
- [M3] Added isLoading prop to QuestProgress with skeleton loader state
- [M4] Enhanced haptic feedback with different patterns (200ms for disabled, 50ms for enabled)

### Change Log

- 2026-02-08: Story 2.3 implementation complete — Game Home cockpit with role badge, SCAN button, quest progress, player list, and No Dead End navigation
- 2026-02-08: Code review fixes applied — 8 HIGH and 4 MEDIUM issues resolved (accessibility, performance, state sync, validation, testing)

### File List

**New files:**
- components/game/game-home.tsx
- components/game/role-badge.tsx
- components/game/scan-button.tsx
- components/game/quest-progress.tsx
- tests/unit/game-home.test.tsx
- tests/unit/role-badge.test.tsx
- tests/unit/scan-button.test.tsx
- tests/unit/quest-progress.test.tsx

**Modified files:**
- app/game/[id]/page.tsx (replaced inline Game Home with `<GameHome>` component)
- app/layout.tsx (added Rajdhani font import)
- app/globals.css (added font-orbitron and font-rajdhani to theme)
- lib/store/game-store.ts (added questsCompleted, questsTotal fields)
- tests/unit/role-selection.test.tsx (updated mocks with new store fields)
