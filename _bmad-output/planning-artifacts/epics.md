---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-detail-v2-ac"]
inputDocuments:
  - prd.md
  - architecture.md
  - ux-design-specification.md
---

# amogus - Epic Breakdown

## Phase 1: MVP (Stories 1-5)

### Epic 1: Fondation & Lobby

Stories 1.1 à 1.4 : Projet init, Creation de partie, Join sans compte, Migration Redis TCP.

### Epic 2: Cockpit & Rôles

Stories 2.1 à 2.3 : Start Game, Selection Rôle, Dashboard initial.

### Epic 3: Cycle Strike-Quest

Stories 3.1 à 3.4 : Routage quêtes, SandBox, Mini-jeux, Retour Home.

### Epic 4: Expérience Imposteur

Stories 4.1 à 4.2 : Masquage contenu, Succès simulé.

### Epic 5: Tracker Admin v1

Stories 5.1 à 5.2 : Dashboard simple et stats de base.

---

## Phase 2: Tactical Overhaul (v2.0)

### Epic 6: Admin Infrastructure & Batches

#### Story 6.1: Admin Authentication

**As an** admin, **I want to** log in with a secure password **so that** only I can access sensitive batch and game management tools.

- **AC 1**: A dedicated `/admin/login` page exists with username/password fields.
- **AC 2**: Successful login sets an HTTP-only secure cookie and redirects to `/admin/batches`.
- **AC 3**: Middleware blocks access to any `/admin/*` route (except login) for unauthenticated users.

#### Story 6.2: Batch Generation & Logic

**As an** admin, **I want to** create a "Batch" by defining a total quest count **so that** the system automatically generates a balanced distribution of quest types and formats.

- **AC 1**: Input field for "Total Number of Quests" (e.g., 30).
- **AC 2**: System automatically creates a list of Quests with a 1/3 split for formats (Short, Medium, Long).
- **AC 3**: Each Quest is assigned a random Type (QCM, Vrai/Faux, etc.) compatible with the extension registry.
- **AC 4**: Batches are stored in Redis with a unique persistent ID.

#### Story 6.3: QR & Localization

**As an** admin, **I want to** name the physical location of each quest and download a PDF for printing **so that** I can setup the game area IRL.

- **AC 1**: Interface to list all quests in a Batch with an editable "Location" text field (e.g., "Machine à café").
- **AC 2**: "Generate PDF" button produces a document where each page contains: 1 QR Code pointing to `/quest/{questId}`, the Location label, and the Quest Format (S/M/L).
- **AC 3**: QR Codes carry the persistent Quest ID from the Batch, independent of any specific Game session.

### Epic 7: Advanced Game Management

#### Story 7.1: Setup from Batch (Short-Codes)

**As an** admin, **I want to** create a game session by selecting a Batch and receiving a short join code **so that** players can join quickly from their mobile devices.

- **AC 1**: Creation UI allows selecting a previously created Batch.
- **AC 2**: Admin defines "Quests per Player" (Default: 2S, 2M, 2L).
- **AC 3**: Game produces a 6-character alphanumeric code (e.g., AH72X9) to replace long UUIDs in the join flow.

#### Story 7.2: Real-time Lobby Sync

**As a** player, **I want to** see the crew list grow as people join and see when the game starts without refreshing **so that** the onboarding feels responsive.

- **AC 1**: Lobby page updates automatically when a new player joins (using SWR polling or SSE).
- **AC 2**: When Admin clicks "Start Game", all joined players are instantly redirected to their Role Selection or Dashboard.

### Epic 8: Dynamic Quest Engine (v2)

#### Story 8.1: In-App Camera Scanner

**As a** player, **I want to** trigger my camera directly from the game dashboard **so that** I can scan QR codes without leaving the web app.

- **AC 1**: Persistent "SCAN" button on the Game Dashboard.
- **AC 2**: Clicking it opens a camera overlay using `MediaDevices API`.
- **AC 3**: Successful QR detection automatically triggers navigation to the quest route.

#### Story 8.2: Dynamic Content Mapper

**As a** crewmate, **I want to** see a fresh question or mini-game every time I scan a QR code **so that** the game remains unpredictable.

- **AC 1**: Upon scanning `questId`, the system fetches Quest Meta (Format/Type) from Redis.
- **AC 2**: It then selects a random entry from `quests-content.json` matching that (Format, Type).
- **AC 3**: **Idempotency/Rotation**: If a player re-scans a quest they _previously failed_, a _different_ content entry from the same (Format, Type) pool is selected.

#### Story 8.3: Atomic Success Flow (Flicker Fix)

**As a** player, **I want to** be redirected to my dashboard immediately after validation **so that** I don't see glitchy intermediate screens.

- **AC 1**: Success Overlay appears for exactly 2 seconds.
- **AC 2**: Redirect to `/game/[id]` happens in the background during the animation.
- **AC 3**: Removal of any logic that displays a second quest choice or redirects to Home/Login after a win.

### Epic 9: Refined Impostor Stealth

#### Story 9.1: Seamless Impostor Scan

**As an** impostor, **I want to** experience a "silent" success screen when I scan a QR **so that** I can pretend to work without being spotted.

- **AC 1**: Scan results immediately show the Success screen (matching Crewmate timing).
- **AC 2**: Content of the quest (Question/Minigame) is NEVER loaded or visible for the Impostor role.

#### Story 9.2: Credible Tracker

**As an** impostor, **I want to** see a list of location labels and a progress bar **so that** my screen looks exactly like a Crewmate's if someone glances at it.

- **AC 1**: Impostor Dashboard shows the same list of assigned quest locations as a Crewmate.
- **AC 2**: Progress bar updates as the Impostor "completes" scans.

### Epic 10: Live Ops & Player State

#### Story 10.1: Interactive Admin Dashboard

**As an** admin, **I want to** see live global stats of the game **so that** I can narrate the progress to the crew.

- **AC 1**: Live view shows: Total Quests Completed / Total Quests Assigned.
- **AC 2**: Progress breakdown by Format (Short/Med/Long).
- **AC 3**: List of active players with their individual progress (e.g., "Omi: 4/6").

#### Story 10.2: Self-Elimination Flow

**As a** player, **I want to** signal that I have been "killed" or eliminated **so that** I stop receiving game updates.

- **AC 1**: "SIGNAL ELIMINATION" button in the dashboard footer.
- **AC 2**: Once activated, player status in Redis becomes `ELIMINATED`.
- **AC 3**: Any further scan attempts return an "ACCESS DENIED - SYSTEM OFFLINE" message.
