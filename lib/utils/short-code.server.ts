import { redis } from "@/lib/redis/client";

/**
 * Alphabet for short codes - excludes ambiguous characters 0, 1, O, I
 */
const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SHORT_CODE_LENGTH = 6;
const MAX_RETRIES = 10;

/**
 * Generate a unique 6-character short code
 * Uses collision detection with Redis to ensure uniqueness
 */
export async function generateShortCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Generate random short code using cryptographically secure randomness
    let shortCode = "";
    const randomBytes = new Uint32Array(SHORT_CODE_LENGTH);
    crypto.getRandomValues(randomBytes);
    
    for (let i = 0; i < SHORT_CODE_LENGTH; i++) {
      shortCode += SHORT_CODE_ALPHABET[randomBytes[i] % SHORT_CODE_ALPHABET.length];
    }

    // Check for collision in Redis
    const gameKey = `game:${shortCode}:state`;
    const exists = await redis.exists(gameKey);
    
    if (exists === 0) {
      return shortCode;
    }
    
    // If collision detected, try again
    console.warn(`Short code collision detected: ${shortCode}, retrying...`);
  }

  throw new Error(`Failed to generate unique short code after ${MAX_RETRIES} attempts`);
}
