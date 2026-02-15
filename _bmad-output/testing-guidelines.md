# Testing Guidelines

## E2E Testing Best Practices

### ❌ NEVER: Direct Database Connections in E2E Tests

**DO NOT** connect directly to databases (Redis, PostgreSQL, MongoDB, etc.) in E2E tests.

**Reasons:**

- **Connection timeouts**: Database connections can hang, causing test timeouts (especially in cleanup hooks like `afterAll`)
- **Environment dependencies**: Tests become dependent on specific database configurations and availability
- **Test isolation**: Direct database manipulation bypasses application logic and can create inconsistent state
- **Maintenance burden**: Database schema changes require updating both application code AND test code

**Common anti-patterns to avoid:**

```typescript
// ❌ BAD: Direct Redis connection in E2E test
import { createClient } from "redis";

test.beforeAll(async () => {
  redisClient = createClient({ url: REDIS_URL });
  await redisClient.connect();
});

test.afterAll(async () => {
  await redisClient.quit(); // This can timeout!
});
```

### ✅ INSTEAD: Use Application APIs and UI

**Preferred approaches for E2E test data setup:**

1. **Use the UI** - Create test data through user interactions

   ```typescript
   // ✅ GOOD: Create data through UI
   test("should display batch list", async ({ page }) => {
     await page.click('button:has-text("Create New Batch")');
     await page.fill('input[name="count"]', "30");
     await page.click('button:has-text("CREATE")');

     await expect(page.locator("text=BATCH-")).toBeVisible();
   });
   ```

2. **Use API endpoints** - Call application APIs to set up test state

   ```typescript
   // ✅ GOOD: Use API endpoints
   test.beforeEach(async ({ request }) => {
     await request.post("/api/admin/batches", {
       data: { questCount: 30 },
     });
   });
   ```

3. **Use test fixtures/factories** - Leverage application-provided test utilities
   ```typescript
   // ✅ GOOD: Use test fixtures
   test.beforeEach(async ({ page }) => {
     await page.goto("/test-setup?scenario=with-batches");
   });
   ```

### Test Data Cleanup

**For E2E tests:**

- Let the application handle cleanup through its normal APIs
- Use dedicated test databases that can be reset between runs
- Implement cleanup endpoints in your application for testing purposes

```typescript
// ✅ GOOD: Cleanup through application API
test.afterEach(async ({ request }) => {
  await request.delete("/api/test/cleanup");
});
```

### When Database Access IS Appropriate

Direct database access is acceptable in:

- **Integration tests** - Testing specific database operations or repositories
- **Unit tests** - Testing database utilities with proper mocking
- **Setup scripts** - One-time test environment initialization (not in test files)

## Summary

> [!IMPORTANT]
> E2E tests should interact with your application the same way users do - through the UI and public APIs. Never bypass the application layer to manipulate databases directly.

> [!WARNING]
> **Existing E2E tests that require database connections should be deleted.** If a test cannot be rewritten to work without direct database access, it should be converted to an integration test or removed entirely. E2E tests must be able to run in isolation without external dependencies like Redis, PostgreSQL, etc.

### Examples of Tests to Remove

- Tests that connect to Redis/databases in `beforeAll`/`beforeEach` hooks
- Tests that seed data directly into databases
- Tests that verify state by querying databases
- Tests that require specific database configurations to run

### Alternative Testing Strategies

For functionality that requires database state:

- **Unit tests**: Test database utilities and repositories in isolation with mocks
- **Integration tests**: Test API endpoints with a test database
- **UI-only E2E tests**: Test UI behavior without backend data (like `admin-auth-ui-simple.spec.ts`)
