import { renderHook, waitFor, act } from "@testing-library/react";
import { ReactNode } from "react";
import { useAuth, AuthProvider } from "@/hooks/use-auth";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// Mock timers for periodic refresh
vi.useFakeTimers();

beforeAll(() => {
  // Setup global mocks
  globalThis.fetch = mockFetch;
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: vi.fn(() => 'test-uuid-123'),
    },
  });
});

afterAll(() => {
  vi.useRealTimers();
});

// Test wrapper component
function createWrapper({ children }: { children: ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

describe("Authentication Persistence Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Admin Session Persistence", () => {
    it("should maintain admin session across component re-renders", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            userId: "admin-123",
            username: "test-admin",
            role: "organizer",
          },
        }),
      } as Response);

      // Initial render
      const { result, rerender } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for authentication to complete
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Re-render component
      rerender();

      // Session should persist
      expect(result.current.authState.isAuthenticated).toBe(true);
      expect(result.current.authState.session?.sessionType).toBe("admin");
      expect(result.current.authState.session?.username).toBe("test-admin");
    });

    it("should refresh admin session periodically", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            userId: "admin-123",
            username: "test-admin",
            role: "organizer",
          },
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for initial authentication
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Clear previous calls
      mockFetch.mockClear();

      // Fast-forward 30 seconds to trigger periodic refresh
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });

      // Verify the refresh call was made to the correct endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/auth/verify",
        expect.objectContaining({
          method: "GET",
          credentials: "include",
        })
      );
    });

    it("should handle admin session expiration gracefully", async () => {
      // First call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            userId: "admin-123",
            username: "test-admin",
            role: "organizer",
          },
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for initial authentication
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Clear the mock to set up the failure response
      mockFetch.mockReset();
      
      // Second call fails (session expired)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: "Session expired",
        }),
      } as Response);

      // Trigger periodic refresh
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.authState.isAuthenticated).toBe(false);
      expect(result.current.authState.session?.sessionType).toBe("anonymous");
    });
  });

  describe("Anonymous Session Persistence", () => {
    it("should persist anonymous session in localStorage", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for authentication to complete (no admin session)
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Set anonymous session wrapped in act
      await act(async () => {
        result.current.setAnonymousSession("test-user", "game-123");
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "anonymous-session",
        expect.stringContaining("test-user")
      );

      expect(result.current.authState.session).toEqual({
        userId: "test-uuid-123",
        username: "test-user",
        gameId: "game-123",
        isAuthenticated: false,
        sessionType: "anonymous",
      });
    });

    it("should recover anonymous session from localStorage", async () => {
      const storedSession = {
        userId: "anon-456",
        username: "recovered-user",
        gameId: "game-789",
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSession));

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for authentication to complete
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.authState.session).toEqual({
        ...storedSession,
        isAuthenticated: false,
        sessionType: "anonymous",
      });

      expect(result.current.authState.isAuthenticated).toBe(false);
      expect(result.current.authState.session?.sessionType).toBe("anonymous");
    });

    it("should handle corrupted localStorage gracefully", async () => {
      localStorageMock.getItem.mockReturnValue("invalid-json");

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for authentication to complete
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Should handle gracefully - will create anonymous session as fallback
      expect(result.current.authState.session?.sessionType).toBe("anonymous");
      expect(result.current.authState.isAuthenticated).toBe(false);
    });
  });

  describe("Session Priority and Transitions", () => {
    it("should prioritize admin session over anonymous session", async () => {
      // Start with anonymous session
      const storedSession = {
        userId: "anon-123",
        username: "anonymous-user",
        gameId: "game-456",
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSession));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            userId: "admin-789",
            username: "admin-user",
            role: "organizer",
          },
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for authentication to complete
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Admin session should take priority
      expect(result.current.authState.session?.sessionType).toBe("admin");
      expect(result.current.authState.session?.username).toBe("admin-user");
    });

    it("should handle transition from admin to anonymous", async () => {
      // Admin session initially
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            userId: "admin-123",
            username: "admin-user",
            role: "organizer",
          },
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for initial authentication
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Clear the mock to set up the failure response
      mockFetch.mockReset();
      
      // Admin session expires
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          success: false,
          error: "Session expired",
        }),
      } as Response);

      // Set up anonymous session for fallback
      const anonymousSession = {
        userId: "anon-456",
        username: "fallback-user",
        gameId: "game-789",
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(anonymousSession));

      // Trigger refresh
      await act(async () => {
        vi.advanceTimersByTime(30000);
        await vi.runOnlyPendingTimersAsync();
      });

      // Should fall back to anonymous session
      expect(result.current.authState.session?.sessionType).toBe("anonymous");
      expect(result.current.authState.session?.username).toBe("fallback-user");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle network errors during authentication", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for authentication to complete
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Should handle gracefully - will create anonymous session as fallback
      expect(result.current.authState.session?.sessionType).toBe("anonymous");
      expect(result.current.authState.isAuthenticated).toBe(false);
    });

    it("should handle localStorage being disabled", async () => {
      // Mock localStorage to throw errors only for setItem
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error("localStorage disabled");
      });
      
      // Mock getItem to return an existing session to avoid creating a new one
      localStorageMock.getItem.mockReturnValue(JSON.stringify({
        userId: "existing-user",
        isAuthenticated: false,
        sessionType: "anonymous",
      }));

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      // Suppress console errors for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Wait for authentication to complete
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      // Should load existing session from localStorage
      expect(result.current.authState.session?.sessionType).toBe("anonymous");
      expect(result.current.authState.isAuthenticated).toBe(false);

      // Setting anonymous session should not throw
      expect(() => {
        result.current.setAnonymousSession("test-user");
      }).not.toThrow();

      // Restore console
      consoleSpy.mockRestore();
    });

    it("should maintain loading state during authentication", async () => {
      // Delay the response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                userId: "admin-123",
                username: "test-admin",
                role: "organizer",
              },
            }),
          } as Response), 100)
        )
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      // Should start in loading state
      expect(result.current.authState.isLoading).toBe(true);

      // Fast-forward time to resolve the promise
      await act(async () => {
        vi.advanceTimersByTime(100);
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.authState.isAuthenticated).toBe(true);
      expect(result.current.authState.session?.sessionType).toBe("admin");
    });
  });
});
