# Story 4.1: Masquage du Contenu (Impostor View)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an impostor,
I want scanner un QR de quête,
so that paraître actif aux yeux des autres sans accéder aux détails de la mission.

## Acceptance Criteria

1. **Given** l'identifiant du joueur avec le rôle `Impostor`.
2. **When** j'accède à une URL de quête `/game/[id]/quest?duration=short|medium|long`.
3. **Then** le système ne tire aucune quête du pool.
4. **And** aucune instruction ou durée n'est affichée.
5. **And** le système se prépare à afficher l'écran de succès simulé (Story 4.2).

## Tasks / Subtasks

- [x] Adapter le routage dynamique des quêtes pour les imposteurs (AC: 1, 2)
  - [x] Identifier le rôle de l'utilisateur dans `app/game/[id]/quest/page.tsx`
  - [x] Court-circuiter la sélection aléatoire de quête si `role === 'IMPOSTOR'`
- [x] Prévenir l'affichage des détails de la mission (AC: 3, 4)
  - [x] S'assurer que `currentQuest` reste nul ou est marqué comme "simulé"
  - [x] Mettre à jour `QuestView` pour gérer l'affichage vide ou le passage direct au succès simulé
- [x] Validation technique (AC: 5)
  - [x] Vérifier qu'aucune donnée de quête réelle n'est envoyée au client pour un imposteur (prévention de triche via inspection réseau)

## Dev Notes

- **Fichiers critiques :**
  - `app/game/[id]/quest/page.tsx` : Contrôle la logique de chargement de la quête.
  - `lib/store/game-store.ts` : Source de vérité pour l'état du jeu et le rôle du joueur.
  - `components/game/quest-view.tsx` : Composant d'affichage à adapter.
- **Patterns Architecture :**
  - Respecter le principe "No Dead End" : si une erreur survient, permettre le retour à `/game/[id]`.
  - Utiliser Framer Motion pour les transitions fluides prévues dans l'Epic 4.
- **Sécurité :** Ne pas tirer de quête côté serveur/action si le rôle est Imposteur pour éviter les leaks.

### Project Structure Notes

- L'architecture utilise Next.js App Router.
- L'état est géré via Zustand dans `lib/store/game-store.ts`.
- Les quêtes sont définies dans `lib/constants/quest-pool.ts`.

### References

- [Epics: Epic 4](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L271)
- [PRD: Functional Requirement FR18](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L253)
- [Architecture: Role-based UI logic](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L24)
- [UX Specs: Impostor Flow](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L266)

## Dev Agent Record

### Agent Model Used

Antigravity (BMad Edition)

### Debug Log References

N/A

### Completion Notes List

- Story context analyzed and generated.
- Technical guardrails extracted from codebase analysis.

### File List

- `app/game/[id]/quest/page.tsx`
- `components/game/quest-view.tsx`
- `tests/unit/quest-page.test.tsx`
- `tests/unit/quest-view.test.tsx`
