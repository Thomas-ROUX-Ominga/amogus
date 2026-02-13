---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  ["prd.md", "product-brief-amogus-2025-02-03.md", "ux-design-specification.md"]
workflowType: "architecture"
project_name: "amogus"
user_name: "Omi"
date: "2026-02-05T20:35:52+01:00"
lastStep: 8
status: "complete"
completedAt: "2026-02-05T22:05:00+01:00"
---

# Architecture Decision Document

## Phase 1: Core Architecture (v1.0)

### Data Architecture

- **Tech**: Redis (Vercel KV or TCP).
- **Rationale**: Minimal latency for real-time game state updates.
- **Modeling**: Objects keyed by `gameId`, containing player arrays and task status.

### Authentication & Security

- **Logic**: Zero-Account Session.
- **Mechanism**: Randomly generated `userId` in `localStorage`.
- **URL Protection**: Non-guessable UUIDs for game links.

### Testing Strategy

- **Unit Testing**: **Vitest** for game logic (roles, quest pools).
- **E2E Testing**: **Playwright** for complete scenarios.
- **Mocks**: Redis and Camera mocks for CI.

---

## Phase 2: Tactical Pivot (v2.0)

### Data Modeling & Persistence

- **Redis (Vercel KV)**:
  - `admin:session:{id}`: Admin auth state.
  - `batch:{id}`: List of quest structures (Fixed: ID, Format, Type, Location).
  - `game:{shortCode}:state`: Current game status, players, and assignments.
- **Static Library (`/lib/constants/quest-library.json`)**:
  - Mapping of `format_type` to a list of content objects (questions, mini-games).

### Authentication & Authorization

- **Admin**: Login/Password (Server Actions + HTTP-only cookies).
- **Player**: Session-based `userId`. Access via 6-character short code.

### Real-time Communication

- **Lobby Sync**: SWR with small interval (2s) or SSE to track new players and game start.

### Device Integration

- **Camera API**: `HTML5 MediaDevices API` for direct in-app scanning.

### Naming Patterns & Boundaries

- **Batches**: `batch:{batchId}`.
- **API Boundaries**: All access to Redis encapsulated in `lib/redis/actions.ts`.

---

## Project Directory Structure (Global)

```
amogus/
├── app/
│   ├── (auth)/                 # Onboarding / Join logic
│   ├── (game)/                 # Core Game Experience
│   ├── admin/                  # Admin portal & Live Tracker
├── components/
│   ├── ui/                     # Atoms
│   ├── game/                   # Features (Scanner, QuestCard)
│   ├── admin/                  # Admin specific components
├── lib/
│   ├── redis/                  # Redis Client & Actions
│   ├── store/                  # Zustand (game-store.ts)
│   ├── quests/                 # Logic for dynamic mapping
├── hooks/                      # useHaptic, useCamera, useGame
├── types/                      # Master Types
```
