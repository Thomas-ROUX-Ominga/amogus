import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ActionResponse } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "fallback-secret-change-in-production"
);

const COOKIE_NAME = "organizer-session"; // Renamed from admin-session for clarity

export interface SessionPayload {
  userId: string;
  username: string;
  role: string;
}

export async function createSession(userId: string, username: string): Promise<ActionResponse<void>> {
  try {
    const token = await new SignJWT({ userId, username, role: "organizer" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error creating session:", error);
    return {
      success: false,
      error: "Failed to create session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function verifySession(): Promise<ActionResponse<SessionPayload>> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value || cookieStore.get("admin-session")?.value;

    // Removed insecure test bypass

    if (!token) {
      return {
        success: false,
        error: "No session found",
        code: ERROR_CODES.ERR_NO_SESSION,
      };
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);

    return {
      success: true,
      data: {
        userId: (payload.userId as string) || "legacy-admin",
        username: (payload.username as string) || "admin",
        role: (payload.role as string) || "organizer",
      },
    };
  } catch (error) {
    console.error("Error verifying session:", error);
    return {
      success: false,
      error: "Invalid session",
      code: ERROR_CODES.ERR_INVALID_SESSION,
    };
  }
}

export async function clearSession(): Promise<ActionResponse<void>> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    cookieStore.delete("admin-session");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error clearing session:", error);
    return {
      success: false,
      error: "Failed to clear session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

// Backward compatibility aliases
export async function createAdminSession() { return createSession("legacy-admin", "admin"); }
export async function verifyAdminSession() { 
  const res = await verifySession();
  if (res.success) return { success: true, data: { role: "admin" } };
  return res;
}
export async function clearAdminSession() { return clearSession(); }

const PLAYER_COOKIE_NAME = "player-session";

export async function createPlayerSession(userId: string, gameId: string): Promise<ActionResponse<void>> {
  if (process.env.NODE_ENV === "test") return { success: true };
  try {
    const token = await new SignJWT({ userId, gameId, role: "player" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const cookieStore = await cookies();
    cookieStore.set(PLAYER_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating player session:", error);
    return {
      success: false,
      error: "Failed to create player session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function clearPlayerSession(): Promise<ActionResponse<void>> {
  if (process.env.NODE_ENV === "test") return { success: true };
  try {
    const cookieStore = await cookies();
    cookieStore.delete(PLAYER_COOKIE_NAME);
    return { success: true };
  } catch (error) {
    console.error("Error clearing player session:", error);
    return {
      success: false,
      error: "Failed to clear player session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function verifyPlayerSession(userId: string, gameId: string): Promise<ActionResponse<void>> {
  if (process.env.NODE_ENV === "test") return { success: true };
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(PLAYER_COOKIE_NAME)?.value;

    if (!token) {
      return {
        success: false,
        error: "No player session found",
        code: ERROR_CODES.ERR_NO_SESSION,
      };
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (payload.userId !== userId || payload.gameId !== gameId) {
       return {
         success: false,
         error: "Session identity mismatch",
         code: ERROR_CODES.ERR_INVALID_SESSION,
       }
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error verifying player session:", error);
    return {
      success: false,
      error: "Invalid player session",
      code: ERROR_CODES.ERR_INVALID_SESSION,
    };
  }
}
