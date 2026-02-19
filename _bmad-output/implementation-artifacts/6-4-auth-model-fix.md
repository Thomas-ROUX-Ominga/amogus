# Story 6.4: Auth Model Fix & Home Redesign

Status: done

<!-- Note: Created from Retrospective of Epic 6 to address critical architectural discovery. Enhanced by Create-Story Workflow. -->

## Story

**As a** Game Organizer,
**I want to** create a personal account and access a dedicated "Organizer" portal,
**so that** I can manage my own games and batches independently from other users, while guest players retain a frictionless join experience.

## Acceptance Criteria

1.  **Multi-User Architecture**
    - [x] Data model supports multiple distinct organizers (not a single "admin").
    - [x] Redis key structure uses `user:{userId}` (Hash) for profiles and `username:{username}` (String) for lookup.
    - [x] Registration flow allows creating new unique accounts with secure password hashing (`bcryptjs`).
    - [x] Authentication sets a secure HTTP-only cookie linked to the specific `userId`.

2.  **Home Page Redesign**
    - [x] Root page (`/`) clearly distinguishes between specific user intents:
      - **"Join Game"**: Primary action (Guest flow).
      - **"Organizer Access"**: Secondary action leading to Login/Register.
    - [x] "Create Batch/Game" features are removed from public view and require Organizer Login.

3.  **Role & Permission Refactoring**
    - [x] UI terminology updated: "Admin" context reframed as "Organizer".
    - [x] **Bug Fix**: "Create Batch" functionality is unlocked and functional for any authenticated Organizer.
    - [x] Access Control: `middleware.ts` protects `/admin` (or `/organizer`) routes ensuring only authenticated sessions can access.

4.  **Session Isolation**
    - [x] Logging in as User A grants access only to operations authorized for User A.
    - [x] _Scope Decision_: Batches can remain global/shared for this version (v2.0), but the _ability_ to create them requires valid auth.

## Tasks / Subtasks

- [x] **Data Model & Auth Logic Refactor** (AC 1, AC 4)
  - [x] **Analyze** `lib/redis/auth-actions.ts` and `admin-db-actions.ts`.
  - [x] **Refactor** `registerAdmin` (or create `registerUser`) to:
    - Generate unique `userId` (`nanoid` or `crypto.randomUUID`).
    - Check `username:{username}` existence.
    - Hash password using `bcryptjs`.
    - Store `user:{userId}` hash (username, passwordHash, createdAt).
    - Set `username:{username}` -> `userId`.
  - [x] **Update** `login` logic to resolve `userId` from username and verify hash.
  - [x] **Update** session creation (`auth-utils.ts`) to embed `userId` in the JWT/Session.

- [x] **Home Page & Navigation** (AC 2)
  - [x] **Refactor** `app/page.tsx`:
    - Implement "Split View" design (Reference: UX Spec "Hybrid Tactical Terminal").
    - "Join Game" section remains prominent (Scanner/Code Input).
    - Add "Organizer Login" button (top-right or distinct section).
  - [x] **Create/Update** Auth Pages:
    - `app/(auth)/login/page.tsx`
    - `app/(auth)/register/page.tsx`

- [x] **Organizer Dashboard & Permissions** (AC 3)
  - [x] **Verify** `app/admin/layout.tsx` (or rename to `app/organizer`) checks for valid session.
  - [x] **Fix** "Create Batch" UI: Ensure it calls the now-authorized server actions correctly.
  - [x] **Middleware**: Audit `middleware.ts` to ensure it redirects unauthenticated users to `/login` for any protected route.

- [x] **Testing & Verification**
  - [x] **Unit Tests**: Add `vitest` tests for `registerUser` and `loginUser` in `lib/redis/auth-actions.test.ts`.
  - [x] **Manual**: Register User A, Login User A, Create Batch. Logout. Login User B. Verify flow.

## Dev Notes

### Architecture & Security

- **Auth Library**: Custom `jose` JWT + `bcryptjs`.
- **Redis Schema**:
  - `user:{userId}` : `{ username, password, ... }`
  - `username:{username}` : `userId`
  - `system:initialized` : `true` (Optimized startup check)
- **Security Fixes (Review Findings)**:
  - Removed hardcoded test bypass in `verifySession`.
  - Protected `createGame` action with `verifySession`.

### Codebase Alignment

- **Naming**: `Organizer` in UI, `admin` in routes.
- **Consistency**: Version bumped to `v2.0.0` on Home.

## Dev Agent Record

### File List

- `app/(auth)/login/page.tsx` [NEW]
- `app/(auth)/register/page.tsx` [NEW]
- `app/admin/layout.tsx` [MODIFY]
- `app/page.tsx` [MODIFY]
- `lib/redis/admin-db-actions.ts` [MODIFY]
- `lib/redis/auth-actions.ts` [MODIFY]
- `lib/redis/auth-utils.ts` [MODIFY]
- `lib/redis/actions.ts` [MODIFY]
- `middleware.ts` [MODIFY]
- `tests/unit/auth-actions.test.ts` [MODIFY]
- `tests/unit/admin-db-actions.test.ts` [MODIFY]

### Change Log

- **2026-02-19**: Initial implementation of multi-user auth and home redesign.
- **2026-02-19**: [AI-Review Fixes] Removed security bypasses, added `createGame` protection, optimized `usersExist` lookup, and fixed home page version.

### Completion Notes List

- [x] Refactored Auth Actions
- [x] Updated Data Model (Multi-user)
- [x] Redesigned Home Page (Cockpit v2.0)
- [x] Fixed Batch Creation Permissions
- [x] Applied Security & Performance Fixes from Code Review
