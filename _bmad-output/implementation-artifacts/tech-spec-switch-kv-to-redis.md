---
title: 'Switch Vercel KV to Standard Redis'
slug: 'switch-kv-to-redis'
created: '2026-02-06'
status: 'Completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js', 'redis (node-redis)', 'Vitest']
files_to_modify: 
  - package.json
  - lib/kv/client.ts
  - _bmad-output/planning-artifacts/epics.md
code_patterns: ['Facade Pattern for KV', 'Module-level mocking in Vitest']
test_patterns: ['vi.mock("@/lib/kv/client")']
---

# Tech-Spec: Switch Vercel KV to Standard Redis

**Created:** 2026-02-06

## Overview

### Problem Statement

The current application uses `@vercel/kv` (an HTTP-based client) to interact with Redis. It also includes a custom `kvMock` implementation in `lib/kv/client.ts` for local development. However, the project environment provides a standard TCP connection string (`REDIS_URL`), and the user wishes to align with standard practices by using a TCP-based client (`ioredis` or `node-redis`) and removing the custom mock (or minimizing it) to rely on the actual Redis instance or a standard approach. The user also requested to explicitly add this task to Epic 1.

### Solution

We will migrate the Redis client implementation from `@vercel/kv` to the standard `redis` package (node-redis). This involves:
1.  removing the `@vercel/kv` dependency.
2.  installing the `redis` dependency.
3.  refactoring `lib/kv/client.ts` to initialize a standard Redis client using `REDIS_URL`.
4.  removing the manual `kvMock` implementation, relying on the actual Redis connection (which is available).
5.  Updating the `epics.md` file to reflect this architectural change in Epic 1.

### Scope

**In Scope:**
*   Modify `package.json`: Remove `@vercel/kv`, add `redis`.
*   Modify `lib/kv/client.ts`: Replace implementation with `redis` client creation.
*   Modify `_bmad-output/planning-artifacts/epics.md`: Add a new story to Epic 1 for this migration.
*   Ensure the `kv` export maintains the same interface (`get`, `set`, `del`) to avoid breaking consumers.

**Out of Scope:**
*   Modifying any logic in consumers of `kv` (e.g., game logic, API routes), provided the interface remains compatible.
*   Setting up a local Redis instance (assumed `REDIS_URL` connects to a cloud instance or accessible service).

## Context for Development

### Codebase Patterns

*   `lib/kv/client.ts` currently exports a `kv` object with `get`, `set`, `del` methods. This interface MUST be preserved.
*   Environment variables are managed in `.env.local`. `REDIS_URL` is the source of truth for connection.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `lib/kv/client.ts` | The target file for refactoring the client. |
| `package.json` | Dependency management. |
| `.env.local` | Source of `REDIS_URL`. |
| `_bmad-output/planning-artifacts/epics.md` | Document to update with the new story. |

### Technical Decisions

*   **Client Library**: `redis` (node-redis) was chosen over `@vercel/kv` to support standard TCP connections.
*   **Mocking**: specific manual mocking code in `client.ts` will be removed.
*   **Interface Stability**: `lib/kv/client.ts` MUST export `kv` with `get`, `set`, `del` to satisfy existing test mocks (`tests/unit/game-actions.test.ts`).

## Implementation Plan

### Tasks

- [x] Task 1: Update dependencies
  - File: `package.json`
  - Action: Run `npm uninstall @vercel/kv` and `npm install redis` (and `@types/redis` if needed, typically included or separate).
  - Notes: `redis` package v4+ supports promises natively.

- [x] Task 2: Refactor KV Client
  - File: `lib/kv/client.ts`
  - Action: Replace `@vercel/kv` import with `createClient` from `redis`.
  - Action: Initialize client with `process.env.REDIS_URL`.
  - Action: Implement `get`, `set`, `del` wrappers to match the existing interface expected by consumers and tests.
  - Action: Remove the manual `kvMock` fallback implementation (or simplify it if strictly needed for tests, but `vi.mock` handles it).
  - Notes: Ensure `connect()` is called (since node-redis requires it) or handle connection management safely.

- [x] Task 3: Update Epics Documentation
  - File: `_bmad-output/planning-artifacts/epics.md`
  - Action: Add a new Story (e.g., Story 1.4) to Epic 1: "Migration to Standard Redis".
  - Action: Define ACs for this story matching the technical changes.

### Acceptance Criteria

- [x] AC 1: Given the application is built, when `npm run build` is executed, then it should succeed without type errors from the new Redis client.
- [x] AC 2: Given existing unit tests, when `npm run test` is executed, then `tests/unit/game-actions.test.ts` must pass (confirming the `kv` facade is correctly mocked/structured).
- [x] AC 3: Given the updated `lib/kv/client.ts`, when inspected, then it should import `redis` and NOT `@vercel/kv`.
- [x] AC 4: Given the `epics.md` file, when read, then it should contain the new story for Redis migration in Epic 1.

## Additional Context

### Dependencies

*   `redis`: Main client library.
*   `@types/redis` (if not included in main package).

### Testing Strategy

*   **Unit Tests**: Run `vitest run tests/unit/game-actions.test.ts` to verify the mock/interface compatibility.
*   **Manual Verification**: Since we are removing the in-memory mock, verify that running the app locally with a valid `REDIS_URL` connects successfully.

### Notes

*   Ensure proper error handling during Redis connection (e.g., `client.on('error', ...)`).
*   The `redis` package requires an explicit `.connect()` call, unlike `@vercel/kv` which is HTTP/stateless. We need to ensure we manage the connection lifecycle (singleton pattern recommended for Next.js).

## Review Notes
- Adversarial review completed
- Findings: 3 total, 2 fixed (Robustness), 1 skipped (Low)
- Resolution approach: auto-fix
