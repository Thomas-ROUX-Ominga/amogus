/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ERROR_CODES } from "@/lib/constants/error-codes";

// Mock environment variables
vi.stubEnv("AUTH_SECRET", "test_secret_for_jwt_signing_123456789");
vi.stubEnv("NODE_ENV", "test");

// Mock Redis for testing
vi.mock("@/lib/redis/client", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

// Mock bcryptjs with simple approach
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

// Mock cookies for testing
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock jose completely with proper class mock
vi.mock("jose", () => ({
  SignJWT: class MockSignJWT {
    constructor(private payload: any) {}
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "mock_jwt_token"; }
  },
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { role: "admin" }
  }),
}));

import { verifyAdminCredentials, adminLogin } from "@/lib/redis/auth-actions";
import { createAdminSession, verifyAdminSession, clearAdminSession } from "@/lib/redis/auth-utils";
import { redis } from "@/lib/redis/client";
import bcrypt from "bcryptjs";

describe("Authentication Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("verifyAdminCredentials", () => {
    it("should reject empty username", async () => {
      const result = await verifyAdminCredentials("", "password");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Username and password are required");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_INPUT);
    });

    it("should reject empty password", async () => {
      const result = await verifyAdminCredentials("admin", "");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Username and password are required");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_INPUT);
    });

    it("should reject when no admin exists", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      
      const result = await verifyAdminCredentials("admin", "password");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_CREDENTIALS);
    });

    it("should reject invalid credentials", async () => {
      const mockAdmin = {
        username: "admin",
        passwordHash: "$2a$10$hashedpassword",
        createdAt: "2024-01-01T00:00:00.000Z",
      };
      vi.mocked(redis.get).mockResolvedValue(mockAdmin);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      
      const result = await verifyAdminCredentials("wronguser", "wrongpassword");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_CREDENTIALS);
    });

    it("should accept valid credentials", async () => {
      const mockAdmin = {
        username: "admin",
        passwordHash: "$2a$10$hashedpassword",
        createdAt: "2024-01-01T00:00:00.000Z",
      };
      vi.mocked(redis.get).mockResolvedValue(mockAdmin);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      
      const result = await verifyAdminCredentials("admin", "correct_password");
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
    });
  });

  describe("adminLogin", () => {
    it("should reject invalid credentials", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      
      const result = await adminLogin("admin", "wrong_password");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
    });

    it("should create session for valid credentials", async () => {
      const mockAdmin = {
        username: "admin",
        passwordHash: "$2a$10$hashedpassword",
        createdAt: "2024-01-01T00:00:00.000Z",
      };
      vi.mocked(redis.get).mockResolvedValue(mockAdmin);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      
      const result = await adminLogin("admin", "correct_password");
      
      expect(result.success).toBe(true);
    });
  });

  describe("session management", () => {
    it("should create admin session successfully", async () => {
      const { cookies } = await import("next/headers");
      const mockCookieStore = {
        set: vi.fn(),
      };
      vi.mocked(cookies).mockReturnValue(mockCookieStore as any);
      
      const result = await createAdminSession();
      
      expect(result.success).toBe(true);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "admin-session",
        "mock_jwt_token",
        expect.objectContaining({
          httpOnly: true,
          secure: false, // test environment
          sameSite: "lax",
          maxAge: 24 * 60 * 60,
          path: "/",
        })
      );
    });

    it("should verify valid session", async () => {
      const { cookies } = await import("next/headers");
      const mockCookieStore = {
        get: vi.fn(() => ({ value: "valid_jwt_token" })),
      };
      vi.mocked(cookies).mockReturnValue(mockCookieStore as any);
      
      const result = await verifyAdminSession();
      
      expect(result.success).toBe(true);
      expect(result.data?.role).toBe("admin");
    });

    it("should reject invalid session", async () => {
      const { cookies } = await import("next/headers");
      const mockCookieStore = {
        get: vi.fn(() => null),
      };
      vi.mocked(cookies).mockReturnValue(mockCookieStore as any);
      
      const result = await verifyAdminSession();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("No session found");
      expect(result.code).toBe(ERROR_CODES.ERR_NO_SESSION);
    });

    it("should clear admin session", async () => {
      const { cookies } = await import("next/headers");
      const mockCookieStore = {
        delete: vi.fn(),
      };
      vi.mocked(cookies).mockReturnValue(mockCookieStore as any);
      
      const result = await clearAdminSession();
      
      expect(result.success).toBe(true);
      expect(mockCookieStore.delete).toHaveBeenCalledWith("admin-session");
    });
  });
});
