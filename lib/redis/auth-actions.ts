"use server";

import { ActionResponse } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { 
  verifyUserCredentials, 
  registerUser as registerUserDB 
} from "./admin-db-actions";
import { 
  createSession, 
  clearSession as clearSessionUtils,
  clearPlayerSession,
  verifyPlayerSession,
} from "./auth-utils";
import { redis } from "./client";
import { getPlayerPresenceKey } from "./game-state-keys";

export async function clearSession() {
  return await clearSessionUtils();
}

/**
 * @deprecated Use clearSession
 */
export async function clearAdminSession() {
  return await clearSession();
}

export async function login(
  username: string,
  password: string
): Promise<ActionResponse<void>> {
  // First verify credentials
  const verificationResult = await verifyUserCredentials(username, password);
  
  if (!verificationResult.success || !verificationResult.data) {
    return {
      success: false,
      error: verificationResult.error,
      code: verificationResult.code,
    };
  }

  // Then create session with userId and username
  return await createSession(
    verificationResult.data.userId, 
    verificationResult.data.username
  );
}

/**
 * @deprecated Use login
 */
export async function adminLogin(u: string, p: string) {
  return await login(u, p);
}

export async function register(
  username: string,
  password: string
): Promise<ActionResponse<void>> {
  return await registerUserDB(username, password);
}

export async function disconnectPlayer(
  gameId: string,
  userId: string
): Promise<ActionResponse<void>> {
  const normalizedGameId = gameId.trim();
  const normalizedUserId = userId.trim();

  if (!normalizedGameId || !normalizedUserId) {
    return {
      success: false,
      error: "Invalid disconnect payload.",
      code: ERROR_CODES.ERR_INVALID_INPUT,
    };
  }

  const verification = await verifyPlayerSession(normalizedUserId, normalizedGameId);
  if (!verification.success) {
    return {
      success: false,
      error: verification.error || "Player session verification failed.",
      code: verification.code || ERROR_CODES.ERR_INVALID_SESSION,
    };
  }

  try {
    await redis.del(getPlayerPresenceKey(normalizedGameId, normalizedUserId));
  } catch (error) {
    console.error("Failed to clear player presence:", error);
  }

  return await clearPlayerSession();
}
