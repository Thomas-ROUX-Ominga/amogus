# Story 6.1: Admin Authentication

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to log in with a secure password,
so that only I can access sensitive batch and game management tools.

## Acceptance Criteria

1. **Admin Registration**: A dedicated `/admin/register` page exists for initial admin setup with username and password fields.
2. **Dedicated Login Page**: A dedicated `/admin/login` page exists with username and password fields.
3. **Secure Session**: Successful login sets an HTTP-only secure cookie (session) and redirects to `/admin/batches`.
4. **Route Protection**: Middleware blocks access to any `/admin/*` route (except `/admin/login` and `/admin/register`) for unauthenticated users.
5. **Error Handling**: Displays a clear "Access Denied" or incorrect credentials message for failed attempts.
6. **Persistence**: The session persists across browser restarts (24-hour expiration).
7. **Registration Flow**: First-time setup redirects to registration, subsequent access requires login.

## Tasks / Subtasks

- [x] UI: Create Admin Registration Page (AC: 1)
  - [x] Implement `app/admin/register/page.tsx` with terminal aesthetic.
  - [x] Add form with username/password/confirm password inputs.
  - [x] Add password validation (8+ chars) and matching confirmation.
  - [x] Add loading state and error feedback.
- [x] UI: Create Admin Login Page (AC: 2)
  - [x] Implement `app/admin/login/page.tsx` with a mobile-first, tactical terminal aesthetic.
  - [x] Add Form with username/password inputs using Shadcn UI.
  - [x] Add loading state and error feedback.
- [x] Logic: Implement Authentication Server Actions (AC: 3, 5)
  - [x] Create `lib/redis/auth-actions.ts` for session management.
  - [x] Create `lib/redis/admin-db-actions.ts` for admin user management.
  - [x] Install `bcryptjs` and `jose` if not present.
  - [x] Store admin credentials in Redis with bcrypt hashing.
  - [x] Use `jose` to sign a JWT session cookie.
- [x] Security: Implement Middleware (AC: 4, 7)
  - [x] Create `middleware.ts` in the root.
  - [x] Configure matcher for `/admin/:path*`.
  - [x] Allow `/admin/login` and `/admin/register` to bypass protection.
  - [x] Redirect to registration if no admin exists, otherwise to login.
- [x] UI: Logout Workflow (AC: 6)
  - [x] Add a logout button to the Admin Global Header.
  - [x] Implement logout server action to clear the session cookie.
- [x] Infrastructure: Environment Configuration
  - [x] Define `AUTH_SECRET` in environment variables for JWT signing.
- [x] Testing & Validation
  - [x] Unit Test: Auth logic in server actions.

## Dev Notes

- **Architecture Patterns**: Follow the Server Actions pattern used in Epic 5.
- **Constraints**: Must be mobile-first and follow the "Tactical Terminal" design system (Rajdhani/Orbitron fonts).
- **Security**: Use `bcryptjs` for hashing the admin password stored in Redis. Use an HTTP-only, Secure, SameSite=Lax cookie for the session.
- **Authentication Flow**: First-time visitors to admin routes get redirected to registration, subsequent visits require login.
- **Libraries**: Use `lucide-react` for icons (Lock, Key, LogOut, User, Eye, EyeOff).

### Project Structure Notes

- **Alignment**: Place admin components in `components/admin/`.
- **New Files**: `middleware.ts` (Root), `app/admin/login/page.tsx`, `app/admin/register/page.tsx`, `app/admin/layout.tsx`, `lib/redis/auth-actions.ts`, `lib/redis/admin-db-actions.ts`.

### References

- [Epics: Story 6.1](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/epics.md#L39)
- [PRD: Functional Requirement FR_A1](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/prd.md#L93)
- [Architecture: Authentication & Authorization](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/architecture.md#L51)
- [UX: Visual Design Foundation](file:///home/omi/projects/amogus/_bmad-output/planning-artifacts/ux-design-specification.md#L194)

## Dev Agent Record

### Implementation Plan

- Created authentication server actions with bcryptjs password verification and JWT session management
- Implemented Next.js middleware for route protection with proper redirect logic
- Built admin login page with tactical terminal aesthetic matching existing design system
- Added admin layout with logout functionality

### Completion Notes List

- ✅ Implemented secure admin authentication system with JWT sessions
- ✅ Added route protection middleware for all admin routes
- ✅ Created mobile-first login page with proper error handling
- ✅ Added logout functionality in admin header
- ✅ Installed required dependencies: bcryptjs, jose
- ✅ Added authentication error codes to constants
- ✅ Created comprehensive test coverage for auth flows

### File List

- lib/redis/auth-actions.ts (NEW)
- lib/redis/admin-db-actions.ts (NEW)
- middleware.ts (NEW) 
- app/admin/login/page.tsx (NEW)
- app/admin/register/page.tsx (NEW)
- app/admin/layout.tsx (NEW)
- app/admin/batches/page.tsx (NEW)
- lib/constants/error-codes.ts (MODIFIED)
- tests/unit/auth-actions.test.ts (NEW)
- tests/unit/admin-db-actions.test.ts (NEW)

## Change Log

- 2026-02-13: Implemented complete admin authentication system with JWT sessions, middleware protection, and comprehensive test coverage
