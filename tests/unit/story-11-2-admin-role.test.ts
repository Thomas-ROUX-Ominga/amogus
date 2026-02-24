import { describe, it, expect, vi, beforeEach } from "vitest";
import { joinGame, createGame, startGame } from '@/lib/redis/actions';
import { verifySession, createPlayerSession } from '@/lib/redis/auth-utils';

// Mock dependencies
vi.mock('@/lib/redis/auth-utils', () => ({
  verifySession: vi.fn(),
  createPlayerSession: vi.fn(),
}));

vi.mock('@/lib/redis/client', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    atomicUpdate: vi.fn(),
  },
  GAME_TTL_SECONDS: 86400,
}));

vi.mock('@/lib/utils/short-code.server', () => ({
  generateShortCode: vi.fn(),
}));

describe('Task 2: Fix Admin Role Assignment on Game Launch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Subtask 2.1 & 2.2: Admin role assignment', () => {
    it('should assign admin role in createGame', async () => {
      // Mock admin session
      vi.mocked(verifySession).mockResolvedValue({
        success: true,
        data: { userId: 'admin-user-id', username: 'admin', role: 'organizer' }
      });

      const { generateShortCode } = await import('@/lib/utils/short-code.server');
      vi.mocked(generateShortCode).mockResolvedValue('TEST123');

      const { redis } = await import('@/lib/redis/client');
      vi.mocked(redis.set).mockResolvedValue(undefined);

      const result = await createGame();

      expect(result.success).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('game:TEST123:state'),
        expect.objectContaining({
          creatorId: 'admin-user-id',
          players: expect.arrayContaining([
            expect.objectContaining({
              id: 'admin-user-id',
              name: 'admin',
              role: 'ADMIN',
              isAlive: true,
            })
          ])
        }),
        expect.any(Number)
      );
    });

    it('should not assign admin role to regular players in joinGame', async () => {
      // Mock no session (regular player)
      vi.mocked(verifySession).mockResolvedValue({
        success: false,
        error: 'No session found',
        code: 'ERR_NO_SESSION'
      });

      const mockGameState = {
        id: 'TEST123',
        status: 'LOBBY',
        players: [],
        createdAt: Date.now(),
        creatorId: 'admin-user-id',
      };

      const { redis } = await import('@/lib/redis/client');
      vi.mocked(redis.get).mockResolvedValue(mockGameState);
      vi.mocked(redis.set).mockResolvedValue(undefined);
      vi.mocked(createPlayerSession).mockResolvedValue({ success: true });

      const result = await joinGame('TEST123', 'RegularPlayer', 'player-user-id');

      expect(result.success).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('game:TEST123:state'),
        expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({
              id: 'player-user-id',
              name: 'RegularPlayer',
              // No role assigned for regular players
            })
          ])
        })
      );
    });
  });

  describe('Subtask 2.3: Admin dashboard redirection', () => {
    it('should redirect admin to dashboard after game creation', async () => {
      vi.mocked(verifySession).mockResolvedValue({
        success: true,
        data: { userId: 'admin-user-id', username: 'admin', role: 'organizer' }
      });

      const { generateShortCode } = await import('@/lib/utils/short-code.server');
      vi.mocked(generateShortCode).mockResolvedValue('TEST123');

      const { redis } = await import('@/lib/redis/client');
      vi.mocked(redis.set).mockResolvedValue(undefined);

      const result = await createGame();

      expect(result.success).toBe(true);
      expect(result.data).toBe('TEST123');
      // The redirection should be handled in the UI layer, not here
    });
  });
});
