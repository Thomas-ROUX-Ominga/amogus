/**
 * Alphabet for short codes - excludes ambiguous characters 0, 1, O, I
 */
const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SHORT_CODE_LENGTH = 6;

/**
 * Validate short code format
 */
export function isValidShortCode(code: string): boolean {
  if (!code) {
    return false;
  }
  
  // Enforce 6-character length strictly
  if (code.length !== SHORT_CODE_LENGTH) {
    return false;
  }
  
  // Check if all characters are from the allowed alphabet
  for (const char of code.toUpperCase()) {
    if (!SHORT_CODE_ALPHABET.includes(char)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Convert a short code to uppercase and validate
 */
export function normalizeShortCode(code: string): string {
  return code.toUpperCase();
}
