import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateShortCode } from '@/lib/utils/short-code.server';
import { isValidShortCode, normalizeShortCode } from '@/lib/utils/short-code';
import { redis } from '@/lib/redis/client';

// Mock Redis
vi.mock('@/lib/redis/client', () => ({
  redis: {
    exists: vi.fn(),
  },
}));

describe('Short Code Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateShortCode', () => {
    it('should generate a 6-character code', async () => {
      vi.mocked(redis.exists).mockResolvedValue(0);
      
      const shortCode = await generateShortCode();
      
      expect(shortCode).toHaveLength(6);
      expect(shortCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
    });

    it('should retry on collision and return unique code', async () => {
      // First attempt: collision
      // Second attempt: success
      vi.mocked(redis.exists)
        .mockResolvedValueOnce(1) // Collision
        .mockResolvedValueOnce(0); // Success
      
      const shortCode = await generateShortCode();
      
      expect(shortCode).toHaveLength(6);
      expect(redis.exists).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      // All attempts result in collision
      vi.mocked(redis.exists).mockResolvedValue(1);
      
      await expect(generateShortCode()).rejects.toThrow(
        'Failed to generate unique short code after 10 attempts'
      );
      
      expect(redis.exists).toHaveBeenCalledTimes(10);
    });

    it('should use only allowed characters', async () => {
      vi.mocked(redis.exists).mockResolvedValue(0);
      
      const shortCode = await generateShortCode();
      const allowedChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      
      for (const char of shortCode) {
        expect(allowedChars).toContain(char);
      }
    });
  });

  describe('isValidShortCode', () => {
    it('should return true for valid short codes', () => {
      expect(isValidShortCode('AH72X9')).toBe(true);
      expect(isValidShortCode('234567')).toBe(true);
      expect(isValidShortCode('ABCDEF')).toBe(true);
    });

    it('should return false for invalid length', () => {
      expect(isValidShortCode('')).toBe(false);
      expect(isValidShortCode('AH72X')).toBe(false); // 5 chars
      expect(isValidShortCode('AH72X99')).toBe(false); // 7 chars
    });

    it('should return false for excluded characters', () => {
      expect(isValidShortCode('AH72X0')).toBe(false); // Contains 0
      expect(isValidShortCode('AH72X1')).toBe(false); // Contains 1
      expect(isValidShortCode('AH72XO')).toBe(false); // Contains O
      expect(isValidShortCode('AH72XI')).toBe(false); // Contains I
    });

    it('should handle lowercase input', () => {
      expect(isValidShortCode('ah72x9')).toBe(true);
      expect(isValidShortCode('Ah72X9')).toBe(true);
    });

    it('should return false for invalid characters', () => {
      expect(isValidShortCode('AH72X!')).toBe(false);
      expect(isValidShortCode('AH72X@')).toBe(false);
      expect(isValidShortCode('AH72X#')).toBe(false);
    });
  });

  describe('normalizeShortCode', () => {
    it('should convert to uppercase', () => {
      expect(normalizeShortCode('ah72x9')).toBe('AH72X9');
      expect(normalizeShortCode('Ah72X9')).toBe('AH72X9');
      expect(normalizeShortCode('AH72X9')).toBe('AH72X9');
    });

    it('should preserve special characters', () => {
      expect(normalizeShortCode('ah72x0')).toBe('AH72X0');
      expect(normalizeShortCode('ah72x!')).toBe('AH72X!');
    });
  });
});
