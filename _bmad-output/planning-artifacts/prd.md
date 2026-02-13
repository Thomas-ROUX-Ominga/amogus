---
stepsCompleted:
  [
    "step-01-init",
    "step-02-discovery",
    "step-01b-continue",
    "step-03-success",
    "step-04-journeys",
    "step-05-domain",
    "step-06-innovation",
    "step-07-project-type",
    "step-08-scoping",
    "step-09-functional",
    "step-10-nonfunctional",
    "step-11-polish",
    "step-12-complete",
  ]
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-amogus-2025-02-03.md
  - _bmad-output/brainstorming/brainstorming-session-2025-02-03.md
briefCount: 1
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
workflowType: "prd"
classification:
  projectType: web_app
---

# Product Requirements Document - amogus

## Phase 1: MVP (Initial Specification)

### Executive Summary

Application web mobile-first pour faire jouer **Among Us en IRL** : l’organisateur crée une partie et partage un lien ; les joueurs (crewmates et impostors) rejoignent sans compte, choisissent leur rôle, et enchaînent quêtes via QR (scan → quête → validation → home). Les impostors ne voient pas le contenu des quêtes (écran succès uniquement).

### User Journeys (v1.0)

1. **Organisateur** : Création de partie, partage de lien, vue tracker.
2. **Crewmate** : Join, pseudo, rôle, scan QR -> quête -> succès -> home.
3. **Impostor** : Succès simulé, pas de contenu de quête.

---

## Phase 2: Tactical Overhaul (v2.0) - Correct Course

### New Vision & Objectives

Cette phase introduit une distinction stricte entre l'**Administrateur** et les **Joueurs**, et découple la structure des quêtes de leur contenu.

### Updated Success Criteria (v2.0)

- **Administrateur** :
  - S'authentifier pour accéder aux outils de gestion.
  - Créer des "Batches" (zones de jeu) de N quêtes avec génération automatique de types/formats.
  - Saisir des localisations pour aider les joueurs à trouver les QR.
  - Télécharger un PDF/PNG des QR codes avec labels.
  - Créer une partie en choisissant un Batch et une répartition (ex: 2/2/2).
  - Suivre les statistiques globales en temps réel (quêtes effectuées/totales).
- **Joueurs** :
  - Rejoindre une partie via un ID simplifié (ex: code à 6 caractères).
  - Recevoir une liste de quêtes assignées (todo/done) avec localisation.
  - Crewmate : Scan QR → Contenu aléatoire (format/type) → Succès → Home.
  - Impostor : Scan QR → Validation automatique (furtive) → Succès → Home. Suivi de progression identique au Crewmate.
  - Possibilité de se déclarer "éliminé" (arrêt d'interaction).

### Updated Product Scope (v2.0)

- **Espace Admin** : Login/MDP, Gestion de Batches, Génération de QR (PDF/PNG).
- **Gestion de Partie** : Création via Batch, ID simplifié, Lancement par l'Admin.
- **Système de Quêtes** :
  - Séparation Structure (Redis) / Contenu (JSON).
  - Mapping dynamique (Format, Type) au scan.
  - Rotation de contenu sur re-scan d'une même quête.
- **Lobby Temps Réel** : Mise à jour automatique de la liste des joueurs et du statut de lancement.
- **Expérience Joueur** :
  - Scan via Caméra mobile native.
  - Liste de quêtes assignées avec labels de localisation.
  - Flux Imposteur furtif (auto-success).
  - Signalement d'élimination.

---

## Technical & Functional Requirements (Global)

### Real-time Communication

- Utilisation de **Websockets** ou Polling optimisé pour le Lobby et le statut de la partie.

### Functional Requirements (New & Revised)

- **FR_A1:** Seul un Admin authentifié peut créer des Batches et des Games.
- **FR_A2:** L'Admin peut définir un Batch (nombre total de quêtes, répartition auto S/M/L).
- **FR_A5:** L'Admin choisit un Batch et une répartition lors de la création d'une Game.
- **FR_G1:** Identifiant de partie simplifié (code court).
- **FR_Q2:** Mapping dynamique (Format, Type) au scan via bibliothèque JSON.
- **FR_U4:** Fonction "Déclarer éliminé" bloquant les interactions.

_(Consulter les Epics pour le détail complet des stories v2.0)_
