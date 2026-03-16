import { vi, describe, it, expect, beforeEach } from "vitest";
import { redis } from "@/lib/redis/client";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { verifySession } from "@/lib/redis/auth-utils";

// Mock redis client
vi.mock("@/lib/redis/client", () => ({
    GAME_TTL_SECONDS: 86400,
    redis: {
        set: vi.fn(),
        get: vi.fn(),
        del: vi.fn(),
        atomicUpdate: vi.fn(),
    },
}));

// Mock admin session
vi.mock("@/lib/redis/auth-utils", () => ({
    verifySession: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
}));

// Import after mocks
import { startGame } from "@/lib/redis/actions";

// Helper: mock atomicUpdate to call the updater with the given state
function mockAtomicUpdate(state: unknown) {
    vi.mocked(redis.atomicUpdate).mockImplementationOnce(
        async (_key: string, updater: (current: unknown) => unknown) => {
            const result = updater(state);
            return result ?? state; // If updater returns null, return original state
        }
    );
}

describe("startGame", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default admin session mock for all tests
        vi.mocked(verifySession).mockResolvedValue({
            success: true,
            data: { userId: "player-1", username: "Alice", role: "organizer" }
        });
    });

    it("should transition game from LOBBY to IN_PROGRESS", async () => {
        const mockState = {
            id: "test-game-id",
            status: "LOBBY",
            players: [
                { id: "player-1", name: "Alice", isAlive: true },
                { id: "player-2", name: "Bob", isAlive: true },
                { id: "player-3", name: "Chloe", isAlive: true },
            ],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            creatorId: "player-1",
        };
        mockAtomicUpdate(mockState);

        const result = await startGame("test-game-id");

        expect(result.success).toBe(true);
        expect(result.data).toEqual(
            expect.objectContaining({
                id: "test-game-id",
                status: "IN_PROGRESS",
            })
        );
        expect(redis.atomicUpdate).toHaveBeenCalledWith(
            "game:v2:test-game-id:state",
            expect.any(Function),
            86400
        );
    });

    it("should return error if game not found", async () => {
        mockAtomicUpdate(null);

        const result = await startGame("nonexistent-id");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.GAME_NOT_FOUND);
    });

    it("should be idempotent when game is already IN_PROGRESS", async () => {
        const mockState = {
            id: "test-game-id",
            status: "IN_PROGRESS",
            players: [{ id: "player-1", name: "Alice", isAlive: true }],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            creatorId: "player-1",
        };
        mockAtomicUpdate(mockState);

        const result = await startGame("test-game-id");

        expect(result.success).toBe(true);
        expect(result.data).toEqual(
            expect.objectContaining({
                status: "IN_PROGRESS",
            })
        );
    });

    it("should return error if game is in invalid state (FINISHED)", async () => {
        const mockState = {
            id: "test-game-id",
            status: "FINISHED",
            players: [{ id: "player-1", name: "Alice", isAlive: true }],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            creatorId: "player-1",
        };
        mockAtomicUpdate(mockState);

        const result = await startGame("test-game-id");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_INVALID_STATE);
    });

    it("should return error if no players have joined", async () => {
        const mockState = {
            id: "test-game-id",
            status: "LOBBY",
            players: [],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            creatorId: "player-1",
        };
        mockAtomicUpdate(mockState);

        const result = await startGame("test-game-id");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_NO_PLAYERS);
    });

    it("should return error if fewer than 3 players have joined", async () => {
        const mockState = {
            id: "test-game-id",
            status: "LOBBY",
            players: [
                { id: "player-1", name: "Alice", isAlive: true },
                { id: "player-2", name: "Bob", isAlive: true },
            ],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
            creatorId: "player-1",
        };
        mockAtomicUpdate(mockState);

        const result = await startGame("test-game-id");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_NO_PLAYERS);
        expect(result.error).toContain("requires at least 3 players");
    });

    it("should return error if Redis fails", async () => {
        vi.mocked(redis.atomicUpdate).mockRejectedValueOnce(new Error("Redis Error"));

        const result = await startGame("test-game-id");

        expect(result.success).toBe(false);
        expect(result.code).toBe(ERROR_CODES.ERR_SIGNAL_LOST);
    });
});
