import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and assets
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/game/") ||
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return NextResponse.next();
  }

  // No bypasses for E2E tests in middleware - use real auth or mock cookies

  // Production/staging organizer middleware
  try {
    const { verifySession } = await import("@/lib/redis/auth-utils");
    const { adminExists } = await import("@/lib/redis/admin-utils");
    
    // For admin routes, first check if user has a valid session
    if (pathname.startsWith("/admin")) {
      const sessionResult = await verifySession();
      
      if (sessionResult.success) {
        // Valid session, allow access
        return NextResponse.next();
      }
    }
    
    // Check if any user (organizer) exists for non-authenticated users
    const hasUsers = await adminExists();
    
    if (!hasUsers) {
      // No users exist, redirect to registration
      if (pathname !== "/register") {
        const registerUrl = new URL("/register", request.url);
        return NextResponse.redirect(registerUrl);
      }
      return NextResponse.next();
    }

    // Users exist but no valid session for admin routes, redirect to login
    if (pathname.startsWith("/admin")) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  } catch (error) {
    console.error("Middleware auth error:", error);
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - game (public game routes)
     * - / (root page)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|game).*)",
  ],
};
