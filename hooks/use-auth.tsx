"use client";

import React, { useState, useEffect, createContext, useContext, ReactNode } from "react";

// Types for authentication state
export interface AdminSession {
  userId: string;
  username: string;
  role: "organizer" | "admin";
  isAuthenticated: true;
  sessionType: "admin";
}

export interface AnonymousSession {
  userId: string;
  username?: string;
  gameId?: string;
  isAuthenticated: false;
  sessionType: "anonymous";
}

export type AuthSession = AdminSession | AnonymousSession | null;

export interface AuthState {
  session: AuthSession;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
}

// Context for global auth state
const AuthContext = createContext<{
  authState: AuthState;
  refreshAuth: () => Promise<void>;
  setAnonymousSession: (username?: string, gameId?: string) => void;
  clearAnonymousSession: () => void;
} | null>(null);

// Storage keys
const ADMIN_SESSION_KEY = "organizer-session";
const ANONYMOUS_SESSION_KEY = "anonymous-session";

/**
 * Hook to manage dual authentication sessions:
 * - Admin sessions via JWT cookies (server-side)
 * - Anonymous sessions via localStorage (client-side)
 * 
 * Provides real-time authentication state synchronization across components.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Provider component that wraps the app and provides authentication context
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    session: null,
    isLoading: true,
    isAdmin: false,
    isAuthenticated: false,
  });

  // Verify admin session via API call
  const verifyAdminSession = async (): Promise<AdminSession | null> => {
    try {
      const response = await globalThis.fetch("/api/auth/verify", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return {
            userId: data.data.userId,
            username: data.data.username,
            role: data.data.role,
            isAuthenticated: true,
            sessionType: "admin",
          };
        }
      }
    } catch (error) {
      console.error("Admin session verification failed:", error);
    }
    return null;
  };

  // Load anonymous session from localStorage
  const loadAnonymousSession = (): AnonymousSession | null => {
    try {
      const stored = localStorage.getItem(ANONYMOUS_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...parsed,
          isAuthenticated: false,
          sessionType: "anonymous",
        };
      }
    } catch (error) {
      console.error("Failed to load anonymous session:", error);
      localStorage.removeItem(ANONYMOUS_SESSION_KEY);
    }
    return null;
  };

  // Refresh authentication state
  const refreshAuth = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    // Check admin session first (higher priority)
    const adminSession = await verifyAdminSession();
    if (adminSession) {
      setAuthState({
        session: adminSession,
        isLoading: false,
        isAdmin: true,
        isAuthenticated: true,
      });
      return;
    }

    // Fall back to anonymous session
    const anonymousSession = loadAnonymousSession();
    if (anonymousSession) {
      setAuthState({
        session: anonymousSession,
        isLoading: false,
        isAdmin: false,
        isAuthenticated: false,
      });
      return;
    }

    // No session found
    setAuthState({
      session: null,
      isLoading: false,
      isAdmin: false,
      isAuthenticated: false,
    });
  };

  // Set anonymous session — preserves existing userId to support reconnection (AC2)
  const setAnonymousSession = (username?: string, gameId?: string) => {
    try {
      // Reuse the existing anonymous userId if one already exists, to preserve reconnection identity
      const existingRaw = localStorage.getItem(ANONYMOUS_SESSION_KEY);
      const existingUserId = existingRaw
        ? (() => { try { return JSON.parse(existingRaw).userId as string; } catch { return null; } })()
        : null;

      const session: AnonymousSession = {
        userId: existingUserId ?? globalThis.crypto.randomUUID(),
        username,
        gameId,
        isAuthenticated: false,
        sessionType: "anonymous",
      };

      localStorage.setItem(ANONYMOUS_SESSION_KEY, JSON.stringify(session));
      
      // Only update state if not admin (admin takes priority)
      if (!authState.isAdmin) {
        setAuthState({
          session,
          isLoading: false,
          isAdmin: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error("Failed to set anonymous session:", error);
    }
  };

  // Clear anonymous session
  const clearAnonymousSession = () => {
    try {
      localStorage.removeItem(ANONYMOUS_SESSION_KEY);
      
      // Only update state if current session is anonymous
      if (authState.session?.sessionType === "anonymous") {
        setAuthState({
          session: null,
          isLoading: false,
          isAdmin: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error("Failed to clear anonymous session:", error);
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    refreshAuth();
  }, []);

  // Periodic refresh for admin sessions (every 30 seconds)
  useEffect(() => {
    if (authState.isAdmin) {
      const interval = setInterval(refreshAuth, 30000);
      return () => clearInterval(interval);
    }
  }, [authState.isAdmin]);

  const contextValue = {
    authState,
    refreshAuth,
    setAnonymousSession,
    clearAnonymousSession,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Utility hook for authentication guards
 */
export function useAuthGuard(requireAdmin: boolean = false) {
  const { authState } = useAuth();
  
  if (requireAdmin && !authState.isAdmin) {
    return {
      canProceed: false,
      reason: "Admin authentication required",
    };
  }
  
  if (!authState.session) {
    return {
      canProceed: false,
      reason: "Authentication required",
    };
  }
  
  return {
    canProceed: true,
    reason: null,
  };
}
