import { describe, it, expect, vi, beforeEach } from "vitest";
import { ERROR_CODES } from "@/lib/constants/error-codes";

// Mock Redis client
vi.mock("@/lib/redis/client", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

// Mock bcryptjs
vi.mock("bcryptjs");

import { registerAdmin, getAdminUser, verifyAdminCredentials, adminExists } from "@/lib/redis/admin-db-actions";
import { redis } from "@/lib/redis/client";
import bcrypt from "bcryptjs";

describe("Admin DB Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerAdmin", () => {
    it("should reject empty username", async () => {
      const result = await registerAdmin("", "password123");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Username and password are required");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_INPUT);
    });

    it("should reject empty password", async () => {
      const result = await registerAdmin("admin", "");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Username and password are required");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_INPUT);
    });

    it("should reject short password", async () => {
      const result = await registerAdmin("admin", "123");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Password must be at least 8 characters");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_INPUT);
    });

    it("should reject if admin already exists", async () => {
      vi.mocked(redis.get).mockResolvedValue({ username: "existing" });
      
      const result = await registerAdmin("admin", "password123");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Admin user already exists");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_INPUT);
    });

    it("should register admin successfully", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(bcrypt.hash).mockResolvedValue("hashed_password" as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(redis.set).mockResolvedValue("OK" as any);
      
      const result = await registerAdmin("admin", "password123");
      
      expect(result.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", 10);
      expect(redis.set).toHaveBeenCalledWith("admin:user", {
        username: "admin",
        passwordHash: "hashed_password",
        createdAt: expect.any(String),
      });
    });
  });

  describe("getAdminUser", () => {
    it("should return null if no admin exists", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      
      const result = await getAdminUser();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("No admin user found");
      expect(result.code).toBe(ERROR_CODES.ERR_NO_SESSION);
    });

    it("should return admin user if exists", async () => {
      const mockAdmin = {
        username: "admin",
        passwordHash: "hashed_password",
        createdAt: "2023-01-01T00:00:00.000Z",
      };
      vi.mocked(redis.get).mockResolvedValue(mockAdmin);
      
      const result = await getAdminUser();
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAdmin);
    });
  });

  describe("verifyAdminCredentials", () => {
    it("should reject empty credentials", async () => {
      const result = await verifyAdminCredentials("", "");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Username and password are required");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_INPUT);
    });

    it("should reject if no admin exists", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      
      const result = await verifyAdminCredentials("admin", "password123");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_CREDENTIALS);
    });

    it("should reject wrong username", async () => {
      const mockAdmin = {
        username: "admin",
        passwordHash: "hashed_password",
        createdAt: "2023-01-01T00:00:00.000Z",
      };
      vi.mocked(redis.get).mockResolvedValue(mockAdmin);
      
      const result = await verifyAdminCredentials("wronguser", "password123");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_CREDENTIALS);
    });

    it("should reject wrong password", async () => {
      const mockAdmin = {
        username: "admin",
        passwordHash: "hashed_password",
        createdAt: "2023-01-01T00:00:00.000Z",
      };
      vi.mocked(redis.get).mockResolvedValue(mockAdmin);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(bcrypt.compare).mockResolvedValue(false as any);
      
      const result = await verifyAdminCredentials("admin", "wrongpassword");
      
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid credentials");
      expect(result.code).toBe(ERROR_CODES.ERR_INVALID_CREDENTIALS);
    });

    it("should accept valid credentials", async () => {
      const mockAdmin = {
        username: "admin",
        passwordHash: "hashed_password",
        createdAt: "2023-01-01T00:00:00.000Z",
      };
      vi.mocked(redis.get).mockResolvedValue(mockAdmin);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
      
      const result = await verifyAdminCredentials("admin", "password123");
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true });
    });
  });

  describe("adminExists", () => {
    it("should return false if no admin exists", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);
      
      const result = await adminExists();
      
      expect(result).toBe(false);
    });

    it("should return true if admin exists", async () => {
      vi.mocked(redis.get).mockResolvedValue({ username: "admin" });
      
      const result = await adminExists();
      
      expect(result).toBe(true);
    });

    it("should return false on Redis error", async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error("Redis error"));
      
      const result = await adminExists();
      
      expect(result).toBe(false);
    });
  });
});
