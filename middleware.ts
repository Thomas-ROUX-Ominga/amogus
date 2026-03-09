import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  LOCALE_COOKIE_NAME,
} from "@/lib/i18n/config";
import { resolveAppLocale } from "@/lib/i18n/locale";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = resolveAppLocale({
    cookieLocale: request.cookies.get(LOCALE_COOKIE_NAME)?.value ?? null,
    acceptLanguage: request.headers.get("accept-language"),
  });
  const hadLocaleCookie = Boolean(request.cookies.get(LOCALE_COOKIE_NAME));

  const withLocaleCookie = (response: NextResponse) => {
    if (hadLocaleCookie) {
      return response;
    }

    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      path: "/",
      maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
    });

    return response;
  };

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
    return withLocaleCookie(NextResponse.next());
  }

  // No bypasses for E2E tests in middleware - use real auth or mock cookies

  // Production/staging organizer middleware
  try {
    const { verifySession } = await import("@/lib/redis/auth-utils");
    const { adminExists } = await import("@/lib/redis/admin-utils");
    
    // List of organizer routes (previously under /admin)
    const organizerRoutes = ["/batches", "/dashboard", "/games", "/tracker"];
    const isOrganizerRoute = organizerRoutes.some(route => pathname === route || pathname.startsWith(route + "/"));
    
    // For organizer routes, first check if user has a valid session
    if (isOrganizerRoute) {
      const sessionResult = await verifySession();
      
      if (sessionResult.success) {
        // Valid session, allow access
        return withLocaleCookie(NextResponse.next());
      }
    }
    
    // Check if any user (organizer) exists for non-authenticated users
    const hasUsers = await adminExists();
    
    if (!hasUsers) {
      // No users exist, redirect to registration
      if (pathname !== "/register") {
        const registerUrl = new URL("/register", request.url);
        return withLocaleCookie(NextResponse.redirect(registerUrl));
      }
      return withLocaleCookie(NextResponse.next());
    }
    
    // Users exist but no valid session for organizer routes, redirect to login
    if (isOrganizerRoute) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return withLocaleCookie(NextResponse.redirect(loginUrl));
    }
  } catch (error) {
    console.error("Middleware auth error:", error);
    return withLocaleCookie(NextResponse.next());
  }

  return withLocaleCookie(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
