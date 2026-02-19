# Story 5.2: Suivi Individuel & Rafraîchissement (Manual Sync)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an organisateur,
I want pouvoir rafraîchir manuellement la vue du tracker,
so that voir qui a terminé quelle quête le plus récemment.

## Acceptance Criteria

**Given** le tracker admin ouvert.
**When** je clique sur "Actualiser".
**Then** le système récupère les dernières données de Vercel KV.
**And** le détail des quêtes (Nombre total vs terminées) est mis à jour pour chaque joueur.

## Tasks / Subtasks

- [x] Ajouter un bouton d'actualisation manuelle au tracker (AC: Given, When)
  - [x] Créer un composant `RefreshButton` dans `components/admin/`
  - [x] Intégrer le bouton dans la page tracker existante
  - [x] Ajouter un état de chargement pendant la synchronisation
- [x] Implémenter la logique de rafraîchissement des données (AC: 1)
  - [x] Créer une action serveur pour rafraîchir les données de partie
  - [x] Mettre à jour le store Zustand avec les nouvelles données
  - [x] Forcer la revalidation des données joueurs et quêtes
- [x] Afficher le détail individuel des quêtes par joueur (AC: 2)
  - [x] Étendre `PlayerList` pour montrer les quêtes terminées/total
  - [x] Créer un composant `PlayerQuestProgress` pour le détail
  - [x] Ajouter une indication visuelle des quêtes récemment terminées
- [x] Optimiser l'expérience utilisateur et les performances
  - [x] Ajouter des feedbacks tactiles (haptique) lors du rafraîchissement
  - [x] Implémenter un debounce pour éviter les clics multiples
  - [x] Afficher un timestamp de dernière synchronisation
- [x] Tests et validation
  - [x] Tests unitaires pour la logique de rafraîchissement
  - [x] Validation de la mise à jour en temps réel des données

## Dev Notes

### Architecture Compliance

- **Component Pattern**: Réutiliser les composants admin de 5.1 (`PlayerList`, `ProgressBar`)
- **State Management**: Utiliser le pattern `useGameStore` établi pour la cohérence
- **API Integration**: Étendre les actions Redis existantes dans `lib/redis/actions.ts`
- **Styling**: Maintenir le thème "Tactical Terminal" avec les mêmes tokens

### Technical Requirements

- **Framework**: Next.js 16 Server Actions pour la logique de rafraîchissement
- **State**: Zustand store avec pattern de mise à jour immuable
- **Data Source**: Vercel KV avec revalidation forcée
- **Performance**: Transition <300ms pour le feedback de rafraîchissement (NFR-P2)
- **UX**: Feedback haptique et visuel immédiat (UX Haptic Feedback)

### File Structure Requirements

```
app/admin/tracker/[id]/
├── page.tsx                    # Page principale (à étendre)
components/admin/
├── refresh-button.tsx         # Bouton d'actualisation
├── player-quest-progress.tsx  # Détail des quêtes par joueur
├── player-list.tsx            # Liste enrichie (modification)
├── progress-bar.tsx           # Barre de progression globale
└── tracker-stats.tsx          # Statistiques de complétion
lib/redis/
└── actions.ts                 # Actions serveur (extension)
hooks/
└── use-refresh-tracker.ts      # Hook personnalisé pour le rafraîchissement
```

### Integration Points

- **Store Integration**: `useGameStore.refreshGame(gameId)` pour forcer la mise à jour
- **Data Schema**: Utiliser `Player.completedQuests` et `Player.lastQuestCompleted`
- **Component Extension**: Enrichir `PlayerList` avec le détail des quêtes
- **Error Handling**: Messages clairs avec retry automatique en cas d'échec

### Previous Story Intelligence

**From Story 5.1 (Dashboard Admin):**
- **Foundation**: Route `/admin/tracker/[id]` et structure de base existent
- **Components**: `PlayerList`, `ProgressBar`, `TrackerStats` sont implémentés
- **Store Pattern**: `useGameStore` avec `fetchGame()` est établi
- **Security**: Contrôle d'accès creatorId est en place

**Code Patterns to Follow:**
- **Component Structure**: Suivre le pattern établi dans `components/admin/`
- **Server Actions**: Étendre `lib/redis/actions.ts` avec `refreshGame()`
- **State Updates**: Utiliser le pattern immuable de Zustand
- **Error Handling**: Messages "Tactical" avec retour vers game home

### Project Structure Notes

- **Alignment**: Extension cohérente de l'architecture admin existante
- **Naming**: Convention `kebab-case` pour les nouveaux composants
- **Location**: Placer les nouveaux composants dans `components/admin/`
- **Tests**: Suivre le pattern de tests co-localisés de 5.1

### References

- [Epics: Story 5.2](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L319)
- [PRD: Functional Requirement FR21](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L261)
- [Architecture: API Patterns](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L101)
- [Architecture: Project Structure](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L179)
- [UX: Feedback Patterns](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L355)
- [Previous Story: 5.1 Implementation](file:///home/omi/projects/amogus/_bmad-output/implementation-artifacts/5-1-dashboard-admin-liste-des-joueurs.md)

## Dev Agent Record

### Agent Model Used

Cascade (BMad Edition) - BMad Story Context Engine

### Debug Log References

### Completion Notes List

✅ **Story 5.2 Implementation Complete**

**Key Accomplishments:**
- ✅ Created RefreshButton component with debouncing and loading states
- ✅ Implemented refreshGameData server action and store integration  
- ✅ Enhanced Player type with lastQuestCompleted timestamp
- ✅ Created PlayerQuestProgress component for detailed quest tracking
- ✅ Added sync timestamp display in tracker header
- ✅ Comprehensive unit tests for all new components

**Technical Implementation:**
- Manual refresh button with 2-second debounce protection
- Real-time quest progress tracking with completion timestamps
- Enhanced player list showing detailed quest statistics
- French-localized UI with tactical terminal styling

**Files Modified/Created:**
- `components/admin/refresh-button.tsx` (NEW)
- `components/admin/player-quest-progress.tsx` (NEW)  
- `components/admin/player-list.tsx` (ENHANCED)
- `app/admin/tracker/[id]/page.tsx` (ENHANCED)
- `lib/redis/actions.ts` (ENHANCED)
- `lib/store/game-store.ts` (ENHANCED)
- `types/game.ts` (ENHANCED)
- `tests/unit/components/admin/refresh-button.test.tsx` (NEW)
- `tests/unit/components/admin/player-quest-progress.test.tsx` (NEW)
- `tests/unit/admin/tracker.test.tsx` (UPDATED)

**Acceptance Criteria Met:**
- ✅ AC1: Manual refresh fetches latest data from Vercel KV
- ✅ AC2: Individual quest details (completed/total) updated per player

**Code Review Fixes Applied (2026-02-12):**
- ✅ Fixed missing File List documentation
- ✅ Added haptic feedback implementation to RefreshButton
- ✅ Fixed performance issue in refreshGameData method
- ✅ Updated story status to "done" after all fixes applied

### File List

- `components/admin/refresh-button.tsx` (NEW)
- `components/admin/player-quest-progress.tsx` (NEW)  
- `components/admin/player-list.tsx` (ENHANCED)
- `app/admin/tracker/[id]/page.tsx` (ENHANCED)
- `lib/redis/actions.ts` (ENHANCED)
- `lib/store/game-store.ts` (ENHANCED)
- `types/game.ts` (ENHANCED)
- `tests/unit/components/admin/refresh-button.test.tsx` (NEW)
- `tests/unit/components/admin/player-quest-progress.test.tsx` (NEW)
- `tests/unit/admin/tracker.test.tsx` (UPDATED)
- `test-results/.last-run.json` (UPDATED)
