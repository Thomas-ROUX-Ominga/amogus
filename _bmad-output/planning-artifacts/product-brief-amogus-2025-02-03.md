---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - _bmad-output/brainstorming/brainstorming-session-2025-02-03.md
date: '2025-02-03'
author: Omi
---

# Product Brief: amogus

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

Amogus is a personal, organizer-focused web app (mobile-first, deployed on Vercel) to run an Among Us IRL event: crewmates complete timed quests per room on their phones; impostors use fake knives; the app supports the whole flow (quests, QR, optional rooms/lobby). The vision is deliberately minimal for now—support one real-world game night—with possible evolution toward a reusable or commercial product after the first event.

---

## Core Vision

### Problem Statement

As an organizer, there is no straightforward way to run an Among Us-style game in real life with the right structure: quests per room, QR-based discovery, clear roles (impostors vs crewmates), and timing. Doing it with ad-hoc tools (paper, separate apps, manual coordination) is fragile and does not scale to the intended experience.

### Problem Impact

Without a dedicated support, the organizer bears the full burden of explaining rules, placing clues, and keeping the game coherent. Players lack a single, clear interface for quests and progress. The result is more setup friction, less play time, and a higher risk that the IRL game falls short of the intended "Among Us IRL" feel.

### Why Existing Solutions Fall Short

Generic quiz or game apps are not designed for an IRL murder-mystery with room-based quests, QR codes, and role-based flow. The video game Among Us does not translate directly to physical space. Existing options either require heavy customization, lack mobile-first quest flows, or do not match the desired mix (quest pools by duration, scan → quest → home, optional lobby).

### Proposed Solution

A minimal web app (mobile-first, Vercel-hosted) that gives the organizer the means to run one Among Us IRL event: predefined quest pools (short / medium / long), QR codes leading to quest URLs, and a clear flow (scan → do quest → return to game home). Optional features include room creation, invite links, and a simple lobby. The app serves the organizer first; players use it as the single place for quests and game state during the party.

### Key Differentiators

- **Organizer-first, event-scoped:** Built for one organizer and one (or a few) events, not for a generic "product" from day one.
- **Among Us IRL–specific:** Quest taxonomy, duration brackets, and flow (QR → quest → home) are designed for this use case, not a generic quiz platform.
- **Minimal and deployable:** Single deploy on Vercel, no accounts required for players (join by link/code), so the organizer can set it up and share it quickly.
- **Evolution path:** The design (pools, routes, optional rooms) can later support a reusable or commercial version if the organizer decides to iterate after the first event.

---

## Target Users

### Primary Users

**1. Organizer / Admin**
- **Role:** Creates the game, configures the lobby, launches the game. Can also play (crewmate or impostor).
- **Problem:** Without a dedicated app, everything falls on them (rules, quests, coordination).
- **Success:** One app to share (link/code), a clear lobby, one-click launch; players know what to do.
- **Typical usage:** Create the room → share the link → distribute roles IRL (random draw) → launch the game → players join and enter their role.

**2. Crewmate (player)**
- **Role:** Player who drew "crewmate". Joins the game, enters their role in the app, completes quests (scan QR → minigame/answer → return to home).
- **Problem:** Without a common support, no clear quests or progress.
- **Success:** Join via link, enter "Crewmate", get readable quests on phone and a consistent return after each quest.
- **Typical usage:** Open link → join (pseudo) → after launch, enter "Crewmate" → do displayed quests (scan QR, etc.) → return to game home.

**3. Impostor (player)**
- **Role:** Player who drew "impostor". Joins the game, enters their role in the app; IRL gameplay (knife, eliminations). The app shows a role-appropriate experience: impostors can scan quest QR codes to pretend they are crewmates, but they do **not** see the actual quest or its duration — the app immediately shows a "quest success" message only (so they can fake completion without gaining quest info).
- **Problem:** Needs to know they are impostor without breaking immersion; the app must not reveal real quest content or duration to them.
- **Success:** Join, enter "Impostor", and when scanning a quest get only a success confirmation (no quest, no duration), so they can blend in without information leak.
- **Typical usage:** Open link → join → enter "Impostor" → scan quest QRs when needed to look like crewmates (success screen only) → IRL use (knife) per design.

### Secondary Users

- **No distinct secondary segment for the MVP.** Admin is a primary user (organizer) who can also take a player role (crewmate or impostor).

### User Journey

| Phase | Admin / Organizer | Crewmate / Impostor (player) |
|-------|-------------------|------------------------------|
| **Discovery** | Decides to run an Among Us IRL game. | Gets the game link (or code) from the organizer. |
| **Onboarding** | Creates the room in the app, gets the link. | Opens the link, joins with a pseudo. |
| **Pre-game** | Distributes roles IRL (random draw), launches the game. | After launch, enters their role (Crewmate or Impostor). |
| **Core usage** | May view lobby/status; plays if participating. | Crewmate: scan QR → quest → validate → return home. Impostor: can scan quest QRs but gets success screen only (no quest/duration); IRL use (knife). |
| **Success** | The party runs without technical blockers. | Clear quests, no confusion about role or flow. |

---

## Success Metrics

Success is defined by user experience and reliability, not by business or growth targets. The product is for personal use; metrics are optional and minimal.

**User success (what "working" means):**
- **Lobby setup:** As simple as possible — create a game and share a link/code with minimal steps.
- **During the game:** No bugs during quests; flow is reliable (scan → quest → validation → return home).
- **For everyone:** Experience is fluid for all roles (admin, crewmate, impostor): no confusion, no blocking issues.

**Optional, simple metrics (if tracking is added later):**
- **Lobbies created** — number of games created (e.g. per event or over time).
- **App usage / frequency** — e.g. number of sessions or active players per game, to get a sense of adoption.

These are not targets; they are at most indicators that the app is being used. The main success criteria remain: simple setup, no quest bugs, fluid experience for everyone.

### Business Objectives

Not applicable for the current scope. The app is for personal use; there is no revenue or market objective. If the product later evolves toward a commercial or reusable offering, business objectives can be defined then.

### Key Performance Indicators

No formal KPIs for the initial release. Success is judged qualitatively:
- Organizer can set up and launch a lobby quickly.
- Quests run without bugs.
- All players experience a smooth, coherent flow.

If lightweight analytics are added, the only indicators worth noting are: number of lobbies created and usage/frequency (sessions or players per game), for informational purposes only.

---

## MVP Scope

### Core Features

**Version 1 — Minimum viable:**

1. **Lobby creation**
   - Admin creates a game (lobby), gets a shareable link or code.
   - Simple setup, minimal steps.

2. **Players join with pseudo and role**
   - Players open the link, enter a pseudo and their role for the game (Crewmate or Impostor).
   - No account required; join by link/code only.

3. **Quests to scan and play**
   - Quests accessible via QR (e.g. URLs like `/game/[id]/quest?duration=short|medium|long`).
   - Flow: scan → open quest → complete (minigame/answer) → validation → return to game home.
   - **Impostor scan behavior:** When an impostor scans a quest URL, the app does **not** show the quest content or duration; it displays a success message only and returns to game home. This lets impostors fake being crewmates without seeing real quest information.
   - At least 2–3 quest types (e.g. True/False, QCM, one minigame) to validate the loop.

4. **Quest tracker for the admin**
   - Admin view showing quest progress (e.g. who completed what, or overall progress).
   - Allows the organizer to follow the game state during the party.

**Delivered as:** One deployable app (e.g. Vercel), mobile-friendly, usable for one full IRL game night.

### Out of Scope for MVP

- **Buzzer system** — deferred to phase 2.
- **Real-time tracker updates on buzz** — tracker in MVP can be manual or refresh-based; live updates triggered by buzz come later.
- **End-of-game detection** — no automatic "game over" logic in MVP; organizer decides when the game ends.
- **Advanced quest types** — beyond 2–3 types; more minigames and taxonomy come after MVP.
- **Templates / duplicate room** — no "save and reuse" room template in MVP (per brainstorming).

### MVP Success Criteria

- Organizer can create a lobby and share the link with minimal friction.
- Players can join, set pseudo and role, and play quests (scan → play → return home) without blocking bugs.
- Admin has a quest tracker to monitor progress.
- One full IRL game night runs successfully using the app (deployed, e.g. on Vercel).
- Success is judged qualitatively: simple setup, no quest bugs, fluid experience for everyone.

### Future Vision (Phase 2 and beyond)

- **Buzzer system** — in-app or integrated buzzer so players can signal events (e.g. body found, accusation).
- **Tracker updates on buzz** — quest tracker (and possibly game state) updates when buzzes occur, for a more live view of the game.
- **End-of-game detection** — logic or flows to detect or support end of game (e.g. all crewmates eliminated, impostors found, or time-based), with clear "game over" state.
- **Impostor sabotage mechanics** — ways for impostors to hinder crewmates: e.g. make quests impossible for a period, force crewmates to go to a special location and complete a group quest (or everyone loses), and similar sabotage actions.
- Optional later: more quest types, room templates, reuse for future events, or evolution toward a commercial/reusable product.
