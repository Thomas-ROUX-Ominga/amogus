"use server";

import { ActionResponse } from "@/types/game";
import { 
  verifyUserCredentials, 
  registerUser as registerUserDB 
} from "./admin-db-actions";
import { 
  createSession, 
  clearSession as clearSessionUtils 
} from "./auth-utils";

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
