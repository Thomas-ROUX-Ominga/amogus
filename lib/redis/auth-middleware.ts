import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "./auth-utils";
import { ERROR_CODES } from "@/lib/constants/error-codes";

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

/**
 * Authentication middleware for API routes
 * Verifies admin session and attaches user info to request
 */
export async function withAuth(
  handler: (req: AuthenticatedRequest, ...args: unknown[]) => Promise<NextResponse>,
  options: {
    requireAdmin?: boolean;
    allowAnonymous?: boolean;
  } = {}
) {
  return async (req: NextRequest, ...args: unknown[]) => {
    const { requireAdmin = true, allowAnonymous = false } = options;

    // Skip authentication for anonymous access
    if (allowAnonymous) {
      return handler(req as AuthenticatedRequest, ...args);
    }

    try {
      // Verify admin session
      const sessionResult = await verifySession();
      
      if (!sessionResult.success || !sessionResult.data) {
        return NextResponse.json({
          success: false,
          error: requireAdmin 
            ? "Admin authentication required" 
            : "Authentication required",
          code: ERROR_CODES.ERR_UNAUTHORIZED,
        }, { status: 401 });
      }

      // Attach user info to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = sessionResult.data;

      // Additional admin check if required
      if (requireAdmin && sessionResult.data.role !== "organizer" && sessionResult.data.role !== "admin") {
        return NextResponse.json({
          success: false,
          error: "Admin privileges required",
          code: ERROR_CODES.ERR_UNAUTHORIZED,
        }, { status: 403 });
      }

      return handler(authenticatedReq, ...args);
    } catch (error) {
      console.error("Authentication middleware error:", error);
      return NextResponse.json({
        success: false,
        error: "Authentication service unavailable",
        code: ERROR_CODES.ERR_SIGNAL_LOST,
      }, { status: 500 });
    }
  };
}

/**
 * Role-based access control middleware — wraps a handler with role enforcement.
 */
export function withRole(
  requiredRole: "admin" | "organizer" | "any",
  handler: (req: AuthenticatedRequest, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (req: AuthenticatedRequest, ...args: unknown[]): Promise<NextResponse> => {
    if (!req.user) {
      return NextResponse.json({
        success: false,
        error: "Authentication required",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      }, { status: 401 });
    }

    if (requiredRole !== "any") {
      const userRole = req.user.role.toLowerCase();
      const required = requiredRole.toLowerCase();

      if (userRole !== required && userRole !== "admin") {
        return NextResponse.json({
          success: false,
          error: `${requiredRole} privileges required`,
          code: ERROR_CODES.ERR_UNAUTHORIZED,
        }, { status: 403 });
      }
    }

    return handler(req, ...args);
  };
}

/**
 * Game-specific authentication middleware
 */
export async function withGameAuth(
  handler: (req: AuthenticatedRequest, gameId: string, ...args: unknown[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: { gameId: string } }, ...args: unknown[]) => {
    const { gameId } = context.params;

    try {
      // Verify admin session first
      const sessionResult = await verifySession();
      
      if (sessionResult.success && sessionResult.data) {
        // Admin access - allow all operations
        const authenticatedReq = req as AuthenticatedRequest;
        authenticatedReq.user = sessionResult.data;
        return handler(authenticatedReq, gameId, ...args);
      }

      // For non-admin users, we would need to implement player session verification
      // This is a placeholder for future player authentication enhancement
      return NextResponse.json({
        success: false,
        error: "Game access requires authentication",
        code: ERROR_CODES.ERR_UNAUTHORIZED,
      }, { status: 401 });
    } catch (error) {
      console.error("Game authentication middleware error:", error);
      return NextResponse.json({
        success: false,
        error: "Authentication service unavailable",
        code: ERROR_CODES.ERR_SIGNAL_LOST,
      }, { status: 500 });
    }
  };
}

/**
 * Rate limiting middleware for authentication endpoints — wraps a handler with rate limiting.
 */
export function withAuthRateLimit(
  handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
  maxRequests = 10,
  windowMs = 60000
) {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async (req: NextRequest, ...args: unknown[]): Promise<NextResponse> => {
    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [ip, data] of requests.entries()) {
      if (data.resetTime < windowStart) {
        requests.delete(ip);
      }
    }

    // Check current requests
    const current = requests.get(clientIp);
    if (current && current.count >= maxRequests && current.resetTime > now) {
      return NextResponse.json({
        success: false,
        error: "Too many authentication attempts",
        code: "RATE_LIMIT_EXCEEDED",
      }, { status: 429 });
    }

    // Update request count
    if (current) {
      current.count++;
    } else {
      requests.set(clientIp, {
        count: 1,
        resetTime: now + windowMs,
      });
    }

    return handler(req, ...args);
  };
}
