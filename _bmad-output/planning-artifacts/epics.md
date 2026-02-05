---
stepsCompleted: ['step-01-validate-prerequisites']
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
---

# amogus - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for amogus, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: L’organisateur peut créer une partie (game) et obtenir un identifiant de partie.
FR2: L'organisateur peut obtenir un lien partageable ou un code pour inviter des joueurs.
FR3: URL stables pour parties (/game/[id]) et quêtes (/game/[id]/quest?duration=...).
FR4: L'organisateur peut lancer la partie (passage en « en cours »).
FR5: Le système conserve l’état d’une partie : identifiant, joueurs, rôles, statut.
FR6: Un joueur peut rejoindre une partie via le lien ou le code, sans compte utilisateur.
FR7: Un joueur peut indiquer un pseudo (nom d’affichage) lors du join.
FR8: Après le lancement, un joueur peut indiquer son rôle (Crewmate ou Impostor).
FR9: Un joueur accède à une page « home » de la partie (game home) après avoir rejoint et choisi son rôle.
FR10: Le système propose trois pools de quêtes par durée : court, moyen, long.
FR11: L'accès à une quête se fait via une URL incluant l'id de partie et la durée.
FR12: Affichage d’une quête aléatoire du pool correspondant pour un Crewmate.
FR13: Support d’au moins 2-3 types de quêtes (Vrai/Faux, QCM, minijeu).
FR14: Un Crewmate voit le contenu complet, la durée et le minijeu.
FR15: Détermination de la réussite et enregistrement de la complétion pour le joueur.
FR16: Redirection automatique vers la home de la partie après un succès.
FR17: Possibilité d’enchaîner les quêtes sans ordre imposé.
FR18: Un Impostor ne voit ni le contenu ni la durée de la quête.
FR19: Un Impostor voit un écran de succès simulé puis est redirigé vers la home.
FR20: L’organisateur peut consulter une vue « tracker » de la progression des quêtes.
FR21: Le tracker peut être rafraîchi manuellement.
FR22: Affichage d’un message explicite en cas d’erreur (quête introuvable, timeout, etc.).
FR23: Un moyen de revenir à la home est toujours proposé (pas de cul-de-sac).

### NonFunctional Requirements

NFR-P1: Chargement fluide des pages home et quête sur Wi-Fi/4G.
NFR-P2: Transition scan -> quête en moins de 300ms (pas de délai perceptible).
NFR-P3: Support de ~10 joueurs actifs simultanés sans dégradation.
NFR-S1: Pas de données sensibles ou d'authentification forte (Zéro-Compte).
NFR-S2: Accès sécurisé par lien/code avec UUIDs non devinables.
NFR-S3: Isolation stricte des données entre les différentes parties.
NFR-A1: Zones de toucher optimisées pour mobile (44x44px minimum).
NFR-A2: Lisibilité du texte adaptée aux conditions de soirée (haut contraste).
NFR-A3: Messages d'erreur clairs avec option de secours vers la home.

### Additional Requirements

- **Starter Template**: Next.js 16 + Tailwind 4 + Zustand + Framer Motion + Serwist (PWA).
- **Data Store**: Vercel KV (Redis) pour l'état du jeu.
- **Security**: Génération client-side d'un UUID pour l'identité utilisateur dans le localStorage.
- **UX Strategy**: Cycle "Strike-Quest" (Scan immédiat → Micro-jeu → Succès → Home).
- **UI Aesthetic**: "Tactical Terminal" (Dark Mode, contrastes néons, esthétique Cyber/Espace).
- **Haptic Feedback**: Vibrations distinctes pour les succès et les échecs sur mobile.
- **Thumb-Driven Design**: Éléments interactifs critiques placés dans le tiers inférieur de l'écran.
- **PWA**: Capacité d'installation sur l'écran d'accueil (Home-screen).
- **Error Handling**: Principe "No Dead End" (toujours un retour possible).

### FR Coverage Map

FR1: Epic 1 - Création de partie
FR2: Epic 1 - Lien de partage/code
FR3: Epic 1 - URLs stables
FR4: Epic 2 - Lancement de la partie
FR5: Epic 1 - État de la partie
FR6: Epic 1 - Join sans compte
FR7: Epic 1 - Saisie pseudo
FR8: Epic 2 - Choix du rôle
FR9: Epic 2 - Accès Game Home
FR10: Epic 3 - Pools de quêtes
FR11: Epic 3 - Accès quêtes via URL
FR12: Epic 3 - Quête aléatoire (Crewmate)
FR13: Epic 3 - Types de quêtes MVP
FR14: Epic 3 - Contenu quête complet
FR15: Epic 3 - Validation succès
FR16: Epic 3 - Redirection auto Home
FR17: Epic 3 - Enchaînement quêtes
FR18: Epic 4 - Masquage contenu (Impostor)
FR19: Epic 4 - Succès simulé (Impostor)
FR20: Epic 5 - Vue Tracker admin
FR21: Epic 5 - Refresh manuel Tracker
FR22: Epic 1 - Gestion erreurs initiale
FR23: Epic 1 - Retour Home (No Dead End)

## Epic List

### Epic 1: Fondation & Assemblage (Lobby & Connexion)
Permettre à un organisateur de créer une "room" et aux joueurs de la rejoindre de manière fluide (Zero-Account).
**FRs covered:** FR1, FR2, FR3, FR5, FR6, FR7, FR22, FR23

### Epic 2: Déploiement des Rôles & Cockpit de Jeu
Lancer la partie et permettre aux joueurs de découvrir leur rôle (Crewmate/Impostor) via une interface immersive.
**FRs covered:** FR4, FR8, FR9

### Epic 3: Le Cycle "Strike-Quest" (Expérience Crewmate)
Implémenter le cœur du gameplay pour les crewmates : scan QR -> mini-jeu -> succès -> retour home.
**FRs covered:** FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17

### Epic 4: Simulation & Camouflage (Expérience Imposteur)
Créer le flux spécifique de l'imposteur pour qu'il puisse simuler des quêtes sans trahir son identité.
**FRs covered:** FR18, FR19

### Epic 5: Commandement & Contrôle (Tracker Admin)
Fournir à l'organisateur une vue d'ensemble de la progression des quêtes en temps réel (ou rafraîchissement manuel).
**FRs covered:** FR20, FR21

## Epic 1: Fondation & Assemblage (Lobby & Connexion)

Permettre à un organisateur de créer une "room" et aux joueurs de la rejoindre de manière fluide (Zero-Account).

### Story 1.1: Fondation du Cockpit & Création de Partie

As an organisateur,
I want initialiser la plateforme et créer ma première partie,
So that je puisse commencer à configurer ma soirée Among Us IRL.

**Acceptance Criteria:**

**Given** un environnement Next.js configuré avec Vercel KV.
**When** je clique sur le bouton "Créer une partie" sur la page d'accueil.
**Then** le système initialise l'architecture des dossiers (`app/`, `components/`, `lib/`, `types/`).
**And** une entrée de jeu est créée dans Vercel KV avec un UUID unique.
**And** je suis redirigé vers l'URL `/game/[id]` en mode lobby.

### Story 1.2: Rejoindre une Partie (Zero-Account Join)

As a joueur,
I want accéder à une partie via un lien direct et saisir mon pseudo,
So that je puisse rejoindre le lobby sans créer de compte.

**Acceptance Criteria:**

**Given** un lien valide `/game/[id]`.
**When** je saisis un pseudo et valide.
**Then** un `userId` est généré et stocké dans mon `localStorage`.
**And** je suis ajouté à la liste des joueurs de la partie dans Vercel KV.

### Story 1.3: Gestion de l'Identité & Erreurs (No Dead End)

As an utilisateur,
I want être informé si une partie est invalide et pouvoir revenir à l'accueil,
So that je ne reste pas bloqué sur un écran vide.

**Acceptance Criteria:**

**Given** un lien de partie expiré ou invalide.
**When** j'accède à la page.
**Then** un message d'erreur clair s'affiche.
**And** un bouton me permet de retourner à la page de création/accueil.

## Epic 2: Déploiement des Rôles & Cockpit de Jeu

Lancer la partie et permettre aux joueurs de découvrir leur rôle (Crewmate/Impostor) via une interface immersive.

### Story 2.1: Lancement de la Partie (Start Game)

As an organisateur,
I want stopper les nouvelles entrées et lancer la partie,
So that les joueurs puissent choisir leur rôle et commencer les quêtes.

**Acceptance Criteria:**

**Given** un lobby avec au moins un joueur.
**When** je clique sur "Lancer la partie".
**Then** l'état de la partie dans Vercel KV passe à `IN_PROGRESS`.
**And** les joueurs présents voient l'écran de sélection de rôle s'afficher.

### Story 2.2: Sélection de Rôle & Immersion Visuelle

As a joueur,
I want sélectionner mon rôle (Crewmate ou Impostor) après le lancement,
So that recevoir mes instructions et accéder au cockpit de jeu.

**Acceptance Criteria:**

**Given** une partie lancée.
**When** je choisis mon rôle ("Crewmate" ou "Impostor").
**Then** mon rôle est enregistré dans Vercel KV.
**And** une transition visuelle avec Framer Motion (effet cockpit/scanning) s'affiche.

### Story 2.3: Home Cocktail (Game Home)

As a joueur,
I want accéder à un écran central (Mon "Cockpit"),
So that voir mon état actuel, le nombre de quêtes restantes et le bouton de scan.

**Acceptance Criteria:**

**Given** un rôle sélectionné.
**When** j'arrive sur la home de la partie.
**Then** je vois mon pseudo, mon rôle et le bouton de scan massif.
**And** (si Crewmate) je vois une barre de progression des quêtes.

## Epic 3: Le Cycle "Strike-Quest" (Expérience Crewmate)

Implémenter le cœur du gameplay pour les crewmates : scan QR -> mini-jeu -> succès -> retour home.

### Story 3.1: Routage Dynamique & Scan QR

As a crewmate,
I want scanner un QR code (URL avec paramètre `duration`),
So that être projeté immédiatement dans une quête aléatoire de la durée correspondante.

**Acceptance Criteria:**

**Given** le "Cockpit" ouvert.
**When** le système détecte une URL type `/game/[id]/quest?duration=short`.
**Then** il tire une quête au hasard dans le pool `short`.
**And** la page de quête se charge instantanément.

### Story 3.2: Conteneur de Quête (Quest Sandbox)

As a crewmate,
I want voir une interface de quête optimisée (tiers inférieur pour le pouce),
So that résoudre ma mission tout en gardant un œil sur mon environnement réel.

**Acceptance Criteria:**

**Given** une quête chargée.
**When** j'affiche l'écran.
**Then** les instructions sont en haut et les boutons d'action en bas.
**And** un bouton "Abandonner/Fuir" est toujours présent en cas d'imposteur proche.

### Story 3.3: Mini-Jeux MVP (QCM / Vrai-Faux)

As a crewmate,
I want résoudre des mini-jeux simples,
So that valider mes quêtes et faire gagner l'équipage.

**Acceptance Criteria:**

**Given** une quête active.
**When** je réponds correctement (QCM ou Vrai/Faux).
**Then** le système enregistre ma réussite dans Vercel KV.
**And** je reçois un retour haptique (vibration) et visuel (flash vert).

### Story 3.4: Conclusion Atomique & Retour Home

As a crewmate,
I want être redirigé automatiquement vers mon cockpit après un succès,
So that libérer mes mains et pouvoir scanner le prochain QR immédiatement.

**Acceptance Criteria:**

**Given** une quête accomplie avec succès.
**When** l'animation de célébration se termine.
**Then** je suis redirigé automatiquement vers `/game/[id]`.
**And** mon compteur "Quêtes restantes" est mis à jour.

## Epic 4: Simulation & Camouflage (Expérience Imposteur)

Créer le flux spécifique de l'imposteur pour qu'il puisse simuler des quêtes sans trahir son identité.

### Story 4.1: Masquage du Contenu (Impostor View)

As an impostor,
I want scanner un QR de quête,
So that paraître actif aux yeux des autres sans accéder aux détails de la mission.

**Acceptance Criteria:**

**Given** l'identifiant du joueur avec le rôle `Impostor`.
**When** j'accède à une URL de quête `/game/[id]/quest?duration=short|medium|long`.
**Then** le système ne tire aucune quête du pool.
**And** aucune instruction ou durée n'est affichée.

### Story 4.2: Écran de Succès Simulé & Effet "Glitch"

As an impostor,
I want voir un écran de succès "simulé",
So that pouvoir montrer mon écran aux autres s'ils suspectent que je ne fais rien.

**Acceptance Criteria:**

**Given** un scan effectué par un imposteur.
**When** la page de quête se charge.
**Then** l'écran affiche immédiatement un statut "MISSION ACCOMPLIE".
**And** le design utilise des effets de "Glitch" visuels (Framer Motion) et des teintes rouges subtiles.
**And** le joueur est redirigé vers la home comme un Crewmate.

## Epic 5: Commandement & Contrôle (Tracker Admin)

Fournir à l'organisateur une vue d'ensemble de la progression des quêtes en temps réel (ou rafraîchissement manuel).

### Story 5.1: Dashboard Admin & Liste des Joueurs

As an organisateur,
I want accéder à une vue dédiée `/admin/tracker/[id]`,
So that voir la liste des joueurs rejoints et leur état de complétion global.

**Acceptance Criteria:**

**Given** une partie active.
**When** j'accède à la route admin.
**Then** je vois la liste de tous les joueurs (pseudos).
**And** une barre de progression indique le pourcentage global de quêtes terminées par l'équipage.

### Story 5.2: Suivi Individuel & Rafraîchissement (Manual Sync)

As an organisateur,
I want pouvoir rafraîchir manuellement la vue du tracker,
So that voir qui a terminé quelle quête le plus récemment.

**Acceptance Criteria:**

**Given** le tracker admin ouvert.
**When** je clique sur "Actualiser".
**Then** le système récupère les dernières données de Vercel KV.
**And** le détail des quêtes (Nombre total vs terminées) est mis à jour pour chaque joueur.
