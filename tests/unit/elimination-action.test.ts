import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire Redis client module
vi.mock('@/lib/redis/client', () => ({
    redis: {
        atomicUpdate: vi.fn(),
    },
    GAME_TTL_SECONDS: 86400,
}));

// Import after mocking
import { eliminatePlayer } from '@/lib/redis/actions';
import { ERROR_CODES } from '@/lib/constants/error-codes';
import { redis } from '@/lib/redis/client';

describe('eliminatePlayer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should successfully eliminate a player', async () => {
        const mockGameState = {
            id: 'test-game',
            status: 'IN_PROGRESS',
            players: [
                { id: 'user1', name: 'Player 1', isAlive: true },
                { id: 'user2', name: 'Player 2', isAlive: true },
            ],
        };

        vi.mocked(redis.atomicUpdate).mockResolvedValue({
            ...mockGameState,
            players: [
                { id: 'user1', name: 'Player 1', isAlive: false },
                { id: 'user2', name: 'Player 2', isAlive: true },
            ],
        });

        const result = await eliminatePlayer('test-game', 'user1');

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ isAlive: false });
        expect(vi.mocked(redis.atomicUpdate)).toHaveBeenCalledWith(
            'game:v2:test-game:state',
            expect.any(Function),
            expect.any(Number)
        );
    });

    it('should handle already eliminated player (idempotent)', async () => {
        const mockGameState = {
            id: 'test-game',
            status: 'IN_PROGRESS',
            players: [
                { id: 'user1', name: 'Player 1', isAlive: false },
                { id: 'user2', name: 'Player 2', isAlive: true },
            ],
        };

        vi.mocked(redis.atomicUpdate).mockResolvedValue(null); // No update needed

        const result = await eliminatePlayer('test-game', 'user1');
    });

    it('should return error when game not found', async () => {
        vi.mocked(redis.atomicUpdate).mockRejectedValue(new Error('Game not found'));

        const result = await eliminatePlayer('nonexistent-game', 'user1');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to eliminate player.');
    });

    it('should return error when game not in progress', async () => {
        vi.mocked(redis.atomicUpdate).mockRejectedValue(new Error('Game not in progress'));

        const result = await eliminatePlayer('test-game', 'user1');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to eliminate player.');
    });

    it('should return error when player not found', async () => {
        vi.mocked(redis.atomicUpdate).mockRejectedValue(new Error('Player not found'));

        const result = await eliminatePlayer('test-game', 'nonexistent-user');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to eliminate player.');
    });

    it('should handle Redis errors', async () => {
        vi.mocked(redis.atomicUpdate).mockRejectedValue(new Error('Redis connection failed'));

        const result = await eliminatePlayer('test-game', 'user1');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to eliminate player.');
        expect(result.code).toBe(ERROR_CODES.ERR_SIGNAL_LOST);
    });
});
