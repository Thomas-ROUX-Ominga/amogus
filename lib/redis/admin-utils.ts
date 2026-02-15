import { redis } from "./client";

const ADMIN_KEY = "admin:user";

export async function adminExists(): Promise<boolean> {
  try {
    const adminData = await redis.get(ADMIN_KEY);
    return !!adminData;
  } catch (error) {
    console.warn("Failed to check admin existence (likely Edge runtime), assuming true to allow login:", error);
    // If we can't check (e.g. Edge runtime), assume admin exists to let them try invalid login
    // rather than forcing a redirect to register which might be wrong.
    return true;
  }
}
