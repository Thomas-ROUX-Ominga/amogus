# Testing Guidelines

## Summary

> [!IMPORTANT]
> Use Vitest for unit and integration testing. Ensure comprehensive coverage of server actions and core game logic.

### Alternative Testing Strategies

For functionality that requires database state:

- **Unit tests**: Test database utilities and repositories in isolation with mocks
- **Integration tests**: Test API endpoints with a test database
