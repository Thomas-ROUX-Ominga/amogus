import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { ActionResponse } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "fallback-secret-change-in-production"
);

const COOKIE_NAME = "admin-session";

export async function createAdminSession(): Promise<ActionResponse<void>> {
  try {
    const token = await new SignJWT({ role: "admin" })
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
    console.error("Error creating admin session:", error);
    return {
      success: false,
      error: "Failed to create session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function verifyAdminSession(): Promise<ActionResponse<{ role: string }>> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    // Check for E2E test bypass
    if (process.env.PLAYWRIGHT === "true") {
      return {
        success: true,
        data: { role: "admin" },
      };
    }

    if (!token) {
      return {
        success: false,
        error: "No session found",
        code: ERROR_CODES.ERR_NO_SESSION,
      };
    }

    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (payload.role !== "admin") {
      return {
        success: false,
        error: "Invalid session",
        code: ERROR_CODES.ERR_INVALID_SESSION,
      };
    }

    return {
      success: true,
      data: { role: payload.role as string },
    };
  } catch (error) {
    console.error("Error verifying admin session:", error);
    return {
      success: false,
      error: "Invalid session",
      code: ERROR_CODES.ERR_INVALID_SESSION,
    };
  }
}

export async function clearAdminSession(): Promise<ActionResponse<void>> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error clearing admin session:", error);
    return {
      success: false,
      error: "Failed to clear session",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}
