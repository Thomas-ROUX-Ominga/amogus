---
title: 'Session Persistence & Role Management Fix'
slug: 'session-persistence-role-management'
created: '2026-02-27T22:38:00+01:00'
status: 'in-progress'
stepsCompleted: [1]
tech_stack: []
files_to_modify: []
code_patterns: []
test_patterns: []
---

# Tech-Spec: Session Persistence & Role Management Fix

**Created:** 2026-02-27T22:38:00+01:00

## Overview

### Problem Statement

L'application n'a pas de gestion de session cohérente. Les utilisateurs authentifiés (login/password) perdent leur statut d'admin après rafraîchissement, ce qui les force à rejoindre les parties comme joueurs anonymes. De plus, les joueurs anonymes n'ont aucune session persistente et ne peuvent pas se reconnecter à une partie s'ils ferment la page par erreur.

### Solution

Implémenter une architecture de session unifiée avec :
- Session persistente pour utilisateurs authentifiés (JWT cookies existants)
- Session temporaire pour joueurs anonymes (session browser localStorage)
- Vérification d'authentification côté client dans les composants admin
- Gestion des rôles par partie : créateur = admin, autres = joueurs
- Sécurité API : seuls les authentifiés peuvent créer des parties

### Scope

**In Scope:**
- Session persistente pour utilisateurs authentifiés (login/password)
- Session temporaire pour joueurs anonymes (pseudo uniquement)
- Vérification d'authentification côté client dans les composants admin
- Gestion des rôles : créateur de partie = admin, autres = joueurs
- Sécurité API : seuls les utilisateurs authentifiés peuvent créer des parties

**Out of Scope:**
- Modification du système de création de comptes existant
- Changement de la logique métier des rôles dans les parties
- Refactor complet du système d'authentification existant

## Context for Development

### Codebase Patterns

- JWT tokens avec `createSession`/`verifySession` dans `lib/redis/auth-utils.ts`
- Cookies `organizer-session` de 24h pour authentification persistente
- Middleware Next.js pour protection des routes admin
- Composants client React sans gestion d'état d'authentification
- Actions serveur dans `lib/redis/actions.ts` avec vérification `verifySession`

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `lib/redis/auth-utils.ts` | Session JWT existante et gestion cookies |
| `lib/redis/auth-actions.ts` | Actions d'authentification serveur |
| `middleware.ts` | Protection des routes admin |
| `components/admin/batch-detail.tsx` | Création de partie depuis batch |
| `lib/redis/actions.ts` | Logique de création de jeu |
| `app/admin/layout.tsx` | Layout admin global |

### Technical Decisions

- Conserver l'architecture JWT existante pour les admins
- Ajouter session localStorage pour joueurs anonymes
- Créer hook `useAuth` client pour vérification unifiée
- Utiliser SWR ou React Context pour état d'authentification client
- Maintenir sécurité : vérification serveur obligatoire pour actions critiques

## Implementation Plan

### Tasks

(Tâches à définir dans Step 2)

### Acceptance Criteria

(Critères à définir dans Step 2)

## Additional Context

### Dependencies

- Système d'authentification existant (JWT + cookies)
- Architecture Next.js App Router
- Redis pour stockage d'état de jeu

### Testing Strategy

(Stratégie à définir dans Step 2)

### Notes

- Ce problème affecte directement Story 11.2 d'Epic 11
- La solution doit maintenir la compatibilité avec les joueurs existants
- Priorité : stabilité et sécurité de l'authentification admin
