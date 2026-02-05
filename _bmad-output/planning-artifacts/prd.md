---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-01b-continue', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
inputDocuments:
  - _bmad-output/planning-artifacts/product-brief-amogus-2025-02-03.md
  - _bmad-output/brainstorming/brainstorming-session-2025-02-03.md
briefCount: 1
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
workflowType: 'prd'
classification:
  projectType: web_app
  domain: general
  complexity: low
  projectContext: greenfield
---

# Product Requirements Document - amogus

**Author:** Omi
**Date:** 2025-02-03

## Executive Summary

Application web mobile-first pour faire jouer **Among Us en IRL** : l’organisateur crée une partie et partage un lien ; les joueurs (crewmates et impostors) rejoignent sans compte, choisissent leur rôle, et enchaînent quêtes via QR (scan → quête → validation → home). Les impostors ne voient pas le contenu des quêtes (écran succès uniquement). Différenciateur : un seul outil pour une soirée jeu (lobby, quêtes, tracker), déployable sur Vercel, sans compte. Cibles : organisateur, crewmate, impostor.

## Success Criteria

### User Success

- **Organisateur** : pouvoir créer un lobby et partager le lien en très peu d’étapes ; lancer la partie en un clic ; suivre l’avancement des quêtes via le tracker.
- **Crewmate** : rejoindre par lien, indiquer son rôle, enchaîner scan QR → quête → validation → retour home sans blocage ni confusion.
- **Impostor** : voir uniquement un écran de succès à la place des quêtes (pas de contenu ni durée) pour pouvoir « faire semblant » sans fuite d’info.
- **Critère global** : une soirée Among Us IRL complète se déroule sans bug bloquant et avec une expérience fluide pour tous.

### Business Success

- **Non applicable** pour cette version : usage personnel, pas d’objectif revenu ou marché. Si le produit évolue vers du réutilisable ou commercial, des objectifs business pourront être définis plus tard.

### Technical Success

- Application déployée sur Vercel, accessible via URL partageable.
- Usage mobile-first fiable (scan, quêtes, navigation) pendant une partie.
- Une partie complète (création lobby → join → quêtes → tracker) peut se jouer sans panne technique.

### Measurable Outcomes

- **MVP** : au moins **une** soirée IRL jouée de bout en bout avec l’app (lobby créé, joueurs joints, quêtes jouées, tracker utilisé) sans blocage.
- Succès jugé de façon qualitative : setup simple, pas de bugs sur les quêtes, flux clair pour tous les rôles.

## Product Scope

### MVP - Minimum Viable Product

- **Lobby** : création de partie, lien ou code partageable.
- **Joueurs** : rejoindre par lien, pseudo + rôle (Crewmate / Impostor), sans compte.
- **Quêtes** : URLs type `/game/[id]/quest?duration=short|medium|long`, scan → quête → validation → retour home ; comportement impostor (succès uniquement, pas de contenu quête).
- **Tracker admin** : vue de la progression des quêtes (qui a fait quoi / état global).
- **Livrable** : une app déployable (ex. Vercel), mobile-first, utilisable pour une soirée IRL.

### Growth Features (Post-MVP)

- Buzzer in-app (signaler corps trouvé, accusations, etc.).
- Tracker mis à jour en temps réel sur événements (ex. buzz).
- Détection / support de fin de partie (game over).
- Mécaniques de sabotage impostor (quêtes indisponibles, quête groupe obligatoire, etc.).

### Vision (Future)

- Plus de types de quêtes et de minijeux.
- Templates / duplication de room pour réutiliser des configs.
- Réutilisation pour d’autres événements ou évolution vers une offre réutilisable / commerciale.

## User Journeys

### 1. Organisateur (Admin) – Parcours principal

**Ouverture :** L’organisateur veut lancer une soirée Among Us IRL. Sans outil dédié, il devrait tout expliquer à la main, gérer les quêtes sur papier ou des apps éparses.

**Montée :** Il ouvre l’app, crée une partie (lobby), obtient un lien (ou un code) partageable. Il envoie le lien au groupe (SMS, Discord…). En IRL, les rôles sont tirés au sort (carte crewmate/impostor). Quand tout le monde est prêt, il lance la partie dans l’app.

**Climax :** Les joueurs rejoignent et entrent leur rôle. L’organisateur voit le lobby se remplir, puis le tracker de quêtes pendant la soirée (qui a fait quoi, avancement). Il n’a pas à tout piloter manuellement.

**Résolution :** La partie se déroule avec un seul point d’entrée (l’app), setup minimal, et une visibilité claire sur la progression. L’organisateur peut éventuellement jouer lui-même (crewmate ou impostor) sans quitter son rôle d’admin.

*Capacités révélées :* création de game, lien/code d’invitation, lobby (liste des joueurs), bouton « Lancer la partie », vue tracker (progression des quêtes).

---

### 2. Crewmate – Parcours principal

**Ouverture :** Le joueur a reçu le lien et a tiré « crewmate ». Il doit accomplir des quêtes en scannant des QR dans les pièces pour faire avancer la partie.

**Montée :** Il ouvre le lien, entre un pseudo, voit l’écran d’attente puis, une fois la partie lancée, choisit « Crewmate ». Il arrive sur la home de la partie (game home). Il se déplace IRL, scanne un QR (court / moyen / long). L’app ouvre une quête (ex. Vrai/Faux, QCM, minijeu).

**Climax :** Il répond ou termine le minijeu, valide. L’app affiche un succès et le renvoie immédiatement sur la home de la partie. Il peut enchaîner une autre quête (scan → quête → validation → home) sans rester bloqué sur l’écran de quête.

**Résolution :** Boucle claire et répétable : home → scan → quête → validation → home. Il sait toujours où il en est et ce qu’il doit faire ensuite.

*Capacités révélées :* join par lien, saisie pseudo + rôle, page `/game/[id]` (home), route quête avec `duration`, affichage quête selon type, validation, redirection systématique vers home après succès.

---

### 3. Impostor – Parcours principal

**Ouverture :** Le joueur a tiré « impostor ». Il doit se faire passer pour un crewmate tout en jouant IRL (couteau, éliminations). S’il scannait une vraie quête, il aurait une fuite d’info (durée, contenu).

**Montée :** Il rejoint comme les autres (lien, pseudo), puis choisit « Impostor » au lancement. Il a accès à la même home de partie. Quand il scanne un QR de quête (pour « faire semblant » devant les autres), l’app ne lui montre pas la quête.

**Climax :** Au lieu du contenu et de la durée, l’app affiche uniquement un écran de type « Quête réussie » (ou succès) et le renvoie sur la home. Il peut prétendre avoir fait la quête sans jamais voir son contenu ni sa durée.

**Résolution :** Il peut utiliser les QR comme les crewmates pour le paraître, tout en gardant son avantage. Le jeu IRL (couteau, éliminations) reste hors app.

*Capacités révélées :* même flux de join et home que crewmate, mais branche « rôle = Impostor » : sur les URLs de quête, pas d’affichage du contenu, uniquement écran de succès + redirect home.

---

### 4. Crewmate – Cas limite (erreur / récupération)

**Contexte :** Réseau instable, ou le joueur scanne un QR déjà validé / mal configuré, ou quitte une quête en cours.

**Montée :** Le crewmate scanne un QR mais la page met du temps à charger, ou une erreur s’affiche (quête introuvable, partie expirée, etc.).

**Climax :** L’app affiche un message explicite (ex. « Quête indisponible » ou « Vérifie ta connexion ») et propose un retour vers la home de la partie, sans le laisser bloqué.

**Résolution :** Le joueur revient sur la home et peut réessayer un autre QR ou attendre. Aucun état « coincé » sur un écran d’erreur.

*Capacités révélées :* gestion d’erreurs (quête introuvable, partie invalide, timeout), messages clairs, bouton/liens « Retour à la partie » pour toujours ramener vers `/game/[id]`.

---

### Journey Requirements Summary

| Parcours            | Capacités principales                                                                 |
|---------------------|----------------------------------------------------------------------------------------|
| Organisateur        | Création game, lien/code, lobby, lancement partie, tracker de progression des quêtes  |
| Crewmate            | Join, pseudo, rôle, home partie, routes quêtes par durée, types de quêtes, validation, redirect home |
| Impostor            | Même join/home ; pour quêtes : écran succès uniquement, pas de contenu, redirect home |
| Crewmate (edge case)| Erreurs et timeouts, messages utilisateur, retour garanti vers home                   |

## Web App Specific Requirements

### Project-Type Overview

Application web mobile-first (SPA), déployée sur Vercel, utilisée en contexte de soirée IRL : création de partie, lien partageable, quêtes via QR, rôles crewmate/impostor. Pas de compte utilisateur ; entrée par lien ou code. Priorité : stabilité du flux quêtes et lisibilité sur mobile (y compris en extérieur).

### Technical Architecture Considerations

- **SPA** : expérience type app (Next.js ou équivalent), navigation fluide entre home de partie et pages quêtes, redirection systématique vers la home après validation d’une quête.
- **Hébergement** : Vercel (ou équivalent) pour déploiement et URL partageable. Build statique/SSR selon besoin (performance et SEO minimal).
- **État** : une partie = un game (id, joueurs, rôles, état lancé/en attente). Données de quêtes (pools short/medium/long) et progression ; pour le MVP, pas d’obligation de temps réel (rafraîchissement manuel du tracker acceptable).

### Browser Matrix

- **Cible principale** : navigateurs mobiles récents (Chrome, Safari) sur iOS et Android, utilisés pour scanner des QR et jouer les quêtes.
- **Secondaire** : desktop pour l’organisateur (création de partie, tracker admin) ; mêmes navigateurs modernes.
- **Hors scope MVP** : anciens navigateurs ou fonctionnalités avancées (ex. WebAssembly) non requises.

### Responsive Design

- **Mobile-first** : écrans quêtes, home de partie et join/lobby optimisés pour petit écran et usage en déplacement.
- **Lisibilité** : contraste et taille de texte suffisants pour usage en intérieur/extérieur (soirée).
- **Desktop** : optionnel pour admin (création de game, vue tracker) ; mise en page adaptée sans être prioritaire.

### Performance Targets

- **Chargement** : premier affichage et navigation entre home ↔ quête raisonnablement rapides (objectif qualitatif : pas de blocage perçu pendant une partie).
- **Réseau** : usage typique en Wi‑Fi / 4G ; pas de forte dépendance au temps réel pour le MVP.
- **Quêtes** : enchaînement scan → quête → validation → home sans latence excessive ; pas de cible chiffrée stricte pour le MVP.

### SEO Strategy

- **Priorité faible** : l’app est jointe par lien partageable (invitation), pas par recherche.
- **Requis** : URL stables pour les parties et les quêtes (ex. `/game/[id]`, `/game/[id]/quest?duration=…`) pour partage et QR.
- **Hors scope** : référencement organique, meta avancés, sitemap.

### Accessibility Level

- **Niveau de base** : zones de toucher suffisantes, contraste lisible, libellés clairs pour les actions principales (rejoindre, choisir rôle, valider quête, retour home).
- **Contexte** : usage en soirée (éclairage variable, possible usage en extérieur) ; éviter les interactions trop fines ou les messages uniquement visuels.
- **Hors scope MVP** : conformité WCAG complète ; à renforcer si le produit évolue.

### Implementation Considerations

- **Routes** : `/game/[id]` (home de partie), `/game/[id]/quest?duration=short|medium|long` (quête tirée du pool), avec prise en compte du rôle (impostor → écran succès uniquement).
- **Pas de compte** : identification par pseudo + rôle au join ; pas de persistance de compte entre parties.
- **Skip sections** (non applicables) : native_features, cli_commands.

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach :** Expérience – valider qu’une soirée Among Us IRL peut se jouer de bout en bout avec l’app (création partie, join, quêtes, tracker). Pas d’objectif revenu ni plateforme ; objectif = « ça marche pour une partie ».

**Ressources :** Petit effectif (solo ou très petite équipe). Pas de compte, pas de persistance lourde ; priorité au flux quêtes et au rôle impostor.

### MVP Feature Set (Phase 1)

Parcours et capacités détaillés : voir **Product Scope** et **User Journeys** ci-dessus. Résumé : lobby + join + rôles, quêtes par durée (2–3 types), comportement impostor (succès seul), tracker admin (refresh manuel), gestion d’erreurs avec retour home.

### Post-MVP Features

**Phase 2 (croissance) :**
- Buzzer in-app (corps trouvé, accusations).
- Tracker mis à jour en temps réel (ou sur événements type buzz).
- Détection / support de fin de partie (game over).
- Mécaniques de sabotage impostor (quêtes indisponibles, quête groupe, etc.).

**Phase 3 (expansion) :**
- Plus de types de quêtes et minijeux.
- Templates / duplication de room pour réutiliser des configs.
- Réutilisation pour d’autres événements ou évolution commerciale / réutilisable.

### Risk Mitigation Strategy

**Technique :** Partir sur un flux quêtes simple (2–3 types), pas de temps réel en Phase 1 ; tracker en refresh manuel. Déploiement Vercel pour réduire la complexité d’infra.

**Marché :** N/A (usage perso). Risque = « personne n’utilise » → valider avec une vraie soirée test.

**Ressources :** MVP conçu pour être livrable en petit effectif ; en cas de contrainte, priorité absolue : lobby + join + 1 type de quête + redirect home + comportement impostor, puis ajout des autres types et du tracker.

## Functional Requirements

### Game & Lobby Management

- **FR1:** L’organisateur peut créer une partie (game) et obtenir un identifiant de partie.
- **FR2:** L’organisateur peut obtenir un lien partageable ou un code pour inviter des joueurs à rejoindre la partie.
- **FR3:** Le système expose des URL stables pour une partie (ex. `/game/[id]`) et pour les quêtes (ex. paramètre `duration`).
- **FR4:** L’organisateur peut lancer la partie (passage en « en cours ») pour que les joueurs puissent saisir leur rôle et accéder aux quêtes.
- **FR5:** Le système conserve l’état d’une partie : identifiant, joueurs rejoints, rôles, statut (en attente / en cours).

### Player Join & Role

- **FR6:** Un joueur peut rejoindre une partie via le lien ou le code, sans compte utilisateur.
- **FR7:** Un joueur peut indiquer un pseudo (nom d’affichage) lors du join.
- **FR8:** Après le lancement de la partie, un joueur peut indiquer son rôle pour cette partie (Crewmate ou Impostor).
- **FR9:** Un joueur qui a rejoint et (si lancé) choisi son rôle accède à une page « home » de la partie (game home) depuis laquelle il peut accéder aux quêtes.

### Quests – Affichage & Pools

- **FR10:** Le système propose trois pools de quêtes par durée : court, moyen, long (ex. short / medium / long).
- **FR11:** L’accès à une quête se fait via une URL incluant l’id de partie et la durée (ex. `/game/[id]/quest?duration=short|medium|long`).
- **FR12:** Lorsqu’un joueur (crewmate) ouvre une telle URL, le système affiche une quête tirée aléatoirement dans le pool correspondant à la durée.
- **FR13:** Le système prend en charge au moins 2–3 types de quêtes en MVP (ex. Vrai/Faux, QCM, un minijeu) avec contenu et règles distincts.

### Quests – Complétion & Flux

- **FR14:** Un crewmate peut consulter le contenu complet de la quête (énoncé, durée, minijeu) et y répondre ou la terminer.
- **FR15:** Le système détermine si la réponse ou le minijeu est réussi et enregistre la complétion pour le joueur.
- **FR16:** Après une complétion réussie, le système redirige le joueur vers la home de la partie (game home), sans le laisser sur l’écran de quête.
- **FR17:** Un crewmate peut enchaîner plusieurs quêtes (accès via URL/QR → quête → validation → retour home) sans dépendre d’un ordre imposé.

### Impostor Experience

- **FR18:** Lorsqu’un joueur avec le rôle Impostor ouvre une URL de quête, le système n’affiche pas le contenu de la quête ni sa durée.
- **FR19:** Pour un impostor, le système affiche uniquement un écran de type « quête réussie » (ou succès) puis redirige vers la home de la partie, afin qu’il puisse simuler une complétion sans fuite d’information.

### Admin & Tracker

- **FR20:** L’organisateur peut consulter une vue « tracker » de la progression des quêtes pour la partie (qui a complété quoi, ou état global).
- **FR21:** Le tracker peut être rafraîchi manuellement pour le MVP (pas d’obligation de mise à jour en temps réel).

### Error Handling & Recovery

- **FR22:** En cas d’erreur (quête introuvable, partie invalide, timeout, etc.), le système affiche un message explicite à l’utilisateur.
- **FR23:** Le système propose toujours un moyen de revenir à la home de la partie (lien ou bouton) pour ne jamais laisser l’utilisateur bloqué sur un écran d’erreur.

## Non-Functional Requirements

### Performance

- **NFR-P1:** Le chargement de la home de partie et de la page quête reste perçu comme fluide sur connexion type Wi‑Fi / 4G (pas de cible chiffrée stricte en MVP ; pas de blocage évident pendant une partie).
- **NFR-P2:** Après validation d’une quête, la redirection vers la home de partie s’effectue sans délai perceptible qui bloquerait l’enchaînement scan → quête → home.
- **NFR-P3:** L’app reste utilisable pour un groupe typique d’une soirée (ordre de grandeur : une dizaine de joueurs actifs simultanés) sans dégradation notable.

### Security

- **NFR-S1:** Aucune donnée de paiement ou d’authentification forte ; pseudo et rôle par partie uniquement.
- **NFR-S2:** L’accès à une partie se fait par connaissance du lien ou du code ; pas d’énumération simple des parties actives (pas de liste publique d’IDs de games).
- **NFR-S3:** Les données de partie (joueurs, rôles, complétions) sont associées à l’id de game ; pas de fuite entre parties (une partie ne voit pas les données d’une autre).

### Accessibility

- **NFR-A1:** Zones de toucher suffisantes sur mobile pour les actions principales (rejoindre, choisir rôle, valider quête, retour home).
- **NFR-A2:** Contraste et taille de texte permettant une lecture en conditions de soirée (intérieur/extérieur, éclairage variable).
- **NFR-A3:** En cas d’erreur, le message est lisible et un moyen de retour (lien/bouton vers la home) est toujours proposé.
