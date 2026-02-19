import { describe, it, expect, vi, beforeEach } from "vitest";
import { ERROR_CODES } from "@/lib/constants/error-codes";

// Mock Redis client
vi.mock("@/lib/redis/client", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

// Mock crypto.randomUUID
if (typeof crypto === "undefined") {
  // @ts-expect-error - Global crypto might not be defined in this environment
  global.crypto = { randomUUID: () => "test-uuid" };
} else {
  vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid" as never);
}

import { registerUser, getUserById, verifyUserCredentials, usersExist } from "@/lib/redis/admin-db-actions";
import { redis } from "@/lib/redis/client";
import bcrypt from "bcryptjs";

describe("User DB Actions (Multi-user)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerUser", () => {
    it("should reject empty username", async () => {
      const result = await registerUser("", "password123");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Username and password are required");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_INPUT);
    });

    it("should reject short password", async () => {
      const result = await registerUser("user1", "123");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Password must be at least 8 characters");
    });

    it("should reject if username already exists", async () => {
      vi.mocked(redis.get).mockResolvedValue("existing-uuid");
      
      const result = await registerUser("user1", "password123");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Username already taken");
    });

    it("should register user successfully with split keys", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue("hashed_password" as never);
      
      const result = await registerUser("User1", "password123");
      
      expect(result.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      
      // Check username lookup key (normalized to lowercase)
      expect(redis.set).toHaveBeenCalledWith("username:user1", "test-uuid");
      
      // Check user profile key
      expect(redis.set).toHaveBeenCalledWith("user:test-uuid", {
        id: "test-uuid",
        username: "user1",
        passwordHash: "hashed_password",
        createdAt: expect.any(String),
      });
    });
  });

  describe("getUserById", () => {
    it("should return error if user doesn't exist", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      const result = await getUserById("nonexistent");
      expect(result.success).toBe(false);
    });

    it("should return user if exists", async () => {
      const mockUser = { id: "u1", username: "user1", passwordHash: "h1", createdAt: "..." };
      vi.mocked(redis.get).mockResolvedValue(mockUser);
      
      const result = await getUserById("u1");
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUser);
    });
  });

  describe("verifyUserCredentials", () => {
    it("should verify valid credentials", async () => {
      const mockUser = { id: "test-uuid", username: "user1", passwordHash: "hashed" };
      vi.mocked(redis.get).mockImplementation(async (key) => {
        if (key === "username:user1") return "test-uuid";
        if (key === "user:test-uuid") return mockUser;
        return null;
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      
      const result = await verifyUserCredentials("user1", "password");
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ userId: "test-uuid", username: "user1" });
    });
  });

  describe("usersExist", () => {
    it("should return false if no username keys found", async () => {
      vi.mocked(redis.keys).mockResolvedValue([]);
      const result = await usersExist();
      expect(result).toBe(false);
    });

    it("should return true if username keys exist", async () => {
      vi.mocked(redis.keys).mockResolvedValue(["username:admin"]);
      const result = await usersExist();
      expect(result).toBe(true);
    });
  });
});
