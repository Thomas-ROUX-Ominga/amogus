import { describe, it, expect, vi, beforeEach } from "vitest";
import { startGame } from '@/lib/redis/actions';
import { verifySession } from '@/lib/redis/auth-utils';

// Mock dependencies
vi.mock('@/lib/redis/auth-utils', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/lib/redis/client', () => ({
  redis: {
    get: vi.fn(),
    atomicUpdate: vi.fn(),
  },
  GAME_TTL_SECONDS: 86400,
}));

describe('Task 3: Restrict Game Launch to Host', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Subtask 3.2: Server-side validation for game launch', () => {
    it('should allow host to start the game', async () => {
      // Mock organizer session
      vi.mocked(verifySession).mockResolvedValue({
        success: true,
        data: { userId: 'admin-user-id', username: 'admin', role: 'organizer' }
      });

      const mockGameState = {
        id: 'TEST123',
        status: 'LOBBY',
        players: [
          { id: 'admin-user-id', name: 'Admin', isAlive: true },
          { id: 'player-user-id', name: 'Player', isAlive: true },
          { id: 'player-user-id-2', name: 'Player 2', isAlive: true },
        ],
        createdAt: Date.now(),
        revision: 1,
        updatedAt: Date.now(),
        creatorId: 'admin-user-id',
      };

      const { redis } = await import('@/lib/redis/client');
      vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
        const result = updater(mockGameState);
        return result || mockGameState;
      });

      const result = await startGame('TEST123');

      expect(result.success).toBe(true);
      expect(redis.atomicUpdate).toHaveBeenCalled();
    });

    it('should reject non-host trying to start the game', async () => {
      // Mock no session (regular player)
      vi.mocked(verifySession).mockResolvedValue({
        success: false,
        error: 'No session found',
        code: 'ERR_NO_SESSION'
      });

      const mockGameState = {
        id: 'TEST123',
        status: 'LOBBY',
        players: [
          { id: 'admin-user-id', name: 'Admin', isAlive: true },
          { id: 'player-user-id', name: 'Player', isAlive: true }
        ],
        createdAt: Date.now(),
        revision: 1,
        updatedAt: Date.now(),
        creatorId: 'admin-user-id',
      };

      const { redis } = await import('@/lib/redis/client');
      vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, _updater) => {
        // This should not be called for non-host attempts
        throw new Error('atomicUpdate should not be called for non-host');
      });

      const result = await startGame('TEST123');

      // Should fail with unauthorized error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
      expect(result.code).toBe('ERR_UNAUTHORIZED');
    });

    it('should reject if creatorId does not match session user', async () => {
      // Mock organizer session for different user
      vi.mocked(verifySession).mockResolvedValue({
        success: true,
        data: { userId: 'different-admin-id', username: 'admin2', role: 'organizer' }
      });

      const mockGameState = {
        id: 'TEST123',
        status: 'LOBBY',
        players: [
          { id: 'admin-user-id', name: 'Admin', isAlive: true }
        ],
        createdAt: Date.now(),
        revision: 1,
        updatedAt: Date.now(),
        creatorId: 'admin-user-id', // Different from session user
      };

      const { redis } = await import('@/lib/redis/client');
      vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
        // Call the updater function to test the validation logic
        const result = updater(mockGameState);
        return result || mockGameState;
      });

      const result = await startGame('TEST123');

      // Should fail with unauthorized error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
      expect(result.code).toBe('ERR_UNAUTHORIZED');
    });
  });
});
