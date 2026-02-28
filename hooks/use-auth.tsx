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
  isAuthenticated: boolean; // Has a verified account (Organizer)
  isAnonymous: boolean;    // Temporary guest session
}

// Context for global auth state
const AuthContext = createContext<{
  authState: AuthState;
  refreshAuth: () => Promise<void>;
  setAnonymousSession: (username?: string, gameId?: string) => void;
  clearAnonymousSession: () => void;
} | null>(null);

// Storage keys
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
    isAuthenticated: false,
    isAnonymous: false,
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

      // Migration from legacy useLocalUser (amogus_user_id)
      const legacyId = localStorage.getItem("amogus_user_id");
      if (legacyId) {
        const newSession: AnonymousSession = {
          userId: legacyId,
          isAuthenticated: false,
          sessionType: "anonymous",
        };
        localStorage.setItem(ANONYMOUS_SESSION_KEY, JSON.stringify(newSession));
        return newSession;
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
        isAuthenticated: true,
        isAnonymous: false,
      });
      return;
    }

    // Fall back to anonymous session
    let anonymousSession = loadAnonymousSession();
    
    // Ensure we always have at least an anonymous session (parity with useLocalUser)
    if (!anonymousSession) {
      const newUserId = globalThis.crypto.randomUUID();
      anonymousSession = {
        userId: newUserId,
        isAuthenticated: false,
        sessionType: "anonymous",
      };
      localStorage.setItem(ANONYMOUS_SESSION_KEY, JSON.stringify(anonymousSession));
    }

    setAuthState({
      session: anonymousSession,
      isLoading: false,
      isAuthenticated: false,
      isAnonymous: true,
    });
  };

  // Set anonymous session — preserves existing userId to support reconnection (AC2)
  const setAnonymousSession = (username?: string, gameId?: string) => {
    try {
      const existingRaw = localStorage.getItem(ANONYMOUS_SESSION_KEY);
      const userId = existingRaw ? JSON.parse(existingRaw).userId : globalThis.crypto.randomUUID();
      const session: AnonymousSession = {
        userId,
        username,
        gameId,
        isAuthenticated: false,
        sessionType: "anonymous",
      };
      localStorage.setItem(ANONYMOUS_SESSION_KEY, JSON.stringify(session));
      
      if (!authState.isAuthenticated) {
        setAuthState({
          session,
          isLoading: false,
          isAuthenticated: false,
          isAnonymous: true,
        });
      }
    } catch (e) {
      console.error("Failed to set anonymous session:", e);
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
          isAuthenticated: false,
          isAnonymous: false,
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

  // Periodic refresh for authenticated sessions (every 30 seconds)
  useEffect(() => {
    if (authState.isAuthenticated) {
      const interval = setInterval(refreshAuth, 30000);
      return () => clearInterval(interval);
    }
  }, [authState.isAuthenticated]);

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
export function useAuthGuard(requireAccount: boolean = false) {
  const { authState } = useAuth();
  
  if (authState.isLoading) {
    return { canProceed: true, isLoading: true, reason: null };
  }
  
  if (requireAccount && !authState.isAuthenticated) {
    return {
      canProceed: false,
      isLoading: false,
      reason: "Organizer authentication required",
    };
  }
  
  if (!authState.session) {
    return {
      canProceed: false,
      isLoading: false,
      reason: "Authentication required",
    };
  }
  
  return {
    canProceed: true,
    isLoading: false,
    reason: null,
  };
}
