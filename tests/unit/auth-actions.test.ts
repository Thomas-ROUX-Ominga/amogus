/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

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

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
  compare: vi.fn(),
  hash: vi.fn(),
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock jose
vi.mock("jose", () => ({
  SignJWT: class MockSignJWT {
    constructor(private payload: any) {}
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "mock_jwt_token"; }
  },
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { userId: "u1", username: "user1", role: "organizer" }
  }),
}));

import { login } from "@/lib/redis/auth-actions";
import { createSession, verifySession } from "@/lib/redis/auth-utils";
import { redis } from "@/lib/redis/client";
import bcrypt from "bcryptjs";

describe("Authentication Actions (Multi-user)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("login", () => {
    it("should reject invalid credentials", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      const result = await login("admin", "wrong_password");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
    });

    it("should create session for valid credentials", async () => {
      const mockUser = { id: "u1", username: "user1", passwordHash: "hashed" };
      vi.mocked(redis.get).mockImplementation(async (key) => {
        if (key === "username:user1") return "u1";
        if (key === "user:u1") return mockUser;
        return null;
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      
      const result = await login("user1", "correct_password");
      expect(result.success).toBe(true);
    });
  });

  describe("session management", () => {
    it("should create session with user data", async () => {
      const { cookies } = await import("next/headers");
      const mockCookieStore = { set: vi.fn() };
      vi.mocked(cookies).mockReturnValue(mockCookieStore as any);
      
      const result = await createSession("u1", "user1");
      
      expect(result.success).toBe(true);
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "organizer-session",
        "mock_jwt_token",
        expect.any(Object)
      );
    });

    it("should verify session and return user data", async () => {
      const { cookies } = await import("next/headers");
      const mockCookieStore = { 
        get: vi.fn((name) => name === "organizer-session" ? { value: "token" } : null) 
      };
      vi.mocked(cookies).mockReturnValue(mockCookieStore as any);
      
      const result = await verifySession();
      
      expect(result.success).toBe(true);
      expect(result.data?.userId).toBe("u1");
      expect(result.data?.username).toBe("user1");
    });
  });
});
