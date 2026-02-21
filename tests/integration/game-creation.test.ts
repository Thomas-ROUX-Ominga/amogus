import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGame, CreateGameInput } from '@/lib/redis/actions';
import { generateShortCode } from '@/lib/utils/short-code.server';
import { ERROR_CODES } from '@/lib/constants/error-codes';

// Mock dependencies
vi.mock('@/lib/redis/client', () => ({
  redis: {
    exists: vi.fn().mockResolvedValue(0),
    set: vi.fn().mockResolvedValue('OK'),
  },
  GAME_TTL_SECONDS: 86400,
}));

vi.mock('@/lib/redis/auth-utils', () => ({
  verifySession: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/redis/batch-actions', () => ({
  getBatch: vi.fn(),
  getAllBatches: vi.fn(),
}));

vi.mock('@/lib/utils/short-code.server', () => ({
  generateShortCode: vi.fn().mockResolvedValue('AH72X9'),
}));

vi.mock('@/lib/constants/quest-pool', () => ({
  getTotalQuestGamesCount: vi.fn().mockReturnValue(30),
}));

describe('Game Creation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGame with batch selection', () => {
    it('should create game with selected batch and default quest distribution', async () => {
      const { getBatch } = await import('@/lib/redis/batch-actions');
      vi.mocked(getBatch).mockResolvedValue({
        success: true,
        data: {
          id: 'batch-123',
          questCount: 12,
          quests: Array(12).fill(null).map((_, i) => ({
            id: `quest-${i}`,
            type: 'true-false' as const,
            duration: 'short' as const,
            location: `Zone ${i}`,
          })),
          createdAt: new Date().toISOString(),
        },
      });

      const input: CreateGameInput = {
        batchId: 'batch-123',
      };

      const result = await createGame(input);

      expect(result.success).toBe(true);
      expect(result.data).toBe('AH72X9');
      expect(generateShortCode).toHaveBeenCalled();
      
      // Verify Redis was called with short code key pattern
      const { redis } = await import('@/lib/redis/client');
      expect(redis.set).toHaveBeenCalledWith(
        'game:AH72X9:state',
        expect.objectContaining({
          id: 'AH72X9',
          batchId: 'batch-123',
          questsTotal: 12,
          questsPerPlayer: { short: 1, medium: 1, long: 1 },
        }),
        86400
      );
    });

    it('should create game with custom quest distribution', async () => {
      const { getBatch } = await import('@/lib/redis/batch-actions');
      vi.mocked(getBatch).mockResolvedValue({
        success: true,
        data: {
          id: 'batch-456',
          questCount: 15,
          quests: Array(15).fill(null).map((_, i) => ({
            id: `quest-${i}`,
            type: 'true-false' as const,
            duration: 'short' as const,
            location: `Zone ${i}`,
          })),
          createdAt: new Date().toISOString(),
        },
      });

      const input: CreateGameInput = {
        batchId: 'batch-456',
        questsPerPlayer: {
          short: 3,
          medium: 1,
          long: 2,
        },
      };

      const result = await createGame(input);

      expect(result.success).toBe(true);
      
      const { redis } = await import('@/lib/redis/client');
      expect(redis.set).toHaveBeenCalledWith(
        'game:AH72X9:state',
        expect.objectContaining({
          questsPerPlayer: { short: 3, medium: 1, long: 2 },
        }),
        86400
      );
    });

    it('should reject game creation when requested quests exceed available', async () => {
      const { getBatch } = await import('@/lib/redis/batch-actions');
      vi.mocked(getBatch).mockResolvedValue({
        success: true,
        data: {
          id: 'batch-small',
          questCount: 5,
          quests: Array(5).fill(null).map((_, i) => ({
            id: `quest-${i}`,
            type: 'true-false' as const,
            duration: 'short' as const,
            location: `Zone ${i}`,
          })),
          createdAt: new Date().toISOString(),
        },
      });

      const input: CreateGameInput = {
        batchId: 'batch-small',
        questsPerPlayer: {
          short: 3,
          medium: 3,
          long: 3, // Total 9 > 5 available
        },
      };

      const result = await createGame(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Requested 9 quests per player, but only 5 available');
    });

    it('should create game without batch (using default pool)', async () => {
      const input: CreateGameInput = {
        questsPerPlayer: {
          short: 1,
          medium: 1,
          long: 1,
        },
      };

      const result = await createGame(input);

      expect(result.success).toBe(true);
      
      const { redis } = await import('@/lib/redis/client');
      expect(redis.set).toHaveBeenCalledWith(
        'game:AH72X9:state',
        expect.objectContaining({
          batchId: undefined,
          questsTotal: 30, // From default pool
          questsPerPlayer: { short: 1, medium: 1, long: 1 },
        }),
        86400
      );
    });

    it('should fail game creation when batch is not found', async () => {
      const { getBatch } = await import('@/lib/redis/batch-actions');
      vi.mocked(getBatch).mockResolvedValue({
        success: false,
        error: 'Batch not found',
      });

      const input: CreateGameInput = {
        batchId: 'non-existent-batch',
      };

      const result = await createGame(input);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load batch');
    });
  });

  describe('authentication', () => {
    it('should reject game creation for unauthenticated users', async () => {
      const { verifySession } = await import('@/lib/redis/auth-utils');
      vi.mocked(verifySession).mockResolvedValue({
        success: false,
        error: 'Unauthorized',
      });

      const input: CreateGameInput = {};
      const result = await createGame(input);

      expect(result.success).toBe(false);
      expect(result.code).toBe(ERROR_CODES.ERR_UNAUTHORIZED);
      expect(result.error).toBe('Unauthorized access: Organizer credentials required.');
    });
  });
});
