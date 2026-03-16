import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the entire Redis client module
vi.mock('@/lib/redis/client', () => ({
    redis: {
        get: vi.fn(),
        atomicUpdate: vi.fn(),
    },
    GAME_TTL_SECONDS: 86400,
}));

vi.mock('@/lib/redis/auth-utils', () => ({
    verifySession: vi.fn(() => Promise.resolve({ success: true })),
    createPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
    verifyPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
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
        const now = Date.now();
        const mockGameState = {
            id: 'test-game',
            status: 'IN_PROGRESS',
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [
                { id: 'user1', name: 'Player 1', isAlive: true },
                { id: 'user2', name: 'Player 2', isAlive: true },
            ],
        };

        vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
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
        const now = Date.now();
        const mockGameState = {
            id: 'test-game',
            status: 'IN_PROGRESS',
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [
                { id: 'user1', name: 'Player 1', isAlive: false },
                { id: 'user2', name: 'Player 2', isAlive: true },
            ],
        };

        vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            const result = updater(mockGameState);
            return result ?? mockGameState;
        });

        const result = await eliminatePlayer('test-game', 'user1');
        expect(result.success).toBe(true);
        expect(result.data).toEqual({ isAlive: false });
    });

    it('should return error when game not found', async () => {
        vi.mocked(redis.get).mockResolvedValueOnce(null);

        const result = await eliminatePlayer('nonexistent-game', 'user1');

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.GAME_NOT_FOUND);
    });

    it('should return error when game not in progress', async () => {
        const now = Date.now();
        vi.mocked(redis.get).mockResolvedValueOnce({
            id: 'test-game',
            status: 'LOBBY',
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [
                { id: 'user1', name: 'Player 1', isAlive: true },
                { id: 'user2', name: 'Player 2', isAlive: true },
            ],
        });
        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => updater({
            id: 'test-game',
            status: 'LOBBY',
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [
                { id: 'user1', name: 'Player 1', isAlive: true },
                { id: 'user2', name: 'Player 2', isAlive: true },
            ],
        }));

        const result = await eliminatePlayer('test-game', 'user1');

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_INVALID_STATE);
    });

    it('should return error when player not found', async () => {
        const now = Date.now();
        vi.mocked(redis.get).mockResolvedValueOnce({
            id: 'test-game',
            status: 'IN_PROGRESS',
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [{ id: 'user1', name: 'Player 1', isAlive: true }],
        });

        const result = await eliminatePlayer('test-game', 'nonexistent-user');

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_INVALID_SIGNATURE);
    });

    it('should handle Redis errors', async () => {
        const now = Date.now();
        vi.mocked(redis.get).mockResolvedValueOnce({
            id: 'test-game',
            status: 'IN_PROGRESS',
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [{ id: 'user1', name: 'Player 1', isAlive: true }],
        });
        vi.mocked(redis.atomicUpdate).mockRejectedValue(new Error('Redis connection failed'));

        const result = await eliminatePlayer('test-game', 'user1');

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to eliminate player.');
        expect(result.code).toBe(ERROR_CODES.ERR_SIGNAL_LOST);
    });

    it("should finish the game with IMPOSTOR win when alive counts become equal", async () => {
        const now = Date.now();
        const mockGameState = {
            id: "test-game",
            status: "IN_PROGRESS" as const,
            createdAt: now,
            revision: 1,
            updatedAt: now,
            players: [
                { id: "imp-1", name: "Impostor", role: "IMPOSTOR" as const, isAlive: true },
                { id: "crew-1", name: "Crewmate 1", role: "CREWMATE" as const, isAlive: true },
                { id: "crew-2", name: "Crewmate 2", role: "CREWMATE" as const, isAlive: true },
            ],
        };

        vi.mocked(redis.get).mockResolvedValueOnce(mockGameState);
        let updatedState: unknown;
        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            updatedState = updater(mockGameState);
            return updatedState;
        });

        const result = await eliminatePlayer("test-game", "crew-2");

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ isAlive: false });
        expect(updatedState).toEqual(
            expect.objectContaining({
                status: "FINISHED",
                winner: "IMPOSTOR",
            })
        );
    });
});
