import { describe, it, expect, beforeEach, vi } from "vitest";
import { selectRole } from "@/lib/redis/actions";
import { redis } from "@/lib/redis/client";
import { GameState } from "@/types/game";
import { ERROR_CODES } from "@/lib/constants/error-codes";

vi.mock("@/lib/redis/client", () => ({
    redis: {
        atomicUpdate: vi.fn(),
        get: vi.fn(),
    },
    GAME_TTL_SECONDS: 86400,
}));

vi.mock("@/lib/redis/auth-utils", () => ({
    verifyPlayerSession: vi.fn(() => Promise.resolve({ success: true })),
}));

describe("selectRole", () => {
    const gameId = "test-game-123";
    const userId = "user-456";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should successfully assign CREWMATE role to player", async () => {
        const mockState: GameState = {
            id: gameId,
            status: "IN_PROGRESS",
            players: [
                { id: userId, name: "Test Player", isAlive: true },
            ],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
        };

        const updatedState: GameState = {
            ...mockState,
            players: [
                { id: userId, name: "Test Player", isAlive: true, role: "CREWMATE" },
            ],
        };

        vi.mocked(redis.atomicUpdate).mockResolvedValue(updatedState);

        const result = await selectRole(gameId, userId, "CREWMATE");

        expect(result.success).toBe(true);
        expect(result.data?.role).toBe("CREWMATE");
        expect(redis.atomicUpdate).toHaveBeenCalledWith(
            `game:v2:${gameId}:state`,
            expect.any(Function),
            86400
        );
    });

    it("should successfully assign IMPOSTOR role to player", async () => {
        const mockState: GameState = {
            id: gameId,
            status: "IN_PROGRESS",
            players: [
                { id: userId, name: "Test Player", isAlive: true },
            ],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
        };

        const updatedState: GameState = {
            ...mockState,
            players: [
                { id: userId, name: "Test Player", isAlive: true, role: "IMPOSTOR" },
            ],
        };

        vi.mocked(redis.atomicUpdate).mockResolvedValue(updatedState);

        const result = await selectRole(gameId, userId, "IMPOSTOR");

        expect(result.success).toBe(true);
        expect(result.data?.role).toBe("IMPOSTOR");
    });

    it("should fail when game does not exist", async () => {
        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            const result = updater(null);
            return result;
        });

        const result = await selectRole(gameId, userId, "CREWMATE");

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.code).toBe(ERROR_CODES.GAME_NOT_FOUND);
    });

    it("should fail when game is not IN_PROGRESS", async () => {
        const mockState: GameState = {
            id: gameId,
            status: "LOBBY",
            players: [
                { id: userId, name: "Test Player", isAlive: true },
            ],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
        };

        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            const result = updater(mockState);
            return result;
        });

        const result = await selectRole(gameId, userId, "CREWMATE");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not in progress");
        expect(result.code).toBe(ERROR_CODES.ERR_INVALID_STATE);
    });

    it("should fail when player is not in the game", async () => {
        const mockState: GameState = {
            id: gameId,
            status: "IN_PROGRESS",
            players: [
                { id: "other-user", name: "Other Player", isAlive: true },
            ],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
        };

        vi.mocked(redis.atomicUpdate).mockImplementation(async (_key, updater) => {
            const result = updater(mockState);
            return result;
        });

        const result = await selectRole(gameId, userId, "CREWMATE");

        expect(result.success).toBe(false);
        expect(result.error).toContain("not found");
        expect(result.code).toBe(ERROR_CODES.ERR_INVALID_SIGNATURE);
    });

    it("should be idempotent - allow selecting same role twice", async () => {
        const mockState: GameState = {
            id: gameId,
            status: "IN_PROGRESS",
            players: [
                { id: userId, name: "Test Player", isAlive: true, role: "CREWMATE" },
            ],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
        };

        vi.mocked(redis.atomicUpdate).mockResolvedValue(mockState);

        const result = await selectRole(gameId, userId, "CREWMATE");

        expect(result.success).toBe(true);
        expect(result.data?.role).toBe("CREWMATE");
    });

    it("should allow changing role from CREWMATE to IMPOSTOR", async () => {
        const mockState: GameState = {
            id: gameId,
            status: "IN_PROGRESS",
            players: [
                { id: userId, name: "Test Player", isAlive: true, role: "CREWMATE" },
            ],
            createdAt: Date.now(),
            revision: 1,
            updatedAt: Date.now(),
        };

        const updatedState: GameState = {
            ...mockState,
            players: [
                { id: userId, name: "Test Player", isAlive: true, role: "IMPOSTOR" },
            ],
        };

        vi.mocked(redis.atomicUpdate).mockResolvedValue(updatedState);

        const result = await selectRole(gameId, userId, "IMPOSTOR");

        expect(result.success).toBe(true);
        expect(result.data?.role).toBe("IMPOSTOR");
    });

    it("should handle Redis connection errors", async () => {
        vi.mocked(redis.atomicUpdate).mockRejectedValue(new Error("Redis connection failed"));

        const result = await selectRole(gameId, userId, "CREWMATE");

        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
        expect(result.code).toBe(ERROR_CODES.ERR_SIGNAL_LOST);
    });

    it("should validate role value is valid", async () => {
        const result = await selectRole(gameId, userId, "INVALID_ROLE" as "CREWMATE" | "IMPOSTOR");

        expect(result.success).toBe(false);
        expect(result.error).toContain("Invalid role");
    });
});
