"use server";

import bcrypt from "bcryptjs";
import { redis } from "./client";
import { ActionResponse } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export async function registerUser(
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

    const normalizedUsername = username.trim().toLowerCase();

    // Check if username already exists
    const existingUserId = await redis.get<string>(`username:${normalizedUsername}`);
    if (existingUserId) {
      return {
        success: false,
        error: "Username already taken",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    // Generate unique ID
    const userId = crypto.randomUUID();

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const newUser: User = {
      id: userId,
      username: normalizedUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    // Store in Redis
    // 1. User profile
    await redis.set(`user:${userId}`, newUser);
    // 2. Username lookup
    await redis.set(`username:${normalizedUsername}`, userId);
    // 3. System initialization flag (Optimized check for middleware)
    await redis.set("system:initialized", "true");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error registering user:", error);
    return {
      success: false,
      error: "Registration failed",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function getUserById(userId: string): Promise<ActionResponse<User>> {
  try {
    const user = await redis.get<User>(`user:${userId}`);
    
    if (!user) {
      return {
        success: false,
        error: "User not found",
        code: ERROR_CODES.ERR_NO_SESSION,
      };
    }

    return {
      success: true,
      data: user,
    };
  } catch (error) {
    console.error("Error getting user by ID:", error);
    return {
      success: false,
      error: "Failed to get user",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function getUserByUsername(username: string): Promise<ActionResponse<User>> {
  try {
    const normalizedUsername = username.trim().toLowerCase();
    const userId = await redis.get<string>(`username:${normalizedUsername}`);
    
    if (!userId) {
      return {
        success: false,
        error: "User not found",
        code: ERROR_CODES.ERR_INVALID_CREDENTIALS,
      };
    }

    return await getUserById(userId);
  } catch (error) {
    console.error("Error getting user by username:", error);
    return {
      success: false,
      error: "Failed to get user",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

export async function verifyUserCredentials(
  username: string,
  password: string
): Promise<ActionResponse<{ userId: string; username: string }>> {
  try {
    // Basic validation
    if (!username?.trim() || !password?.trim()) {
      return {
        success: false,
        error: "Username and password are required",
        code: ERROR_CODES.ERR_INVALID_INPUT,
      };
    }

    // Get user from database
    const userResult = await getUserByUsername(username);
    
    if (!userResult.success || !userResult.data) {
      return {
        success: false,
        error: "Invalid credentials",
        code: ERROR_CODES.ERR_INVALID_CREDENTIALS,
      };
    }

    const user = userResult.data;

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValidPassword) {
      return {
        success: false,
        error: "Invalid credentials",
        code: ERROR_CODES.ERR_INVALID_CREDENTIALS,
      };
    }

    return {
      success: true,
      data: { userId: user.id, username: user.username },
    };
  } catch (error) {
    console.error("Error verifying user credentials:", error);
    return {
      success: false,
      error: "Authentication failed",
      code: ERROR_CODES.ERR_SIGNAL_LOST,
    };
  }
}

/**
 * Checks if at least one user exists in the system.
 * Useful for the initial setup/redirection logic.
 */
export async function usersExist(): Promise<boolean> {
  try {
    const initialized = await redis.get<string>("system:initialized");
    if (initialized === "true") return true;
    
    // Fallback for legacy data (one-time cost)
    const keys = await redis.keys("username:*");
    if (keys.length > 0) {
      await redis.set("system:initialized", "true");
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Deprecated functions for backward compatibility (will be removed later)
export async function registerAdmin(u: string, p: string) { return registerUser(u, p); }
export async function verifyAdminCredentials(u: string, p: string) { 
  const res = await verifyUserCredentials(u, p);
  if (res.success) return { success: true, data: { success: true } };
  return { success: false, error: res.error, code: res.code };
}
export async function adminExists() { return usersExist(); }

