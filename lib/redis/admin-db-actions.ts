"use server";

import bcrypt from "bcryptjs";
import { redis } from "./client";
import { ActionResponse } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";

const ADMIN_KEY = "admin:user";

export interface AdminUser {
  username: string;
  passwordHash: string;
  createdAt: string;
}

export async function registerAdmin(
  username: string,
  password: string
): Promise<ActionResponse<void>> {
  try {
    // Basic validation
    if (!username?.trim() || !password?.trim()) {
      return {
        success: false,
        error: "Username and password are required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    // Check if admin already exists
    const existingAdmin = await redis.get(ADMIN_KEY);
    if (existingAdmin) {
      return {
        success: false,
        error: "Admin user already exists",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create admin user
    const adminUser: AdminUser = {
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    // Store in Redis (no expiration)
    await redis.set(ADMIN_KEY, adminUser);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error registering admin:", error);
    return {
      success: false,
      error: "Registration failed",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function getAdminUser(): Promise<ActionResponse<AdminUser>> {
  try {
    const adminUser = await redis.get<AdminUser>(ADMIN_KEY);
    
    if (!adminUser) {
      return {
        success: false,
        error: "No admin user found",
        code: ERROR_CODES.ERR_NO_SESSION,
      };
    }

    return {
      success: true,
      data: adminUser,
    };
  } catch (error) {
    console.error("Error getting admin user:", error);
    return {
      success: false,
      error: "Failed to get admin user",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<ActionResponse<{ success: boolean }>> {
  try {
    // Basic validation
    if (!username?.trim() || !password?.trim()) {
      return {
        success: false,
        error: "Username and password are required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    // Get admin user from database
    const adminResult = await getAdminUser();
    
    if (!adminResult.success || !adminResult.data) {
      return {
        success: false,
        error: "Invalid credentials",
        code: ERROR_CODES.ERR_INVALID_CREDENTIALS,
      };
    }

    const adminUser = adminResult.data;

    // Verify username
    if (adminUser.username !== username) {
      return {
        success: false,
        error: "Invalid credentials",
        code: ERROR_CODES.ERR_INVALID_CREDENTIALS,
      };
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminUser.passwordHash);
    
    if (!isValidPassword) {
      return {
        success: false,
        error: "Invalid credentials",
        code: ERROR_CODES.ERR_INVALID_CREDENTIALS,
      };
    }

    return {
      success: true,
      data: { success: true },
    };
  } catch (error) {
    console.error("Error verifying admin credentials:", error);
    return {
      success: false,
      error: "Authentication failed",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function adminExists(): Promise<boolean> {
  try {
    const adminData = await redis.get(ADMIN_KEY);
    return !!adminData;
  } catch {
    return false;
  }
}
