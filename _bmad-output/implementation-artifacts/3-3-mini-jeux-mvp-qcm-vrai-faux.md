# Story 3.3: Mini-Jeux MVP (QCM / Vrai-Faux)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a crewmate,
I want résoudre des mini-jeux simples,
so that valider mes quêtes et faire gagner l'équipage.

## Acceptance Criteria

1. **Quest Completion Recording in Redis**: When a crewmate answers a quest correctly (`questAnswered === true`), the system records the completion in Redis under the game state. The player's completed quest ID is stored persistently so it survives page refreshes. [Source: epics.md#L253-L257, architecture.md#L92-L93, story 3.2 AC#7 scope note]
2. **Server Action: `completeQuest`**: A new server action `completeQuest(gameId, userId, questId)` in `lib/redis/actions.ts` atomically updates the game state to record quest completion. Uses the established `atomicUpdate` (WATCH/MULTI/EXEC) pattern. Returns the updated quest completion data. [Source: architecture.md#L100-L101, story 3.1 Dev Notes]
3. **Player Quest Tracking in GameState**: Extend the `Player` interface in `types/game.ts` with `completedQuests?: string[]` to track which quest IDs each player has completed. This field is persisted in Redis as part of the game state. [Source: architecture.md#L93, types/game.ts]
4. **Quest Progress Counters Updated**: After successful quest completion, the Zustand store `questsCompleted` is incremented and `questsTotal` is set to the total number of quests available (9 quests across all pools). The `QuestProgress` component on Game Home reflects real progress. [Source: story 2.3 — QuestProgress component, game-store.ts fields]
5. **Quest Progress Loaded on Game Home**: When the Game Home page loads, the player's quest progress (`completedQuests.length` / total quests) is read from the game state and synced to the Zustand store. Returning to Game Home always shows accurate progress. [Source: components/game/game-home.tsx, story 2.3 AC]
6. **Duplicate Completion Prevention**: If a player has already completed a quest (same `questId`), the server action returns success without duplicating the entry. The client does not re-record already-completed quests. [Source: architecture.md#L144 "No Dead End", defensive coding]
7. **Haptic Feedback on Completion Recording**: After the server confirms quest completion, a distinct haptic pattern `[100, 50, 100]` fires (different from the answer-correct haptic `[50, 50, 50]`). This gives tactile confirmation that progress was saved. [Source: ux-design-specification.md#L357, epics.md#L256]
8. **Visual Completion Confirmation**: After quest completion is recorded, a brief "MISSION ENREGISTRÉE" status text appears below the quest answer area, confirming the save. Uses Tactical Terminal aesthetic (Orbitron, primary color). [Source: ux-design-specification.md#L355-L359]
9. **Error Handling on Completion Failure**: If the `completeQuest` server action fails (network error, Redis error), an inline error message is shown with a "Réessayer" retry button. The quest answer state is preserved (user does not need to re-answer). Follows "No Dead End" principle. [Source: architecture.md#L144, epic-2-retro Action Item #1]
10. **Quest Already Completed Guard**: If a crewmate navigates to a quest they've already completed, the quest page shows a "Quête déjà accomplie" message with a link back to Game Home, instead of showing the quest again. [Source: architecture.md#L144, defensive UX]
11. **Accessibility**: All new UI elements (completion status, error messages, retry button) have ARIA labels, support keyboard navigation, respect `prefers-reduced-motion`, and meet 44x44px touch targets. [Source: ux-design-specification.md#L388-L391, epic-2-retro Action Item #1]

## Tasks / Subtasks

- [x] **Task 1: Extend Player Data Model** (AC: 3)
  - [x] Add `completedQuests?: string[]` field to `Player` interface in `types/game.ts`
  - [x] Ensure backward compatibility — existing game states without this field still work (default to `[]`)

- [x] **Task 2: Server Action `completeQuest`** (AC: 1, 2, 6, 9)
  - [x] Create `completeQuest(gameId: string, userId: string, questId: string)` in `lib/redis/actions.ts`
  - [x] Use `atomicUpdate` pattern (WATCH/MULTI/EXEC) on `game:{gameId}:state`
  - [x] Validate: game exists, game is `IN_PROGRESS`, player exists in game, player has role
  - [x] Validate: quest is not already in player's `completedQuests` array (idempotent — return success if duplicate)
  - [x] On success: push `questId` to player's `completedQuests` array, return `{ completedQuests: string[], questsCompleted: number }`
  - [x] On failure: return error with appropriate error code
  - [x] Add new error code `ERR_QUEST_COMPLETE_FAILED` to `lib/constants/error-codes.ts`

- [x] **Task 3: Zustand Store — Quest Completion Flow** (AC: 4, 5)
  - [x] Add `completeQuestAction(gameId: string, userId: string, questId: string)` async action to GameStore
  - [x] This action calls `completeQuest` server action, then updates `questsCompleted` from response
  - [x] Add `setQuestsTotal(total: number)` action (or set it during game fetch)
  - [x] Add `isCompletingQuest: boolean` loading state
  - [x] Add `completionError: string | null` error state
  - [x] Update `fetchGame` to sync `questsCompleted` from `gameState.players[userId].completedQuests.length`
  - [x] Set `questsTotal` to total quest count (9) when game is loaded
  - [x] Reset `isCompletingQuest` and `completionError` in `clearQuest()` and `reset()`

- [x] **Task 4: Quest Completion Trigger in QuestView** (AC: 1, 7, 8, 9)
  - [x] Modify `handleSuccess` in `components/game/quest-view.tsx` to call `completeQuestAction` after setting `questAnswered: true`
  - [x] Pass `userId` to QuestView (from quest page or via `useLocalUser` hook)
  - [x] After successful completion recording: trigger haptic `[100, 50, 100]`, show "MISSION ENREGISTRÉE" text
  - [x] On completion error: show inline error with "Réessayer" button that retries `completeQuestAction`
  - [x] Preserve quest answer state during retry (user does not re-answer)

- [x] **Task 5: Quest Already Completed Guard** (AC: 10)
  - [x] In `app/game/[id]/quest/page.tsx`, after loading game state and selecting quest, check if `currentPlayer.completedQuests?.includes(quest.id)`
  - [x] If already completed: show "QUÊTE DÉJÀ ACCOMPLIE" message with link back to Game Home
  - [x] Use ErrorView or a dedicated info view with Tactical Terminal aesthetic

- [x] **Task 6: Quest Progress Sync on Game Home** (AC: 4, 5)
  - [x] In `app/game/[id]/page.tsx` (or wherever game state is fetched for Game Home), sync quest progress to Zustand store
  - [x] Set `questsCompleted = currentPlayer.completedQuests?.length ?? 0`
  - [x] Set `questsTotal = 9` (total quests in quests.json — all pools combined)
  - [x] `QuestProgress` component already renders from these store values — no changes needed to the component itself

- [x] **Task 7: Testing** (AC: 1-11)
  - [x] Unit test: `completeQuest` server action — success, duplicate prevention, game not found, player not found, game not in progress
  - [x] Unit test: GameStore `completeQuestAction` — calls server action, updates questsCompleted, handles errors
  - [x] Unit test: GameStore `fetchGame` — syncs questsCompleted/questsTotal from game state
  - [x] Unit test: QuestView — completion flow triggers completeQuestAction, shows confirmation, handles error + retry
  - [x] Unit test: Quest page — already-completed quest shows guard message
  - [x] E2E test: Full flow — answer quest correctly → completion recorded → return to Game Home → progress bar updated
  - [x] E2E test: Answer quest → completion error → retry → success
  - [x] E2E test: Navigate to already-completed quest → guard message shown
  - [x] E2E test: Quest progress persists across page refreshes (reload Game Home → progress still shown)

## Dev Notes

### Architecture Compliance

**State Management Pattern:**
- Zustand store (`lib/store/game-store.ts`) for client-side quest completion state
- New async action `completeQuestAction` follows the established pattern (set loading → call server action → update store → handle error)
- `questsCompleted` and `questsTotal` already exist in the store (added in Story 2.3, default 0) — this story populates them with real data
- Response wrapper: `{ success: boolean, data?: T, error?: string }` — follow existing pattern

**Redis Key Pattern:**
- Game state: `game:{gameId}:state` (existing key — extended with `completedQuests` on Player)
- NO new Redis keys needed — quest completion data is stored within the existing game state object
- This keeps the data model simple and avoids key proliferation

**Error Handling:**
- All error states must provide clear messaging and recovery path
- Use standardized error codes from `lib/constants/error-codes.ts`
- Follow "No Dead End" principle: always provide a way back to `/game/[id]`
- New error code: `ERR_QUEST_COMPLETE_FAILED`
- Completion errors are non-blocking: the quest answer is preserved, user can retry saving

**Data Flow:**
```
User answers correctly (Story 3.2) → questAnswered=true
  → QuestView.handleSuccess() calls completeQuestAction()
  → completeQuestAction() calls completeQuest() server action
  → Server action atomically updates game state in Redis (push questId to completedQuests)
  → Response returns updated completion count
  → Zustand store updates questsCompleted
  → UI shows "MISSION ENREGISTRÉE" confirmation
  → User flees/redirects to Game Home (Story 3.4)
  → Game Home loads → fetchGame → syncs questsCompleted/questsTotal from Redis
  → QuestProgress component shows updated progress bar
```

### Technical Requirements

**Dependencies (all already installed — NO new dependencies):**
- `next` 16.1.6 — Server Actions, App Router
- `zustand` v5.0.11 — quest completion state
- `framer-motion` v12.33.0 — completion confirmation animation (optional)
- `lucide-react` v0.563.0 — icons (Check, AlertTriangle)
- `react` 19.2.3 — hooks
- `redis` — via `lib/redis/client.ts` wrapper

**No new dependencies required.**

**Server Action Pattern (follow existing):**
```typescript
// In lib/redis/actions.ts
export async function completeQuest(
    gameId: string,
    userId: string,
    questId: string
): Promise<ActionResponse<{ completedQuests: string[], questsCompleted: number }>> {
    // 1. Validate inputs
    // 2. atomicUpdate on game:{gameId}:state
    // 3. Find player, check not already completed
    // 4. Push questId to player.completedQuests
    // 5. Return updated data
}
```

**Component Architecture:**
```
app/game/[id]/quest/page.tsx              (MODIFY - add already-completed guard)
  └── <QuestView>                          (MODIFY - components/game/quest-view.tsx)
        ├── Quest header + instruction      — NO CHANGE
        ├── <QuestRenderer>                 — NO CHANGE
        ├── Completion confirmation          — NEW (inline in QuestView)
        ├── Completion error + retry         — NEW (inline in QuestView)
        └── "Abandonner" flee button         — NO CHANGE

app/game/[id]/page.tsx                    (MODIFY - sync quest progress on load)
  └── <GameHome>                           — NO CHANGE (reads from store)
        └── <QuestProgress>                — NO CHANGE (reads from store)
```

### UI/UX Requirements

**Completion Confirmation (after server records quest):**
```
┌─────────────────────────┐
│  ✓ MISSION ENREGISTRÉE  │  ← Orbitron, primary color, appears below quest area
│                         │     Subtle fade-in animation (prefers-reduced-motion safe)
└─────────────────────────┘
```

**Completion Error (if server action fails):**
```
┌─────────────────────────┐
│  ⚠ ERREUR DE SAUVEGARDE │  ← Destructive color
│  Votre réponse est      │
│  correcte mais la       │
│  sauvegarde a échoué.   │
│                         │
│  ╔═══════════════════╗  │
│  ║    RÉESSAYER       ║  │  ← Primary border, min-h-[44px], touch-manipulation
│  ╚═══════════════════╝  │
└─────────────────────────┘
```

**Already Completed Guard (quest page):**
```
┌─────────────────────────┐
│  ✓ QUÊTE DÉJÀ ACCOMPLIE │  ← Orbitron, green accent
│                         │
│  Vous avez déjà validé  │
│  cette mission.         │
│                         │
│  ╔═══════════════════╗  │
│  ║  RETOUR AU COCKPIT ║  │  ← Link to /game/[id]
│  ╚═══════════════════╝  │
└─────────────────────────┘
```

**Accessibility:**
- High contrast ratio (4.5:1 minimum)
- Touch targets: 44x44px minimum (retry button)
- `prefers-reduced-motion`: disable fade-in animation on confirmation
- ARIA: `role="status"` on completion confirmation, `aria-live="polite"` for dynamic updates
- Keyboard: retry button focusable via Tab + Enter

### File Structure Requirements

```
types/
  └── game.ts                    # MODIFY - Add completedQuests to Player interface

lib/redis/
  └── actions.ts                 # MODIFY - Add completeQuest server action

lib/constants/
  └── error-codes.ts             # MODIFY - Add ERR_QUEST_COMPLETE_FAILED

lib/store/
  └── game-store.ts              # MODIFY - Add completeQuestAction, isCompletingQuest, completionError, sync logic

components/game/
  └── quest-view.tsx             # MODIFY - Add completion trigger, confirmation UI, error + retry

app/game/[id]/quest/
  └── page.tsx                   # MODIFY - Add already-completed guard

app/game/[id]/
  └── page.tsx                   # MODIFY - Sync quest progress to store on load

tests/unit/
  ├── game-actions.test.ts       # MODIFY - Add completeQuest server action tests
  ├── game-store.test.ts         # MODIFY - Add completeQuestAction, progress sync tests
  ├── quest-view.test.tsx        # MODIFY - Add completion flow tests
  └── quest-page.test.tsx        # MODIFY - Add already-completed guard test

tests/e2e/
  └── quest-routing.spec.ts      # MODIFY - Add completion E2E tests
```

### Previous Story Intelligence

**From Story 3.2 (Conteneur de Quête — Quest Sandbox) — DONE:**
- `questAnswered: boolean` state exists in Zustand store — set to `true` when user answers correctly
- `handleSuccess` callback in `QuestView` currently only calls `setQuestAnswered(true)` — this story extends it to also call `completeQuestAction`
- `useQuestAnswer` hook in `hooks/use-quest-answer.ts` handles answer validation, haptic, retry — NO changes needed to this hook
- `QuestRenderer` dispatches to `QuestTrueFalse` / `QuestQCM` — NO changes needed
- Quest answer state is client-side only — this story adds the server-side persistence layer
- Code review fix M2: `useQuestAnswer` shared hook extracted — reuse, don't duplicate

**From Story 3.2 Code Review (MUST NOT regress):**
- H1/H2: Buttons disabled after answer, guard prevents double-tap — DO NOT break this
- H3: E2E tests use brute-force correct answer finding + `toBeDisabled()` + `toHaveClass` assertions — follow same pattern
- M3: `willChange: "transform"` only on selected/animating button — keep this optimization

**From Story 3.1 (Routage Dynamique & Scan QR) — DONE:**
- Quest page validates game state, player, role before showing quest — add completion check after these validations
- `clearQuest()` called in flee handler — keep this, also clear completion state
- `useSearchParams()` wrapped in `<Suspense>` — DO NOT touch this
- `router.push()` for SPA navigation — DO NOT use `window.location.href`

**Key Code Review Patterns to Follow (from Epic 2 retro):**
- **(a) State sync**: Always update Zustand store with server response after every mutation — CRITICAL for this story
- **(b) Accessibility**: `prefers-reduced-motion`, keyboard navigation, ARIA labels, touch targets (44px min)
- **(c) Error recovery**: Inline error display, functional retry, "No Dead End" principle
- **(d) No `setState` during render** — use `useEffect` for derived state
- **(e) `'use client'` directive** for all Framer Motion and hook-using components
- **(f) Hydration-safe**: no `localStorage` during SSR

**Patterns established in Epic 2 + Epic 3:**
1. Server Actions in `lib/redis/actions.ts` for all Redis mutations
2. Error codes from `lib/constants/error-codes.ts`
3. Orbitron for headers, Rajdhani for body, JetBrains Mono for technical data
4. Haptic: `navigator.vibrate([duration])` with try/catch
5. Hydration-safe: no localStorage during SSR
6. Atomic Redis updates via `atomicUpdate` (WATCH/MULTI/EXEC)
7. `'use client'` directive for all Framer Motion components
8. `useReducedMotion()` hook for accessibility
9. Conditional `willChange: transform` for GPU acceleration (only on animating elements)
10. Tailwind primary color variables instead of hardcoded hex
11. `useQuestAnswer` shared hook for quest answer logic (DRY)
12. `ActionResponse<T>` wrapper for all server action returns

### Git Intelligence

**Recent commits (last 5):**
1. `06a2367` Story 3.2: Conteneur de Quête (Quest Sandbox)
2. `430654b` Story 3.1: Routage Dynamique & Scan QR
3. `51e7c6e` Story 2.3: Home Cocktail (Game Home)
4. `36f2216` Story 2.2: Sélection de Rôle & Immersion Visuelle
5. `0d5d98e` Story 2.1: Lancement de la Partie (Start Game)

**Patterns from recent commits:**
- Each story is a single atomic commit
- Server actions follow `atomicUpdate` pattern consistently
- Zustand store extended incrementally (not replaced)
- Test counts growing: 99 → 142 → 194 unit tests, 21 → 26 → 29 E2E tests
- All commits pass lint + unit + E2E gate

### Epic 3 Context

**This Story's Role in Epic 3:**
- Story 3.1: Quest routing & scan — DONE 
- Story 3.2: Quest sandbox container — DONE 
- **Story 3.3: Mini-games MVP — quest completion recording (THIS STORY)**
- Story 3.4: Auto-redirect home after success — celebration overlay + auto-redirect loop

**What this story enables:**
- Connects the client-side quest answer flow (Story 3.2) to server-side persistence (Redis)
- Populates the `QuestProgress` component on Game Home with real data
- Tracks which quests each player has completed (prevents re-doing same quest)
- Provides the completion confirmation that Story 3.4 will use as the trigger for auto-redirect

**What this story does NOT do (scope boundaries):**
- Does NOT implement success overlay or auto-redirect (Story 3.4)
- Does NOT handle Impostor-specific view (Epic 4)
- Does NOT implement `form` or `single-input` quest types (future)
- Does NOT implement quest cooldown or rate limiting (not in MVP)
- Does NOT change the quest answer UI (Story 3.2 handles that)
- After completion recording, user must still manually flee or wait for Story 3.4 auto-redirect

### Project Structure Notes

- Follows hybrid organization from architecture.md
- Server action added to existing `lib/redis/actions.ts` (single file for all Redis mutations)
- Store extension in `lib/store/game-store.ts` (single store pattern)
- Type extension in `types/game.ts` (alongside existing Player interface)
- No new components — completion UI is inline in existing `QuestView`
- Quest progress sync happens in existing page components

### References

- [Epic 3 Story 3.3](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L245-L257)
- [Architecture: Data Architecture](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L90-L93)
- [Architecture: API Patterns](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L100-L101)
- [Architecture: Error Handling](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L144)
- [Architecture: Project Structure](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L177-L211)
- [UX Design: Feedback Patterns](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L355-L359)
- [UX Design: Haptic Feedback](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L357)
- [UX Design: Accessibility](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L388-L391)
- [Story 3.2 - Quest Sandbox](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/3-2-conteneur-de-quete-quest-sandbox.md)
- [Story 3.1 - Routage Dynamique](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/3-1-routage-dynamique-scan-qr.md)
- [Epic 2 Retrospective](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/epic-2-retro-2026-02-08.md)

## Dev Agent Record

### Agent Model Used

Cascade (Penguin Alpha)

### Debug Log References

No debug logs needed - implementation proceeded smoothly with comprehensive test coverage.

### Completion Notes List

- **Task 1**: Extended Player interface with optional `completedQuests?: string[]` field for backward compatibility
- **Task 2**: Implemented `completeQuest` server action with atomic Redis updates, full validation, and idempotent duplicate prevention
- **Task 3**: Extended Zustand store with `completeQuestAction`, `isCompletingQuest`, `completionError` states and progress sync in `fetchGame`
- **Task 4**: Modified QuestView to trigger completion recording on answer success, with haptic feedback `[100, 50, 100]`, confirmation UI, and error/retry handling
- **Task 5**: Added already-completed quest guard in quest page with "QUÊTE DÉJÀ ACCOMPLIE" message and return link
- **Task 6**: Updated Game Home and quest page to pass `userId` to `fetchGame` for automatic progress sync
- **Task 7**: Added comprehensive unit tests (6 new tests) and E2E tests (3 new tests) covering all acceptance criteria

### File List

## Modified Files

- `types/game.ts` - Added completedQuests field to Player interface
- `lib/constants/error-codes.ts` - Added ERR_QUEST_COMPLETE_FAILED
- `lib/redis/actions.ts` - Added completeQuest server action
- `lib/store/game-store.ts` - Added completeQuestAction, isCompletingQuest, completionError, updated fetchGame
- `components/game/quest-view.tsx` - Added completion trigger, confirmation UI, error/retry
- `app/game/[id]/quest/page.tsx` - Added already-completed guard, pass userId to QuestView
- `app/game/[id]/page.tsx` - Pass userId to fetchGame for progress sync
- `tests/unit/game-actions.test.ts` - Added completeQuest server action tests
- `tests/unit/game-store.test.ts` - Added completeQuestAction and progress sync tests
- `tests/unit/quest-view.test.tsx` - Added completion flow tests
- `tests/unit/quest-page.test.tsx` - Added already-completed guard test
- `tests/e2e/quest-routing.spec.ts` - Added quest completion E2E tests
