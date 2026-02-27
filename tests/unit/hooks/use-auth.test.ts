import { renderHook, waitFor, act } from "@testing-library/react";
import { ReactNode } from "react";
import { useAuth, AuthProvider } from "@/hooks/use-auth";
import React from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

type MockedFunction = ReturnType<typeof vi.fn>;
type MockedFetch = MockedFunction & {
  mockResolvedValue: (value: unknown) => void;
  mockResolvedValueOnce: (value: unknown) => void;
  mockRejectedValue: (value: unknown) => void;
  mockClear: () => void;
  mockImplementation: (fn: () => unknown) => void;
};

// Get the mocked localStorage from setup
const localStorageMock = (globalThis as { localStorage: unknown }).localStorage as {
  getItem: MockedFunction;
  setItem: MockedFunction;
  removeItem: MockedFunction;
  clear: MockedFunction;
};

// Test wrapper component
function createWrapper({ children }: { children: ReactNode }) {
  return React.createElement(AuthProvider, null, children);
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe("Admin Session", () => {
    it("should detect admin session when API returns valid session", async () => {
      const mockFetch = fetch as MockedFetch;
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

      await waitFor(() => {
        expect(result.current.authState.isLoading).toBe(false);
      });

      expect(result.current.authState.session).toEqual({
        userId: "admin-123",
        username: "test-admin",
        role: "organizer",
        isAuthenticated: true,
        sessionType: "admin",
      });
      expect(result.current.authState.isAdmin).toBe(true);
      expect(result.current.authState.isAuthenticated).toBe(true);
    });

    it("should handle admin session verification failure", async () => {
      const mockFetch = fetch as MockedFetch;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      await waitFor(() => {
        expect(result.current.authState.isLoading).toBe(false);
      });

      expect(result.current.authState.session).toBeNull();
      expect(result.current.authState.isAdmin).toBe(false);
      expect(result.current.authState.isAuthenticated).toBe(false);
    });

    it("should refresh admin session periodically", async () => {
      const mockFetch = fetch as MockedFetch;
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

      // Mock setInterval to track calls
      const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
      
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      await waitFor(() => {
        expect(result.current.authState.isAdmin).toBe(true);
      });

      // Check that setInterval was called with 30 second interval
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      
      setIntervalSpy.mockRestore();
    });
  });

  describe("Anonymous Session", () => {
    it("should load anonymous session from localStorage", async () => {
      const storedSession = {
        userId: "anon-123",
        username: "test-user",
        gameId: "game-456",
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSession));

      const mockFetch = fetch as MockedFetch;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      await waitFor(() => {
        expect(result.current.authState.isLoading).toBe(false);
      });

      expect(result.current.authState.session).toEqual({
        ...storedSession,
        isAuthenticated: false,
        sessionType: "anonymous",
      });
      expect(result.current.authState.isAdmin).toBe(false);
      expect(result.current.authState.isAuthenticated).toBe(false);
    });

    it("should set anonymous session", async () => {
      const mockFetch = fetch as MockedFetch;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      await waitFor(() => {
        expect(result.current.authState.isLoading).toBe(false);
      });

      // Set anonymous session wrapped in act
      act(() => {
        result.current.setAnonymousSession("new-user", "game-789");
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "anonymous-session",
        expect.stringContaining("new-user")
      );

      expect(result.current.authState.session).toEqual({
        userId: "550e8400-e29b-41d4-a716-446655440001",
        username: "new-user",
        gameId: "game-789",
        isAuthenticated: false,
        sessionType: "anonymous",
      });
    });

    it("should clear anonymous session", async () => {
      const storedSession = {
        userId: "anon-123",
        username: "test-user",
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSession));

      const mockFetch = fetch as MockedFetch;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      await waitFor(() => {
        expect(result.current.authState.session).not.toBeNull();
      });

      // Clear anonymous session wrapped in act
      act(() => {
        result.current.clearAnonymousSession();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith("anonymous-session");
      expect(result.current.authState.session).toBeNull();
    });

    it("should not override admin session with anonymous session", async () => {
      const mockFetch = fetch as MockedFetch;
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

      await waitFor(() => {
        expect(result.current.authState.isAdmin).toBe(true);
      });

      // Try to set anonymous session while admin is active
      result.current.setAnonymousSession("new-user", "game-789");

      // Admin session should remain unchanged
      expect(result.current.authState.isAdmin).toBe(true);
      expect(result.current.authState.session?.sessionType).toBe("admin");
    });
  });

  describe("Session Management", () => {
    it("should handle localStorage errors gracefully", async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error("Storage access denied");
      });

      const mockFetch = fetch as MockedFetch;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: "No session found",
        }),
      } as Response);

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }) => createWrapper({ children }),
      });

      await waitFor(() => {
        expect(result.current.authState.isLoading).toBe(false);
      });

      expect(result.current.authState.session).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("anonymous-session");
    });

    it("should prioritize admin session over anonymous session", async () => {
      // Start with anonymous session
      const storedSession = {
        userId: "anon-123",
        username: "test-user",
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSession));

      const mockFetch = fetch as MockedFetch;
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

      await waitFor(() => {
        expect(result.current.authState.isAdmin).toBe(true);
      });

      // Admin session should take priority
      expect(result.current.authState.session?.sessionType).toBe("admin");
      expect(result.current.authState.isAdmin).toBe(true);
    });
  });
});
