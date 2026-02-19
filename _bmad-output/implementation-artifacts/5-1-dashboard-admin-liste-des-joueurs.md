# Story 5.1: Dashboard Admin & Liste des Joueurs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an organisateur,
I want accéder à une vue dédiée `/admin/tracker/[id]`,
so that voir la liste des joueurs rejoints et leur état de complétion global.

## Acceptance Criteria

**Given** une partie active.
**When** j'accède à la route admin `/admin/tracker/[id]`.
**Then** je vois la liste de tous les joueurs (pseudos).
**And** une barre de progression indique le pourcentage global de quêtes terminées par l'équipage.

## Tasks / Subtasks

- [x] Créer la route admin dynamique `/admin/tracker/[id]` (AC: Given, When)
  - [x] Créer le dossier `app/admin/tracker/[id]/` et le fichier `page.tsx`
  - [x] Implémenter la récupération des données de la partie via `gameId` dans les params
  - [x] Ajouter la validation d'accès (vérifier que la partie existe)
- [x] Afficher la liste des joueurs (AC: 1)
  - [x] Créer le composant `PlayerList` pour afficher les pseudos
  - [x] Utiliser les données de `gameState.players` depuis le store Zustand
  - [x] Appliquer le style "Tactical Terminal" (dark mode, contrastes néons)
- [x] Calculer et afficher la progression globale (AC: 2)
  - [x] Créer une fonction pour calculer le pourcentage de quêtes terminées
  - [x] Implémenter une barre de progression visuelle avec Tailwind
  - [x] Afficher le nombre de quêtes terminées / total par joueur
- [x] Intégration avec l'architecture existante
  - [x] Utiliser le store Zustand (`lib/store/game-store.ts`) pour la synchronisation
  - [x] Appeler les actions Redis existantes via `lib/redis/actions.ts`
  - [x] Maintenir la cohérence avec les patterns de routage Next.js
- [x] Tests et validation
  - [x] Créer les tests unitaires pour le composant tracker
  - [x] Valider la responsivité mobile-first

## Dev Notes

### Architecture Compliance

- **Route Pattern**: Suivre le pattern établi `/game/[id]` pour la structure admin
- **State Management**: Utiliser `useGameStore` pour la cohérence avec l'existant
- **API Integration**: Réutiliser `getGame()` action pour récupérer les données de partie
- **Styling**: Appliquer le thème "Tactical Terminal" avec classes Tailwind existantes

### Technical Requirements

- **Framework**: Next.js 16 App Router avec routes dynamiques
- **State**: Zustand store pour la synchronisation UI/Redis
- **Data Source**: Vercel KV via actions Redis existantes
- **Styling**: Tailwind CSS 4 avec design system "Tactical Terminal"
- **Performance**: Chargement fluide sur Wi-Fi/4G (NFR-P1)

### File Structure Requirements

```
app/admin/tracker/[id]/
├── page.tsx                    # Page principale du tracker
components/admin/
├── player-list.tsx            # Liste des joueurs
├── progress-bar.tsx           # Barre de progression globale
└── tracker-stats.tsx          # Statistiques de complétion
```

### Integration Points

- **Store Integration**: `useGameStore.fetchGame(gameId)` pour charger les données
- **Data Schema**: Utiliser `GameState.players` et `Player.completedQuests`
- **Navigation**: Lien depuis la page game home pour l'organisateur
- **Error Handling**: Messages clairs avec retour vers game home (No Dead End)

### Project Structure Notes

- **Alignment**: Cohérent avec l'architecture `app/game/[id]/` existante
- **Naming**: Suivre les conventions `kebab-case` pour les fichiers
- **Components**: Placer dans `components/admin/` pour l'organisation

### References

- [Epics: Story 5.1](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L306)
- [PRD: Functional Requirement FR20](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L260)
- [Architecture: Admin Tracker Route](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L191)
- [Architecture: Project Structure](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L179)

## Dev Agent Record

### Agent Model Used

Cascade (BMad Edition) - BMad Story Context Engine

### Completion Notes List

- Story context analyzed from epics, PRD, and architecture documents
- Technical patterns identified from existing game implementation
- Integration points defined with Zustand store and Redis actions
- File structure aligned with established Next.js App Router patterns
- "Tactical Terminal" UI theme requirements incorporated
- **IMPLEMENTATION COMPLETED**: Full admin tracker dashboard with player list, global progress, and statistics
- **INTEGRATION VERIFIED**: Uses actual game store and quest calculations (9 total quests)
- **ACCEPTANCE CRITERIA MET**: Route `/admin/tracker/[id]` displays player list and global progress bar
- **CODE REVIEW FIXES APPLIED**: 
  - Created shared `quest-calculations.ts` utility to eliminate code duplication
  - Added admin access control (only game creator can access tracker)
  - Added error boundary for component failure protection
  - Updated GameState with creatorId field for security
  - Fixed file path documentation discrepancies

### File List

- `app/admin/tracker/[id]/page.tsx`
- `components/admin/player-list.tsx`
- `components/admin/progress-bar.tsx`
- `components/admin/tracker-stats.tsx`
- `components/admin/error-boundary.tsx`
- `lib/utils/quest-calculations.ts`
- `types/game.ts` (updated with creatorId field)
- `lib/redis/actions.ts` (updated with creatorId logic)
- `tests/unit/admin/tracker.test.tsx`
