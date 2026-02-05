---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['prd.md', 'product-brief-amogus-2025-02-03.md', 'ux-design-specification.md']
workflowType: 'architecture'
project_name: 'amogus'
user_name: 'Omi'
date: '2026-02-05T20:35:52+01:00'
lastStep: 8
status: 'complete'
completedAt: '2026-02-05T22:05:00+01:00'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
Architecture must support:
- Dynamic Routing: `/game/[id]` for the lobby/home and `/game/[id]/quest?duration=[d]` for task execution.
- Role-based UI logic: Seamless switch between functional quest views (Crewmate) and placeholder success views (Impostor).
- Admin Tracker: Aggregated view of task progress (manual refresh for MVP).

**Non-Functional Requirements:**
- **Zero-Account Join**: Extremely low friction onboarding.
- **Tactical Speed**: Transition to quest in <300ms.
- **Resilience**: Every error state must provide a clear exit path to the game home.

**Scale & Complexity:**
- Primary domain: Full-stack Web (Mobile-first SPA)
- Complexity level: Medium (due to high UX/Immersive requirements)
- Estimated architectural components: 5 (Game Engine, Lobby Service, Quest Handler, Admin Tracker, UI Design System)

### Technical Constraints & Dependencies
- Deployment: Vercel.
- Navigation: Must handle QR-originated entries smoothly.

### Cross-Cutting Concerns Identified
- **State Management**: Handling game state (lobby, roles, completions) without heavy persistence.
- **Immersive UI Transitions**: Smooth, high-contrast UI suited for real-world party environments.

## Starter Template Evaluation

### Primary Technology Domain
**Mobile-first Web App (SPA/PWA)** basé sur l'analyse des besoins de mobilité et d'interaction temps-réel (concept "Strike-Quest").

### Starter Options Considered
1. **Current Setup (Next.js 16 + Tailwind 4)** : État actuel du projet. Très performant, moderne, mais nécessite des ajouts pour la gestion d'état et les animations immersives.
2. **T3 Stack (tRPC, Prisma)** : Excellent pour les projets avec backend complexe, mais potentiellement trop lourd pour un MVP centré sur l'UX locale.
3. **PWA Dedicated Starters** : Offrent une configuration PWA clé en main, mais moins à jour sur Next.js 16/Tailwind 4 que l'installation actuelle.

### Selected Starter: Current Project Foundation (Augmented)

**Rationale for Selection:**
Le projet utilise déjà **Next.js 16** et **Tailwind 4**, ce qui représente le "state of the art". Au lieu de changer, nous allons enrichir cette base pour répondre aux besoins spécifiques du jeu.

**Initialization Command Prefix (already executed):**
```bash
npx create-next-app@latest
```

**Architectural Decisions Provided by Starter:**
- **Language**: TypeScript (Strict mode) pour la fiabilité du code.
- **Styling**: Tailwind CSS 4 (Engine v4) pour un design système rapide et performant.
- **Routing**: Next.js App Router pour une navigation fluide entre Lobby et Quêtes.
- **Architecture**: Atomic Components (via Radix UI) pour une interface tactile robuste.

**Planned Enhancements:**
- **State management**: Zustand (léger, parfait pour le flux de jeu).
- **Animations**: Framer Motion (indispensable pour les transitions immersives et effets "glitch").
- **PWA**: Configuration native des manifests et service workers pour l'usage "Homescreen".

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Data Store: Vercel KV (Redis) for game state.
- Security: Zero-Account logic with client-side UUID generation.
- Frontend State: Zustand for game/quest coordination.

**Important Decisions (Shape Architecture):**
- API: Next.js Server Actions for game mutations.
- UI: Framer Motion for immersive task transitions.
- PWA: @serwist/next for home-screen capability.

### Data Architecture
- **Tech**: Vercel KV (Redis)
- **Rationale**: Minimal latency for real-time game state updates (lobby, quest completion). No heavy persistence needed for MVP.
- **Modeling**: Objects keyed by `gameId`, containing player arrays and task status.

### Authentication & Security
- **Logic**: Zero-Account Session.
- **Mechanism**: Randomly generated `userId` in `localStorage`.
- **URL Protection**: Non-guessable UUIDs for game links.

### API & Communication Patterns
- **Protocol**: Next.js Server Actions.
- **Polling**: SWR for admin tracker updates (3000ms interval recommended).

### Frontend Architecture
- **State Management**: Zustand v5.
- **Animations**: Framer Motion v12.
- **Styles**: Tailwind CSS v4 + Radix UI components optimized for thumb-driven mobile touch targets.

### Infrastructure & Deployment
- **Platform**: Vercel.
- **PWA**: @serwist/next for native-like full-screen experience.

### Testing Strategy
- **Unit Testing**: **Vitest** for game logic (roles, quest pools, KV state transitions).
- **E2E Testing**: **Playwright** for the "Strike-Quest" loop (Join -> Scan -> Quest -> Home).
- **Component Testing**: Focused on the QR Scanner and tactical UI feedback.
- **Mocking**: Redis/KV mocking for local development and CI.

## Implementation Patterns & Consistency Rules

### Naming Patterns
- **Files & Directories**: `kebab-case` (e.g., `game-lobby.tsx`, `use-haptic.ts`).
- **React Components**: `PascalCase` (e.g., `QuestCard`).
- **Variables & Functions**: `camelCase`.
- **Redis Keys**: `game:{gameId}:state` and `game:{gameId}:players:{userId}`.

### Structure Patterns
- **Project Hybrid Organization**:
  - `app/game/[id]/`: Feature-specific logic (lobby, quests, tracker).
  - `components/ui/`: Atomic UI components.
  - `lib/store/`: Zustand stores.
  - `lib/actions/`: Server Actions for Redis mutations.
  - `hooks/`: Custom hooks (`useHaptic`, `useQuest`).

### Format Patterns
- **API Response Wrapper**: `{ success: boolean, data?: T, error?: string }` for all Server Actions.
- **JSON Field Naming**: `camelCase`.

### Communication Patterns
- **State Updates**: Immutable updates via Zustand.
- **Event Callbacks**: Prefixed with `on` (e.g., `onQuestComplete`).

### Process Patterns
- **Error Handling**: Global "No Dead End" principle. Any error UI must provide a "Back to Game Home" action.
- **Loading States**: Tactile feedback (pulse, skeleton) during transitions.
- **Haptic Feedback**: Trigger vibration on all critical success/failure events.

### Testing Patterns
- **Test Location**: Co-located `*.test.ts` for simple logic; `tests/` directory for integration/E2E.
- **Naming**: `[name].test.ts` or `[name].spec.ts`.
- **Logic Isolation**: Keep game rules pure and testable without the UI.

## Architecture Validation Results

### Coherence Validation ✅
Les choix technologiques sont alignés sur le concept de "Cockpit Tactile" :
- **Next.js 16 + Vercel KV** : Garantit une latence minimale indispensable pour les quêtes.
- **Zustand + Framer Motion** : Permet des transitions fluides "Strike-Quest" sans rafraîchissement lourd.

### Requirements Coverage Validation ✅
- **FRs (Lobby, Join, Quests, Roles)** : Entièrement couverts par le système de routage dynamique et le stockage Redis.
- **NFRs (PWA, Performance)** : Adressés via Serwist et l'optimisation mobile-first.

### Implementation Readiness Validation ✅
- **Structure** : L'arborescence est spécifique et évite les conflits entre agents.
- **Patterns** : Les conventions de nommage Redis et React sont précises.
- **Cost Policy**: Stack 100% compatible avec les **Free Tiers** (Vercel Hobby + Vercel KV 30k reqs/mo) pour une utilisation type soirée.

### Architecture Readiness Assessment
- **Status** : READY FOR IMPLEMENTATION
- **Confidence Level** : High
- **Key Strengths** : Mobilité maximale, friction nulle (zero-account), immersion visuelle, coût d'exploitation nul.

### Implementation Handoff
**First Implementation Priority:** Configure Vercel KV and initialize the Next.js project structure as defined in the "Project Structure" section.

### Complete Project Directory Structure

```
amogus/
├── app/
│   ├── (auth)/                 # Onboarding / Join logic
│   │   ├── join/
│   │   │   └── page.tsx        # Initial pseudo/role input
│   ├── (game)/                 # Core Game Experience
│   │   ├── game/[id]/          # Game Cockpit (Home)
│   │   │   ├── page.tsx
│   │   │   └── quest/          # Dynamic Quest Router
│   │   │       └── page.tsx    # Handles drawing tasks via ?duration
│   ├── admin/
│   │   └── tracker/[id]/       # Admin tracker view
│   ├── layout.tsx              # PWA Wrapper & Root Providers
│   └── globals.css             # Tailwind 4 Entry
├── components/
│   ├── ui/                     # Shadcn / Radix primitives
│   ├── game/                   # Game-specific components (Scanner, QuestCard)
│   ├── layout/                 # Tactical Headers, Navigation
│   └── effects/                # Glitch, Success overlays (Framer Motion)
├── lib/
│   ├── kv/                     # Vercel KV Client & Redis Actions
│   ├── store/                  # Zustand (game-store.ts)
│   ├── utils/                  # helpers (haptics, qr-parser)
│   └── constants/              # Quest pools (short/med/long)
├── hooks/                      # useHaptic, useGameStatus, useQuest
├── tests/
│   ├── unit/                   # Logic and utility tests
│   ├── e2e/                    # Playwright scenarios
│   └── mocks/                  # KV & Haptic mocks
├── public/                     # PWA Manifest, Icons, Assets
└── types/                      # Game, Player, Quest interfaces
```

### Architectural Boundaries

**API Boundaries:**
- All access to Vercel KV is encapsulated in `lib/kv/actions.ts`. No direct Redis calls in components.

**Component Boundaries:**
- `game/` components are presentational; they receive data and callbacks via dedicated hooks or props.

**State Boundaries:**
- Zustand synchronizes local UI state with the Redis store using Server Actions.

**Data Flow:**
- `QR Scan` -> `Dynamic Route` -> `KV Action Fetch` -> `Zustand Sync` -> `UI Render`.
