"use server";

import { ActionResponse } from "@/types/game";
import { verifyAdminCredentials as verifyAdminCredentialsDB } from "./admin-db-actions";
import { createAdminSession, clearAdminSession as clearSessionUtils } from "./auth-utils";

export async function clearAdminSession() {
  return await clearSessionUtils();
}

export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<ActionResponse<{ success: boolean }>> {
  return await verifyAdminCredentialsDB(username, password);
}

export async function adminLogin(
  username: string,
  password: string
): Promise<ActionResponse<void>> {
  // First verify credentials
  const verificationResult = await verifyAdminCredentials(username, password);
  
  if (!verificationResult.success) {
    return {
      success: false,
      error: verificationResult.error,
      code: verificationResult.code,
    };
  }

  // Then create session
  return await createAdminSession();
}
