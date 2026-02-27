import { ActionResponse } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";

// Must match ANONYMOUS_SESSION_KEY in hooks/use-auth.tsx to share the same storage entry
const PLAYER_SESSION_KEY = "anonymous-session";

export interface PlayerSession {
  userId: string;
  username?: string;
  gameId?: string;
  joinedAt: string;
  lastSeen: string;
}

export interface PlayerSessionData {
  userId: string;
  username?: string;
  gameId?: string;
}

/**
 * Create a persistent player session in localStorage
 * This allows anonymous players to reconnect to games
 */
export function createPlayerSession(data: PlayerSessionData): ActionResponse<PlayerSession> {
  if (typeof window === "undefined") {
    return { success: false, error: "localStorage unavailable (server-side)", code: ERROR_CODES.ERR_SIGNAL_LOST };
  }
  try {
    const session: PlayerSession = {
      ...data,
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };

    localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
    
    return {
      success: true,
      data: session,
    };
  } catch (error) {
    console.error("Failed to create player session:", error);
    return {
      success: false,
      error: "Failed to create player session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

/**
 * Get the current player session from localStorage
 */
export function getPlayerSession(): ActionResponse<PlayerSession> {
  if (typeof window === "undefined") {
    return { success: false, error: "No player session found", code: ERROR_CODES.ERR_NO_SESSION };
  }
  try {
    const stored = localStorage.getItem(PLAYER_SESSION_KEY);
    
    if (!stored) {
      return {
        success: false,
        error: "No player session found",
        code: ERROR_CODES.ERR_NO_SESSION,
      };
    }

    const session = JSON.parse(stored) as PlayerSession;
    
    // Update last seen time
    session.lastSeen = new Date().toISOString();
    localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(session));
    
    return {
      success: true,
      data: session,
    };
  } catch (error) {
    console.error("Failed to get player session:", error);
    // Clear corrupted session
    localStorage.removeItem(PLAYER_SESSION_KEY);
    
    return {
      success: false,
      error: "Invalid player session",
      code: ERROR_CODES.ERR_INVALID_SESSION,
    };
  }
}

/**
 * Update player session with new game information
 */
export function updatePlayerSession(updates: Partial<PlayerSessionData>): ActionResponse<PlayerSession> {
  if (typeof window === "undefined") {
    return { success: false, error: "Failed to update player session", code: ERROR_CODES.ERR_SIGNAL_LOST };
  }
  try {
    const currentResult = getPlayerSession();
    
    if (!currentResult.success || !currentResult.data) {
      // Ensure we have a userId for new sessions
      if (!updates.userId) {
        return {
          success: false,
          error: "userId required for player session",
          code: ERROR_CODES.ERR_INVALID_SESSION,
        };
      }
      return createPlayerSession(updates as PlayerSessionData);
    }

    const updatedSession: PlayerSession = {
      ...currentResult.data,
      ...updates,
      lastSeen: new Date().toISOString(),
    };

    localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(updatedSession));
    
    return {
      success: true,
      data: updatedSession,
    };
  } catch (error) {
    console.error("Failed to update player session:", error);
    return {
      success: false,
      error: "Failed to update player session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

/**
 * Clear the player session from localStorage
 */
export function clearPlayerSession(): ActionResponse<void> {
  if (typeof window === "undefined") {
    return { success: true }; // Nothing to clear server-side
  }
  try {
    localStorage.removeItem(PLAYER_SESSION_KEY);
    
    return {
      success: true,
    };
  } catch (error) {
    console.error("Failed to clear player session:", error);
    return {
      success: false,
      error: "Failed to clear player session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

/**
 * Check if player can reconnect to a specific game
 */
export function canReconnectToGame(gameId: string): ActionResponse<PlayerSession> {
  if (typeof window === "undefined") {
    return { success: false, error: "No player session found for reconnection", code: ERROR_CODES.ERR_NO_SESSION };
  }
  try {
    const sessionResult = getPlayerSession();
    
    if (!sessionResult.success || !sessionResult.data) {
      return {
        success: false,
        error: "No player session found for reconnection",
        code: ERROR_CODES.ERR_NO_SESSION,
      };
    }

    const session = sessionResult.data;
    
    // Check if session is for the same game
    if (session.gameId !== gameId) {
      return {
        success: false,
        error: "Session is for a different game",
        code: ERROR_CODES.ERR_INVALID_SESSION,
      };
    }

    // Check if session is not too old (24 hours)
    const lastSeen = new Date(session.lastSeen);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      clearPlayerSession(); // Clear expired session
      return {
        success: false,
        error: "Session expired",
        code: ERROR_CODES.ERR_INVALID_SESSION,
      };
    }

    return {
      success: true,
      data: session,
    };
  } catch (error) {
    console.error("Failed to check reconnection:", error);
    return {
      success: false,
      error: "Failed to check reconnection",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

/**
 * Get all active player sessions (for admin/debug purposes)
 */
export function getAllPlayerSessions(): PlayerSession[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PLAYER_SESSION_KEY);
    if (!stored) return [];
    
    const session = JSON.parse(stored) as PlayerSession;
    return [session];
  } catch (error) {
    console.error("Failed to get player sessions:", error);
    return [];
  }
}

/**
 * Validate player session integrity
 */
export function validatePlayerSession(session: unknown): session is PlayerSession {
  if (!session || typeof session !== "object" || session === null) {
    return false;
  }
  
  const obj = session as Record<string, unknown>;
  return (
    typeof obj.userId === "string" &&
    typeof obj.joinedAt === "string" &&
    typeof obj.lastSeen === "string" &&
    (obj.username === undefined || typeof obj.username === "string") &&
    (obj.gameId === undefined || typeof obj.gameId === "string")
  );
}
