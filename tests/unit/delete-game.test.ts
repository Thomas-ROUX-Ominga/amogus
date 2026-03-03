/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client before any imports
vi.mock('@/lib/redis/client', () => ({
  redis: {
    del: vi.fn(),
    keys: vi.fn(),
    get: vi.fn(),
  },
  GAME_TTL_SECONDS: 86400,
}));

// Mock auth utils
vi.mock('@/lib/redis/auth-utils', () => ({
  verifySession: vi.fn(),
}));

import { deleteGame } from '@/lib/redis/actions';
import { redis } from '@/lib/redis/client';
import { verifySession } from '@/lib/redis/auth-utils';

describe('deleteGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default to authorized
    (verifySession as any).mockResolvedValue({ 
      success: true, 
      data: { userId: 'admin-id', username: 'admin' } 
    });
  });

  it('should delete a game and all its associated keys successfully', async () => {
    const gameId = 'TEST-123';
    const associatedKeys = [
      `game:${gameId}:state`,
      `game:${gameId}:player:p1:failed-quests`,
      `game:${gameId}:player:p2:failed-quests`,
    ];

    (redis.keys as any).mockResolvedValue(associatedKeys);
    (redis.del as any).mockResolvedValue(1);

    const result = await deleteGame(gameId);

    expect(result.success).toBe(true);
    expect(redis.keys).toHaveBeenCalledWith(`game:${gameId}:*`);
    expect(redis.del).toHaveBeenCalledTimes(associatedKeys.length);
    associatedKeys.forEach(key => {
      expect(redis.del).toHaveBeenCalledWith(key);
    });
  });

  it('should return success even if no keys are found', async () => {
    const gameId = 'EMPTY-GAME';
    (redis.keys as any).mockResolvedValue([]);

    const result = await deleteGame(gameId);

    expect(result.success).toBe(true);
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('should fail if unauthorized', async () => {
    (verifySession as any).mockResolvedValue({ success: false, error: 'Unauthorized' });

    const result = await deleteGame('any-id');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unauthorized');
    expect(redis.keys).not.toHaveBeenCalled();
  });

  it('should fail if gameId is missing', async () => {
    const result = await deleteGame('');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Game ID is required');
  });

  it('should handle Redis errors gracefully', async () => {
    (redis.keys as any).mockRejectedValue(new Error('Redis connection lost'));

    const result = await deleteGame('TEST-123');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to stop game session.');
    expect(result.code).toBe('ERR_SIGNAL_LOST');
  });
});
