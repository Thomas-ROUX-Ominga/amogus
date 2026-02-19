import { usersExist } from "./admin-db-actions";

export async function adminExists(): Promise<boolean> {
  try {
    return await usersExist();
  } catch (error) {
    console.warn("Failed to check admin existence, assuming true to allow login:", error);
    return true;
  }
}
