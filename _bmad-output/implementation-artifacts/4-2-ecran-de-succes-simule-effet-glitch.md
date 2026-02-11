# Story 4.2: Écran de Succès Simulé & Effet "Glitch"

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an impostor,
I want voir un écran de succès "simulé",
so that pouvoir montrer mon écran aux autres s'ils suspectent que je ne fais rien.

## Acceptance Criteria

1. **Given** un scan effectué par un imposteur.
2. **When** la page de quête se charge.
3. **Then** l'écran affiche immédiatement un statut "MISSION ACCOMPLIE".
4. **And** le design utilise des effets de "Glitch" visuels (Framer Motion) et des teintes rouges subtiles.
5. **And** le joueur est redirigé vers la home comme un Crewmate après un délai de 2-3 secondes.

## Tasks / Subtasks

- [x] Supprimer le placeholder "Transmission Brouillée" pour les imposteurs (AC: 1, 3)
  - [x] Mettre à jour `components/game/quest-view.tsx` pour déclencher le succès immédiatement si `isImpostor` est vrai.
- [x] Implémenter l'effet "Glitch" dans l'overlay de succès (AC: 4)
  - [x] Modifier ou étendre `components/game/success-overlay.tsx` pour accepter un mode `impostor`.
  - [x] Ajouter des variations de couleurs (rouge tactique `#DA3633`) et des animations de glitch via `Framer Motion`.
  - [x] S'assurer que le texte "MISSION ACCOMPLIE" reste identique à celui du Crewmate (hormis les effets visuels subtils).
- [x] Gérer la redirection automatique (AC: 5)
  - [x] Vérifier que le délai de redirection de 3s dans `QuestView` est actif pour les imposteurs.
  - [x] S'assurer que `clearQuest` est appelé pour nettoyer l'état local.
- [x] Validation et Qualité
  - [x] Vérifier la fluidité de la transition scan -> succès (NFR-P2: <300ms).
  - [x] Tester le retour haptique spécifique (vibration "glitchy" si possible).
  - [x] S'assurer que les unit tests sur `SuccessOverlay` passent avec le nouveau mode imposteur.
  - [x] Valider via Playwright le flow complet de l'imposteur.

## Dev Notes

- **Fichiers critiques :**
  - `components/game/quest-view.tsx` : Point d'entrée pour la logique de vue spécifique.
  - `components/game/success-overlay.tsx` : Composant responsable de l'affichage final.
- **Patterns Architecture :**
  - Utiliser les variables de thèmes définies dans `ux-design-specification.md` (Success: Green, Alert: Red).
  - Respecter le principe "No Dead End" : l'utilisateur doit pouvoir sortir de l'overlay manuellement si besoin.
- **Animations :** Utiliser `framer-motion` pour les effets de glitch (décalages aléatoires de l'ombre portée ou de la position du texte).

### Project Structure Notes

- L'état est synchronisé via `Zustand` (`lib/store/game-store.ts`).
- Les styles utilisent `Tailwind 4`.
- Le routage est géré par la App Router de Next.js.

### References

- [Epics: Story 4.2](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L288)
- [PRD: Functional Requirement FR19](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L256)
- [UX Specs: Success Overlay (Glitch-Aware)](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L325)
- [Architecture: Framer Motion for glitch effects](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L73)

## Dev Agent Record

### Agent Model Used

Antigravity (BMad Edition) - BMad Sprint Execution Engine

### Completion Notes List

- Story context and requirements analyzed from PRD, Epics, and UX Specs.
- Technical architecture patterns identified from existing codebase.
- Clear implementation steps defined to transition from placeholder to final glitch effect.

### File List

- `components/game/quest-view.tsx`
- `components/game/success-overlay.tsx`
- `tests/unit/quest-view.test.tsx`
- `tests/unit/success-overlay.test.tsx`
- `tests/e2e/impostor-flow.spec.ts`
